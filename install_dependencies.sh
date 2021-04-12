#!/bin/bash

# This is the library that performs the voice recognition
pip3 install vosk

# This is the library used to listen from audio input devices
pip3 install sounddevice

# This is the data model used to recognize English speech
curl https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o vosk-model-small-en-us-0.15.zip

# This is the data model used to recognize French speech
curl https://alphacephei.com/vosk/models/vosk-model-small-fr-pguyot-0.3.zip -o vosk-model-small-fr-pguyot-0.3.zip

rm -rf vosk-model-small-en-us-0.15 vosk-model-small-fr-pguyot-0.3
unzip vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-fr-pguyot-0.3.zip

rm vosk-model-small-en-us-0.15.zip vosk-model-small-fr-pguyot-0.3.zip
