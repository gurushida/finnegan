import { Language } from './language.ts';
import { VoiceCommand, DartBaseValue, DartStatus, DartMultiplier,
    Answer, GameEvent, GameName, DartPlayed, State, PossibleCommand } from "./types.ts";


// Global number of players, since it is quite likely
// that the same group of players will play multiple time a row
export let lastNumberOfPlayers = 2;


export interface PlayerStatus {
    description: string;

    // This array describes all the darts thrown by the player
    // Each cell dartsPlayed[n] corresponds to turn #n.
    // All cells contain all the darts for turn except the last one, if the
    // player is currently playing where the size of the last
    // dartsPlayed[n] array indicates the number of darts
    // played so far in this turn
    dartsPlayed: DartPlayed[][];
}


export abstract class GameEngine<PS extends PlayerStatus> {

    state: State = 'WAITING_FOR_START';
    playerStatuses: PS[] = [];
    currentPlayer = 0;
    turn = 0;

    // When the state is GAME_ENDED, this field indicates the index of
    // the winner in the playerStatuses array. If not defined, it means
    // that the game was stopped.
    winner?: number;

    constructor(readonly game: GameName, public numberOfPlayers: number) {}

    abstract createPlayer(playerIndex: number): PS;

    public startGame() {
        this.playerStatuses = [];
        for (let i = 0 ; i < this.numberOfPlayers ; i++) {
            this.playerStatuses.push(this.createPlayer(i));
        }
        this.state = 'PLAYING';
    }


    abstract isTurnComplete(): boolean;

    /**
     * Returns an array containing all the score commands that are relevant
     * at the current point of the game, like for instance discarding dart
     * values that are too high.
     */
    public getLegalMoveCommands() {
        const legalMoves: PossibleCommand[] = [];

        for (let multiplier = 1 ; multiplier <= 3 ; multiplier++) {
            for (let baseValue = 1 ; baseValue <= 20 ; baseValue++) {
                if ('OK' === this.getDartPlayedStatus(multiplier as DartMultiplier, baseValue as DartBaseValue)) {
                    legalMoves.push(`SCORE_${multiplier}x${baseValue}` as PossibleCommand);
                }
            }
        }
        if ('OK' === this.getDartPlayedStatus(1, 25)) {
            legalMoves.push('SCORE_1x25');
        }
        if ('OK' === this.getDartPlayedStatus(2, 25)) {
            legalMoves.push('SCORE_2x25');
        }
        return legalMoves;
    }

    /**
     * Override this method to add possible commands.
     * Unless special case, the subclass should merge its own commands
     * with the new ones provided here.
     */
    getPossibleCommands(): PossibleCommand[] {
        switch (this.state) {
            case 'WAITING_FOR_START': return [
                'START_GAME',
                'SET_PLAYER_COUNT_1',
                'SET_PLAYER_COUNT_2',
                'SET_PLAYER_COUNT_3',
                'SET_PLAYER_COUNT_4',
                'SET_PLAYER_COUNT_5',
                'SET_PLAYER_COUNT_6',
                'SET_PLAYER_COUNT_7',
                'SET_PLAYER_COUNT_8',
                'SET_PLAYER_COUNT_9',
                'SET_PLAYER_COUNT_10'];

            case 'PLAYING': {
                const cmds: PossibleCommand[] = ['PAUSE_GAME', 'STOP_GAME', 'CORRECTION'];
                if (this.isTurnComplete()) {
                    cmds.push('NEXT_TURN');
                } else {
                    cmds.push('<score>');
                    cmds.push(...this.getLegalMoveCommands());
                }
                return cmds;
            }
            case 'GAME_PAUSED': return ['CONTINUE_GAME'];
    
            case 'WAITING_STOP_GAME_CONFIRMATION': return ['ANSWER_YES', 'ANSWER_NO'];

            case 'GAME_ENDED': return [ 'BACK' ];

            default: return [];
        }
    }


