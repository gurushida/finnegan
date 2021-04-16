import { GameEvent, Answer, isVoiceCommand, DartPlayed, PlayerStatus, DartMultiplier,
    DartBaseValue, N_DARTS_PER_TURN, GameState, PlayingState, PossibleCommand, VoiceCommand,
    voiceCommands, Difficulty, State, ValuelessGameState, MessageId, FinneganConfig, messageIDs, SWITCH_LANGUAGE_COMMAND_PREFIX, isCommandMsg
} from './types.ts';
import { serve } from 'std/http/server.ts';
import { readLines } from 'std/io/bufio.ts';
import { readAll } from 'std/io/util.ts';


function getBlankState(language: string): ValuelessGameState {
    return {
        language,
        state: 'NOT_PLAYING',
        possibleThingsToSay: [],
        alternativeLanguages: [],
    };
}


let game: GameState = getBlankState('');

let device: string|undefined;
let samplerate: string|undefined;
let port: number | undefined;
let lastNumberOfPlayers = 2;
let lastDifficulty: Difficulty = 'easy';
let config: FinneganConfig;
let voiceCommand2Text: Partial<Record<VoiceCommand, string>> = {};
let fartProcess: Deno.Process | undefined;

let playerScoreFromLastTurn = 501;
let playerNeedADoubleToStartFromLastTurn = false;

function populateAlternativeLanguageMap() {
    game.alternativeLanguages = [];
    for (const pattern in config.patterns) {
        if (pattern.startsWith(SWITCH_LANGUAGE_COMMAND_PREFIX)) {
            if (!config.alternativeLanguageDescriptions) {
                console.error('Missing property \'alternativeLanguageDescriptions\'');
                Deno.exit(1);
            }
            const tokenSequence = config.patterns[pattern];
            if (!tokenSequence) {
                console.error(`Missing token sequence for \'${pattern}\'`);
                Deno.exit(1);
            }
            const textToSay = `"${tokenSequence2TextToSay(tokenSequence[0])}"`;
            const description = config.alternativeLanguageDescriptions[pattern];
            game.alternativeLanguages.push({
                command: pattern,
                textToSay,
                description,
            });
        }
    }
}


function tokenSequence2TextToSay(tokenSequence: string): string {
    const result: string [] = [];
    const tokens = tokenSequence.split(' ');
    for (const token of tokens) {
        const alternative = config.tokens[token];
        if (!alternative) {
            console.error(`Missing token ${token} in configuration file !`);
            Deno.exit(1);
        }
        result.push(alternative[0]);
    }

    return result.join(' ');
}


/**
 * For each command, we look for the first token sequence, and
 * for each token, we take the first text sequence.
 */
function populateVoiceCommandMap() {
    voiceCommand2Text = {};
    for (const cmd of voiceCommands) {
        const tokenSequence = config.patterns[cmd];
        if (!tokenSequence) {
            console.error(`Missing command ${cmd} in configuration file !`);
            Deno.exit(1);
        }

        voiceCommand2Text[cmd] = tokenSequence2TextToSay(tokenSequence[0]);
    }
}


