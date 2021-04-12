import * as child from 'child_process';
import readline from 'readline';
import { exit } from 'process';
import { readFileSync } from 'fs';
import { GameEvent, Answer, isVoiceCommand, DartPlayed, PlayerStatus, DartMultiplier,
    DartBaseValue, N_DARTS_PER_TURN, GameState, PlayingState, PossibleCommand, VoiceCommand, FartConfig, voiceCommands, Difficulty, State, ValuelessGameState } from './types';

const BLANK_STATE: ValuelessGameState = {
    state: 'NOT_PLAYING',
    possibleThingsToSay: [],
};


let game: GameState = BLANK_STATE;

let playerStatusesLastRound: PlayerStatus[] = [];
let lastNumberOfPlayers = 2;
let lastDifficulty: Difficulty = 'easy';
let config: FartConfig;
let voiceCommand2Text: Partial<Record<VoiceCommand, string>> = {};


/**
 * For each command, we look for the first token sequence, and
 * for each token, we take the first text sequence.
 */
function populateVoiceCommandMap() {
    voiceCommand2Text = {};
    for (const cmd of voiceCommands) {
        const tokenSequence = config.patterns[cmd];
        if (!tokenSequence) {
            console.error(`Missing command ${cmd} in configuration file !`);
            exit(1);
        }

        const result: string [] = [];

        for (const token of tokenSequence[0].split(' ')) {
            const alternative = config.tokens[token];
            if (!alternative) {
                console.error(`Missing token ${token} for command ${cmd} in configuration file !`);
                exit(1);
            }
            result.push(alternative[0]);
        }

        voiceCommand2Text[cmd] = result.join(' ');
    }
}


async function startGameEngine(args: ParsedArguments) {
    const rawdata = readFileSync('speech_recognition_config_en.json');
    config = JSON.parse(rawdata.toString());
    populateVoiceCommandMap();

    const fartArgs = ['-u', 'fart.py', 'speech_recognition_config_en.json'];

    if (args.device) {
        fartArgs.push('-d', args.device);
    }

    if (args.samplerate) {
        fartArgs.push('-r', args.samplerate);
    }

    lastDifficulty = parsed.difficulty;
    lastNumberOfPlayers = parsed.players

    const p = child.spawn('python3', fartArgs, { stdio: ['ignore', 'pipe', 'ignore'] });
    const stdoutLineReader = readline.createInterface({input: p.stdout});
    stdoutLineReader.on('line', (line: string) => {
        if (line.startsWith('???:')) {
            render();
            processUnrecognizedInput(line.substring(4));
        } else if (line.startsWith('CMD:')) {
            processCommand(line.substring(4));
            updatePossibleThingsToSay();
            render();
        }
    });
    updatePossibleThingsToSay();
    render();
}


function printQuitConfirmationMessage() {
    console.log();
    console.log('Are you sure you want to quit the program ?');
}


function getVocalCommand(cmd: PossibleCommand): string {
    if (cmd === '<score>') return cmd;
    return `"${voiceCommand2Text[cmd] as string}"`;
}


function getCommandDescription(cmd: PossibleCommand): string {
    switch (cmd) {
        case 'NEW_GAME': return 'Start a new game';

        case 'SET_DIFFICULTY_EXPERT': return 'Each player must start and end with a double';
        case 'SET_DIFFICULTY_MEDIUM': return 'Each player must end with a double';
        case 'SET_DIFFICULTY_EASY': return 'No restriction';

        case 'SET_PLAYER_COUNT_1': return '1 player game';
        case 'SET_PLAYER_COUNT_2': return '2 players game';
        case 'SET_PLAYER_COUNT_3': return '3 players game';
        case 'SET_PLAYER_COUNT_4': return '4 players game';
        case 'SET_PLAYER_COUNT_5': return '5 players game';
        case 'SET_PLAYER_COUNT_6': return '6 players game';
        case 'SET_PLAYER_COUNT_7': return '7 players game';
        case 'SET_PLAYER_COUNT_8': return '8 players game';
        case 'SET_PLAYER_COUNT_9': return '9 players game';
        case 'SET_PLAYER_COUNT_10': return '10 players game';

        case 'ANSWER_YES': return game.state === 'WAITING_STOP_GAME_CONFIRMATION' ? 'Stop the game' : 'Quit the program';
        case 'ANSWER_NO': return 'Stay';

        case 'START_GAME': return 'Start the game';
        case 'STOP_GAME': return 'Stop the current game';
        case 'PAUSE_GAME': return 'Stop listening for commands until the game is resumed';
        case 'CONTINUE_GAME': return 'Resume listening for commands';
        case 'QUIT': return 'Quit the program';
        case 'CORRECTION': return 'Reset the current player\'s turn';
        case 'NEXT_TURN': return 'Move on the next player\'s turn';
        case '<score>': return `Report a score like "${voiceCommand2Text['SCORE_1x17']}" or "${voiceCommand2Text['SCORE_2x6']}"`;
    }
}

