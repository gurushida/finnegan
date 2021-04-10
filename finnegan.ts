import * as child from 'child_process';
import readline from 'readline';
import { exit } from 'process';

enum Difficulty {
    EXPERT = 0,
    MEDIUM = 1,
    EASY = 2,
}

enum Answer {
    NO = 0,
    YES = 1,
}

/**
 * This enum represents the possible states the program can be in.
 */
type State = 'NOT_PLAYING' | 'WAITING_FOR_START'
             | 'WAITING_FOR_SCORE_DART_1' | 'WAITING_FOR_SCORE_DART_2' | 'WAITING_FOR_SCORE_DART_3'
             | 'WAITING_FOR_END_OF_TURN'
             | 'GAME_WON' | 'GAME_PAUSED' | 'WAITING_QUIT_CONFIRMATION' | 'WAITING_STOP_GAME_CONFIRMATION';

type EventType = 'NEW_GAME' | 'SET_DIFFICULTY' | 'SET_PLAYER_COUNT' | 'START_GAME' | 'STOP_GAME'
                 | 'PAUSE_GAME' | 'CONTINUE_GAME' | 'QUIT' | 'CORRECTION' | 'SCORE_REPORT'
                 | 'ANSWER' | 'NEXT_TURN';

interface Event {
    type: EventType;

    // Only relevant for SET_DIFFICULTY, ANSWER, SET_PLAYER_COUNT and SCORE_REPORT
    value?: number;

    // Only relevant for SCORE_REPORT
    is_double?: boolean;
    description?: string;
}

let current_state: State = 'NOT_PLAYING';
let state_to_return_to: State | undefined;
let number_of_players = 2;
let difficulty = Difficulty.EASY;

interface PlayerStatus {
    name: string;
    score: number;
    // Darts only cound when the round is finished, in case a dart falls
    // off the board. For the current player, the tentative score is the
    // score adjusted with the darts already played in the round
    tentative_score: number;
    need_a_double_to_start: boolean;
}

interface Dart {
    score: number;
    description: string;
    is_double: boolean;
    ignored: boolean;
}

let player_statuses: PlayerStatus[] = [];
let current_player = 0;
let dart_1: Dart | undefined;
let dart_2: Dart | undefined;
let dart_3: Dart | undefined;


async function main() {
    const p = child.spawn('python3', ['-u', 'finnegan.py'], { stdio: ['ignore', 'pipe', 'ignore'] });
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

    switch(current_state) {
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
                console.log(`${i === number_of_players ? ' => ' : '    '}${i === 10 ? '' : ' '}"${i} player${i > 1 ? 's' : ''}"`);
            }
            console.log();
            console.log('Say "guinness begin" to start the game');
            break;
        }
        default: {
            if (current_state !== 'WAITING_QUIT_CONFIRMATION'
                || (state_to_return_to !== 'WAITING_FOR_START' && state_to_return_to !== 'NOT_PLAYING')) {
                printScoreBoard();
            }
            if (current_state === 'GAME_PAUSED') {
                console.log();
                console.log('Game paused. Say "guinness continue game" to resume');
                break;
            }
            if (current_state === 'GAME_WON') {
                console.log();
                console.log(`${player_statuses[current_player].name} won !`);
                console.log();
                console.log('Say "guinness new game" to start a new game or "guinness quit" to quit');
                break;
            }
            if (current_state === 'WAITING_QUIT_CONFIRMATION') {
                console.log();
                console.log('Are you sure you want to quit the program ? Answer by "yes" or "no"');
                break;
            }
            if (current_state === 'WAITING_STOP_GAME_CONFIRMATION') {
                console.log();
                console.log('Are you sure you want to stop the current game ? Answer by "yes" or "no"');
                break;
            }
        }
    }
}

