import { Language } from './language.ts';
import { Server } from './server.ts';
import { Finnegan } from './finnegan.ts';


let device: string|undefined;
let samplerate: string|undefined;
let port: number | undefined;







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
const language = await Language.load(configFile);
const finnegan = new Finnegan(language, device, samplerate);
if (port !== undefined) {
    new Server(port, finnegan);
}