function checkLanguageData(cfg: FinneganConfig) {
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


async function startFart(configFile: string) {
    if (fartProcess) {
        fartProcess.kill(9);
    }
    const fartArgs = ['python3', '-u', 'fart.py', configFile];

    if (device) {
        fartArgs.push('-d', device);
    }

    if (samplerate) {
        fartArgs.push('-r', samplerate);
    }

    fartProcess = Deno.run({
        cmd: fartArgs,
        stdout: "piped",
        stderr: "null",
    });

    for await (const line of readLines(fartProcess.stdout!)) {
        if (line.startsWith('???:')) {
            game.unrecognizedText = {
                text: line.substring(4),
                iDidntUnderstandLabel: msg('I_DIDNT_UNDERSTAND'),
            };
            render();
        } else if (line.startsWith('CMD:')) {
            processCommand(line.substring(4));
        }
    }
}


function updatePlayerNames() {
    if (game.state === 'PLAYING'
      || game.state === 'GAME_PAUSED'
      || game.state === 'WAITING_QUIT_CONFIRMATION__PLAYING'
      || game.state === 'GAME_WON'
      || game.state === 'WAITING_QUIT_CONFIRMATION__GAME_WON'
      || game.state === 'WAITING_STOP_GAME_CONFIRMATION') {
        for (let i = 0 ; i < game.playerStatuses.length ; i++) {
            game.playerStatuses[i].description = `${msg('PLAYER')} ${i + 1}`;
        }
    }
}


async function startGameEngine(configFile: string) {
    const json = await Deno.readTextFile(configFile);
    config = JSON.parse(json);
    checkLanguageData(config);
    populateVoiceCommandMap();
    populateAlternativeLanguageMap();

    startFart(configFile);
    updatePossibleThingsToSay();
    updatePlayerNames();

    // When switching language, there is no point in showing the last
    // thing not understood in the previous language
    game.unrecognizedText = undefined;
    render();
}


function msg(msgId: MessageId) {
    return config.messages[msgId];
}


function getVocalCommand(cmd: PossibleCommand): string {
    if (cmd === '<score>') return cmd;
    return `"${voiceCommand2Text[cmd] as string}"`;
}


function getCommandDescription(cmd: PossibleCommand): string {
    switch (cmd) {
        case 'NEW_GAME': return msg('NEW_GAME');

        case 'SET_DIFFICULTY_EXPERT': return msg('EXPERT_LEVEL');
        case 'SET_DIFFICULTY_MEDIUM': return msg('MEDIUM_LEVEL');
        case 'SET_DIFFICULTY_EASY': return msg('EASY_LEVEL');

        case 'SET_PLAYER_COUNT_1': return msg('1_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_2': return msg('2_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_3': return msg('3_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_4': return msg('4_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_5': return msg('5_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_6': return msg('6_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_7': return msg('7_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_8': return msg('8_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_9': return msg('9_PLAYER_GAME');
        case 'SET_PLAYER_COUNT_10': return msg('10_PLAYER_GAME');

        case 'ANSWER_YES': return game.state === 'WAITING_STOP_GAME_CONFIRMATION' ? msg('STOP_GAME') : msg('QUIT');
        case 'ANSWER_NO': return msg('CANCEL');

        case 'START_GAME': return msg('START_GAME');
        case 'STOP_GAME': return msg('STOP_GAME');
        case 'PAUSE_GAME': return msg('PAUSE_GAME');
        case 'CONTINUE_GAME': return msg('BACK_FROM_PAUSE');
        case 'QUIT': return msg('QUIT');
        case 'CORRECTION': return msg('CORRECTION');
        case 'NEXT_TURN': return msg('NEXT_TURN');
        case '<score>': return msg('SCORE');
        default: throw 'Illegal cmd value';
    }
}


function printPossibleCommands() {
    const maxLen = Math.max(...(game.possibleThingsToSay.map(p => p.textToSay.length)),
                            ...Object.keys(game.alternativeLanguages).map(p => p.length));
    const commandLines: string [] = [`${msg('POSSIBLE_THINGS_TO_SAY')}:`, ''];
    for (const command of game.possibleThingsToSay) {
        commandLines.push(`${command.textToSay.padEnd(maxLen)}     ${command.description}`);
    }
    commandLines.push('');
    for (const altLang of game.alternativeLanguages) {
        commandLines.push(`${altLang.textToSay.padEnd(maxLen)}     ${altLang.description}`);
    }

    const maxLineLen = Math.max(...(commandLines.map(line => line.length)));
    console.log(''.padStart(maxLineLen + 4, '*'));
    for (const line of commandLines) {
        console.log(`* ${line.padEnd(maxLineLen)} *`);
    }
    console.log(''.padStart(maxLineLen + 4, '*'));
}


function updatePossibleThingsToSay() {
    const possibleCommands = getPossibleCommands(game.state);
    game.possibleThingsToSay = [];
    for (const command of possibleCommands) {
        game.possibleThingsToSay.push({
            command,
            textToSay: getVocalCommand(command),
            description: getCommandDescription(command)
        });
    }
}


function msgDifficulty(d: Difficulty) {
    switch (d) {
        case 'expert': return msg('EXPERT');
        case 'medium': return msg('MEDIUM');
        case 'easy': return msg('EASY');
    }
}


function render() {
    // The terminal escape code sequence "\u001b[2J\u001b[0;0H\u001b[3J" is
    // for clearing the screen at placing the corner in the top left corner
    console.log('\u001b[2J\u001b[0;0H\u001b[3J/-------------------------------------------------------\\');
    console.log('|  FINNEGAN - 501 DART VOICE CONTROLLED SCORING SYSTEM  |');
    console.log('\\-------------------------------------------------------/');
    console.log();

    switch(game.state) {
        case 'NOT_PLAYING': {
            break;
        }
        case 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING': {
            break;
        }
        case 'WAITING_FOR_START':
        case 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START': {
            const labelDifficulty = `${msg('DIFFICULTY')}:`;
            const labelPlayers = `${msg('NUMBER_OF_PLAYERS')}:`;
            const maxLen = Math.max(labelDifficulty.length, labelPlayers.length);
            console.log(`${labelDifficulty.padEnd(maxLen)}   ${msgDifficulty(game.difficulty)}`);
            console.log(`${labelPlayers.padEnd(maxLen)}   ${game.numberOfPlayers}`);
            break;
        }
        default: {
            printScoreBoard(game);
            break;
        }
    }

    console.log();
    if (game.messageForUser) {
        console.log(game.messageForUser);
        console.log();
    }

    printPossibleCommands();

    if (game.unrecognizedText) {
        console.log();
        console.log(`${game.unrecognizedText.iDidntUnderstandLabel}: "${game.unrecognizedText.text}"`);
    }
}


function getDartDescription(dart: DartPlayed) {
    if (dart.multiplier === 0) {
        return '  0';
    }
    if (getDartScore(dart) === 50) {
        return ' 50';
    }
    if (dart.baseValue === 25) {
        return ' 25';
    }
    switch (dart.multiplier) {
        case 1: return `${dart.baseValue}`.padStart(3, ' ');
        case 2: return `D${dart.baseValue}`.padStart(3, ' ');
        case 3: return `T${dart.baseValue}`.padStart(3, ' ');
    }
}


function printScoreBoard(g: PlayingState) {
    console.log(`${msg('DIFFICULTY')}: ${msgDifficulty(g.difficulty)}`);
    console.log();

    for (let i = 0 ; i < g.playerStatuses.length ; i++) {
        const cur = i === g.currentPlayer;
        console.log(`${cur ? ' => ' : '    '}${g.playerStatuses[i].description}: ${g.playerStatuses[i].score}`);
    }

    console.log();
    if (g.state === 'PLAYING') {
        if (g.playerStatuses[g.currentPlayer].needADoubleToStart) {
            console.log(`${g.playerStatuses[g.currentPlayer].description} ${msg('NEEDS_A_DOUBLE_TO_START')}`);
        }
        const dartsPlayedThisTurn = g.playerStatuses[g.currentPlayer].dartsPlayed[g.turn];
        for (let i = 0 ; i < dartsPlayedThisTurn.length ; i++) {
            const dart = dartsPlayedThisTurn[i];
            console.log(`${msg('DART')} ${i + 1}: ${getDartDescription(dart)}${isIgnored(dart) ? (' (' + msg('IGNORED')) + ')' : ''}`);
        }

        if (dartsPlayedThisTurn.length < N_DARTS_PER_TURN) {
            console.log(`${msg('DART')} ${dartsPlayedThisTurn.length + 1}:`);
        }
    }

    console.log();
}


function processCommand(cmd: string) {
    game.unrecognizedText = undefined;
    executeCommand(cmd);
    updatePossibleThingsToSay();
    render();
}


function executeCommand(cmd: string) {
    if (cmd.startsWith(SWITCH_LANGUAGE_COMMAND_PREFIX)) {
        const configFile = cmd.substring(SWITCH_LANGUAGE_COMMAND_PREFIX.length);
        setTimeout(() => {
            startGameEngine(configFile);
        }, 1);
        return;
    }

    if (!isVoiceCommand(cmd)) {
        console.error(`${msg('UNKNOWN_COMMAND')}: '${cmd}'`);
        return;
    }
    switch (cmd) {
        case 'NEW_GAME': processEvent({type: 'NEW_GAME'}); break;
        case 'STOP_GAME': processEvent({type: 'STOP_GAME'}); break;
        case 'PAUSE_GAME': processEvent({type: 'PAUSE_GAME'}); break;
        case 'CONTINUE_GAME': processEvent({type: 'CONTINUE_GAME'}); break;
        case 'QUIT': processEvent({type: 'QUIT'}); break;
        case 'CORRECTION': processEvent({type: 'CORRECTION'}); break;
        case 'START_GAME': processEvent({type: 'START_GAME'}); break;
        case 'NEXT_TURN': processEvent({type: 'NEXT_TURN'}); break;

        case 'ANSWER_YES': processEvent({type: 'ANSWER', answer: Answer.YES}); break;
        case 'ANSWER_NO': processEvent({type: 'ANSWER', answer: Answer.NO}); break;

        case 'SET_DIFFICULTY_EASY': processEvent({type: 'SET_DIFFICULTY', difficulty: 'easy'}); break;
        case 'SET_DIFFICULTY_MEDIUM': processEvent({type: 'SET_DIFFICULTY', difficulty: 'medium'}); break;
        case 'SET_DIFFICULTY_EXPERT': processEvent({type: 'SET_DIFFICULTY', difficulty: 'expert'}); break;

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
            processEvent({type: 'SET_PLAYER_COUNT', numberOfPlayers: parseInt(cmd.substring('SET_PLAYER_COUNT_'.length))});
            break;
        }

        case 'SCORE_0x0':
        case 'SCORE_1x1':
        case 'SCORE_1x2':
        case 'SCORE_1x3':
        case 'SCORE_1x4':
        case 'SCORE_1x5':
        case 'SCORE_1x6':
        case 'SCORE_1x7':
        case 'SCORE_1x8':
        case 'SCORE_1x9':
        case 'SCORE_1x10':
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
        case 'SCORE_2x25': {
            const multiplierXvalue = cmd.substring('SCORE_'.length);
            const [multiplierStr, valueStr] = multiplierXvalue.split('x');
            const baseValue = parseInt(valueStr) as DartBaseValue;
            const multiplier = parseInt(multiplierStr) as DartMultiplier;
            processEvent({type: 'SCORE_REPORT', baseValue, multiplier});
            break;
        }
    }
}


function startGame() {
    const playerStatuses: PlayerStatus[] = [];

    for (let i = 1 ; i <= lastNumberOfPlayers ; i++) {
        playerStatuses.push({
            description: `${msg('PLAYER')} ${i}`,
            score: 501,
            needADoubleToStart: lastDifficulty === 'expert',
            dartsPlayed: []
        });
        playerScoreFromLastTurn = 501;
        playerNeedADoubleToStartFromLastTurn = (lastDifficulty === 'expert');
    }
    playerStatuses[0].dartsPlayed.push([]);




    game = {
        language: config.language,
        state: 'PLAYING',
        turn: 0,
        possibleThingsToSay: [],
        alternativeLanguages: [],
        difficulty: lastDifficulty,
        playerStatuses,
        currentPlayer: 0,
        messageForUser: undefined,
    };
    populateAlternativeLanguageMap();
}


function isDouble(dart: DartPlayed) {
    return dart.multiplier === 2;
}


function getDartScore(dart: DartPlayed) {
    return dart.multiplier * dart.baseValue;
}


function isIgnored(dart: DartPlayed) {
    return dart.status !== 'OK';
}


function quit() {
    console.log('Bye bye...');
    console.log();
    Deno.exit(0);
}


function getPossibleCommands(state: State): PossibleCommand[] {
    switch (state) {
        case 'NOT_PLAYING':
        case 'GAME_WON': return ['NEW_GAME', 'QUIT'];

        case 'WAITING_FOR_START': return [
            'START_GAME',
            'SET_DIFFICULTY_EXPERT',
            'SET_DIFFICULTY_MEDIUM',
            'SET_DIFFICULTY_EASY',
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
            'QUIT'];
        case 'PLAYING': {
            const cmds: PossibleCommand[] = ['QUIT', 'PAUSE_GAME', 'STOP_GAME', 'CORRECTION'];
            if (isTurnComplete()) {
                cmds.push('NEXT_TURN');
            } else {
                cmds.push('<score>');
            }
            return cmds;
        }
        case 'GAME_PAUSED': return ['CONTINUE_GAME'];

        case 'WAITING_STOP_GAME_CONFIRMATION':
        case 'WAITING_QUIT_CONFIRMATION__GAME_WON':
        case 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING':
        case 'WAITING_QUIT_CONFIRMATION__PLAYING':
        case 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START': return ['ANSWER_YES', 'ANSWER_NO'];
    }
}


function waitForStart() {
    game = {
        language: config.language,
        state: 'WAITING_FOR_START',
        possibleThingsToSay: [],
        alternativeLanguages: [],
        numberOfPlayers: lastNumberOfPlayers,
        difficulty: lastDifficulty,
        messageForUser: undefined,
    };
    populateAlternativeLanguageMap();
}


function waitForQuitAnswerWhileNotPlaying() {
    game.state = 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING';
    game.messageForUser = msg('ARE_YOU_SURE_YOU_WANT_TO_QUIT');
}


function waitForQuitAnswerWhenGameIsWon() {
    game.state = 'WAITING_QUIT_CONFIRMATION__GAME_WON';
    game.messageForUser = msg('ARE_YOU_SURE_YOU_WANT_TO_QUIT');
}


function waitForQuitAnswerWhileWaitingForStart() {
    game.state = 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START';
    game.messageForUser = msg('ARE_YOU_SURE_YOU_WANT_TO_QUIT');
}


function waitForQuitAnswerWhilePlaying() {
    game.state = 'WAITING_QUIT_CONFIRMATION__PLAYING';
    game.messageForUser = msg('ARE_YOU_SURE_YOU_WANT_TO_QUIT');
}


function pauseGame() {
    game.state = 'GAME_PAUSED';
    game.messageForUser = `< ${msg('GAME_IS_PAUSED')} >`;
}


function waitForStopGameAnswer() {
    game.state = 'WAITING_STOP_GAME_CONFIRMATION';
    game.messageForUser = msg('ARE_YOU_SURE_YOU_TO_STOP_THE_GAME');
}


function continuePlaying() {
    game.state = 'PLAYING';
    game.messageForUser = undefined;
}


function gameOver() {
    game.state = 'GAME_WON';
    game.messageForUser = `${msg('PLAYER')} ${(game as PlayingState).currentPlayer + 1} ${msg('_WON')}`
}


/**
 * Given the current state, this function processes an incoming event.
 * If the event is not expected in the current state, it is ignored.
 *
 * Returns true if the event was processed; false if it was ignored.
 */
function processEvent(event: GameEvent): boolean {
    switch (game.state) {
        case 'NOT_PLAYING': {
            // If there is no game in progress, we can only start one
            if (event.type === 'NEW_GAME') {
                waitForStart();
                return true;
            }
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhileNotPlaying();
                return true;
            }
            break;
        }

        case 'GAME_WON': {
            // If there is no game in progress, we can only start one
            if (event.type === 'NEW_GAME') {
                waitForStart();
                return true;
            }
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhenGameIsWon();
                return true;
            }
            break;
        }
    
        case 'WAITING_FOR_START': {
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhileWaitingForStart();
                return true;
            }
            if (event.type === 'SET_PLAYER_COUNT') {
                lastNumberOfPlayers = event.numberOfPlayers;
                game.numberOfPlayers = event.numberOfPlayers;
                return true;
            }
            if (event.type === 'SET_DIFFICULTY') {
                lastDifficulty = event.difficulty;
                game.difficulty = event.difficulty;
                return true;
            }
            if (event.type === 'START_GAME') {
                startGame();
                return true;
            }
            break;
        }

        case 'PLAYING': {
            if (event.type === 'QUIT') {
                waitForQuitAnswerWhilePlaying();
                return true;
            }
            if (event.type === 'PAUSE_GAME') {
                pauseGame();
                return true;
            }
            if (event.type === 'STOP_GAME') {
                waitForStopGameAnswer();
                return true;
            }
            if (event.type === 'CORRECTION') {
                resetTurn();
                return true;
            }

            // NEXT_TURN is only valid when we have played all the darts
            if (event.type === 'NEXT_TURN') {
                if (isTurnComplete()) {
                    processEndOfTurn();
                    return true;
                }
                return false;
            }

            if (event.type === 'SCORE_REPORT') {
                if (isTurnComplete()) {
                    // Let's ignore any score report if we have already played all the darts
                    return false;
                }

                const dart: DartPlayed = {
                    baseValue: event.baseValue,
                    multiplier: event.multiplier,
                    status: 'OK',
                };
                game.playerStatuses[game.currentPlayer].dartsPlayed[game.turn].push(dart);

                const currentScore = game.playerStatuses[game.currentPlayer].score;
                if (game.playerStatuses[game.currentPlayer].needADoubleToStart) {
                    if (isDouble(dart)) {
                        // If we need a double start, we are still at 501 so any double
                        // is guaranteed to be valid
                        game.playerStatuses[game.currentPlayer].needADoubleToStart = false;
                    } else {
                        // We need a double and did not get one
                        dart.status = 'NEED_A_DOUBLE_TO_START';
                        return true;
                    }
                }
                const dartScore = getDartScore(dart);
                if (dartScore > currentScore) {
                    // If the dart would make the score be negative, we have to ignore it
                    dart.status = 'SCORE_CANNOT_BE_NEGATIVE';
                    return true;
                }
                if (dartScore === currentScore - 1) {
                    if (game.difficulty !== 'easy') {
                        // If we need a double to finish, ending up with 1 is illegal
                        dart.status = 'SCORE_CANNOT_BE_1';
                        return true;
                    }
                    game.playerStatuses[game.currentPlayer].score = 1;
                    return true;
                }
                if (dartScore === currentScore) {
                    if (game.difficulty !== 'easy' && !isDouble(dart)) {
                        // If we need a double to finish and haven't got one, we ignore the dart
                        dart.status = 'NEED_A_DOUBLE_TO_END';
                        return true;
                    }
                    // We have reached 0, game is over
                    game.playerStatuses[game.currentPlayer].score = 0;
                    gameOver();
                    return true;
                }
                game.playerStatuses[game.currentPlayer].score -= dartScore;
                return true;
            }
            break;
        }

        case 'GAME_PAUSED': {
            if (event.type === 'CONTINUE_GAME') {
                continuePlaying();
                return true;
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__NOT_PLAYING': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    game = getBlankState(config.language);
                    populateAlternativeLanguageMap();
                    return true;
                }
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__WAITING_FOR_START': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    waitForStart();
                    return true;
                }
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__PLAYING': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    continuePlaying();
                    return true;
                }
            }
            break;
        }

        case 'WAITING_QUIT_CONFIRMATION__GAME_WON': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    quit();
                } else {
                    gameOver();
                    return true;
                }
            }
            break;
        }

        case 'WAITING_STOP_GAME_CONFIRMATION': {
            if (event.type === 'ANSWER') {
                if (event.answer === Answer.YES) {
                    game = getBlankState(config.language);
                    populateAlternativeLanguageMap();
                } else {
                    continuePlaying();
                }
                return true;
            }
            break;
        }
    }

    return false;
}



