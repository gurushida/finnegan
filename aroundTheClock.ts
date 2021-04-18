import { DartPlayed,
  GameEvent, VoiceCommand, DartBaseValue, DartMultiplier, DartStatus, PossibleCommand } from './types.ts';
import { PlayerStatus, GameEngine } from './gameengine.ts';
import { Language } from './language.ts';
import { isIgnored, getDartDescription } from './utils.ts';

let lastNumberOfPlayers = 2;


export interface PlayerStatusAroundTheClock extends PlayerStatus {
    targetToHit: number;
}

export class GameEngineAroundTheClock extends GameEngine<PlayerStatusAroundTheClock> {

    private playerTargetToHitFromLastTurn = 1;

    constructor() {
        super('AROUND_THE_CLOCK', lastNumberOfPlayers);
        console.log(`lastNumberOfPlayers: ${lastNumberOfPlayers}, this.numberOfPlayers = ${this.numberOfPlayers}`);
    }

    createPlayer(playerIndex: number): PlayerStatusAroundTheClock {
        return {
            description: '',
            targetToHit: 1,
            dartsPlayed: playerIndex === 0 ? [[]] : []
        };
    }


    convertCommandToEvent(cmd: VoiceCommand): GameEvent | undefined {
        switch (cmd) {
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

            default: {
                return super.convertCommandToEvent(cmd);
            }
        }
    }


    processConfigEvent(event: GameEvent) {
        if (event.type === 'SET_PLAYER_COUNT') {
            lastNumberOfPlayers = event.numberOfPlayers;
            this.numberOfPlayers = event.numberOfPlayers;
            return true;
        }
        super.processConfigEvent(event);
    }


    processGoodDartPlayedEvent(dart: DartPlayed) {
        if (dart.baseValue === 20) {
            this.gameOver(this.currentPlayer);
        } else {
            this.playerStatuses[this.currentPlayer].targetToHit = dart.baseValue + 1;
        }
    }


    processEndOfTurn() {
        super.processEndOfTurn();
        this.playerTargetToHitFromLastTurn = this.playerStatuses[this.currentPlayer].targetToHit;
        this.playerStatuses[this.currentPlayer].dartsPlayed.push([]);
    }


    resetTurn() {
        super.resetTurn();
        this.playerStatuses[this.currentPlayer].targetToHit = this.playerTargetToHitFromLastTurn;
    }


    getDartPlayedStatus(_: DartMultiplier, baseValue: DartBaseValue): DartStatus {
        if (baseValue === 0) {
            return 'ZERO';
        }

        if (baseValue === this.playerStatuses[this.currentPlayer].targetToHit) {
            return 'OK';
        } else {
            return 'WRONG_NUMBER';
        }
    }


    isTurnComplete() {
        return this.playerStatuses[this.currentPlayer].dartsPlayed[this.turn].length === 3;
    }


    getPossibleCommands(): PossibleCommand[] {
        const commands = super.getPossibleCommands();
        if (this.state === 'WAITING_FOR_START') commands.push(
            'SET_PLAYER_COUNT_1',
            'SET_PLAYER_COUNT_2',
            'SET_PLAYER_COUNT_3',
            'SET_PLAYER_COUNT_4',
            'SET_PLAYER_COUNT_5',
            'SET_PLAYER_COUNT_6',
            'SET_PLAYER_COUNT_7',
            'SET_PLAYER_COUNT_8',
            'SET_PLAYER_COUNT_9',
            'SET_PLAYER_COUNT_10');

        return commands;
    }


    public renderForConsole(language: Language) {
        switch(this.state) {
            case 'WAITING_FOR_START': {
                const labelPlayers = `${language.msg('NUMBER_OF_PLAYERS')}:`;
                console.log(`${labelPlayers}   ${this.numberOfPlayers}`);
                break;
            }
            default: {
                this.printScoreBoard(language);
                break;
            }
        }
    }


    private printScoreBoard(language: Language) {
        console.log();

        for (let i = 0 ; i < this.numberOfPlayers ; i++) {
            const cur = i === this.currentPlayer;
            console.log(`${cur ? ' => ' : '    '}${this.playerStatuses[i].description}: ${language.msg('NEEDS_TO_HIT')} ${this.playerStatuses[i].targetToHit}`);
        }

        console.log();
        if (this.state === 'PLAYING') {
            const dartsPlayedThisTurn = this.playerStatuses[this.currentPlayer].dartsPlayed[this.turn];
            for (let i = 0 ; i < dartsPlayedThisTurn.length ; i++) {
                const dart = dartsPlayedThisTurn[i];
                console.log(`${language.msg('DART')} ${i + 1}: ${getDartDescription(dart)}${isIgnored(dart) ? (' (' + language.msg('IGNORED')) + ')' : ''}`);
            }

            if (dartsPlayedThisTurn.length < 3) {
                console.log(`${language.msg('DART')} ${dartsPlayedThisTurn.length + 1}:`);
            }
        }

        console.log();
    }

}
