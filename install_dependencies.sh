#!/bin/bash

# This is the library that performs the voice recognition
pip3 install vosk

# This is the data model used to recognize English speech
curl https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o vosk-model-small-en-us-0.15.zip

unzip vosk-model-small-en-us-0.15.zip

rm -rf model
mv vosk-model-small-en-us-0.15 model
rm vosk-model-small-en-us-0.15.zip
