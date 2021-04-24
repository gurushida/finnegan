import { DartPlayed, DartBaseValue, DartMultiplier, DartStatus, CLOCKWISE_NUMBERS, GameEvent, VoiceCommand } from './types.ts';
import { PlayerStatus, GameEngine, lastNumberOfPlayers } from './gameengine.ts';
import { Language } from './language.ts';
import { isIgnored, getDartDescription } from './utils.ts';


export interface PlayerStatusPursuit extends PlayerStatus {
    // Where the player is
    location: number;

    // The player's target, i.e. next number clockwise
    target: number;
}

export class GameEnginePursuit extends GameEngine<PlayerStatusPursuit> {

    private playerLocationFromLastTurn = 0;
    private playerTargetFromLastTurn = 0;

    constructor() {
        super('AROUND_THE_CLOCK', Math.min(2, lastNumberOfPlayers));
    }

    createPlayer(playerIndex: number): PlayerStatusPursuit {
        return {
            description: '',
            location: playerIndex === 0 ? 20 : 12,
            target: playerIndex === 0 ? 1 : 5,
            dartsPlayed: playerIndex === 0 ? [[]] : []
        };
    }


    processGoodDartPlayedEvent(dart: DartPlayed) {
        // If the hare goes back to 20, he wins
        if (dart.baseValue === 20 && this.currentPlayer === 0) {
            this.gameOver(this.currentPlayer);
            return;
        }

        // If any hound reaches the hare's number, the hare loses
        if (this.currentPlayer !== 0 && dart.baseValue === this.playerStatuses[0].location) {
            this.gameOver(undefined);
            return;
        }

        // Otherwise, let move on to the next target
        this.playerStatuses[this.currentPlayer].location = this.playerStatuses[this.currentPlayer].target;
        const indexOfCurrent = CLOCKWISE_NUMBERS.indexOf(this.playerStatuses[this.currentPlayer].target);
        const indexOfNextNumber = (indexOfCurrent + 1) % 20;
        this.playerStatuses[this.currentPlayer].target = CLOCKWISE_NUMBERS[indexOfNextNumber];
    }


    processEndOfTurn() {
        super.processEndOfTurn();
        this.playerLocationFromLastTurn = this.playerStatuses[this.currentPlayer].location;
        this.playerTargetFromLastTurn = this.playerStatuses[this.currentPlayer].target;
        this.playerStatuses[this.currentPlayer].dartsPlayed.push([]);
    }


    resetTurn() {
        super.resetTurn();
        this.playerStatuses[this.currentPlayer].location = this.playerLocationFromLastTurn;
        this.playerStatuses[this.currentPlayer].target = this.playerTargetFromLastTurn;
    }


    getDartPlayedStatus(_: DartMultiplier, baseValue: DartBaseValue): DartStatus {
        if (baseValue === 0) {
            return 'ZERO';
        }

        if (baseValue === this.playerStatuses[this.currentPlayer].target) {
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
            const animal = (i === 0) ? language.msg('HARE') : language.msg('HOUND');
            const cur = i === this.currentPlayer;
            console.log(`${cur ? ' => ' : '    '}${this.playerStatuses[i].description}: ${animal} ${language.msg('NEEDS_TO_HIT')} ${this.playerStatuses[i].location}`);
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


    /**
     * Enforces a minimum of 2 players
     */
    getVoiceCommands(): VoiceCommand[] {
        if (this.state === 'WAITING_FOR_START'){
            return [
                'START_GAME',
                'SET_PLAYER_COUNT_2',
                'SET_PLAYER_COUNT_3',
                'SET_PLAYER_COUNT_4',
                'SET_PLAYER_COUNT_5',
                'SET_PLAYER_COUNT_6',
                'SET_PLAYER_COUNT_7',
                'SET_PLAYER_COUNT_8',
                'SET_PLAYER_COUNT_9',
                'SET_PLAYER_COUNT_10'
            ];
        }
        return super.getVoiceCommands();
    }


    /**
     * Let's forbid setting the number of players to 1.
     */
    public convertCommandToEvent(cmd: VoiceCommand): GameEvent | undefined {
        if (cmd === 'SET_PLAYER_COUNT_1') {
            return undefined;
        }

        if (this.state === 'WAITING_FOR_START' && cmd === 'SCORE_1x1') {
            return undefined;
        }

        return super.convertCommandToEvent(cmd);
    }

    getGameOverMessage(language: Language) {
        if (this.winner === 0) {
            return language.msg('THE_HARE_WON');
        } else {
            return language.msg('THE_HARE_LOST');
        }
    }

}