function printPossibleCommands() {
    const maxLen = Math.max(...(game.possibleThingsToSay.map(p => p.textToSay.length)));
    const commandLines: string [] = ['Possible things to say:', ''];
    for (const command of game.possibleThingsToSay) {
        commandLines.push(`${command.textToSay.padEnd(maxLen)}     ${command.description}`);
    }

    const maxLineLen = Math.max(...(commandLines.map(line => line.length)));
    console.log(''.padStart(maxLineLen + 4, '*'));
    for (const line of commandLines) {
        console.log(`* ${line.padEnd(maxLineLen)} *`);
    }
    console.log(''.padStart(maxLineLen + 4, '*'));
}


function updatePossibleThingsToSay() {
    const possibleCommands = getPossibleCommands(game.state);
    console.log(possibleCommands);
    game.possibleThingsToSay = [];
    for (const command of possibleCommands) {
        game.possibleThingsToSay.push({
            command,
            textToSay: getVocalCommand(command),
            description: getCommandDescription(command)
        });
    }
}


function render() {
    // Clear screen
    console.log('\u001b[2J');
    // Move to line 0, column 0
    console.log('\u001b[0;0H');

    console.log('/-------------------------------------------------------\\');
    console.log('|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |');
    console.log('\\-------------------------------------------------------/');
    console.log();

    switch(game.state) {
        case 'NOT_PLAYING': {
            break;
        }
        case 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING': {
            printQuitConfirmationMessage();
            break;
        }
        case 'WAITING_FOR_START':
        case 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START': {
            console.log(`Difficulty:          ${game.difficulty}`);
            console.log(`Number of players:   ${game.numberOfPlayers}`);
            break;
        }
        default: {
            printScoreBoard(game);
            if (game.state === 'GAME_PAUSED') {
                console.log();
                console.log(' < Game paused >');
                break;
            }
            if (game.state === 'GAME_WON' || game.state === 'WAITING_QUIT_CONFIRMATION__GAME_WON') {
                console.log();
                console.log(`${game.playerStatuses[game.currentPlayer].name} won !`);
                if (game.state === 'WAITING_QUIT_CONFIRMATION__GAME_WON') {
                    printQuitConfirmationMessage();
                }
                break;
            }
            if (game.state === 'WAITING_QUIT_CONFIRMATION__PLAYING') {
                printQuitConfirmationMessage();
                break;
            }
            if (game.state === 'WAITING_STOP_GAME_CONFIRMATION') {
                console.log();
                console.log('Are you sure you want to stop the current game ?');
                break;
            }
        }
    }

    console.log();
    printPossibleCommands();
}


function getDartDescription(dart: DartPlayed) {
    if (dart.multiplier === 0) {
        return '-';
    }
    if (getDartScore(dart) === 50) {
        return '50';
    }
    if (dart.baseValue === 25) {
        return '25';
    }
    return `${dart.multiplier} x ${dart.baseValue}`;
}


function printScoreBoard(g: PlayingState) {
    console.log(`Difficulty: ${g.difficulty}`);
    console.log();

    for (let i = 0 ; i < g.playerStatuses.length ; i++) {
        const cur = i === g.currentPlayer;
        console.log(`${cur ? ' => ' : '    '}${g.playerStatuses[i].name}: ${g.playerStatuses[i].score}`);
    }

    console.log();
    if (g.state === 'PLAYING') {
        if (g.playerStatuses[g.currentPlayer].needADoubleToStart) {
            console.log(`${g.playerStatuses[g.currentPlayer].name} need a double to start`);
        }
        for (let i = 0 ; i < g.dartsPlayed.length ; i++) {
            const dart = g.dartsPlayed[i];
            console.log(`Dart ${i + 1}: ${isIgnored(dart) ? 'ignored' : getDartScore(dart)} (${getDartDescription(dart)})`);
        }

        if (g.dartsPlayed.length < N_DARTS_PER_TURN) {
            console.log(`Dart ${g.dartsPlayed.length + 1}:`);
        }
    }

    console.log();
}


