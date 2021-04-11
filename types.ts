export enum Difficulty {
    EXPERT = 0,
    MEDIUM = 1,
    EASY = 2,
}

export enum Answer {
    NO = 0,
    YES = 1,
}

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

export interface GameEvent {
    type: EventType;

    // Only relevant for SET_DIFFICULTY, ANSWER, SET_PLAYER_COUNT and SCORE_REPORT
    value?: number;

    // Only relevant for SCORE_REPORT
    is_double?: boolean;
    description?: string;
}
