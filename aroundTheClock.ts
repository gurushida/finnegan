import { DartPlayed, DartBaseValue, DartMultiplier, DartStatus } from './types.ts';
import { PlayerStatus, GameEngine, lastNumberOfPlayers } from './gameengine.ts';
import { Language } from './language.ts';
import { isIgnored, getDartDescription } from './utils.ts';


export interface PlayerStatusAroundTheClock extends PlayerStatus {
    targetToHit: number;
}

export class GameEngineAroundTheClock extends GameEngine<PlayerStatusAroundTheClock> {

    private playerTargetToHitFromLastTurn = 1;

    constructor() {
        super('AROUND_THE_CLOCK', lastNumberOfPlayers);
    }

    createPlayer(playerIndex: number): PlayerStatusAroundTheClock {
        return {
            description: '',
            targetToHit: 1,
            dartsPlayed: playerIndex === 0 ? [[]] : []
        };
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
