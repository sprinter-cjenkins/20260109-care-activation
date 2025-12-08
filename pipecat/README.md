# Pipecat bot

Uses:

- Twilio for SIP connection
- Daily for the conference room stuff
- pipecat cloud for hosting the bot and WebRTC connection (might change)
- right now deepgram + gemini has been working the best for me but things will probably change

## setup and installation

- we're using python 3.13.0 because its the one that is compatible with the ONNX we're using

```
brew install pyenv
pyenv install 3.13.0
pyenv local 3.13.0
uv sync
```

### make VS Code play nice with a python subdirectory..

```
cmd + shift + P -> Python: Select Interpreter
```

Select the .venv one in ./pipecat

## Compile and run

```
pipecat cloud auth login
yes | pipecat cloud docker build-push && yes | yes | pipecat cloud deploy

```

## funky stuff

- pipecat cloud grabs from a private docker container in docker hub
- pipecat cloud in general is probably a temp fix but we gotta serve this container close to the webrtc system somehow
- in general all of this is a lil rough around the edges cuz I'm getting used to it and just python in general lol

```

```
