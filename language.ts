import { voiceCommands, PossibleThingToSay, MessageId,
    SWITCH_LANGUAGE_COMMAND_PREFIX, messageIDs, VoiceCommand, FinneganConfig, PossibleCommand } from './types.ts';

export class Language {

    private voiceCommand2Text: Partial<Record<VoiceCommand, string>>;
    private alternativeLanguages: PossibleThingToSay[];

    private constructor(readonly configFile: string, private config: FinneganConfig) {
        this.voiceCommand2Text = this.populateVoiceCommandMap();
        this.alternativeLanguages = this.populateAlternativeLanguages();
    }


    public getAlternativeLanguages() {
        return this.alternativeLanguages;
    }


    public getVoiceCommandText(cmd: VoiceCommand): string | undefined {
        return this.voiceCommand2Text[cmd];
    }


    /**
     * For each command, we look for the first token sequence, and
     * for each token, we take the first text sequence.
     */
    private populateVoiceCommandMap() {
        const voiceCommand2Text: Partial<Record<VoiceCommand, string>> = {};
        for (const cmd of voiceCommands) {
            const tokenSequence = this.config.patterns[cmd];
            if (!tokenSequence) {
                console.error(`Missing command ${cmd} in configuration file !`);
                Deno.exit(1);
            }

            voiceCommand2Text[cmd] = this.tokenSequence2TextToSay(tokenSequence[0]);
        }
        return voiceCommand2Text;
    }


    private populateAlternativeLanguages() {
        const alternativeLanguages: PossibleThingToSay[] = [];
        for (const pattern in this.config.patterns) {
            if (pattern.startsWith(SWITCH_LANGUAGE_COMMAND_PREFIX)) {
                if (!this.config.alternativeLanguageDescriptions) {
                    console.error('Missing property \'alternativeLanguageDescriptions\'');
                    Deno.exit(1);
                }
                const tokenSequence = this.config.patterns[pattern];
                if (!tokenSequence) {
                    console.error(`Missing token sequence for \'${pattern}\'`);
                    Deno.exit(1);
                }
                const textToSay = `${this.tokenSequence2TextToSay(tokenSequence[0])}`;
                const description = this.config.alternativeLanguageDescriptions[pattern];
                alternativeLanguages.push({
                    command: pattern,
                    textToSay,
                    description,
                });
            }
        }
        return alternativeLanguages;
    }
    

    private tokenSequence2TextToSay(tokenSequence: string): string {
        const result: string [] = [];
        const tokens = tokenSequence.split(' ');
        for (const token of tokens) {
            const alternative = this.config.tokens[token];
            if (!alternative) {
                console.error(`Missing token ${token} in configuration file !`);
                Deno.exit(1);
            }
            result.push(alternative[0]);
        }
    
        return result.join(' ');
    }


    private static checkLanguageData(cfg: FinneganConfig) {
        if (!cfg.language) {
            console.error('Missing \'language\' property in config file');
            Deno.exit(1);
        }
    
        if (!cfg.messages) {
            console.error('Missing \'messages\' property in config file');
            Deno.exit(1);
        }
    
        for (const id of messageIDs) {
            if (!cfg.messages[id]) {
                console.error(`Missing message \'${id}\' property in config file`);
                Deno.exit(1);    
            }
        }
    }

    
    public msg(msgId: MessageId) {
        return this.config.messages[msgId];
    }


    public getVocalCommand(cmd: PossibleCommand): string {
        if (cmd === '<score>') return cmd;
        return `${this.voiceCommand2Text[cmd] as string}`;
    }


    public getCommandDescription(cmd: PossibleCommand): string {
        switch (cmd) {
            case '501': return this.msg('501');
            case 'AROUND_THE_CLOCK': return this.msg('AROUND_THE_CLOCK');
            case 'NEW_GAME': return this.msg('NEW_GAME');
    
            case 'SET_DIFFICULTY_EXPERT': return this.msg('EXPERT_LEVEL');
            case 'SET_DIFFICULTY_MEDIUM': return this.msg('MEDIUM_LEVEL');
            case 'SET_DIFFICULTY_EASY': return this.msg('EASY_LEVEL');
    
            case 'SET_PLAYER_COUNT_1': return this.msg('1_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_2': return this.msg('2_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_3': return this.msg('3_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_4': return this.msg('4_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_5': return this.msg('5_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_6': return this.msg('6_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_7': return this.msg('7_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_8': return this.msg('8_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_9': return this.msg('9_PLAYER_GAME');
            case 'SET_PLAYER_COUNT_10': return this.msg('10_PLAYER_GAME');
    
            case 'ANSWER_YES': return this.msg('YES');
            case 'ANSWER_NO': return this.msg('NO');
    
            case 'START_GAME': return this.msg('START_GAME');
            case 'STOP_GAME': return this.msg('STOP_GAME');
            case 'PAUSE_GAME': return this.msg('PAUSE_GAME');
            case 'CONTINUE_GAME': return this.msg('BACK_FROM_PAUSE');
            case 'CORRECTION': return this.msg('CORRECTION');
            case 'NEXT_TURN': return this.msg('NEXT_TURN');
            case 'BACK': return this.msg('BACK');
            case '<score>': return this.msg('SCORE');
            default: {
                if (cmd.startsWith('SCORE_')) {
                    return this.msg('SCORE');
                }
    
                throw `Illegal cmd value: '${cmd}'`;
            }
        }
    }

    public static async load(configFile: string): Promise<Language> {
        const json = await Deno.readTextFile(configFile);
        const config = JSON.parse(json);
        Language.checkLanguageData(config);
        return new Language(configFile, config);
    }
}