function processUnrecognizedInput(text: string) {
    console.log();
    console.log(`I didn't understand: "${text}"`);
}


function processCommand(cmd: string) {
    if (!isVoiceCommand(cmd)) {
        console.error(`Unknown command: '${cmd}'`);
        return;
    }
    switch (cmd) {
        case 'NEW_GAME': processEvent({type: 'NEW_GAME'}); break;
        case 'STOP_GAME': processEvent({type: 'STOP_GAME'}); break;
        case 'PAUSE_GAME': processEvent({type: 'PAUSE_GAME'}); break;
        case 'CONTINUE_GAME': processEvent({type: 'CONTINUE_GAME'}); break;
        case 'QUIT': processEvent({type: 'QUIT'}); break;
        case 'CORRECTION': processEvent({type: 'CORRECTION'}); break;
        case 'START_GAME': processEvent({type: 'START_GAME'}); break;
        case 'NEXT_TURN': processEvent({type: 'NEXT_TURN'}); break;

        case 'ANSWER_YES': processEvent({type: 'ANSWER', answer: Answer.YES}); break;
        case 'ANSWER_NO': processEvent({type: 'ANSWER', answer: Answer.NO}); break;

        case 'SET_DIFFICULTY_EASY': processEvent({type: 'SET_DIFFICULTY', difficulty: 'easy'}); break;
        case 'SET_DIFFICULTY_MEDIUM': processEvent({type: 'SET_DIFFICULTY', difficulty: 'medium'}); break;
        case 'SET_DIFFICULTY_EXPERT': processEvent({type: 'SET_DIFFICULTY', difficulty: 'expert'}); break;

        case 'SET_PLAYER_COUNT_1':
        case 'SET_PLAYER_COUNT_2':
        case 'SET_PLAYER_COUNT_3':
        case 'SET_PLAYER_COUNT_4':
        case 'SET_PLAYER_COUNT_5':
        case 'SET_PLAYER_COUNT_6':
        case 'SET_PLAYER_COUNT_7':
        case 'SET_PLAYER_COUNT_8':
        case 'SET_PLAYER_COUNT_9':
        case 'SET_PLAYER_COUNT_10': {
            processEvent({type: 'SET_PLAYER_COUNT', numberOfPlayers: parseInt(cmd.substring('SET_PLAYER_COUNT_'.length))});
            break;
        }

        case 'SCORE_0x0':
        case 'SCORE_1x1':
        case 'SCORE_1x2':
        case 'SCORE_1x3':
        case 'SCORE_1x4':
        case 'SCORE_1x5':
        case 'SCORE_1x6':
        case 'SCORE_1x7':
        case 'SCORE_1x8':
        case 'SCORE_1x9':
        case 'SCORE_1x10':
        case 'SCORE_1x11':
        case 'SCORE_1x12':
        case 'SCORE_1x13':
        case 'SCORE_1x14':
        case 'SCORE_1x15':
        case 'SCORE_1x16':
        case 'SCORE_1x17':
        case 'SCORE_1x18':
        case 'SCORE_1x19':
        case 'SCORE_1x20':
        case 'SCORE_2x1':
        case 'SCORE_2x2':
        case 'SCORE_2x3':
        case 'SCORE_2x4':
        case 'SCORE_2x5':
        case 'SCORE_2x6':
        case 'SCORE_2x7':
        case 'SCORE_2x8':
        case 'SCORE_2x9':
        case 'SCORE_2x10':
        case 'SCORE_2x11':
        case 'SCORE_2x12':
        case 'SCORE_2x13':
        case 'SCORE_2x14':
        case 'SCORE_2x15':
        case 'SCORE_2x16':
        case 'SCORE_2x17':
        case 'SCORE_2x18':
        case 'SCORE_2x19':
        case 'SCORE_2x20':
        case 'SCORE_3x1':
        case 'SCORE_3x2':
        case 'SCORE_3x3':
        case 'SCORE_3x4':
        case 'SCORE_3x5':
        case 'SCORE_3x6':
        case 'SCORE_3x7':
        case 'SCORE_3x8':
        case 'SCORE_3x9':
        case 'SCORE_3x10':
        case 'SCORE_3x11':
        case 'SCORE_3x12':
        case 'SCORE_3x13':
        case 'SCORE_3x14':
        case 'SCORE_3x15':
        case 'SCORE_3x16':
        case 'SCORE_3x17':
        case 'SCORE_3x18':
        case 'SCORE_3x19':
        case 'SCORE_3x20':
        case 'SCORE_1x25':
        case 'SCORE_2x25': {
            const multiplierXvalue = cmd.substring('SCORE_'.length);
            const [multiplierStr, valueStr] = multiplierXvalue.split('x');
            const baseValue = parseInt(valueStr) as DartBaseValue;
            const multiplier = parseInt(multiplierStr) as DartMultiplier;
            processEvent({type: 'SCORE_REPORT', baseValue, multiplier});
            break;
        }
    }
}


