import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface QueuedMessage {
    envelope: string;
    expiresAt: number;
}

// In-memory state
const activeConnections = new Map<string, WebSocket>();
const messageQueue = new Map<string, QueuedMessage[]>();

const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [token, messages] of messageQueue.entries()) {
        const validMessages = messages.filter(m => m.expiresAt > now);
        if (validMessages.length === 0) {
            messageQueue.delete(token);
        } else {
            messageQueue.set(token, validMessages);
        }
    }
}, 60 * 60 * 1000);

wss.on('connection', (ws: WebSocket) => {
    let currentToken: string | null = null;

    ws.on('message', (data: string) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'subscribe') {
                if (!msg.token || typeof msg.token !== 'string') return;
                
                currentToken = msg.token;
                activeConnections.set(currentToken!, ws);
                
                const queued = messageQueue.get(currentToken!);
                if (queued && queued.length > 0) {
                    for (const qmsg of queued) {
                        ws.send(JSON.stringify({
                            type: 'deliver',
                            envelope: qmsg.envelope
                        }));
                    }
                    messageQueue.delete(currentToken!);
                }
            } else if (msg.type === 'send') {
                if (!msg.deliveryToken || !msg.envelope) return;

                const targetToken = msg.deliveryToken;
                const targetWs = activeConnections.get(targetToken);

                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: 'deliver',
                        envelope: msg.envelope
                    }));
                } else {
                    const queued = messageQueue.get(targetToken) || [];
                    queued.push({
                        envelope: msg.envelope,
                        expiresAt: Date.now() + MESSAGE_TTL_MS
                    });
                    messageQueue.set(targetToken, queued);
                }
            }
        } catch (e) {
            // Ignore malformed messages
        }
    });

    ws.on('close', () => {
        if (currentToken && activeConnections.get(currentToken) === ws) {
            activeConnections.delete(currentToken);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Relay server running on port ${PORT}`);
});