function isTurnComplete() {
    if (game.state !== 'PLAYING') {
        throw 'Illegal state';
    }
    return game.playerStatuses[game.currentPlayer].dartsPlayed[game.turn].length === N_DARTS_PER_TURN;
}


function resetTurn() {
    if (game.state !== 'PLAYING') {
        throw 'Illegal state';
    }
    game.playerStatuses[game.currentPlayer].dartsPlayed[game.turn] = [];
    game.playerStatuses[game.currentPlayer].score = playerScoreFromLastTurn;
    game.playerStatuses[game.currentPlayer].needADoubleToStart = playerNeedADoubleToStartFromLastTurn;
}


function processEndOfTurn() {
    if (game.state !== 'PLAYING') {
        throw 'Illegal state';
    }
    game.currentPlayer = (game.currentPlayer + 1) % game.playerStatuses.length;
    if (game.currentPlayer === 0) {
        game.turn++;
    }
    playerScoreFromLastTurn = game.playerStatuses[game.currentPlayer].score;
    playerNeedADoubleToStartFromLastTurn = game.playerStatuses[game.currentPlayer].needADoubleToStart;
    game.playerStatuses[game.currentPlayer].dartsPlayed.push([]);
}


async function startServer(port: number) {
    const server = serve({ hostname: "0.0.0.0", port });

    for await (const request of server) {
        if (request.method === 'GET' && request.url === '/state') {
            const headers = new Headers();
            headers.append('Content-Type', 'application/json');
            request.respond({
                status: 200,
                headers,
                body: JSON.stringify(game, null, 2)
            });
        } else if (request.method === 'GET' &&
            (request.url === '' || request.url === '/' || request.url === '/finnegan.html')) {
            const html = await Deno.readTextFile('finnegan.html');
            const headers = new Headers();
            headers.append('Content-Type', 'text/html');
            request.respond({
                status: 200,
                headers,
                body: html
            });
        } else if (request.method === 'GET' && request.url === '/dartboard.svg') {
            const svg = await Deno.readTextFile('dartboard.svg');
            const headers = new Headers();
            headers.append('Content-Type', 'image/svg+xml');
            request.respond({
                status: 200,
                headers,
                body: svg
            });
        } else if (request.method === 'POST' && request.url === '/command') {
            try {
                const bytes = await readAll(request.body);
                const bodyText = new TextDecoder('utf8').decode(bytes);
                const obj = JSON.parse(bodyText);
                if (!isCommandMsg(obj)) {
                    throw `Invalid body: ${bodyText}`;
                }
                request.respond({
                    status: 200
                });
                processCommand(obj.command);
            } catch (e) {
                request.respond({
                    status: 400,
                    body: `Bad request: ${e}`
                });
            }
        } else {
            request.respond({
                status: 404,
                body: ''
            });
        }
    }
}