function startGame() {
    playerStatusesLastRound = [];
    const playerStatuses: PlayerStatus[] = [];

    for (let i = 1 ; i <= lastNumberOfPlayers ; i++) {
        playerStatuses.push({
            name: `Player ${i}`,
            score: 501,
            needADoubleToStart: lastDifficulty === 'expert',
        });
        playerStatusesLastRound.push({
            name: `Player ${i}`,
            score: 501,
            needADoubleToStart: lastDifficulty === 'expert',
        });
    }

    game = {
        state: 'PLAYING',
        possibleThingsToSay: [],
        difficulty: lastDifficulty,
        playerStatuses,
        dartsPlayed: [],
        currentPlayer: 0,
    };
}


function isDouble(dart: DartPlayed) {
    return dart.multiplier === 2;
}


function getDartScore(dart: DartPlayed) {
    return dart.multiplier * dart.baseValue;
}


function isIgnored(dart: DartPlayed) {
    return dart.status !== 'OK';
}


function quit() {
    console.log('Bye bye...');
    console.log();
    exit(0);
}


function getPossibleCommands(state: State): PossibleCommand[] {
    switch (state) {
        case 'NOT_PLAYING':
        case 'GAME_WON': return ['NEW_GAME', 'QUIT'];

        case 'WAITING_FOR_START': return [
            'START_GAME',
            'SET_DIFFICULTY_EXPERT',
            'SET_DIFFICULTY_MEDIUM',
            'SET_DIFFICULTY_EASY',
            'SET_PLAYER_COUNT_1',
            'SET_PLAYER_COUNT_2',
            'SET_PLAYER_COUNT_3',
            'SET_PLAYER_COUNT_4',
            'SET_PLAYER_COUNT_5',
            'SET_PLAYER_COUNT_6',
            'SET_PLAYER_COUNT_7',
            'SET_PLAYER_COUNT_8',
            'SET_PLAYER_COUNT_9',
            'SET_PLAYER_COUNT_10',
            'QUIT'];
        case 'PLAYING': {
            const cmds: PossibleCommand[] = ['QUIT', 'PAUSE_GAME', 'STOP_GAME', 'CORRECTION'];
            if (isTurnComplete()) {
                cmds.push('NEXT_TURN');
            } else {
                cmds.push('<score>');
            }
            return cmds;
        }
        case 'GAME_PAUSED': return ['CONTINUE_GAME'];

        case 'WAITING_STOP_GAME_CONFIRMATION':
        case 'WAITING_QUIT_CONFIRMATION__GAME_WON':
        case 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING':
        case 'WAITING_QUIT_CONFIRMATION__PLAYING':
        case 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START': return ['ANSWER_YES', 'ANSWER_NO'];
    }
}


function waitForStart() {
    game = {
        state: 'WAITING_FOR_START',
        possibleThingsToSay: [],
        numberOfPlayers: lastNumberOfPlayers,
        difficulty: lastDifficulty,
    };
}


function waitForQuitAnswerWhileNotPlaying() {
    game.state = 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING';
}


function waitForQuitAnswerWhenGameIsWon() {
    game.state = 'WAITING_QUIT_CONFIRMATION__GAME_WON';
}


function waitForQuitAnswerWhileWaitingForStart() {
    game.state = 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START';
}


function waitForQuitAnswerWhilePlaying() {
    game.state = 'WAITING_QUIT_CONFIRMATION__PLAYING';
}


function pauseGame() {
    game.state = 'GAME_PAUSED';
}


function waitForStopGameAnswer() {
    game.state = 'WAITING_STOP_GAME_CONFIRMATION';
}


function continuePlaying() {
    game.state = 'PLAYING';
}


