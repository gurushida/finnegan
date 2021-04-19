import { serve } from 'std/http/server.ts';
import { readAll } from 'std/io/util.ts';
import { Finnegan } from './finnegan.ts';
import { isCommandMsg } from './types.ts';

export class Server {

    constructor(port: number, private finnegan: Finnegan) {
        void this.startServer(port);
    }

    private async startServer(port: number) {
        const server = serve({ hostname: "0.0.0.0", port });
    
        for await (const request of server) {
            if (request.method === 'GET' && request.url === '/state') {
                const headers = new Headers();
                headers.append('Content-Type', 'application/json');
                request.respond({
                    status: 200,
                    headers,
                    body: JSON.stringify(this.finnegan.getState(), null, 2)
                });
            } else if (request.method === 'GET' &&
                (request.url === '' || request.url === '/' || request.url.endsWith('.html'))) {
                let file: string;
                if (request.url === '' || request.url === '/') {
                    file = 'finnegan.html';
                } else {
                    file = request.url.substring(1);
                }
                try {
                    const html = await Deno.readTextFile(file);
                    const headers = new Headers();
                    headers.append('Content-Type', 'text/html');
                    request.respond({
                        status: 200,
                        headers,
                        body: html
                    });
                } catch (e) {
                    request.respond({
                        status: 404,
                        body: `Not found: ${file} ${e}`
                    });
                }
            } else if (request.method === 'GET' && (request.url === '/dartboard.svg'
                       || request.url === '/microphone-on.svg'
                       || request.url === '/microphone-off.svg')) {
                const svg = await Deno.readTextFile(request.url.substring(1));
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
                    this.finnegan.processCommand(obj.command);
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
    
}