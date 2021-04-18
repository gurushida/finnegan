import { GameEngine, PlayerStatus } from "./gameengine.ts";
import { Language } from "./language.ts";
import { GameName, gameNames, isVoiceCommand, LastPartOfSpeech, PossibleCommand, PossibleThingToSay, SWITCH_LANGUAGE_COMMAND_PREFIX } from "./types.ts";
import { readLines } from 'std/io/bufio.ts';
import { GameEngine501 } from './501.ts';
import { GameEngineAroundTheClock } from './aroundTheClock.ts';
import { GameEnginePursuit } from './pursuit.ts';


/**
 * This describes what will be served when doing a GET on /state
 */
interface FinneganState {

    // true if speech recognition is active; false otherwise
    listening: boolean;

    // The current selected game if we are on the home screen;
    // the name of the game running otherwise
    gameName: GameName;

    // If not defined, we are on the home screen, waiting to start a game engine.
    // Otherwise, this is a game-specific object describing the state of the engine
    gameEngineState?: Record<string, unknown>;

    // All the commands that can be executed
    possibleThingsToSay: PossibleThingToSay[];

    // Commands
    alternativeLanguages: PossibleThingToSay[];

    // Something to show the user, like a question
    messageForUser?: string;

    // The last piece of text recognized by the speech recognition tool
    lastPartOfSpeech?: LastPartOfSpeech;
}


export class Finnegan {

    private fartProcess: Deno.Process | undefined;
    private gameName: GameName = '501';

    private gameEngine?: GameEngine<PlayerStatus>;
    private possibleThingsToSay: PossibleThingToSay[] = [];

    // A indication or a question to display to the user
    messageForUser?: string;

    // The last piece of text recognized by the speech recognition tool
    lastPartOfSpeech?: LastPartOfSpeech;


    constructor(private language: Language, private listening: boolean, private device: string|undefined, private samplerate: string|undefined) {
        this.onLanguageUpdated();
    }

    public getState(): FinneganState {
        return {
            listening: this.listening,
            gameName: this.gameName,
            possibleThingsToSay: this.possibleThingsToSay,
            alternativeLanguages: this.language.getAlternativeLanguages(),
            messageForUser: this.messageForUser,
            lastPartOfSpeech: this.lastPartOfSpeech,
            gameEngineState: this.gameEngine?.getEngineState()
        };
    }


    public processCommand(cmd: string) {
        this.lastPartOfSpeech = undefined;
        if (isVoiceCommand(cmd)) {
            const text = this.language.getVoiceCommandText(cmd);
            if (text) {
                this.lastPartOfSpeech = {
                    text,
                    iDidntUnderstandLabel: undefined,
                };
            }
        }
        this.executeCommand(cmd);
        this.updateMessageForUser();
        this.refresh();
    }


    private async executeCommand(cmd: string) {
        if (cmd.startsWith(SWITCH_LANGUAGE_COMMAND_PREFIX)) {
            const configFile = cmd.substring(SWITCH_LANGUAGE_COMMAND_PREFIX.length);
            this.language = await Language.load(configFile);
            this.onLanguageUpdated();
            return;
        }

        if (cmd === 'MIC_ON') {
            this.listening = true;
            this.startFart(this.language.configFile);
            return;
        }

        if (cmd === 'MIC_OFF') {
            this.listening = false;
            this.stopFart();
            return;
        }

        if (!isVoiceCommand(cmd)) {
            console.error(`${this.language.msg('UNKNOWN_COMMAND')}: '${cmd}'`);
            return;
        }

        if (!this.gameEngine) {
            if (cmd === '501') {
                this.gameName = '501';
            } else if (cmd === 'AROUND_THE_CLOCK') {
                this.gameName = 'AROUND_THE_CLOCK';
            } else if (cmd === 'PURSUIT') {
                this.gameName = 'PURSUIT';
            } else if (cmd === 'NEW_GAME') {
                if (this.gameName === '501') {
                    this.gameEngine = new GameEngine501();
                } else if (this.gameName === 'AROUND_THE_CLOCK') {
                    this.gameEngine = new GameEngineAroundTheClock();
                } else if (this.gameName === 'PURSUIT') {
                    this.gameEngine = new GameEnginePursuit();
                }
            }
            this.updatePlayerNames();
            return;
        }

        // If there is a game engine running, let's ask it to process
        // the event
        const event = this.gameEngine.convertCommandToEvent(cmd);
        if (event) {
            this.gameEngine.processEvent(event);
            this.updatePlayerNames();
            if (this.gameEngine.state === 'GAME_ENDED' && this.gameEngine.winner === undefined) {
                // When a game is stopped (state GAME_ENDED and no winner), we want to
                // go back to the game selection
                this.gameEngine = undefined;
            }
        }
    }


