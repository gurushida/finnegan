#!/usr/bin/env python3

# Finnegan Audio Recognition Tool
import argparse
import os
import queue
import sounddevice as sd
import vosk
import sys
import json

from vosk import SetLogLevel

# Given an array of strings as input and a dictionary such as
# the ones created by prepareData(), this function looks for
# the longest match (in number of input tokens) it can find. It then returns
# a tuple (n, token) where n is the number of input array cells
# that have been involved in the match and token is the result string.
#
# For instance if we have the following values in tokenData:
#
# "GUINNESS" => [["guinness"], ["get", "us"], ["give", "us"]]
# "NEW"      => [["new"], ["near"], ["you"], ["your"]]
#
# then trying to parse ["get", "us", "start"] will return (2, "GUINNESS").
# The function returns None if no match is found.
#
# With the longest match rule:, if you can recognize both "twenty" and "twenty five",
# then if the input starts with "twenty five" it will give precendence to "twenty five"
# over "twenty".
def tryToParseToken(inputTokens, tokenData):
    if len(inputTokens) == 0:
        return None

    bestResult = None;
    for token in tokenData:
        for alternative in tokenData[token]:
            n = len(alternative)
            if alternative == inputTokens[0:n]:
                if bestResult is None or n > bestResult[0]:
                    bestResult = (n, token)

    return bestResult


# Given an array of strings as input and a dictionary such as
# the ones created by prepareData(), this function
# tries to converts the entire input into tokens.
# It returns an array containing the identified tokens on success
# and None otherwise.
def tryToParseInput(input, tokenData):
    if len(input) == 0:
        return None

    toParse = input.copy()
    recognizedTokens = []
    while (res := tryToParseToken(toParse, tokenData)) != None:
        del toParse[:res[0]]
        recognizedTokens.append(res[1])

    if len(toParse) > 0:
        # If we did not consume of the input tokens, let's return an empty array
        return None

    return recognizedTokens


# Given a string containing the text as identified by the vosk API,
# this function splits it on spaces and tries to convert it first into
# an array of tokens. If this succeeds, it then tries to parse this
# token array to find a pattern. On success, it returns an array
# representing the patterns that were identified; returns None otherwise.
#
# For instance, with the following tokenData:
#
# "GUINNESS" => [["guinness"], ["get", "us"], ["give", "us"]]
# "NEW"      => [["new"], ["near"], ["you"], ["your"]]
# "GAME"     => [["game"]]
# "BEGIN"    => [["begin"]]
#
# and the patternData:
#
# "NEW_GAME"   => [["GUINNESS", "NEW", "GAME"]]
# "BEGIN_GAME" => [["BEGIN"]]
#
# the string "get us new game begin" would produce ["NEW_GAME", "BEGIN_GAME"]
def tryToParsePatterns(textGivenByVosk, tokenData, patternData):
    if len(textGivenByVosk) == 0:
        return None

    toParse = textGivenByVosk.split()
    tokens = tryToParseInput(toParse, tokenData)
    if tokens is None:
        return None

    return tryToParseInput(tokens, patternData)



# Given a dictionary built from a json data structrure like:
#
#    {
#        "GUINNESS": ["guinness", "get us", "give us"],
#        "NEW": ["new", "near", "you", "your"],
#    }
#
# this function returns a dictionary where each key is associated to an array of
# of arrays obtained by splitting the values on spaces:
#
# "GUINNESS" => [["guinness"], ["get", "us"], ["give", "us"]]
# "NEW"      => [["new"], ["near"], ["you"], ["your"]]
#
def prepareData(dict):
    data = {}
    for key in dict:
        alternatives = []
        for alternative in dict[key]:
            alternatives.append(alternative.split())
        data[key] = alternatives
    return data

#-----------------------------------------------------
# Below is the code adapted from the https://github.com/alphacep/vosk-api/blob/master/python/example/test_microphone.py
# example program that listens from the microphone and feeds the tryToParsePatterns function

q = queue.Queue()

def int_or_str(text):
    try:
        return int(text)
    except ValueError:
        return text


def callback(indata, frames, time, status):
    q.put(bytes(indata))


def printUsage():
    print("Usage: python3 fart.py [OPTIONS]")
    print()
    print('-l / --list-devices           Print the available audio devices and exit')
    print('-d DEV / --device DEV         Listen from the audio device DEV')
    print('-r RATE / --samplerate RATE   Define the sampling rate to use')
    print()
    print('<config>                      A json configuration file that describes the speech')
    print('                              recognition model to use, the symbolic tokens to recognize')
    print('                              (like associating both "your" and "you\'re" to a symbolic token')
    print('                              "YOUR"), and the token combinations to recognize (like associating')
    print('                              2 symbolic tokens "YOUR" and "TURN" to the symbol "YOUR_TURN"')
    print()


# Let's silence the debug logs from vosk
SetLogLevel(-1)

args = sys.argv[1:]

if len(args) == 0:
    printUsage()
    exit(0)

configFile = None
device = None
samplerate = None

while len(args) > 0:
    arg = args.pop(0)

    if arg == '-l' or arg == '--list-devices':
        print(sd.query_devices())
        exit(0)

    if arg == '-d' or arg == '--device':
        if len(args) == 0:
            printUsage()
            exit(1)
        device = int_or_str(args.pop(0))
        continue

    if arg == '-r' or arg == '--samplerate':
        if len(args) == 0:
            printUsage()
            exit(1)
        samplerate = int_or_str(args.pop(0))
        continue

    configFile = arg


if configFile is None:
    printUsage()
    exit(0)

with open(configFile, 'r') as myfile:
    data = myfile.read()

config = json.loads(data)
tokenData = prepareData(config['tokens'])
patternData = prepareData(config['patterns'])

if samplerate is None:
    device_info = sd.query_devices(device, 'input')
    # soundfile expects an int, sounddevice provides a float:
    samplerate = int(device_info['default_samplerate'])

model = vosk.Model(config['vosk_model_path'])

with sd.RawInputStream(samplerate=samplerate, blocksize = 8000, device=device, dtype='int16',
                            channels=1, callback=callback):
    rec = vosk.KaldiRecognizer(model, samplerate)
    while True:
        data = q.get()
        if rec.AcceptWaveform(data):
            res = rec.Result()
            obj = json.loads(res)
            text = obj['text']
            if len(text) > 0:
                patterns = tryToParsePatterns(text, tokenData, patternData)
                if patterns is None:
                    print('???:%s' % text)
                else:
                    for pattern in patterns:
                        print('CMD:%s' % pattern)