function printUsage() {
    console.log('Usage: finnegan [OPTIONS] <config>');
    console.log();
    console.log('Starts the game engine that begins to listen for voice commands, using the given json configuration file.');
    console.log();
    console.log('OPTIONS:');
    console.log('  --list-devices   Runs "python3 fart.py -l" to show the available audio devices');
    console.log();
    console.log('  --language en | fr');
    console.log('           Sets the language: en=English, fr=French (default = English)');
    console.log();
    console.log('  --difficulty  expert | medium | easy');
    console.log('           Sets the initial game difficulty (default = easy)');
    console.log();
    console.log('  --players N');
    console.log('           Sets the initial number of players (default = 2)');
    console.log();
    console.log('  --port PORT');
    console.log('           If specified, starts a web server that listens to the given port and');
    console.log('           replies to http request with the current game state in json format');
    console.log();
    console.log('  --device D');
    console.log('           Specifies the audio device parameter to be passed to fart.py');
    console.log();
    console.log('  --samplerate RATE');
    console.log('           Specifies the samplerate parameter to be passed to fart.py');
    console.log();
}


async function parseArguments(): Promise<string> {
    const args = Deno.args;
    if (args.length === 0) {
        printUsage();
        Deno.exit(0);
    }

    let configFile: string | undefined;
    let i = 0;
    while (i < args.length) {
        const arg = args[i++];

        if (arg === '--list-devices') {
            const p = Deno.run({
                cmd: ['python3', '-u', 'fart.py', '-l']
            });
            await p.status();
            Deno.exit(0);
        }

        if (arg === '--difficulty') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                Deno.exit(1);
            }
            const argValue = args[i++];
            if (argValue !== 'expert' && argValue !== 'medium' && argValue !== 'easy') {
                console.error(`Invalid ${arg} argument: ${argValue}`);
                Deno.exit(1);
            }
            lastDifficulty = argValue;
            continue;
        }

        if (arg === '--players') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                Deno.exit(1);
            }
            const argValue = args[i++];
                lastNumberOfPlayers = parseInt(argValue);
            if (isNaN(lastNumberOfPlayers) || lastNumberOfPlayers < 1 || lastNumberOfPlayers > 10) {
                console.error(`Invalid ${arg} argument: ${argValue}`);
                Deno.exit(1);
            }
            continue;
        }

        if (arg === '--port') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                Deno.exit(1);
            }
            const argValue = args[i++];
                port = parseInt(argValue);
            if (isNaN(port) || port < 1024 || port > 65635) {
                console.error(`Invalid ${arg} argument: ${argValue}`);
                Deno.exit(1);
            }
            continue;
        }

        if (arg === '--device') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                Deno.exit(1);
            }
            device = args[i++];
            continue;
        }

        if (arg === '--samplerate') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                Deno.exit(1);
            }
            device = args[i++];
            continue;
        }

        if (configFile === undefined) {
            configFile = arg;
        } else {
            console.error(`Unknown argument: ${arg}`);
        }
    }

    if (configFile === undefined) {
        console.error('Missing configuration file');
        Deno.exit(1);
    }

    return configFile;
}


const configFile = await parseArguments();

if (port !== undefined) {
    startServer(port);
}

await startGameEngine(configFile);
