import { serve } from 'std/http/server.ts';
import { readAll } from 'std/io/util.ts';
import { WebSocketClient, WebSocketServer } from 'websocket/mod.ts';
import { Finnegan } from './finnegan.ts';
import { isCommandMsg } from './types.ts';

export class FinneganServer {

    private wsUrl: string;
    private websockets: WebSocketClient[] = [];

    constructor(httpPort: number, wsPort: number, private finnegan: Finnegan) {
        this.wsUrl = `ws://0.0.0.0:${wsPort}`;
        void this.startServer(httpPort);
        void this.startWsServer(wsPort);
        finnegan.addEventListener(() => this.sendWsMessage(JSON.stringify(this.getState(), null, 2)));
    }


    private startWsServer(port: number) {
        const wss = new WebSocketServer(port);
        wss.on("connection", (ws: WebSocketClient) => {
            this.websockets.push(ws);
        });
    }


    private sendWsMessage(msg: string) {
        const alive: WebSocketClient[] = []
        for (const ws of this.websockets) {
            if (!ws.isClosed) {
                alive.push(ws);
                ws.send(msg);
            }
        }
        this.websockets = alive;
    }


    private getState() {
        return { ...this.finnegan.getState(), wsUrl: this.wsUrl };
    }


    private async startServer(port: number) {
        const httpServer = serve({ hostname: "0.0.0.0", port });

        for await (const request of httpServer) {
            if (request.method === 'GET' && request.url === '/state') {
                const headers = new Headers();
                headers.append('Content-Type', 'application/json');
                request.respond({
                    status: 200,
                    headers,
                    body: JSON.stringify(this.getState(), null, 2)
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