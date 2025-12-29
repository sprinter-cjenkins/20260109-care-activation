#
# Copyright (c) 2024–2025, Daily
#
# SPDX-License-Identifier: BSD 2-Clause License
#

"""Daily + Twilio SIP dial-out voice bot implementation."""

import os
import asyncio
from typing import Any, Optional

from dotenv import load_dotenv
from loguru import logger
from pydantic import BaseModel

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.runner.types import RunnerArguments
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.deepgram.flux.stt import DeepgramFluxSTTService
from pipecat.transports.daily.transport import DailyParams, DailyTransport
from pipecat.observers.loggers.user_bot_latency_log_observer import UserBotLatencyLogObserver
from pipecat.processors.frameworks.rtvi import RTVIProcessor
from pipecat.services.google.llm import GoogleLLMService


load_dotenv(override=True)

class Edge(BaseModel):
    target_id: str
    condition: str

class Node(BaseModel):
    id: str
    name: Optional[str] = None
    prompt: Optional[str] = None
    text: Optional[str] = None

class Segment(BaseModel):
    node: Node
    edges: list[Edge]

class Pathway(BaseModel):
    voicemail_message: str
    global_prompt: str
    segments: list[Segment]

class DialoutSettings(BaseModel):
    """Settings for outbound call.

    Attributes:
        sip_uri: The SIP URI to dial
    """

    sip_uri: str
    pathway: Pathway
    # Include any custom data here needed for the call


class AgentRequest(BaseModel):
    """Request data sent to bot start endpoint.

    Attributes:
        room_url: Daily room URL for the bot to join
        token: Authentication token for the Daily room
        dialout_settings: Settings for the outbound call
    """

    room_url: str
    token: str
    dialout_settings: DialoutSettings
    # Include any custom data here needed for the agent


class DialoutManager:
    """Manages dialout attempts with retry logic.

    Handles the complexity of initiating outbound calls with automatic retry
    on failure, up to a configurable maximum number of attempts.

    Args:
        transport: The Daily transport instance for making the dialout
        dialout_settings: Settings containing SIP URI
        max_retries: Maximum number of dialout attempts (default: 5)
    """

    def __init__(
        self,
        transport: DailyTransport,
        dialout_settings: DialoutSettings,
        max_retries: Optional[int] = 5,
    ):
        self._transport = transport
        self._sip_uri = dialout_settings.sip_uri
        self._pathway = dialout_settings.pathway
        self._max_retries = max_retries
        self._attempt_count = 0
        self._is_successful = False

    async def attempt_dialout(self) -> bool:
        """Attempt to start a dialout call.

        Initiates an outbound call if retry limit hasn't been reached and
        no successful connection has been made yet.

        Returns:
            True if dialout attempt was initiated, False if max retries reached
            or call already successful
        """
        if self._attempt_count >= self._max_retries:
            logger.error(
                f"Maximum retry attempts ({self._max_retries}) reached. Giving up on dialout."
            )
            return False

        if self._is_successful:
            logger.debug("Dialout already successful, skipping attempt")
            return False

        self._attempt_count += 1
        logger.info(
            f"Attempting dialout (attempt {self._attempt_count}/{self._max_retries}) to: {self._sip_uri}"
        )

        await self._transport.start_dialout({"sipUri": self._sip_uri})
        return True

    def mark_successful(self):
        """Mark the dialout as successful to prevent further retry attempts."""
        self._is_successful = True

    def should_retry(self) -> bool:
        """Check if another dialout attempt should be made.

        Returns:
            True if retry limit not reached and call not yet successful
        """
        return self._attempt_count < self._max_retries and not self._is_successful


async def run_bot(
    transport: DailyTransport, dialout_settings: DialoutSettings, handle_sigint: bool
) -> None:
    """Run the voice bot with the given parameters.

    Args:
        transport: The Daily transport instance
        dialout_settings: Settings containing SIP URI for dialout
    """
    logger.info(f"Starting dial-out bot, dialing out to: {dialout_settings.sip_uri}")

    rtvi = RTVIProcessor()

    stt = DeepgramFluxSTTService(
        sample_rate=8000,
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        params=DeepgramFluxSTTService.InputParams(eager_eot_threshold=0.5),
    )
    # llm = OpenAILLMService(model="gpt-4.1-nano", service_tier="priority",api_key=os.getenv("OPENAI_API_KEY"))
    llm = GoogleLLMService(api_key=os.getenv("GEMINI_API_KEY"), model="gemini-2.5-flash-lite")

    tts = DeepgramTTSService(sample_rate=8000,api_key=os.getenv("DEEPGRAM_API_KEY"), voice="aura-2-andromeda-en")

    # Create system message and initialize messages list
    messages = [
        {
            "role": "system",
            "content": dialout_settings.pathway.global_prompt,
        },
    ]

    context = LLMContext(messages)
    context_aggregator = LLMContextAggregatorPair(context)

    # Build pipeline
    pipeline = Pipeline(
        [
            transport.input(),  # Transport user input
            rtvi,
            stt,
            context_aggregator.user(),  # User responses
            llm,  # LLM
            tts,  # TTS
            transport.output(),  # Transport bot output
            context_aggregator.assistant(),  # Assistant spoken responses
        ]
    )

    # Create pipeline task
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
            allow_interruptions=True,
            audio_in_sample_rate=8000,
            audio_out_sample_rate=8000,
            observers=[UserBotLatencyLogObserver()],
        ),
        
    )

    # Initialize dialout manager
    dialout_manager = DialoutManager(transport, dialout_settings)

    @transport.event_handler("on_joined")
    async def on_joined(transport, data):
        await dialout_manager.attempt_dialout()

    @transport.event_handler("on_dialout_answered")
    async def on_dialout_answered(transport, data):
        logger.debug(f"Dial-out answered: {data}")
        dialout_manager.mark_successful()

    @transport.event_handler("on_dialout_error")
    async def on_dialout_error(transport, data: Any):
        logger.error(f"Dial-out error, retrying: {data}")

        if dialout_manager.should_retry():
            await dialout_manager.attempt_dialout()
        else:
            logger.error(f"No more retries allowed, stopping bot.")
            await task.cancel()

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected")
        await task.cancel()

    @transport.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        logger.info(f"Client Ready")
        await rtvi.set_bot_ready()

    runner = PipelineRunner(handle_sigint=handle_sigint)

    await runner.run(task)

async def bot(runner_args: RunnerArguments):
    """Main bot entry point compatible with Pipecat Cloud."""
    try:
        request = AgentRequest.model_validate(runner_args.body)
        
        # mixer = SoundfileMixer(
        #     sound_files={"background": "sounds/background.wav"},
        #     default_sound="background",
        #     volume=0.2,
        #     loop=True,
        #     mixing=True
        # )

        transport = DailyTransport(
            request.room_url,
            request.token,
            "SIP Dial-out Bot",
            params=DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
                # turn_analyzer=LocalSmartTurnAnalyzerV3(),
                # audio_out_mixer=mixer,
            ),
        )

        await run_bot(transport, request.dialout_settings, runner_args.handle_sigint)

    except Exception as e:
        logger.error(f"Error running bot: {e}")
        raise e


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()