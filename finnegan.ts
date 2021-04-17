import { GameEngine, PlayerStatus } from "./gameengine.ts";
import { Language } from "./language.ts";
import { Game, isVoiceCommand, LastPartOfSpeech, PossibleCommand, PossibleThingToSay, SWITCH_LANGUAGE_COMMAND_PREFIX } from "./types.ts";
import { readLines } from 'std/io/bufio.ts';
import { GameEngine501 } from './501.ts';


export class Finnegan {

    private fartProcess: Deno.Process | undefined;
    private gameType: Game = '501';

    private gameEngine?: GameEngine<PlayerStatus>;
    private possibleThingsToSay: PossibleThingToSay[] = [];

    // A indication or a question to display to the user
    messageForUser?: string;

    // The last piece of text recognized by the speech recognition tool
    lastPartOfSpeech?: LastPartOfSpeech;


    constructor(private language: Language, private device: string|undefined, private samplerate: string|undefined) {
    this.onLanguageUpdated();
    }

    public getJson(): Record<string, unknown> {
        return {};
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

        if (!isVoiceCommand(cmd)) {
            console.error(`${this.language.msg('UNKNOWN_COMMAND')}: '${cmd}'`);
            return;
        }

        if (!this.gameEngine) {
            if (cmd === '501') {
                this.gameType = '501';
            } else if (cmd === 'AROUND_THE_CLOCK') {
                this.gameType = 'around_the_clock';
            } else if (cmd === 'NEW_GAME') {
                if (this.gameType === '501') {
                    this.gameEngine = new GameEngine501();
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
            if (this.gameEngine.state === 'GAME_ENDED' && !this.gameEngine.winner) {
                // When a game is stopped (state GAME_ENDED and no winner), we want to
                // go back to the game selection
                this.gameEngine = undefined;
            }
        }
    }

    private updateMessageForUser() {
        this.messageForUser = undefined;
        if (!this.gameEngine) {
            if (this.gameType !== '501') {
                this.messageForUser = `${this.gameType} not supported yet`;
            }
            return;
        }

        switch(this.gameEngine.state) {
            case 'GAME_PAUSED': this.messageForUser = `< ${this.language.msg('GAME_IS_PAUSED')} >`; break;
            case 'WAITING_STOP_GAME_CONFIRMATION': this.messageForUser = this.language.msg('ARE_YOU_SURE_YOU_TO_STOP_THE_GAME'); break;
            case 'GAME_ENDED': {
                if (this.gameEngine.winner) {
                    const winner = this.gameEngine.playerStatuses[this.gameEngine.winner].description;
                    this.messageForUser = `${winner} ${this.language.msg('_WON')}`;
                }
            }
        }
    }


    private async startFart(configFile: string) {
        if (this.fartProcess) {
            this.fartProcess.kill(9);
        }
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
            : ['NEW_GAME', '501', 'AROUND_THE_CLOCK'];
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

        this.gameEngine?.renderForConsole(this.language);

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
        const maxLen = Math.max(...(this.possibleThingsToSay.map(p => p.textToSay.length)),
                                ...Object.keys(this.language.getAlternativeLanguages()).map(p => p.length));
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
        this.startFart(this.language.configFile);
        this.updatePlayerNames();

        // When switching language, there is no point in showing the last piece
        // of text from the previous language
        this.lastPartOfSpeech = undefined;

        this.refresh();
    }

}