function gameOver() {
    game.state = 'GAME_WON';
}


/**
 * Given the current state, this function processes an incoming event.
 * If the event is not expected in the current state, it is ignored.
 *
 * Returns true if the event was processed; false if it was ignored.
 */
function processEvent(event: GameEvent): boolean {
    switch (game.state) {
        case 'NOT_PLAYING': {
            // If there is no game in progress, we can only start one
            if (event.type === 'NEW_GAME') {
                waitForStart();
                return true;
            }
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhileNotPlaying();
                return true;
            }
            break;
        }

        case 'GAME_WON': {
            // If there is no game in progress, we can only start one
            if (event.type === 'NEW_GAME') {
                waitForStart();
                return true;
            }
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhenGameIsWon();
                return true;
            }
            break;
        }
    
        case 'WAITING_FOR_START': {
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhileWaitingForStart();
                return true;
            }
            if (event.type === 'SET_PLAYER_COUNT') {
                lastNumberOfPlayers = event.numberOfPlayers;
                game.numberOfPlayers = event.numberOfPlayers;
                return true;
            }
            if (event.type === 'SET_DIFFICULTY') {
                lastDifficulty = event.difficulty;
                game.difficulty = event.difficulty;
                return true;
            }
            if (event.type === 'START_GAME') {
                startGame();
                return true;
            }
            break;
        }

        case 'PLAYING': {
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhilePlaying();
                return true;
            }
            if (event.type === 'PAUSE_GAME') {
                pauseGame();
                return true;
            }
            if (event.type === 'STOP_GAME') {
                waitForStopGameAnswer();
                return true;
            }
            if (event.type === 'CORRECTION') {
                resetTurn();
                return true;
            }

            // NEXT_TURN is only valid when we have played all the darts
            if (event.type === 'NEXT_TURN') {
                if (isTurnComplete()) {
                    processEndOfTurn();
                    return true;
                }
                return false;
            }

            if (event.type === 'SCORE_REPORT') {
                if (isTurnComplete()) {
                    // Let's ignore any score report if we have already played all the darts
                    return false;
                }

                const dart: DartPlayed = {
                    baseValue: event.baseValue,
                    multiplier: event.multiplier,
                    status: 'OK',
                };
                game.dartsPlayed.push(dart);

                let tentative_score = game.playerStatuses[game.currentPlayer].score;
                if (game.playerStatuses[game.currentPlayer].needADoubleToStart) {
                    if (isDouble(dart)) {
                        // If we need a double start, we are still at 501 so any double
                        // is guaranteed to be valid
                        game.playerStatuses[game.currentPlayer].needADoubleToStart = false;
                    } else {
                        // We need a double and did not get one
                        dart.status = 'NEED_A_DOUBLE_TO_START';
                        return true;
                    }
                }
                const dartScore = getDartScore(dart);
                if (dartScore > tentative_score) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart.status = 'SCORE_CANNOT_BE_NEGATIVE';
                    return true;
                }
                if (dartScore === tentative_score - 1) {
                    if (game.difficulty !== 'easy') {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart.status = 'SCORE_CANNOT_BE_1';
                        return true;
                    }
                    game.playerStatuses[game.currentPlayer].score = 1;
                    return true;
                }
                if (dartScore === tentative_score) {
                    if (game.difficulty !== 'easy' && !isDouble(dart)) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart.status = 'NEED_A_DOUBLE_TO_END';
                        return true;
                    }
                    // We have reached 0, game is over
                    game.playerStatuses[game.currentPlayer].score = 0;
                    gameOver();
                    return true;
                }
                game.playerStatuses[game.currentPlayer].score -= dartScore;
                return true;
            }
            break;
        }

        case 'GAME_PAUSED': {
            if (event.type === 'CONTINUE_GAME') {
                continuePlaying();
                return true;
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    game = BLANK_STATE;
                    return true;
                }
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    waitForStart();
                    return true;
                }
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__PLAYING': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    continuePlaying();
                    return true;
                }
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__GAME_WON': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    gameOver();
                    return true;
                }
            }
            break;
        }

        case 'WAITING_STOP_GAME_CONFIRMATION': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    game = BLANK_STATE
                } else {
                    continuePlaying();
                }
                return true;
            }
            break;
        }
    }

    return false;
}



function isTurnComplete() {
    if (game.state !== 'PLAYING') {
        throw 'Illegal state';
    }
    return game.dartsPlayed.length === N_DARTS_PER_TURN;
}


