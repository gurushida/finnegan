# finnegan

## What is it ?
This is a console application that is a voice-controlled dart scoring system for the 501 dart game.
You talk out loud to the program and it keeps track of the score for you ! And it is completely offline:
no data transmitted anywhere for processing !

Here is what it looks like when you start the program for English:
```
/-------------------------------------------------------\
|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |
\-------------------------------------------------------/


********************************************
* Possible things to say:                  *
*                                          *
* "guinness new game"     Start a new game *
* "guinness quit"         Quit the program *
*                                          *
* "guinness french"       Play in French   *
********************************************
```

If you say "guinness new game", you can then configure the difficulty and number of players:
```
/-------------------------------------------------------\
|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |
\-------------------------------------------------------/

Difficulty:          easy
Number of players:   2

**********************************************************************
* Possible things to say:                                            *
*                                                                    *
* "guinness begin"      Start the game                               *
* "expert"              Each player must start and end with a double *
* "medium"              Each player must end with a double           *
* "easy"                No restriction                               *
* "one player"          1 player game                                *
* "two players"         2 players game                               *
* "three players"       3 players game                               *
* "four players"        4 players game                               *
* "five players"        5 players game                               *
* "six players"         6 players game                               *
* "seven players"       7 players game                               *
* "eight players"       8 players game                               *
* "nine players"        9 players game                               *
* "ten players"         10 players game                              *
* "guinness quit"       Quit the program                             *
*                                                                    *
* "guinness french"     Play in French                               *
**********************************************************************
```

Once you begin the game, you tell the program what each dart has scored like "three", "double eighteen" or "zero"
if you missed the board and it keeps the score for you:
```
/-------------------------------------------------------\
|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |
\-------------------------------------------------------/

Difficulty: easy

 => Player 1: 430
    Player 2: 501

Dart 1: T17
Dart 2:   0
Dart 3: D10


***********************************************************************************
* Possible things to say:                                                         *
*                                                                                 *
* "guinness quit"           Quit the program                                      *
* "guinness pause game"     Stop listening for commands until the game is resumed *
* "guinness stop game"      Stop the game                                         *
* "guinness correction"     Reset the current player's turn                       *
* "guinness next"           Move on the next player's turn                        *
*                                                                                 *
* "guinness french"         Play in French                                        *
***********************************************************************************
```


## Dependencies
To run this application, you need `python3` >= 3.6, `pip3` >= 10, and [deno](https://deno.land/#installation) >= 1.9.
On MacOS, you need to make sure the Terminal is allowed to access your microphone. 


## How to run it
Run `./install_dependencies.sh ` to install the dependencies, i.e. the python modules and data models needed
to run the speech recognition tool.

Then run `./finnegan en.json` to start playing in English.


## How does it work ?
The application is divided in two programs. The python program `fart.py` does the speech
recognition part and the typescript program `finnegan.ts` takes care of the dart scoring.

## The speech recognition part
`fart.py` is a generic tool that looks for patterns made of tokens, where each
token can be matched by several words like accepting "for" for the number "four".
The files `en.json` and `fr.json` contain the configurations needed to play
darts in English and French, which include a bit more that the pure speech
recognition configuration.

Have a look at the example file `vegetables_en.json` to see how you can make
your own configuration rules to do your own stuffs.

You can also have a look at the `search_with_your_voice.sh` script that does not
use any matching rules and works directly on the raw text output from the speech
recognition tool.

The patterns matched by the tool are emitted on the standard output with a `CMD:` prefix, and the
unrecognized speech sequences are emitted with a `???:` prefix.

## The scoring part

The typescript program `finnegan.ts` is the actual scoring system. It reads the output of
`fart.py` to fetch the commands and manages the scores.

And if you want to render the game state yourself, you can run the program with `--port <PORT>`
to start a web server that will respond with a json representation of the full game state
when doing a GET request on `http://localhost:<PORT>/state`

For example, if you start the program with `./finnegan --port 5000 501_en.json` and then
do `curl http://localhost:5000/state`, you will get something like this:

```json
{
  "language": "English",
  "state": "PLAYING",
  "turn": 0,
  "possibleThingsToSay": [
    {
      "command": "QUIT",
      "textToSay": "\"guinness quit\"",
      "description": "Quit the program"
    },
    {
      "command": "PAUSE_GAME",
      "textToSay": "\"guinness pause game\"",
      "description": "Stop listening for commands until the game is resumed"
    },
    {
      "command": "STOP_GAME",
      "textToSay": "\"guinness stop game\"",
      "description": "Stop the game"
    },
    {
      "command": "CORRECTION",
      "textToSay": "\"guinness correction\"",
      "description": "Reset the current player's turn"
    },
    {
      "command": "<score>",
      "textToSay": "<score>",
      "description": "Report a score like \"seventeen\" or \"double six\""
    }
  ],
  "alternativeLanguages": {
    "\"guinness french\"": "Play in French"
  },
  "difficulty": "easy",
  "playerStatuses": [
    {
      "score": 441,
      "needADoubleToStart": false,
      "dartsPlayed": [
        [
          {
            "baseValue": 20,
            "multiplier": 3,
            "status": "OK"
          }
        ]
      ]
    },
    {
      "score": 501,
      "needADoubleToStart": false,
      "dartsPlayed": []
    }
  ],
  "currentPlayer": 0
}
```

As you can see, the game state description also contains everything, including a description of the voice commands
that can be used in the current game state. You can find details about the game state by looking at the
types defined in `types.ts`.



## Credits
* https://alphacephei.com/vosk/: the awesome library that provides the engine for doing voice recognition
