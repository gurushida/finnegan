import { DartPlayed, Difficulty,
  GameEvent, VoiceCommand, DartBaseValue, DartMultiplier, DartStatus, PossibleCommand } from './types.ts';
import { PlayerStatus, GameEngine, lastNumberOfPlayers } from './gameengine.ts';
import { Language } from './language.ts';
import { isIgnored, getDartDescription } from './utils.ts';

let lastDifficulty: Difficulty = 'easy';


export interface PlayerStatus501 extends PlayerStatus {
    score: number;
    needADoubleToStart: boolean;
}

export class GameEngine501 extends GameEngine<PlayerStatus501> {

    private playerScoreFromLastTurn = 501;
    private playerNeedADoubleToStartFromLastTurn;

    public difficulty: Difficulty

    constructor() {
        super('501', lastNumberOfPlayers);
        this.difficulty = lastDifficulty;
        this.playerNeedADoubleToStartFromLastTurn = this.difficulty === 'expert';
    }

    createPlayer(playerIndex: number): PlayerStatus501 {
        return {
            description: '',
            score: 501,
            needADoubleToStart: lastDifficulty === 'expert',
            dartsPlayed: playerIndex === 0 ? [[]] : []
        };
    }


    convertCommandToEvent(cmd: VoiceCommand): GameEvent | undefined {
        switch (cmd) {
            case 'SET_DIFFICULTY_EASY': return { type: 'SET_DIFFICULTY', difficulty: 'easy' };
            case 'SET_DIFFICULTY_MEDIUM': return { type: 'SET_DIFFICULTY', difficulty: 'medium' }
            case 'SET_DIFFICULTY_EXPERT': return { type: 'SET_DIFFICULTY', difficulty: 'expert' };

            default: {
                return super.convertCommandToEvent(cmd);
            }
        }
    }


    processConfigEvent(event: GameEvent) {
        if (event.type === 'SET_DIFFICULTY') {
            lastDifficulty = event.difficulty;
            this.difficulty = event.difficulty;
            return;
        }
        super.processConfigEvent(event);
    }


    processGoodDartPlayedEvent(dart: DartPlayed) {
        if (dart.multiplier === 2) {
            this.playerStatuses[this.currentPlayer].needADoubleToStart = false;
        }

        this.playerStatuses[this.currentPlayer].score -= (dart.multiplier * dart.baseValue);
        if (this.playerStatuses[this.currentPlayer].score === 0) {
            this.gameOver(this.currentPlayer);
        }
    }


    processEndOfTurn() {
        super.processEndOfTurn();
        this.playerScoreFromLastTurn = this.playerStatuses[this.currentPlayer].score;
        this.playerNeedADoubleToStartFromLastTurn = this.playerStatuses[this.currentPlayer].needADoubleToStart;
        this.playerStatuses[this.currentPlayer].dartsPlayed.push([]);
    }


    resetTurn() {
        super.resetTurn();
        this.playerStatuses[this.currentPlayer].score = this.playerScoreFromLastTurn;
        this.playerStatuses[this.currentPlayer].needADoubleToStart = this.playerNeedADoubleToStartFromLastTurn;
    }


    getDartPlayedStatus(multiplier: DartMultiplier, baseValue: DartBaseValue): DartStatus {
        if (baseValue === 0) {
            return 'ZERO';
        }

        const playerStatus = this.playerStatuses[this.currentPlayer];
        const needDoubleToFinish = this.difficulty !== 'easy';

        if (playerStatus.needADoubleToStart && multiplier !== 2) {
            return 'NEED_A_DOUBLE_TO_START';
        }

        if (baseValue * multiplier > playerStatus.score) {
            return 'SCORE_CANNOT_BE_NEGATIVE';
        }

        if (baseValue * multiplier === playerStatus.score) {
            if (needDoubleToFinish) {
                return multiplier === 2 ? 'OK' : 'NEED_A_DOUBLE_TO_END';
            }
            return 'OK';
        }

        if ((baseValue * multiplier === playerStatus.score - 1) && needDoubleToFinish) {
            return 'SCORE_CANNOT_BE_1';
        }

        return 'OK';
    }


    isTurnComplete() {
        return this.playerStatuses[this.currentPlayer].dartsPlayed[this.turn].length === 3;
    }


    getPossibleCommands(): PossibleCommand[] {
        const commands = super.getPossibleCommands();
        if (this.state === 'WAITING_FOR_START') commands.push(
            'SET_DIFFICULTY_EXPERT',
            'SET_DIFFICULTY_MEDIUM',
            'SET_DIFFICULTY_EASY');

        return commands;
    }


    private msgDifficulty(language: Language, d: Difficulty) {
        switch (d) {
            case 'expert': return language.msg('EXPERT');
            case 'medium': return language.msg('MEDIUM');
            case 'easy': return language.msg('EASY');
        }
    }
    


    public renderForConsole(language: Language) {
        switch(this.state) {
            case 'WAITING_FOR_START': {
                const labelDifficulty = `${language.msg('DIFFICULTY')}:`;
                const labelPlayers = `${language.msg('NUMBER_OF_PLAYERS')}:`;
                const maxLen = Math.max(labelDifficulty.length, labelPlayers.length);
                console.log(`${labelDifficulty.padEnd(maxLen)}   ${this.msgDifficulty(language, this.difficulty)}`);
                console.log(`${labelPlayers.padEnd(maxLen)}   ${this.numberOfPlayers}`);    
                break;
            }
            default: {
                this.printScoreBoard(language);
                break;
            }
        }
    }


    private printScoreBoard(language: Language) {
        console.log(`${language.msg('DIFFICULTY')}: ${this.msgDifficulty(language, this.difficulty)}`);
        console.log();
    
        for (let i = 0 ; i < this.numberOfPlayers ; i++) {
            const cur = i === this.currentPlayer;
            console.log(`${cur ? ' => ' : '    '}${this.playerStatuses[i].description}: ${this.playerStatuses[i].score}`);
        }
    
        console.log();
        if (this.state === 'PLAYING') {
            if (this.playerStatuses[this.currentPlayer].needADoubleToStart) {
                console.log(`${this.playerStatuses[this.currentPlayer].description} ${language.msg('NEEDS_A_DOUBLE_TO_START')}`);
            }
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

    public getEngineState() {
        const obj = super.getEngineState();
        return { ...obj, difficulty: this.difficulty };
    }

}