function resetTurn() {
    if (game.state !== 'PLAYING') {
        throw 'Illegal state';
    }
    game.dartsPlayed = [];
    game.playerStatuses[game.currentPlayer].score = playerStatusesLastRound[game.currentPlayer].score;
    game.playerStatuses[game.currentPlayer].needADoubleToStart = playerStatusesLastRound[game.currentPlayer].needADoubleToStart;
}


function processEndOfTurn() {
    if (game.state !== 'PLAYING') {
        throw 'Illegal state';
    }
    playerStatusesLastRound[game.currentPlayer].score = game.playerStatuses[game.currentPlayer].score;
    playerStatusesLastRound[game.currentPlayer].needADoubleToStart = game.playerStatuses[game.currentPlayer].needADoubleToStart;
    game.dartsPlayed = [];
    game.currentPlayer = (game.currentPlayer + 1) % game.playerStatuses.length;
}


import http from 'http';

function startServer(port: number) {
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(game, null, 2));
    });
    server.listen(port);
}

function printUsage() {
    console.log('Usage: finnegan [OPTIONS] COMMAND');
    console.log();
    console.log('COMMANDS:');
    console.log('  list_devices   Runs "python3 fart.py -l" to show the available audio devices');
    console.log('  play           Starts the game engine that begins to listen for voice commands');
    console.log();
    console.log('OPTIONS:');
    console.log('  --difficulty  expert | medium | easy');
    console.log('           Sets the initial game difficulty (default = easy)');
    console.log();
    console.log('  --players N');
    console.log('           Sets the initial number of players (default = 2)');
    console.log();
    console.log('  --port PORT');
    console.log('           If specified, starts a web server that listens to the given port and');
    console.log('           replies to http request with the current game state in json format');
    console.log();
    console.log('  --device D');
    console.log('           Specifies the audio device parameter to be passed to fart.py');
    console.log();
    console.log('  --samplerate RATE');
    console.log('           Specifies the samplerate parameter to be passed to fart.py');
    console.log();
}

interface ParsedArguments {
    difficulty: Difficulty;
    players: number;
    port?: number;
    device?: string;
    samplerate?: string;
    command?: 'play' | 'list_devices';
}

function parseArguments(): ParsedArguments {
    const parsed: ParsedArguments = {
        difficulty: 'easy',
        players: 2,
    };
    let args = process.argv.slice(2);
    if (args.length === 0) {
        printUsage();
        exit(0);
    }

    let i = 0;
    while (i < args.length) {
        const arg = args[i++];

        if (arg === 'play' || arg === 'list_devices') {
            parsed.command = arg;
            continue;
        }

        if (arg === '--difficulty') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                exit(1);
            }
            const argValue = args[i++];
                if (argValue !== 'expert' && argValue !== 'medium' && argValue !== 'easy') {
                console.error(`Invalid ${arg} argument: ${argValue}`);
                exit(1);
            }
            parsed.difficulty = argValue;
            continue;
        }

        if (arg === '--players') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                exit(1);
            }
            const argValue = args[i++];
                parsed.players = parseInt(argValue);
            if (isNaN(parsed.players) || parsed.players < 1 || parsed.players > 10) {
                console.error(`Invalid ${arg} argument: ${argValue}`);
                exit(1);
            }
            continue;
        }

        if (arg === '--port') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                exit(1);
            }
            const argValue = args[i++];
                parsed.port = parseInt(argValue);
            if (isNaN(parsed.port) || parsed.port < 1024 || parsed.port > 65635) {
                console.error(`Invalid ${arg} argument: ${argValue}`);
                exit(1);
            }
            continue;
        }

        if (arg === '--device') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                exit(1);
            }
            parsed.device = args[i++];
            continue;
        }

        if (arg === '--samplerate') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                exit(1);
            }
            parsed.device = args[i++];
            continue;
        }

        console.error(`Unknown argument: ${arg}`);
    }

    if (!parsed.command) {
        console.error('Missing command');
        exit(1);
    }

    return parsed;
}


const parsed = parseArguments();

if (parsed.command === 'list_devices') {
    child.spawnSync('python3', ['-u', 'fart.py', '-l'], { stdio: ['ignore', 'inherit', 'inherit'] });
    exit(0);
}

if (parsed.port !== undefined) {
    startServer(parsed.port);
}

startGameEngine(parsed);
