export const gameCommands = ['501', 'AROUND_THE_CLOCK', 'PURSUIT'] as const;
export type GameCommand = typeof gameCommands[number];

/**
 * The MessageId type describes the IDs of all the text messages
 * that can be presented to the user. 
 */
export const messageIDs = [
    ...gameCommands,
    'DIFFICULTY',
    'EASY',
    'MEDIUM',
    'EXPERT',
    'EASY_LEVEL',
    'MEDIUM_LEVEL',
    'EXPERT_LEVEL',
    'PLAYER',
    'NUMBER_OF_PLAYERS',
    '1_PLAYER_GAME',
    '2_PLAYER_GAME',
    '3_PLAYER_GAME',
    '4_PLAYER_GAME',
    '5_PLAYER_GAME',
    '6_PLAYER_GAME',
    '7_PLAYER_GAME',
    '8_PLAYER_GAME',
    '9_PLAYER_GAME',
    '10_PLAYER_GAME',
    'NEW_GAME',
    'STOP_GAME',
    'PAUSE_GAME',
    'GAME_IS_PAUSED',
    'BACK_FROM_PAUSE',
    'CORRECTION',
    'START_GAME',
    'NEXT_TURN',
    'BACK',
    'ARE_YOU_SURE_YOU_TO_STOP_THE_GAME',
    'SCORE',
    'POSSIBLE_THINGS_TO_SAY',
    '_WON',
    'NEEDS_A_DOUBLE_TO_START',
    'DART',
    'IGNORED',
    'I_DIDNT_UNDERSTAND',
    'UNKNOWN_COMMAND',
    'YES',
    'NO',
    'NEEDS_TO_HIT',
    'HARE',
    'HOUND',
    'THE_HARE_WON',
    'THE_HARE_LOST',
] as const;
export type MessageId = typeof messageIDs[number];


// If the voice recognition receives a command prefixed with this
// string, the remaining will be interpreted as the path of
// of a config file to load
export const SWITCH_LANGUAGE_COMMAND_PREFIX = "LOAD_CONFIG:"


/**
 * The VoiceCommand type describes all the supported commands that can be sent
 * by fart.py
 */
export const voiceCommands = [
    ...gameCommands,
    'NEW_GAME',
    'STOP_GAME',
    'PAUSE_GAME',
    'CONTINUE_GAME',
    'CORRECTION',
    'START_GAME',
    'NEXT_TURN',
    'BACK',
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

export type Difficulty = 'expert' | 'medium' | 'easy';

export enum Answer {
    NO = 0,
    YES = 1,
}

export type DartBaseValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
                            | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 25;

export type DartMultiplier = 0 | 1 | 2 | 3;

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
    type: 'NEW_GAME' | 'START_GAME' | 'STOP_GAME' | 'PAUSE_GAME' | 'CONTINUE_GAME' | 'CORRECTION' | 'NEXT_TURN' | 'BACK';
}

export type GameEvent = DifficultyEvent | PlayerCountEvent | AnswerEvent | ScoreEvent | ValuelessEvent;


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
  | 'ZERO'
  | 'NEED_A_DOUBLE_TO_START'
  | 'NEED_A_DOUBLE_TO_END'
  | 'SCORE_CANNOT_BE_NEGATIVE'
  | 'SCORE_CANNOT_BE_1'
  | 'WRONG_NUMBER';

export interface DartPlayed {
    baseValue: DartBaseValue;
    multiplier: DartMultiplier;
    status: DartStatus;
}

export function isVoiceCommand(s: string): s is VoiceCommand {
    return undefined !== voiceCommands.find((value) => value === s);
}

/**
 * This describes a possible command. 
 */
export interface PossibleThingToSay {
    // The command symbol
    command: string;

    // The text to actually say to trigger it like "next" or "double seven"
    textToSay: string;

    // A description of what the command will do if triggered
    description: string;
}

/**
 * Same as PossibleThingToSay, but for custom commands to switch
 * to another language.
 */
export interface LanguageSwitchCommand {
    textToSay: string;
    description: string;
}

export type State = 'WAITING_FOR_START'
 | 'PLAYING' | 'GAME_PAUSED' | 'GAME_ENDED'
 | 'WAITING_STOP_GAME_CONFIRMATION'
 | 'BACK_TO_HOME_SCREEN';

export interface LastPartOfSpeech {
    text: string;
    // If defined, it means that the text was not recognized as a game command
    iDidntUnderstandLabel?: string;
}


/**
 * This represents the structure of the configuration files given to fart.py
 */
export interface FartConfig {
    // The path to the vosk data model directory to use
    "vosk_model_path": string;

    // The prefix to print before matched patterns
    prefixMatch: string;

    // The prefix to print before unrecognized text
    prefixOther: string;

    // Associates to each symbolic token to recognize the list of strings
    // that will be accepted from the output of the speech recognition process
    tokens: Record<string, string[]>;

    // Associates to each symbolic command to recognize the list of token symbols
    // that will be accepted
    patterns: Record<string, string[]>;
}

export interface FinneganConfig extends FartConfig {
    // A description of the language used by this configuration like 'English' or 'Français'
    language: string;

    // All the UI messages, preferrably in the language the game is played in
    messages: Record<MessageId, string>;

    // Optional commands that allow to switch to another language
    // For this to work, the key must be of the form
    // "LOAD_CONFIG:<path to config file>"
    alternativeLanguageDescriptions?: Record<string, string>;
}

/**
 * The type of messages that can be sent with to the server.
 */
export interface CommandMsg {
    command: string;
}

// deno-lint-ignore no-explicit-any
export function isCommandMsg(obj: any): obj is CommandMsg {
    return typeof obj === 'object' && typeof obj.command === 'string';
}


export const CLOCKWISE_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