    /**
     * Converts a voice command to an event. Here are defined
     * the commands that are common to all games. Override
     * this method to add custom logic for a particular game.
     *
     * Returns an event object or undefined if the command is
     * to be ignored.
     */
    public convertCommandToEvent(cmd: VoiceCommand): GameEvent | undefined {
        switch (cmd) {
            case 'BACK': return { type: 'BACK' };
            case 'STOP_GAME': return { type: 'STOP_GAME' };
            case 'PAUSE_GAME': return { type: 'PAUSE_GAME' };
            case 'CONTINUE_GAME': return { type: 'CONTINUE_GAME' };
            case 'CORRECTION': return { type: 'CORRECTION'} ;
            case 'START_GAME': return { type: 'START_GAME' };
            case 'NEXT_TURN': return { type: 'NEXT_TURN' };

            case 'ANSWER_YES': return { type: 'ANSWER', answer: Answer.YES };
            case 'ANSWER_NO': return { type: 'ANSWER', answer: Answer.NO };

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
                return { type: 'SET_PLAYER_COUNT', numberOfPlayers: parseInt(cmd.substring('SET_PLAYER_COUNT_'.length)) };
            }

            case 'SCORE_1x1':
            case 'SCORE_1x2':
            case 'SCORE_1x3':
            case 'SCORE_1x4':
            case 'SCORE_1x5':
            case 'SCORE_1x6':
            case 'SCORE_1x7':
            case 'SCORE_1x8':
            case 'SCORE_1x9':
            // deno-lint-ignore no-fallthrough
            case 'SCORE_1x10': {
                if (this.state === 'WAITING_FOR_START') {
                    // If we get a number between 1 and 10 when configuring the game, let's
                    // interpret that as a number of players
                    return { type: 'SET_PLAYER_COUNT', numberOfPlayers: parseInt(cmd.substring('SCORE_1x'.length)) };
                }
                // Otherwise, use the fallthrough to proceed with a score command
            }

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
            case 'SCORE_2x25':
            case 'SCORE_0x0': {
                const multiplierXvalue = cmd.substring('SCORE_'.length);
                const [multiplierStr, valueStr] = multiplierXvalue.split('x');
                const baseValue = parseInt(valueStr) as DartBaseValue;
                const multiplier = parseInt(multiplierStr) as DartMultiplier;
                return { type: 'SCORE_REPORT', baseValue, multiplier };
            }
        }
        return undefined;
    }

    /**
     * This is invoked when processing an event at the configuration stage,
     * before the game has started.
     */
    public processConfigEvent(event: GameEvent) {
        if (event.type === 'SET_PLAYER_COUNT') {
            lastNumberOfPlayers = event.numberOfPlayers;
            this.numberOfPlayers = event.numberOfPlayers;
            return;
        }
        if (event.type === 'START_GAME') {
            this.startGame();
        }
    }

    /**
     * Invoked when the CORRECTION command is issued.
     */
    public resetTurn() {
        this.playerStatuses[this.currentPlayer].dartsPlayed[this.turn] = [];
    }


    public processEndOfTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % this.numberOfPlayers;
        if (this.currentPlayer === 0) {
            this.turn++;
        }
    }
    

    abstract processGoodDartPlayedEvent(dart: DartPlayed): void;


    public gameOver(indexOfWinner?: number) {
        this.state = 'GAME_ENDED';
        this.winner = indexOfWinner;
    }


    /**
     * Given the description of a dart, returns the status this dart will have if played now.
     */
    abstract getDartPlayedStatus(multiplier: DartMultiplier, baseValue: DartBaseValue): DartStatus;


    public processEvent(event: GameEvent) {
        switch (this.state) {
            case 'WAITING_FOR_START': {
                this.processConfigEvent(event);
                return;
            }
    
            case 'PLAYING': {
                if (event.type === 'PAUSE_GAME') {
                    this.state = 'GAME_PAUSED';
                    return;
                }
                if (event.type === 'STOP_GAME') {
                    this.state = 'WAITING_STOP_GAME_CONFIRMATION';
                    return;
                }
    
                if (event.type === 'CORRECTION') {
                    this.resetTurn();
                    return;
                }
            
                // NEXT_TURN is only valid when we have played all the darts
                if (event.type === 'NEXT_TURN') {
                    if (this.isTurnComplete()) {
                        this.processEndOfTurn();
                    }
                    return;
                }

                if (event.type === 'SCORE_REPORT') {
                    if (this. isTurnComplete()) {
                        // Let's ignore any score report if we have already played all the darts
                        return;
                    }
                    
                    const dart: DartPlayed = {
                        baseValue: event.baseValue,
                        multiplier: event.multiplier,
                        status: this.getDartPlayedStatus(event.multiplier, event.baseValue),
                    };
                    this.playerStatuses[this.currentPlayer].dartsPlayed[this.turn].push(dart);
                    if (dart.status === 'OK') {
                        this.processGoodDartPlayedEvent(dart);
                    }
                }

                break;
            }
    
            case 'GAME_PAUSED': {
                if (event.type === 'CONTINUE_GAME') {
                    this.state = 'PLAYING';
                }
                break;
            }
    
            case 'WAITING_STOP_GAME_CONFIRMATION': {
                if (event.type === 'ANSWER') {
                    if (event.answer === Answer.YES) {
                        this.gameOver(undefined);
                    } else {
                        this.state = 'PLAYING';
                    }
                }
                break;
            }

            case 'GAME_ENDED': {
                if (event.type === 'BACK') {
                    this.gameOver(undefined);
                }
                break;
            }
        }
    }

    abstract renderForConsole(language: Language): void;


    /**
     * Returns a state object object containing all information needed
     * to render it. Subclass may add their own values.
     */
    getEngineState() {
        return {
            state: this.state,
            playerStatuses: this.playerStatuses,
            currentPlayer: this. currentPlayer,
            numberOfPlayers: this.numberOfPlayers,
            turn: this.turn,
            winner: this.winner,
        };
    }
}
