import * as child from 'child_process';
import readline from 'readline';
import { exit } from 'process';
import { GameEvent, Difficulty, State, Answer, isVoiceCommand, DartPlayed, PlayerStatus, DartMultiplier, DartBaseValue } from './types';


let currentState: State = 'NOT_PLAYING';
let stateToReturnTo: State | undefined;
let numberOfPlayers = 2;
let difficulty = Difficulty.EASY;


let playerStatuses: PlayerStatus[] = [];
let currentPlayer = 0;
let dart_1: DartPlayed | undefined;
let dart_2: DartPlayed | undefined;
let dart_3: DartPlayed | undefined;


async function main() {
    const p = child.spawn('python3', ['-u', 'fart.py', 'speech_recognition_config_en.json'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const stdoutLineReader = readline.createInterface({input: p.stdout});
    stdoutLineReader.on('line', (line: string) => {
        if (line.startsWith('???:')) {
            render();
            processUnrecognizedInput(line.substring(4));
        } else if (line.startsWith('CMD:')) {
            processCommand(line.substring(4));
            render();
        }
    });
    render();
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

    switch(currentState) {
        case 'NOT_PLAYING': {
            console.log('Say "guinness new game" to start or "guinness quit" to quit');
            break;
        }
        case 'WAITING_FOR_START': {
            console.log(`Difficulty (change by saying what you want):`);
            
            const msgs = [
                '"expert"   => must start and end with a double',
                '"medium"   => must end with a double',
                '"easy"     => no restriction',
            ];
            for (let i = 0 ; i < 3 ; i++) {
                console.log(`${i === difficulty ? ' => ' : '    '}${msgs[i]}`);
            } 
            console.log();
            console.log(`Number of players (change by saying what you want):`);
            for (let i = 1 ; i <= 10 ; i++) {
                console.log(`${i === numberOfPlayers ? ' => ' : '    '}${i === 10 ? '' : ' '}"${i} player${i > 1 ? 's' : ''}"`);
            }
            console.log();
            console.log('Say "guinness begin" to start the game');
            break;
        }
        default: {
            if (currentState !== 'WAITING_QUIT_CONFIRMATION'
                || (stateToReturnTo !== 'WAITING_FOR_START' && stateToReturnTo !== 'NOT_PLAYING')) {
                printScoreBoard();
            }
            if (currentState === 'GAME_PAUSED') {
                console.log();
                console.log('Game paused. Say "guinness continue game" to resume');
                break;
            }
            if (currentState === 'GAME_WON') {
                console.log();
                console.log(`${playerStatuses[currentPlayer].name} won !`);
                console.log();
                console.log('Say "guinness new game" to start a new game or "guinness quit" to quit');
                break;
            }
            if (currentState === 'WAITING_QUIT_CONFIRMATION') {
                console.log();
                console.log('Are you sure you want to quit the program ? Answer by "yes" or "no"');
                break;
            }
            if (currentState === 'WAITING_STOP_GAME_CONFIRMATION') {
                console.log();
                console.log('Are you sure you want to stop the current game ? Answer by "yes" or "no"');
                break;
            }
        }
    }
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


function printScoreBoard() {
    const difficultyMsgs = [
        'Expert mode - need to start and finish with a double',
        'Medium mode - need to finish with a double',
        'Easy mode - as long as you end up exactly at 0, you\'re good',
    ];

    console.log(difficultyMsgs[difficulty]);
    console.log();

    for (let i = 0 ; i < numberOfPlayers ; i++) {
        const cur = i === currentPlayer;
        console.log(`${cur ? ' => ' : '    '}${playerStatuses[i].name}: ${cur ? playerStatuses[i].tentative_score : playerStatuses[i].score}`);
    }

    console.log();
    if (currentState === 'WAITING_FOR_SCORE_DART_1') {
        if (playerStatuses[currentPlayer].need_a_double_to_start) {
            console.log(`${playerStatuses[currentPlayer].name} need a double to start`);
        }
        console.log('Dart 1:');
    }
    if (currentState === 'WAITING_FOR_SCORE_DART_2') {
        let need_a_double_to_start = playerStatuses[currentPlayer].need_a_double_to_start;
        if (!isIgnored(dart_1!) && isDouble(dart_1!)) {
            need_a_double_to_start = false;
        }
        if (need_a_double_to_start) {
            console.log(`${playerStatuses[currentPlayer].name} need a double to start`);
        }
        console.log(`Dart 1: ${isIgnored(dart_1!) ? 'ignored' : getDartScore(dart_1!)} (${getDartDescription(dart_1!)})`);
        console.log('Dart 2:');
    }
    if (currentState === 'WAITING_FOR_SCORE_DART_3') {
        let need_a_double_to_start = playerStatuses[currentPlayer].need_a_double_to_start;
        if (!isIgnored(dart_1!) && isDouble(dart_1!)) {
            need_a_double_to_start = false;
        }
        if (!isIgnored(dart_2!) && isDouble(dart_2!)) {
            need_a_double_to_start = false;
        }
        if (need_a_double_to_start) {
            console.log(`${playerStatuses[currentPlayer].name} need a double to start`);
        }
        console.log(`Dart 1: ${isIgnored(dart_1!) ? 'ignored' : getDartScore(dart_1!)} (${getDartDescription(dart_1!)})`);
        console.log(`Dart 2: ${isIgnored(dart_2!) ? 'ignored' : getDartScore(dart_2!)} (${getDartDescription(dart_2!)})`);
        console.log('Dart 3:');
    }
    if (currentState === 'WAITING_FOR_END_OF_TURN') {
        let need_a_double_to_start = playerStatuses[currentPlayer].need_a_double_to_start;
        if (!isIgnored(dart_1!) && isDouble(dart_1!)) {
            need_a_double_to_start = false;
        }
        if (!isIgnored(dart_2!) && isDouble(dart_2!)) {
            need_a_double_to_start = false;
        }
        if (!isIgnored(dart_3!) && isDouble(dart_3!)) {
            need_a_double_to_start = false;
        }
        if (need_a_double_to_start) {
            console.log(`${playerStatuses[currentPlayer].name} need a double to start`);
        }
        console.log(`Dart 1: ${isIgnored(dart_1!) ? 'ignored' : getDartScore(dart_1!)} (${getDartDescription(dart_1!)})`);
        console.log(`Dart 2: ${isIgnored(dart_2!) ? 'ignored' : getDartScore(dart_2!)} (${getDartDescription(dart_2!)})`);
        console.log(`Dart 3: ${isIgnored(dart_3!) ? 'ignored' : getDartScore(dart_3!)} (${getDartDescription(dart_3!)})`);
        console.log();
        console.log('Say "guinness next" to move on the next player\'s turn');
    }

    console.log();

    if (currentState !== 'GAME_WON' && currentState !== 'GAME_PAUSED'
        && currentState !== 'WAITING_QUIT_CONFIRMATION'
        && currentState !== 'WAITING_STOP_GAME_CONFIRMATION') {
        console.log();
        console.log('Commands:');
        console.log();
        console.log('   "guinness correction"      => reset the darts for the current turn');
        console.log('   "guinness pause game"      => stop listening for inputs until the game is resumed');
        console.log('   "guinness continue game"   => resume listening for inputs');
        console.log('   "guinness stop game"       => stop the current game');
        console.log('   "guinness quit"            => quit the program');
        console.log();
        console.log('Reporting points:');
        console.log('   "fifty"                    => when you hit the bullseye');
        console.log('   "twenty five"              => when you hit the 25 point area around the bullseye');
        console.log('   "triple twelve"            => when you hit a number in its triple area');
        console.log('   "double twelve"            => when you hit a number in its double area');
        console.log('   "twelve"                   => when you hit a number in normal area');
    }
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

        case 'SET_DIFFICULTY_EASY': processEvent({type: 'SET_DIFFICULTY', difficulty: Difficulty.EASY}); break;
        case 'SET_DIFFICULTY_MEDIUM': processEvent({type: 'SET_DIFFICULTY', difficulty: Difficulty.MEDIUM}); break;
        case 'SET_DIFFICULTY_EXPERT': processEvent({type: 'SET_DIFFICULTY', difficulty: Difficulty.EXPERT}); break;

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



function initGame() {
    for (let i = 1 ; i <= numberOfPlayers ; i++) {
        playerStatuses.push({
            name: `Player ${i}`,
            score: 501,
            tentative_score: 501,
            need_a_double_to_start: difficulty === Difficulty.EXPERT,
        });
    }
    currentPlayer = 0;
    dart_1 = undefined;
    dart_2 = undefined;
    dart_3 = undefined;
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


/**
 * Given the current state, this function processes an incoming event.
 * If the event is not expected in the current state, it is ignored.
 *
 * Returns true if the event was processed; false if it was ignored.
 */
function processEvent(event: GameEvent): boolean {
    // We want to allow quitting from any state except if we are already waiting
    // for a yes/no answer or if the game is paused
    if (event.type === 'QUIT') {
        if (currentState !== 'WAITING_QUIT_CONFIRMATION'
              && currentState !== 'WAITING_STOP_GAME_CONFIRMATION'
              && currentState !== 'GAME_PAUSED') {
            stateToReturnTo = currentState;
            currentState = 'WAITING_QUIT_CONFIRMATION';
            return true;
        }
        return false;
    }

    switch (currentState) {
        case 'NOT_PLAYING':
        case 'GAME_WON': {
            // If there is no game in progress, we can only start one
            if (event.type === 'NEW_GAME') {
                currentState = 'WAITING_FOR_START';
                return true;
            }
            break;
        }
    
        case 'WAITING_FOR_START': {
            if (event.type === 'SET_PLAYER_COUNT') {
                numberOfPlayers = event.numberOfPlayers;
                return true;
            }
            if (event.type === 'SET_DIFFICULTY') {
                difficulty = event.difficulty;
                return true;
            }
            if (event.type === 'START_GAME') {
                initGame();
                currentState = 'WAITING_FOR_SCORE_DART_1';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_SCORE_DART_1': {
            if (event.type === 'PAUSE_GAME') {
                stateToReturnTo = currentState;
                currentState = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                stateToReturnTo = currentState;
                currentState = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'SCORE_REPORT') {
                dart_1 = {
                    baseValue: event.baseValue,
                    multiplier: event.multiplier,
                    status: 'OK',
                };
                const need_a_double_to_start = playerStatuses[currentPlayer].need_a_double_to_start;
                const tentative_score = playerStatuses[currentPlayer].score;
                if (need_a_double_to_start && !isDouble(dart_1)) {
                    // We need a double and did not get one
                    dart_1.status = 'NEED_A_DOUBLE_TO_START';
                    currentState = 'WAITING_FOR_SCORE_DART_2';
                    return true;
                }
                const dartScore = getDartScore(dart_1);
                if (dartScore > tentative_score) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart_1.status = 'SCORE_CANNOT_BE_NEGATIVE';
                    currentState = 'WAITING_FOR_SCORE_DART_2';
                    return true;
                }
                if (dartScore === tentative_score - 1) {
                    if (difficulty !== Difficulty.EASY) {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart_1.status = 'SCORE_CANNOT_BE_1';
                        currentState = 'WAITING_FOR_SCORE_DART_2';
                        return true;
                    }
                    playerStatuses[currentPlayer].tentative_score = 1;
                    currentState = 'WAITING_FOR_SCORE_DART_2';
                    return true;
                }
                if (dartScore === tentative_score) {
                    if (difficulty !== Difficulty.EASY && !isDouble(dart_1)) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart_1.status = 'NEED_A_DOUBLE_TO_END';
                        currentState = 'WAITING_FOR_SCORE_DART_2';
                        return true;
                    }
                    // We have reached 0, game is over
                    playerStatuses[currentPlayer].tentative_score = 0;
                    currentState = 'GAME_WON';
                    return true;
                }
                playerStatuses[currentPlayer].tentative_score -= dartScore;
                currentState = 'WAITING_FOR_SCORE_DART_2';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_SCORE_DART_2': {
            if (event.type === 'PAUSE_GAME') {
                stateToReturnTo = currentState;
                currentState = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                stateToReturnTo = currentState;
                currentState = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'CORRECTION') {
                stateToReturnTo = currentState;
                currentState = 'WAITING_FOR_SCORE_DART_1';
                dart_1 = undefined;
                dart_2 = undefined;
                playerStatuses[currentPlayer].tentative_score = playerStatuses[currentPlayer].score;
                return true;
            }
            if (event.type === 'SCORE_REPORT') {
                dart_2 = {
                    baseValue: event.baseValue,
                    multiplier: event.multiplier,
                    status: 'OK',
                };

                let need_a_double_to_start = playerStatuses[currentPlayer].need_a_double_to_start;
                if (!isIgnored(dart_1!) && isDouble(dart_1!)) {
                    need_a_double_to_start = false;
                }
                let tentative_score = playerStatuses[currentPlayer].tentative_score;
                if (need_a_double_to_start && !isDouble(dart_2)) {
                    // We need a double and did not get one
                    dart_2.status = 'NEED_A_DOUBLE_TO_START';
                    currentState = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                const dartScore = getDartScore(dart_2);
                if (dartScore > tentative_score) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart_2.status = 'SCORE_CANNOT_BE_NEGATIVE';
                    currentState = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                if (dartScore === tentative_score - 1) {
                    if (difficulty !== Difficulty.EASY) {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart_2.status = 'SCORE_CANNOT_BE_1';
                        currentState = 'WAITING_FOR_SCORE_DART_3';
                        return true;
                    }
                    playerStatuses[currentPlayer].tentative_score = 1;
                    currentState = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                if (dartScore === tentative_score) {
                    if (difficulty !== Difficulty.EASY && !isDouble(dart_2)) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart_2.status = 'NEED_A_DOUBLE_TO_END';
                        currentState = 'WAITING_FOR_SCORE_DART_3';
                        return true;
                    }
                    // We have reached 0, game is over
                    playerStatuses[currentPlayer].tentative_score = 0;
                    currentState = 'GAME_WON';
                    return true;
                }
                playerStatuses[currentPlayer].tentative_score -= dartScore;
                currentState = 'WAITING_FOR_SCORE_DART_3';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_SCORE_DART_3': {
            if (event.type === 'PAUSE_GAME') {
                stateToReturnTo = currentState;
                currentState = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                stateToReturnTo = currentState;
                currentState = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'CORRECTION') {
                stateToReturnTo = currentState;
                currentState = 'WAITING_FOR_SCORE_DART_1';
                dart_1 = undefined;
                dart_2 = undefined;
                dart_3 = undefined;
                playerStatuses[currentPlayer].tentative_score = playerStatuses[currentPlayer].score;
                return true;
            }
            if (event.type === 'SCORE_REPORT') {
                dart_3 = {
                    baseValue: event.baseValue,
                    multiplier: event.multiplier,
                    status: 'OK',
                };

                let need_a_double_to_start = playerStatuses[currentPlayer].need_a_double_to_start;
                if (!isIgnored(dart_1!) && isDouble(dart_1!)) {
                    need_a_double_to_start = false;
                }
                if (!isIgnored(dart_2!) && isDouble(dart_2!)) {
                    need_a_double_to_start = false;
                }
                let tentative_score = playerStatuses[currentPlayer].tentative_score;

                if (need_a_double_to_start && !isDouble(dart_3)) {
                    // We need a double and did not get one
                    dart_3.status = 'NEED_A_DOUBLE_TO_START';
                    currentState = 'WAITING_FOR_END_OF_TURN';
                    return true;
                }
                const dartScore = getDartScore(dart_3);
                if (dartScore > tentative_score) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart_3.status = 'SCORE_CANNOT_BE_NEGATIVE';
                    currentState = 'WAITING_FOR_END_OF_TURN';
                    return true;
                }
                if (dartScore === tentative_score - 1) {
                    if (difficulty !== Difficulty.EASY) {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart_3.status = 'SCORE_CANNOT_BE_1';
                        currentState = 'WAITING_FOR_END_OF_TURN';
                        return true;
                    }
                    playerStatuses[currentPlayer].tentative_score = 1;
                    currentState = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                if (dartScore === tentative_score) {
                    if (difficulty !== Difficulty.EASY && !isDouble(dart_3)) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart_3.status = 'NEED_A_DOUBLE_TO_END';
                        currentState = 'WAITING_FOR_END_OF_TURN';
                        return true;
                    }
                    // We have reached 0, game is over
                    playerStatuses[currentPlayer].tentative_score = 0;
                    currentState = 'GAME_WON';
                    return true;
                }
                playerStatuses[currentPlayer].tentative_score -= dartScore;
                currentState = 'WAITING_FOR_END_OF_TURN';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_END_OF_TURN': {
            if (event.type === 'PAUSE_GAME') {
                stateToReturnTo = currentState;
                currentState = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                stateToReturnTo = currentState;
                currentState = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'CORRECTION') {
                stateToReturnTo = currentState;
                currentState = 'WAITING_FOR_SCORE_DART_1';
                dart_1 = undefined;
                dart_2 = undefined;
                dart_3 = undefined;
                playerStatuses[currentPlayer].tentative_score = playerStatuses[currentPlayer].score;
                return true;
            }
            if (event.type === 'NEXT_TURN') {
                processEndOfTurn();
                return true;
            }
            break;
        }

        case 'GAME_PAUSED': {
            if (event.type === 'CONTINUE_GAME') {
                currentState = stateToReturnTo!;
                stateToReturnTo = undefined;
                return true;
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    console.log('Bye bye...');
                    exit(0);
                } else {
                    currentState = stateToReturnTo!;
                    stateToReturnTo = undefined;
                    return true;
                }
            }
            break;
        }
        case 'WAITING_STOP_GAME_CONFIRMATION': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    currentState = 'NOT_PLAYING';
                    stateToReturnTo = undefined;
                } else {
                    currentState = stateToReturnTo!;
                    stateToReturnTo = undefined;
                }
                return true;
            }
            break;
        }
    }

    return false;
}


function processEndOfTurn() {
    for (const dart of [dart_1!, dart_2!, dart_3!]) {
        if (isDouble(dart)) {
            playerStatuses[currentPlayer].need_a_double_to_start = false;
        }
    }
    playerStatuses[currentPlayer].score = playerStatuses[currentPlayer].tentative_score;

    dart_1 = undefined;
    dart_2 = undefined;
    dart_3 = undefined;

    currentPlayer = (currentPlayer + 1) % numberOfPlayers;
    currentState = 'WAITING_FOR_SCORE_DART_1';
}


main();
