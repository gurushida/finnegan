#!/usr/bin/env python3

import argparse
import os
import queue
import sounddevice as sd
import vosk
import sys
import json
from enum import Enum


class Token(Enum):
    FINNEGAN = 'finnegan'
    NEW = 'new'
    GAME = 'game'
    PAUSE = 'pause'
    CONTINUE = 'continue'
    START = 'start'
    STOP = 'stop'
    SYSTEM = 'system'
    QUIT = 'quit'

    PLAYER = 'player'
    PLAYERS = 'players'
    SINGLE = 'single'
    ZERO = 'zero'
    ONE = 'one'
    TWO = 'two'
    THREE = 'three'
    FOUR = 'four'
    FIVE = 'five'
    SIX = 'six'
    SEVEN = 'seven'
    EIGHT = 'eight'
    NINE = 'nine'
    TEN = 'ten'
    ELEVEN = 'eleven'
    TWELVE = 'twelve'
    THIRTEEN = 'thirteen'
    FOURTEEN = 'fourteen'
    FIFTEEN = 'fifteen'
    SIXTEEN = 'sixteen'
    SEVENTEEN = 'seventeen'
    EIGHTEEN = 'eighteen'
    NINETEEN = 'nineteen'
    TWENTY = 'twenty'
    DOUBLE = 'double'
    TRIPLE = 'triple'
    BULLSEYE = 'bullseye'
    FIFTY = 'fifty'
    CORRECTION = 'correction'

# Vosk does a great job but sometimes it recognizes the wrong words
# Here are some alternate sequences found by trial and error
ALTERNATE_TOKENS = {
    Token.FINNEGAN: ['then again', 'in again', 'it again', 'philly damn', 'phil again', 'can again', 'finn again', 'he again',
                    'fun again'],
    Token.PAUSE: ['pose', 'post', 'posts', 'polls', 'both', 'foes'],
    Token.NEW: ['near'],
    Token.QUIT: ['quits'],
    Token.ZERO: ['the euro', 'hero'],
    Token.TWO: ['to'],
    Token.FOUR: ['for'],
    Token.TEN: ['town', 'down', 'turn'],
    Token.EIGHTEEN: ['eighty'],
    Token.NINETEEN: ['ninety'],
    Token.DOUBLE: ['doubled', 'dabbled', 'babel', 'the ball', 'the bowl', 'that will', 'they will', 'the old',
                   'the whole', 'devil', 'dublin', 'the will'],
    Token.TRIPLE: ['people', 'drupal', 'treble', 'dribble'],
    Token.BULLSEYE: ['bull\'s eye', 'bowles eye']
}


def readToken(speech_tokens, recognized_tokens):
    if len(speech_tokens) == 0:
        return False

    for token in Token:
        if speech_tokens[0] == token.value:
            recognized_tokens.append(token)
            speech_tokens.pop(0)
            return True

    # Let's try some additional sequences
    for token in ALTERNATE_TOKENS:
        sequences = ALTERNATE_TOKENS[token]
        for sequence in sequences:
            split_sequence = sequence.split()
            n = len(split_sequence)

            if split_sequence == speech_tokens[0:n]:
                recognized_tokens.append(token)
                del speech_tokens[:n]
                return True

    return False


def processText(text):
    """Analyzes the content of a speech chunk that was recognized
    to try to find commands in it"""
    if text == '':
        return

    print('Heard: "%s"' % text)
    speech_tokens = text.split()

    recognized_tokens = []
    while readToken(speech_tokens, recognized_tokens):
        pass

    if len(speech_tokens) > 0:
        # If we failed to analyze the entire input, we bail out
        return

    print('Recognized token: %s' % list(map(lambda t: t.value, recognized_tokens)))


#-----------------------------------------------------
# Below is the code adapted from the https://github.com/alphacep/vosk-api/blob/master/python/example/test_microphone.py
# exmaple program that listens from the microphone and feeds the
# processText function

q = queue.Queue()

def int_or_str(text):
    """Helper function for argument parsing."""
    try:
        return int(text)
    except ValueError:
        return text

def callback(indata, frames, time, status):
    """This is called (from a separate thread) for each audio block."""
    q.put(bytes(indata))

parser = argparse.ArgumentParser(add_help=False)
parser.add_argument(
    '-l', '--list-devices', action='store_true',
    help='show list of audio devices and exit')
args, remaining = parser.parse_known_args()
if args.list_devices:
    print(sd.query_devices())
    parser.exit(0)
parser = argparse.ArgumentParser(
    description=__doc__,
    formatter_class=argparse.RawDescriptionHelpFormatter,
    parents=[parser])
parser.add_argument(
    '-d', '--device', type=int_or_str,
    help='input device (numeric ID or substring)')
parser.add_argument(
    '-r', '--samplerate', type=int, help='sampling rate')
args = parser.parse_args(remaining)

try:
    args.model = "model"
    if args.samplerate is None:
        device_info = sd.query_devices(args.device, 'input')
        # soundfile expects an int, sounddevice provides a float:
        args.samplerate = int(device_info['default_samplerate'])

    model = vosk.Model(args.model)

    with sd.RawInputStream(samplerate=args.samplerate, blocksize = 8000, device=args.device, dtype='int16',
                            channels=1, callback=callback):
            rec = vosk.KaldiRecognizer(model, args.samplerate)
            while True:
                data = q.get()
                if rec.AcceptWaveform(data):
                    res = rec.Result()
                    obj = json.loads(res)
                    processText(obj['text'])

except KeyboardInterrupt:
    print('\nDone')
    parser.exit(0)
except Exception as e:
    parser.exit(type(e).__name__ + ': ' + str(e))