function printScoreBoard() {
    const difficultyMsgs = [
        'Expert mode - need to start and finish with a double',
        'Medium mode - need to finish with a double',
        'Easy mode - as long as you end up exactly at 0, you\'re good',
    ];

    console.log(difficultyMsgs[difficulty]);
    console.log();

    for (let i = 0 ; i < number_of_players ; i++) {
        const cur = i === current_player;
        console.log(`${cur ? ' => ' : '    '}${player_statuses[i].name}: ${cur ? player_statuses[i].tentative_score : player_statuses[i].score}`);
    }

    console.log();
    if (current_state === 'WAITING_FOR_SCORE_DART_1') {
        if (player_statuses[current_player].need_a_double_to_start) {
            console.log(`${player_statuses[current_player].name} need a double to start`);
        }
        console.log('Dart 1:');
    }
    if (current_state === 'WAITING_FOR_SCORE_DART_2') {
        let need_a_double_to_start = player_statuses[current_player].need_a_double_to_start;
        if (!dart_1!.ignored && dart_1!.is_double) {
            need_a_double_to_start = false;
        }
        if (need_a_double_to_start) {
            console.log(`${player_statuses[current_player].name} need a double to start`);
        }
        console.log(`Dart 1: ${dart_1!.ignored ? 'ignored' : dart_1!.score} (${dart_1!.description})`);
        console.log('Dart 2:');
    }
    if (current_state === 'WAITING_FOR_SCORE_DART_3') {
        let need_a_double_to_start = player_statuses[current_player].need_a_double_to_start;
        if (!dart_1!.ignored && dart_1!.is_double) {
            need_a_double_to_start = false;
        }
        if (!dart_2!.ignored && dart_2!.is_double) {
            need_a_double_to_start = false;
        }
        if (need_a_double_to_start) {
            console.log(`${player_statuses[current_player].name} need a double to start`);
        }
        console.log(`Dart 1: ${dart_1!.ignored ? 'ignored' : dart_1!.score} (${dart_1!.description})`);
        console.log(`Dart 2: ${dart_2!.ignored ? 'ignored' : dart_2!.score} (${dart_2!.description})`);
        console.log('Dart 3:');
    }
    if (current_state === 'WAITING_FOR_END_OF_TURN') {
        let need_a_double_to_start = player_statuses[current_player].need_a_double_to_start;
        if (!dart_1!.ignored && dart_1!.is_double) {
            need_a_double_to_start = false;
        }
        if (!dart_2!.ignored && dart_2!.is_double) {
            need_a_double_to_start = false;
        }
        if (!dart_3!.ignored && dart_3!.is_double) {
            need_a_double_to_start = false;
        }
        if (need_a_double_to_start) {
            console.log(`${player_statuses[current_player].name} need a double to start`);
        }
        console.log(`Dart 1: ${dart_1!.ignored ? 'ignored' : dart_1!.score} (${dart_1!.description})`);
        console.log(`Dart 2: ${dart_2!.ignored ? 'ignored' : dart_2!.score} (${dart_2!.description})`);
        console.log(`Dart 3: ${dart_3!.ignored ? 'ignored' : dart_3!.score} (${dart_3!.description})`);
        console.log();
        console.log('Say "guinness next" to move on the next player\'s turn');
    }

    console.log();

    if (current_state !== 'GAME_WON' && current_state !== 'GAME_PAUSED'
        && current_state !== 'WAITING_QUIT_CONFIRMATION'
        && current_state !== 'WAITING_STOP_GAME_CONFIRMATION') {
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
    switch (cmd) {
        case 'guinness new game': processEvent({type: 'NEW_GAME'}); break;
        case 'guinness stop game': processEvent({type: 'STOP_GAME'}); break;
        case 'guinness pause game': processEvent({type: 'PAUSE_GAME'}); break;
        case 'guinness continue game': processEvent({type: 'CONTINUE_GAME'}); break;
        case 'guinness quit': processEvent({type: 'QUIT'}); break;
        case 'guinness correction': processEvent({type: 'CORRECTION'}); break;
        case 'guinness begin': processEvent({type: 'START_GAME'}); break;
        case 'guinness next': processEvent({type: 'NEXT_TURN'}); break;

        case 'yes': processEvent({type: 'ANSWER', value: Answer.YES}); break;
        case 'no': processEvent({type: 'ANSWER', value: Answer.NO}); break;

        case 'easy': processEvent({type: 'SET_DIFFICULTY', value: Difficulty.EASY}); break;
        case 'medium': processEvent({type: 'SET_DIFFICULTY', value: Difficulty.MEDIUM}); break;
        case 'expert': processEvent({type: 'SET_DIFFICULTY', value: Difficulty.EXPERT}); break;

        case 'one player': processEvent({type: 'SET_PLAYER_COUNT', value: 1}); break;
        case 'two players': processEvent({type: 'SET_PLAYER_COUNT', value: 2}); break;
        case 'three players': processEvent({type: 'SET_PLAYER_COUNT', value: 3}); break;
        case 'four players': processEvent({type: 'SET_PLAYER_COUNT', value: 4}); break;
        case 'five players': processEvent({type: 'SET_PLAYER_COUNT', value: 5}); break;
        case 'six players': processEvent({type: 'SET_PLAYER_COUNT', value: 6}); break;
        case 'seven players': processEvent({type: 'SET_PLAYER_COUNT', value: 7}); break;
        case 'eight players': processEvent({type: 'SET_PLAYER_COUNT', value: 8}); break;
        case 'nine players': processEvent({type: 'SET_PLAYER_COUNT', value: 9}); break;
        case 'ten players': processEvent({type: 'SET_PLAYER_COUNT', value: 10}); break;

        case 'zero': processEvent({type: 'SCORE_REPORT', value: 0, is_double: false, description: '-'}); break;

        case 'one': processEvent({type: 'SCORE_REPORT', value: 1, is_double: false, description: '1'}); break;
        case 'two': processEvent({type: 'SCORE_REPORT', value: 2, is_double: false, description: '2'}); break;
        case 'three': processEvent({type: 'SCORE_REPORT', value: 3, is_double: false, description: '3'}); break;
        case 'four': processEvent({type: 'SCORE_REPORT', value: 4, is_double: false, description: '4'}); break;
        case 'five': processEvent({type: 'SCORE_REPORT', value: 5, is_double: false, description: '5'}); break;
        case 'six': processEvent({type: 'SCORE_REPORT', value: 6, is_double: false, description: '6'}); break;
        case 'seven': processEvent({type: 'SCORE_REPORT', value: 7, is_double: false, description: '7'}); break;
        case 'eight': processEvent({type: 'SCORE_REPORT', value: 8, is_double: false, description: '8'}); break;
        case 'nine': processEvent({type: 'SCORE_REPORT', value: 9, is_double: false, description: '9'}); break;
        case 'ten': processEvent({type: 'SCORE_REPORT', value: 10, is_double: false, description: '10'}); break;
        case 'eleven': processEvent({type: 'SCORE_REPORT', value: 11, is_double: false, description: '11'}); break;
        case 'twelve': processEvent({type: 'SCORE_REPORT', value: 12, is_double: false, description: '12'}); break;
        case 'thirteen': processEvent({type: 'SCORE_REPORT', value: 13, is_double: false, description: '13'}); break;
        case 'fourteen': processEvent({type: 'SCORE_REPORT', value: 14, is_double: false, description: '14'}); break;
        case 'fifteen': processEvent({type: 'SCORE_REPORT', value: 15, is_double: false, description: '15'}); break;
        case 'sixteen': processEvent({type: 'SCORE_REPORT', value: 16, is_double: false, description: '16'}); break;
        case 'seventeen': processEvent({type: 'SCORE_REPORT', value: 17, is_double: false, description: '17'}); break;
        case 'eighteen': processEvent({type: 'SCORE_REPORT', value: 18, is_double: false, description: '18'}); break;
        case 'nineteen': processEvent({type: 'SCORE_REPORT', value: 19, is_double: false, description: '19'}); break;
        case 'twenty': processEvent({type: 'SCORE_REPORT', value: 20, is_double: false, description: '20'}); break;

        case 'double one': processEvent({type: 'SCORE_REPORT', value: 2, is_double: true, description: '2x1'}); break;
        case 'double two': processEvent({type: 'SCORE_REPORT', value: 4, is_double: true, description: '2x2'}); break;
        case 'double three': processEvent({type: 'SCORE_REPORT', value: 6, is_double: true, description: '2x3'}); break;
        case 'double four': processEvent({type: 'SCORE_REPORT', value: 8, is_double: true, description: '2x4'}); break;
        case 'double five': processEvent({type: 'SCORE_REPORT', value: 10, is_double: true, description: '2x5'}); break;
        case 'double six': processEvent({type: 'SCORE_REPORT', value: 12, is_double: true, description: '2x6'}); break;
        case 'double seven': processEvent({type: 'SCORE_REPORT', value: 14, is_double: true, description: '2x7'}); break;
        case 'double eight': processEvent({type: 'SCORE_REPORT', value: 16, is_double: true, description: '2x8'}); break;
        case 'double nine': processEvent({type: 'SCORE_REPORT', value: 18, is_double: true, description: '2x9'}); break;
        case 'double ten': processEvent({type: 'SCORE_REPORT', value: 20, is_double: true, description: '2x10'}); break;
        case 'double eleven': processEvent({type: 'SCORE_REPORT', value: 22, is_double: true, description: '2x11'}); break;
        case 'double twelve': processEvent({type: 'SCORE_REPORT', value: 24, is_double: true, description: '2x12'}); break;
        case 'double thirteen': processEvent({type: 'SCORE_REPORT', value: 26, is_double: true, description: '2x13'}); break;
        case 'double fourteen': processEvent({type: 'SCORE_REPORT', value: 28, is_double: true, description: '2x14'}); break;
        case 'double fifteen': processEvent({type: 'SCORE_REPORT', value: 30, is_double: true, description: '2x15'}); break;
        case 'double sixteen': processEvent({type: 'SCORE_REPORT', value: 32, is_double: true, description: '2x16'}); break;
        case 'double seventeen': processEvent({type: 'SCORE_REPORT', value: 34, is_double: true, description: '2x17'}); break;
        case 'double eighteen': processEvent({type: 'SCORE_REPORT', value: 36, is_double: true, description: '2x18'}); break;
        case 'double nineteen': processEvent({type: 'SCORE_REPORT', value: 38, is_double: true, description: '2x19'}); break;
        case 'double twenty': processEvent({type: 'SCORE_REPORT', value: 40, is_double: true, description: '2x20'}); break;

        case 'triple one': processEvent({type: 'SCORE_REPORT', value: 3, is_double: false, description: '3x1'}); break;
        case 'triple two': processEvent({type: 'SCORE_REPORT', value: 6, is_double: false, description: '3x2'}); break;
        case 'triple three': processEvent({type: 'SCORE_REPORT', value: 9, is_double: false, description: '3x3'}); break;
        case 'triple four': processEvent({type: 'SCORE_REPORT', value: 12, is_double: false, description: '3x4'}); break;
        case 'triple five': processEvent({type: 'SCORE_REPORT', value: 15, is_double: false, description: '3x5'}); break;
        case 'triple six': processEvent({type: 'SCORE_REPORT', value: 18, is_double: false, description: '3x6'}); break;
        case 'triple seven': processEvent({type: 'SCORE_REPORT', value: 21, is_double: false, description: '3x7'}); break;
        case 'triple eight': processEvent({type: 'SCORE_REPORT', value: 24, is_double: false, description: '3x8'}); break;
        case 'triple nine': processEvent({type: 'SCORE_REPORT', value: 27, is_double: false, description: '3x9'}); break;
        case 'triple ten': processEvent({type: 'SCORE_REPORT', value: 30, is_double: false, description: '3x10'}); break;
        case 'triple eleven': processEvent({type: 'SCORE_REPORT', value: 33, is_double: false, description: '3x11'}); break;
        case 'triple twelve': processEvent({type: 'SCORE_REPORT', value: 36, is_double: false, description: '3x12'}); break;
        case 'triple thirteen': processEvent({type: 'SCORE_REPORT', value: 39, is_double: false, description: '3x13'}); break;
        case 'triple fourteen': processEvent({type: 'SCORE_REPORT', value: 42, is_double: false, description: '3x14'}); break;
        case 'triple fifteen': processEvent({type: 'SCORE_REPORT', value: 45, is_double: false, description: '3x15'}); break;
        case 'triple sixteen': processEvent({type: 'SCORE_REPORT', value: 48, is_double: false, description: '3x16'}); break;
        case 'triple seventeen': processEvent({type: 'SCORE_REPORT', value: 51, is_double: false, description: '3x17'}); break;
        case 'triple eighteen': processEvent({type: 'SCORE_REPORT', value: 54, is_double: false, description: '3x18'}); break;
        case 'triple nineteen': processEvent({type: 'SCORE_REPORT', value: 57, is_double: false, description: '3x19'}); break;
        case 'triple twenty': processEvent({type: 'SCORE_REPORT', value: 60, is_double: false, description: '3x20'}); break;

        case 'twenty five': processEvent({type: 'SCORE_REPORT', value: 25, is_double: false, description: '25'}); break;
        case 'fifty': processEvent({type: 'SCORE_REPORT', value: 50, is_double: true, description: '50'}); break;

        default: console.error(`Unknown command: '${cmd}'`); break;
    }
}



function initGame() {
    for (let i = 1 ; i <= number_of_players ; i++) {
        player_statuses.push({
            name: `Player ${i}`,
            score: 501,
            tentative_score: 501,
            need_a_double_to_start: difficulty === Difficulty.EXPERT,
        });
    }
    current_player = 0;
    dart_1 = undefined;
    dart_2 = undefined;
    dart_3 = undefined;
}

/**
 * Given the current state, this function processes an incoming event.
 * If the event is not expected in the current state, it is ignored.
 *
 * Returns true if the event was processed; false if it was ignored.
 */
function processEvent(event: Event): boolean {
    // We want to allow quitting from any state except if we are already waiting
    // for a yes/no answer or if the game is paused
    if (event.type === 'QUIT') {
        if (current_state !== 'WAITING_QUIT_CONFIRMATION'
              && current_state !== 'WAITING_STOP_GAME_CONFIRMATION'
              && current_state !== 'GAME_PAUSED') {
            state_to_return_to = current_state;
            current_state = 'WAITING_QUIT_CONFIRMATION';
            return true;
        }
        return false;
    }

    switch (current_state) {
        case 'NOT_PLAYING':
        case 'GAME_WON': {
            // If there is no game in progress, we can only start one
            if (event.type === 'NEW_GAME') {
                current_state = 'WAITING_FOR_START';
                return true;
            }
            break;
        }
    
        case 'WAITING_FOR_START': {
            if (event.type === 'SET_PLAYER_COUNT') {
                number_of_players = event.value!;
                return true;
            }
            if (event.type === 'SET_DIFFICULTY') {
                difficulty = event.value!;
                return true;
            }
            if (event.type === 'START_GAME') {
                initGame();
                current_state = 'WAITING_FOR_SCORE_DART_1';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_SCORE_DART_1': {
            if (event.type === 'PAUSE_GAME') {
                state_to_return_to = current_state;
                current_state = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                state_to_return_to = current_state;
                current_state = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'SCORE_REPORT') {
                dart_1 = {
                    score: event.value!,
                    description: event.description!,
                    is_double: event.is_double!,
                    ignored: false,
                };
                const need_a_double_to_start = player_statuses[current_player].need_a_double_to_start;
                const tentative_score = player_statuses[current_player].score;
                if (need_a_double_to_start && !dart_1.is_double) {
                    // We need a double and did not get one
                    dart_1.ignored = true;
                    current_state = 'WAITING_FOR_SCORE_DART_2';
                    return true;
                }
                if (dart_1.score > tentative_score) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart_1.ignored = true;
                    current_state = 'WAITING_FOR_SCORE_DART_2';
                    return true;
                }
                if (dart_1.score === tentative_score - 1) {
                    if (difficulty !== Difficulty.EASY) {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart_1.ignored = true;
                        current_state = 'WAITING_FOR_SCORE_DART_2';
                        return true;
                    }
                    player_statuses[current_player].tentative_score = 1;
                    current_state = 'WAITING_FOR_SCORE_DART_2';
                    return true;
                }
                if (dart_1.score === tentative_score) {
                    if (difficulty !== Difficulty.EASY && !dart_1.is_double) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart_1.ignored = true;
                        current_state = 'WAITING_FOR_SCORE_DART_2';
                        return true;
                    }
                    // We have reached 0, game is over
                    player_statuses[current_player].tentative_score = 0;
                    current_state = 'GAME_WON';
                    return true;
                }
                player_statuses[current_player].tentative_score -= dart_1.score;
                current_state = 'WAITING_FOR_SCORE_DART_2';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_SCORE_DART_2': {
            if (event.type === 'PAUSE_GAME') {
                state_to_return_to = current_state;
                current_state = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                state_to_return_to = current_state;
                current_state = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'CORRECTION') {
                state_to_return_to = current_state;
                current_state = 'WAITING_FOR_SCORE_DART_1';
                dart_1 = undefined;
                dart_2 = undefined;
                player_statuses[current_player].tentative_score = player_statuses[current_player].score;
                return true;
            }
            if (event.type === 'SCORE_REPORT') {
                dart_2 = {
                    score: event.value!,
                    description: event.description!,
                    is_double: event.is_double!,
                    ignored: false,
                };

                let need_a_double_to_start = player_statuses[current_player].need_a_double_to_start;
                if (!dart_1!.ignored && dart_1!.is_double) {
                    need_a_double_to_start = false;
                }
                let tentative_score = player_statuses[current_player].tentative_score;
                if (need_a_double_to_start && !dart_2.is_double) {
                    // We need a double and did not get one
                    dart_2.ignored = true;
                    current_state = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                if (dart_2.score > tentative_score) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart_2.ignored = true;
                    current_state = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                if (dart_2.score === tentative_score - 1) {
                    if (difficulty !== Difficulty.EASY) {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart_2.ignored = true;
                        current_state = 'WAITING_FOR_SCORE_DART_3';
                        return true;
                    }
                    player_statuses[current_player].tentative_score = 1;
                    current_state = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                if (dart_2.score === tentative_score) {
                    if (difficulty !== Difficulty.EASY && !dart_2.is_double) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart_2.ignored = true;
                        current_state = 'WAITING_FOR_SCORE_DART_3';
                        return true;
                    }
                    // We have reached 0, game is over
                    player_statuses[current_player].tentative_score = 0;
                    current_state = 'GAME_WON';
                    return true;
                }
                player_statuses[current_player].tentative_score -= dart_2.score;
                current_state = 'WAITING_FOR_SCORE_DART_3';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_SCORE_DART_3': {
            if (event.type === 'PAUSE_GAME') {
                state_to_return_to = current_state;
                current_state = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                state_to_return_to = current_state;
                current_state = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'CORRECTION') {
                state_to_return_to = current_state;
                current_state = 'WAITING_FOR_SCORE_DART_1';
                dart_1 = undefined;
                dart_2 = undefined;
                dart_3 = undefined;
                player_statuses[current_player].tentative_score = player_statuses[current_player].score;
                return true;
            }
            if (event.type === 'SCORE_REPORT') {
                dart_3 = {
                    score: event.value!,
                    description: event.description!,
                    is_double: event.is_double!,
                    ignored: false,
                };

                let need_a_double_to_start = player_statuses[current_player].need_a_double_to_start;
                if (!dart_1!.ignored && dart_1!.is_double) {
                    need_a_double_to_start = false;
                }
                if (!dart_2!.ignored && dart_2!.is_double) {
                    need_a_double_to_start = false;
                }
                let tentative_score = player_statuses[current_player].tentative_score;

                if (need_a_double_to_start && !dart_3.is_double) {
                    // We need a double and did not get one
                    dart_3.ignored = true;
                    current_state = 'WAITING_FOR_END_OF_TURN';
                    return true;
                }
                if (dart_3.score > tentative_score) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart_3.ignored = true;
                    current_state = 'WAITING_FOR_END_OF_TURN';
                    return true;
                }
                if (dart_3.score === tentative_score - 1) {
                    if (difficulty !== Difficulty.EASY) {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart_3.ignored = true;
                        current_state = 'WAITING_FOR_END_OF_TURN';
                        return true;
                    }
                    player_statuses[current_player].tentative_score = 1;
                    current_state = 'WAITING_FOR_SCORE_DART_3';
                    return true;
                }
                if (dart_3.score === tentative_score) {
                    if (difficulty !== Difficulty.EASY && !dart_3.is_double) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart_3.ignored = true;
                        current_state = 'WAITING_FOR_END_OF_TURN';
                        return true;
                    }
                    // We have reached 0, game is over
                    player_statuses[current_player].tentative_score = 0;
                    current_state = 'GAME_WON';
                    return true;
                }
                player_statuses[current_player].tentative_score -= dart_3.score;
                current_state = 'WAITING_FOR_END_OF_TURN';
                return true;
            }
            break;
        }

        case 'WAITING_FOR_END_OF_TURN': {
            if (event.type === 'PAUSE_GAME') {
                state_to_return_to = current_state;
                current_state = 'GAME_PAUSED';
                return true;
            }
            if (event.type === 'STOP_GAME') {
                state_to_return_to = current_state;
                current_state = 'WAITING_STOP_GAME_CONFIRMATION';
                return true;
            }
            if (event.type === 'CORRECTION') {
                state_to_return_to = current_state;
                current_state = 'WAITING_FOR_SCORE_DART_1';
                dart_1 = undefined;
                dart_2 = undefined;
                dart_3 = undefined;
                player_statuses[current_player].tentative_score = player_statuses[current_player].score;
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
                current_state = state_to_return_to!;
                state_to_return_to = undefined;
                return true;
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION': {
            if (event.type === 'ANSWER') {
                if (event.value === Answer.YES) {
                    console.log('Bye bye...');
                    exit(0);
                } else {
                    current_state = state_to_return_to!;
                    state_to_return_to = undefined;
                    return true;
                }
            }
            break;
        }
        case 'WAITING_STOP_GAME_CONFIRMATION': {
            if (event.type === 'ANSWER') {
                if (event.value === Answer.YES) {
                    current_state = 'NOT_PLAYING';
                    state_to_return_to = undefined;
                } else {
                    current_state = state_to_return_to!;
                    state_to_return_to = undefined;
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
        if (dart.is_double) {
            player_statuses[current_player].need_a_double_to_start = false;
        }
    }
    player_statuses[current_player].score = player_statuses[current_player].tentative_score;

    dart_1 = undefined;
    dart_2 = undefined;
    dart_3 = undefined;

    current_player = (current_player + 1) % number_of_players;
    current_state = 'WAITING_FOR_SCORE_DART_1';
}


main();
