import { LoggerNoPHI } from '#logger/logger';
import { Injectable } from '@nestjs/common';
import { CallerProvider, CallInitiationRequest, CallResult } from './caller-provider';
import { getPatientPhoneNumber } from '#patient/utils';
import { v4 } from 'uuid';
import buildPipecatPathway from '#src/pathway/providers/pipecat/buildPipecatPathway';
import { PATHWAY_FOR_CARE_TASK_TYPE } from '#src/pathway/pathways';

const DEVELOPMENT_SIP_URL = 'sprinterhealthdev.sip.twilio.com';

@Injectable()
export class PipecatCallerProvider implements CallerProvider {
  name: string = 'pipecat';

  private readonly dailyAPIURL = 'https://api.daily.co/v1';
  private readonly pipecatAPIURL = 'https://api.pipecat.daily.co/v1/public/';

  private readonly logger: LoggerNoPHI;

  constructor(logger: LoggerNoPHI) {
    this.logger = logger;
  }

  async initiateCall(request: CallInitiationRequest): Promise<CallResult> {
    const dailyAPIKey = process.env.DAILY_API_KEY;
    if (dailyAPIKey == null) {
      throw new Error('DAILY_API_KEY environment variable not set');
    }
    const pipecatAPIKey = process.env.PIPECAT_API_KEY;
    if (pipecatAPIKey == null) {
      throw new Error('PIPECAT_API_KEY environment variable not set');
    }
    const pipecatAgentName = process.env.PIPECAT_AGENT_NAME;
    if (pipecatAgentName == null) {
      throw new Error('PIPECAT_AGENT_NAME environment variable not set');
    }

    const { patient, careTaskType } = request;
    const phoneNumber = getPatientPhoneNumber(patient);
    const sipURI = `sip:${phoneNumber}@${DEVELOPMENT_SIP_URL}`;
    const roomName = `pipecat-sip-${v4()}`;
    const exp = new Date().getTime() / 1000 + 2 * 60 * 60; // expires in 2 hours

    try {
      // start daily room
      const createDailyRoomResponse = await fetch(`${this.dailyAPIURL}/rooms`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dailyAPIKey}`,
        },
        body: JSON.stringify({
          name: roomName,
          properties: {
            exp,
            enable_dialout: true,
            start_video_off: true,
            sip: {
              display_name: phoneNumber,
              video: false,
              sip_mode: 'dial-in',
              num_endpoints: 1,
            },
          },
        }),
      });

      const createDailyRoomResponseObject = (await createDailyRoomResponse.json()) as {
        url: string;
      };

      // get a "token" for the daily room
      const createMeetingTokenResponse = await fetch(`${this.dailyAPIURL}/meeting-tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dailyAPIKey}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            exp,
            is_owner: true,
          },
        }),
      });

      const createMeetingTokenResponseObject = (await createMeetingTokenResponse.json()) as {
        token: string;
      };
      const pathway = buildPipecatPathway(PATHWAY_FOR_CARE_TASK_TYPE[careTaskType]);
      console.log('pathway', JSON.stringify(pathway).length);
      // pipecat agent start
      await fetch(`${this.pipecatAPIURL}/${pipecatAgentName}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pipecatAPIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createDailyRoom: false, // we got all silly with it to get SIP with twilio to work
          body: {
            room_url: createDailyRoomResponseObject.url,
            token: createMeetingTokenResponseObject.token,
            dialout_settings: {
              sip_uri: sipURI,
              pathway,
            },
          },
        }),
      });

      return {
        status: 'initiated',
        callID: roomName,
      };
    } catch (error) {
      throw new Error(
        `Failed to initiate call: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getCall(callID: string): Promise<CallResult> {
    // TODO
    return new Promise(() => ({ callID, status: 'failed' }));
  }

  parseWebhook(): Promise<CallResult | null> {
    // TODO
    return new Promise(() => ({ callID: '', status: 'failed' }));
  }
}