    private updateMessageForUser() {
        this.messageForUser = undefined;
        if (!this.gameEngine) {
            return;
        }

        switch(this.gameEngine.state) {
            case 'GAME_PAUSED': this.messageForUser = `< ${this.language.msg('GAME_IS_PAUSED')} >`; break;
            case 'WAITING_STOP_GAME_CONFIRMATION': this.messageForUser = this.language.msg('ARE_YOU_SURE_YOU_TO_STOP_THE_GAME'); break;
            case 'GAME_ENDED': {
                if (this.gameEngine.winner !== undefined) {
                    this.messageForUser = this.gameEngine.getGameOverMessage(this.language);
                }
                break;
            }
        }
    }


    private stopFart() {
        if (this.fartProcess) {
            this.fartProcess.kill(9);
            this.fartProcess = undefined;
        }
    }


    private async startFart(configFile: string) {
        this.stopFart();

        const fartArgs = ['python3', '-u', 'fart.py', configFile];

        if (this.device) {
            fartArgs.push('-d', this.device);
        }
    
        if (this.samplerate) {
            fartArgs.push('-r', this.samplerate);
        }

        this.fartProcess = Deno.run({
            cmd: fartArgs,
            stdout: "piped",
            stderr: "null",
        });

        for await (const line of readLines(this.fartProcess.stdout!)) {
            if (line.startsWith('???:')) {
                this.lastPartOfSpeech = {
                    text: line.substring(4),
                    iDidntUnderstandLabel: this.language.msg('I_DIDNT_UNDERSTAND'),
                };
                this.refresh();
            } else if (line.startsWith('CMD:')) {
                this.processCommand(line.substring(4));
            }
        }
    }


    private refresh() {
        this.updatePossibleThingsToSay();
        this.render();
    }


    private updatePossibleThingsToSay() {
        const possibleCommands: PossibleCommand[] = this.gameEngine
            ? this.gameEngine.getPossibleCommands()
            : ['NEW_GAME', '501', 'AROUND_THE_CLOCK', 'PURSUIT'];
        this.possibleThingsToSay = [];
        for (const command of possibleCommands) {
            this.possibleThingsToSay.push({
                command,
                textToSay: this.language.getVocalCommand(command),
                description: this.language.getCommandDescription(command)
            });
        }
    }


    private render() {
        // The terminal escape code sequence "\u001b[2J\u001b[0;0H\u001b[3J" is
        // for clearing the screen at placing the corner in the top left corner
        console.log('\u001b[2J\u001b[0;0H\u001b[3J/---------------------------------------------------\\');
        console.log('|  FINNEGAN - VOICE CONTROLLED DART SCORING SYSTEM  |');
        console.log('\\---------------------------------------------------/');
        console.log();

        if (!this.gameEngine) {
            for (const game of gameNames) {
                console.log(`${(game === this.gameName) ? ' => ' : '    '}${this.language.msg(game)}`);
            }
        } else {
            this.gameEngine.renderForConsole(this.language);
        }

        console.log();
        if (this.messageForUser) {
            console.log(this.messageForUser);
            console.log();
        }

        this.printPossibleCommands();

        if (this.lastPartOfSpeech) {
            console.log();
            if (this.lastPartOfSpeech.iDidntUnderstandLabel) {
                console.log(`${this.lastPartOfSpeech.iDidntUnderstandLabel}: "${this.lastPartOfSpeech.text}"`);
            }
        }
    }


    private printPossibleCommands() {
        const thingsToSay = [...this.possibleThingsToSay, ...this.language.getAlternativeLanguages()]
          .filter(command => !command.command.startsWith('SCORE_'));
        const maxLen = Math.max(...thingsToSay.map(p => p.textToSay.length));

        const commandLines: string [] = [`${this.language.msg('POSSIBLE_THINGS_TO_SAY')}:`, ''];
        for (const command of this.possibleThingsToSay) {
            if (command.command.startsWith('SCORE_')) {
                continue;
            }
            commandLines.push(`${command.textToSay.padEnd(maxLen)}     ${command.description}`);
        }
        commandLines.push('');
        for (const altLang of this.language.getAlternativeLanguages()) {
            commandLines.push(`${altLang.textToSay.padEnd(maxLen)}     ${altLang.description}`);
        }

        const maxLineLen = Math.max(...(commandLines.map(line => line.length)));
        console.log(''.padStart(maxLineLen + 4, '*'));
        for (const line of commandLines) {
            console.log(`* ${line.padEnd(maxLineLen)} *`);
        }
        console.log(''.padStart(maxLineLen + 4, '*'));
    }


    private updatePlayerNames() {
        if (!this.gameEngine) {
            return;
        }

        for (let i = 0 ; i < this.gameEngine.playerStatuses.length ; i++) {
            console.log();
            this.gameEngine.playerStatuses[i].description = `${this.language.msg('PLAYER')} ${i + 1}`;
        }
    }


    public onLanguageUpdated() {
        if (this.listening) {
            this.startFart(this.language.configFile);
        } else {
            this.stopFart();
        }
        this.updatePlayerNames();
        this.updateMessageForUser();

        // When switching language, there is no point in showing the last piece
        // of text from the previous language
        this.lastPartOfSpeech = undefined;

        this.refresh();
    }

}