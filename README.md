# finnegan

## What is it ?
This is a console application that is a voice-controlled dart scoring system for the 501 dart game.
You talk out loud to the program and it keeps track of the score for you ! And it is completely offline:
no data transmitted anywhere for processing !

Here is what it looks like when you start the program:
```
/-------------------------------------------------------\
|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |
\-------------------------------------------------------/

Say "guinness new game" to start or "guinness quit" to quit
```

If you say "guinness new game", you can then configure the difficulty and number of players:
```
/-------------------------------------------------------\
|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |
\-------------------------------------------------------/

Difficulty (change by saying what you want):
    "expert"   => must start and end with a double
    "medium"   => must end with a double
 => "easy"     => no restriction

Number of players (change by saying what you want):
     "1 player"
 =>  "2 players"
     "3 players"
     "4 players"
     "5 players"
     "6 players"
     "7 players"
     "8 players"
     "9 players"
    "10 players"

Say "guinness begin" to start the game
```

Once you begin the game, you tell the program what each dart has scored like "three", "double eighteen" or "zero"
if you missed the board and it keeps the score for you:
```
/-------------------------------------------------------\
|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |
\-------------------------------------------------------/

Easy mode - as long as you end up exactly at 0, you're good

    Player 1: 443
 => Player 2: 450

Dart 1: 51 (3x17)
Dart 2: 0 (-)
Dart 3:


Commands:

   "guinness correction"      => reset the darts for the current turn
   "guinness pause game"      => stop listening for inputs until the game is resumed
   "guinness continue game"   => resume listening for inputs
   "guinness stop game"       => stop the current game
   "guinness quit"            => quit the program

Reporting points:
   "fifty"                    => when you hit the bullseye
   "twenty five"              => when you hit the 25 point area around the bullseye
   "triple twelve"            => when you hit a number in its triple area
   "double twelve"            => when you hit a number in its double area
   "twelve"                   => when you hit a number in normal area
```


## Dependencies
To run this application, you need `python3` >= 3.6, `pip3` >= 10, `npm` and `node`.
On MacOS, you need to make sure the Terminal is allowed to access your microphone. 


## How to run it
Run `npm install` to install all the dependencies, then run `npm start` to start the application.


## How does it work ?
The application is divided in two programs. The python program `finnegan.py` does the speech
recognition part. Its looks for combinations of words that match the commands needed to play
the 501 game. It does so with some tolerance, since trial and error revealed some mis-recognitions
like for instance "for" instead of "four". Don't hesitate to tweak this program to adjust it to
what is recognized when you talk to it. The recognized commands are emitted on the standard output
with a `CMD:` prefix, and the unrecognized speech sequences are emitted with a `???:` prefix.
You can run this program standalone to see what it understands:
```
$ python3 finnegan.py 2> /dev/null
???:hello
CMD:twenty
CMD:double one
???:blah blah
CMD:guinness quit
```

The typescript program `finnegan.ts` is the actual scoring system. It reads the output of
`finnegan.py` to fetch the commands and manages the scores.


## Credits
* https://alphacephei.com/vosk/: the awesome library that provides the engine for doing voice recognition
