import { Language } from './language.ts';
import { Server } from './server.ts';
import { Finnegan } from './finnegan.ts';


const DEFAULT_PORT = 50301;


let device: string|undefined;
let samplerate: string|undefined;
let port: number | undefined = DEFAULT_PORT;
let useFart = true;



function printUsage() {
    console.log('Usage: finnegan [OPTIONS] <config>');
    console.log();
    console.log('Starts the game engine that begins to listen for voice commands, using the given json configuration file.');
    console.log(`Also starts a web server on port ${DEFAULT_PORT} to serve the game state and a web UI and also to receive`);
    console.log('game commands via POST requests.');
    console.log();
    console.log('OPTIONS:');
    console.log('  --list-devices   Runs "python3 fart.py -l" to show the available audio devices');
    console.log();
    console.log('  --language en | fr');
    console.log('           Sets the language: en=English, fr=French (default = English)');
    console.log();
    console.log('  --no-recognition');
    console.log('           Runs without the speech recognition. All commands must be sent via the web server.');
    console.log('           Requires the web server to run');
    console.log();
    console.log('  --port PORT');
    console.log(`           Specifies the port to use for the web server instead of the default ${DEFAULT_PORT}.`);
    console.log('           Use "--port none" to disable the web server');
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

        if (arg === '--no-recognition') {
            useFart = false;
            continue;
        }

        if (arg === '--port') {
            if (i === args.length) {
                console.error(`Missing ${arg} argument`);
                Deno.exit(1);
            }
            const argValue = args[i++];
            if (argValue === 'none') {
                port = undefined;
                continue;
            }
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

    if (!useFart && port === undefined) {
        console.error('Must specify a port to start a server when using --no-recognition');
        Deno.exit(1);
    }
    return configFile;
}


const configFile = await parseArguments();
const language = await Language.load(configFile);
const finnegan = new Finnegan(language, useFart, device, samplerate);
if (port !== undefined) {
    new Server(port, finnegan);
}
