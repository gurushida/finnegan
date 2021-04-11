/**
 * The VoiceCommand type describes all the supported commands that can be sent
 * by fart.py
 */
const voiceCommands = [
    'NEW_GAME',
    'STOP_GAME',
    'PAUSE_GAME',
    'CONTINUE_GAME',
    'QUIT',
    'CORRECTION',
    'START_GAME',
    'NEXT_TURN',
    'SET_DIFFICULTY_EXPERT',
    'SET_DIFFICULTY_MEDIUM',
    'SET_DIFFICULTY_EASY',
    'ANSWER_YES',
    'ANSWER_NO',
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
    'SCORE_0x0',
    'SCORE_1x1',
    'SCORE_1x2',
    'SCORE_1x3',
    'SCORE_1x4',
    'SCORE_1x5',
    'SCORE_1x6',
    'SCORE_1x7',
    'SCORE_1x8',
    'SCORE_1x9',
    'SCORE_1x10',
    'SCORE_1x11',
    'SCORE_1x12',
    'SCORE_1x13',
    'SCORE_1x14',
    'SCORE_1x15',
    'SCORE_1x16',
    'SCORE_1x17',
    'SCORE_1x18',
    'SCORE_1x19',
    'SCORE_1x20',
    'SCORE_2x1',
    'SCORE_2x2',
    'SCORE_2x3',
    'SCORE_2x4',
    'SCORE_2x5',
    'SCORE_2x6',
    'SCORE_2x7',
    'SCORE_2x8',
    'SCORE_2x9',
    'SCORE_2x10',
    'SCORE_2x11',
    'SCORE_2x12',
    'SCORE_2x13',
    'SCORE_2x14',
    'SCORE_2x15',
    'SCORE_2x16',
    'SCORE_2x17',
    'SCORE_2x18',
    'SCORE_2x19',
    'SCORE_2x20',
    'SCORE_3x1',
    'SCORE_3x2',
    'SCORE_3x3',
    'SCORE_3x4',
    'SCORE_3x5',
    'SCORE_3x6',
    'SCORE_3x7',
    'SCORE_3x8',
    'SCORE_3x9',
    'SCORE_3x10',
    'SCORE_3x11',
    'SCORE_3x12',
    'SCORE_3x13',
    'SCORE_3x14',
    'SCORE_3x15',
    'SCORE_3x16',
    'SCORE_3x17',
    'SCORE_3x18',
    'SCORE_3x19',
    'SCORE_3x20',
    'SCORE_1x25',
    'SCORE_2x25'
] as const;
export type VoiceCommand = typeof voiceCommands[number];

export enum Difficulty {
    EXPERT = 0,
    MEDIUM = 1,
    EASY = 2,
}

export enum Answer {
    NO = 0,
    YES = 1,
}

export type DartBaseValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
                            | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 25;

export type DartMultiplier = 0 | 1 | 2 | 3;

/**
 * This enum represents the possible states the program can be in.
 */
export type State = 'NOT_PLAYING' | 'WAITING_FOR_START'
             | 'WAITING_FOR_SCORE_DART_1' | 'WAITING_FOR_SCORE_DART_2' | 'WAITING_FOR_SCORE_DART_3'
             | 'WAITING_FOR_END_OF_TURN'
             | 'GAME_WON' | 'GAME_PAUSED' | 'WAITING_QUIT_CONFIRMATION' | 'WAITING_STOP_GAME_CONFIRMATION';

export type EventType = 'NEW_GAME' | 'SET_DIFFICULTY' | 'SET_PLAYER_COUNT' | 'START_GAME' | 'STOP_GAME'
                 | 'PAUSE_GAME' | 'CONTINUE_GAME' | 'QUIT' | 'CORRECTION' | 'SCORE_REPORT'
                 | 'ANSWER' | 'NEXT_TURN';

export interface DifficultyEvent {
    type: 'SET_DIFFICULTY';
    difficulty: Difficulty;
}

export interface PlayerCountEvent {
    type: 'SET_PLAYER_COUNT';
    numberOfPlayers: number;
}

export interface AnswerEvent {
    type: 'ANSWER';
    answer: Answer;
}

export interface ScoreEvent {
    type: 'SCORE_REPORT';

    // A value between 0 and 20, or 25
    baseValue: DartBaseValue;

    // 0, 1, 2 or 3
    multiplier: DartMultiplier;
}

export interface ValuelessEvent {
    type: 'NEW_GAME' | 'START_GAME' | 'STOP_GAME' | 'PAUSE_GAME' | 'CONTINUE_GAME' | 'QUIT' | 'CORRECTION' | 'NEXT_TURN';
}

export type GameEvent = DifficultyEvent | PlayerCountEvent | AnswerEvent | ScoreEvent | ValuelessEvent;


export interface PlayerStatus {
    name: string;
    score: number;
    // Darts only cound when the round is finished, in case a dart falls
    // off the board. For the current player, the tentative score is the
    // score adjusted with the darts already played in the round
    tentative_score: number;
    need_a_double_to_start: boolean;
}

/**
 * A dart is ignored if one of the following conditions is met:
 *
 * 1) the game is played in expert difficulty
 *    and no double has been played so far, including this dart
 *
 * 2) if the game is played in expert or medium difficulty and
 *    this dart would make the score become 0 but is not a double
 *
 * 3) the dart's value would make the score be negative
 *
 * 4) the game needs to end with a double and the dart would make the
 *    score become 1 which would make it impossible to finish the game
 */
export type DartStatus = 'OK'
  | 'NEED_A_DOUBLE_TO_START'
  | 'NEED_A_DOUBLE_TO_END'
  | 'SCORE_CANNOT_BE_NEGATIVE'
  | 'SCORE_CANNOT_BE_1';

export interface DartPlayed {
    baseValue: DartBaseValue;
    multiplier: DartMultiplier;
    status: DartStatus;
}

export function isVoiceCommand(s: string): s is VoiceCommand {
    return undefined !== voiceCommands.find((value) => value === s);
}
