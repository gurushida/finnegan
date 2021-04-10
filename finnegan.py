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
    BEGIN = 'begin'
    STOP = 'stop'
    QUIT = 'quit'
    NEXT = 'next'
    CORRECTION = 'correction'
    YES = 'yes'
    NO = 'no'

    EXPERT = 'expert'
    MEDIUM = 'medium'
    EASY = 'easy'

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

# Vosk does a great job but sometimes it recognizes the wrong words
# Here are some alternate sequences found by trial and error
ALTERNATE_TOKENS = {
    Token.FINNEGAN: ['then again', 'in again', 'it again', 'philly damn', 'phil again', 'can again', 'finn again', 'he again',
                    'fun again', 'filling and', 'seen again', 'and again', 'she again'],
    Token.PAUSE: ['pose', 'post', 'posts', 'polls', 'both', 'foes'],
    Token.NEW: ['near'],
    Token.QUIT: ['quits'],
    Token.EXPERT: ['expect', 'expects', 'experts', 'expense'],
    Token.MEDIUM: ['median'],
    Token.EASY: ['he\'s he'],
    Token.ZERO: ['the euro', 'hero'],
    Token.TWO: ['to'],
    Token.FOUR: ['for'],
    Token.TEN: ['town', 'down', 'turn'],
    Token.EIGHTEEN: ['eighty'],
    Token.NINETEEN: ['ninety'],
    Token.FIFTY: ['shifty'],
    Token.DOUBLE: ['doubled', 'dabbled', 'babel', 'the ball', 'the bowl', 'that will', 'they will', 'the old',
                   'the whole', 'devil', 'dublin', 'the will'],
    Token.TRIPLE: ['people', 'drupal', 'treble', 'dribble'],
    Token.BULLSEYE: ['bull\'s eye', 'bowles eye']
}


class Command(Enum):
    FINNEGAN_NEW_GAME = 'finnegan new game'
    BEGIN = 'begin'
    NEXT = 'next'
    FINNEGAN_STOP_GAME = 'finnegan stop game'
    FINNEGAN_PAUSE_GAME = 'finnegan pause game'
    FINNEGAN_CONTINUE_GAME = 'finnegan continue game'
    FINNEGAN_QUIT = 'finnegan quit'
    FINNEGAN_CORRECTION = 'finnegan correction'

    EXPERT = 'expert'
    MEDIUM = 'medium'
    EASY = 'easy'

    YES = 'yes'
    NO = 'no'

    ONE_PLAYER = 'one player'
    TWO_PLAYERS = 'two players'
    THREE_PLAYERS = 'three players'
    FOUR_PLAYERS = 'four players'
    FIVE_PLAYERS = 'five players'
    SIX_PLAYERS = 'six players'
    SEVEN_PLAYERS = 'seven players'
    EIGHT_PLAYERS = 'eight players'
    NINE_PLAYERS = 'nine players'
    TEN_PLAYERS = 'ten players'

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
    TWENTY_FIVE = 'twenty five'
    FIFTY = 'fifty'

    DOUBLE_ONE = 'double one'
    DOUBLE_TWO = 'double two'
    DOUBLE_THREE = 'double three'
    DOUBLE_FOUR = 'double four'
    DOUBLE_FIVE = 'double five'
    DOUBLE_SIX = 'double six'
    DOUBLE_SEVEN = 'double seven'
    DOUBLE_EIGHT = 'double eight'
    DOUBLE_NINE = 'double nine'
    DOUBLE_TEN = 'double ten'
    DOUBLE_ELEVEN = 'double eleven'
    DOUBLE_TWELVE = 'double twelve'
    DOUBLE_THIRTEEN = 'double thirteen'
    DOUBLE_FOURTEEN = 'double fourteen'
    DOUBLE_FIFTEEN = 'double fifteen'
    DOUBLE_SIXTEEN = 'double sixteen'
    DOUBLE_SEVENTEEN = 'double seventeen'
    DOUBLE_EIGHTEEN = 'double eighteen'
    DOUBLE_NINETEEN = 'double nineteen'
    DOUBLE_TWENTY = 'double twenty'

    TRIPLE_ONE = 'triple one'
    TRIPLE_TWO = 'triple two'
    TRIPLE_THREE = 'triple three'
    TRIPLE_FOUR = 'triple four'
    TRIPLE_FIVE = 'triple five'
    TRIPLE_SIX = 'triple six'
    TRIPLE_SEVEN = 'triple seven'
    TRIPLE_EIGHT = 'triple eight'
    TRIPLE_NINE = 'triple nine'
    TRIPLE_TEN = 'triple ten'
    TRIPLE_ELEVEN = 'triple eleven'
    TRIPLE_TWELVE = 'triple twelve'
    TRIPLE_THIRTEEN = 'triple thirteen'
    TRIPLE_FOURTEEN = 'triple fourteen'
    TRIPLE_FIFTEEN = 'triple fifteen'
    TRIPLE_SIXTEEN = 'triple sixteen'
    TRIPLE_SEVENTEEN = 'triple seventeen'
    TRIPLE_EIGHTEEN = 'triple eighteen'
    TRIPLE_NINETEEN = 'triple nineteen'
    TRIPLE_TWENTY = 'triple twenty'


ALTERNATE_COMMANDS = {
    Command.ONE_PLAYER: ['single player'],
    Command.FIFTY: ['bullseye'],
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


def readCommand(recognized_tokens, recognized_commands):
    if len(recognized_tokens) == 0:
        return False

    for command in Command:
        possible_sequences = [command.value]
        if command in ALTERNATE_COMMANDS:
            possible_sequences += ALTERNATE_COMMANDS[command]
        for sequence in possible_sequences:
            split_sequence = sequence.split()
            n = len(split_sequence)
            if split_sequence == recognized_tokens[0:n]:
                recognized_commands.append(command)
                del recognized_tokens[:n]
                return True

    return False



def processText(text):
    """Analyzes the content of a speech chunk that was recognized
    to try to find commands in it"""
    if text == '':
        return

    speech_tokens = text.split()

    recognized_tokens = []
    while readToken(speech_tokens, recognized_tokens):
        pass

    if len(speech_tokens) > 0:
        # If we failed to analyze the entire input, we bail out
        print("???:%s" % text)
        return

    token_sequence = list(map(lambda t: t.value, recognized_tokens))

    recognized_commands = []
    while readCommand(token_sequence, recognized_commands):
        pass

    if len(token_sequence) > 0:
        # If we failed to analyze the entire token sequence, we bail out
        print("???:%s" % text)
        return

    commands = list(map(lambda t: t.value, recognized_commands))
    for command in commands:
        print("CMD:%s" % command)



#-----------------------------------------------------
# Below is the code adapted from the https://github.com/alphacep/vosk-api/blob/master/python/example/test_microphone.py
# example program that listens from the microphone and feeds the processText function

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

