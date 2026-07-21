"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
// In-memory state
const activeConnections = new Map();
const messageQueue = new Map();
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [token, messages] of messageQueue.entries()) {
        const validMessages = messages.filter(m => m.expiresAt > now);
        if (validMessages.length === 0) {
            messageQueue.delete(token);
        }
        else {
            messageQueue.set(token, validMessages);
        }
    }
}, 60 * 60 * 1000);
wss.on('connection', (ws) => {
    let currentToken = null;
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'subscribe') {
                if (!msg.token || typeof msg.token !== 'string')
                    return;
                currentToken = msg.token;
                activeConnections.set(currentToken, ws);
                const queued = messageQueue.get(currentToken);
                if (queued && queued.length > 0) {
                    for (const qmsg of queued) {
                        ws.send(JSON.stringify({
                            type: 'deliver',
                            envelope: qmsg.envelope
                        }));
                    }
                    messageQueue.delete(currentToken);
                }
            }
            else if (msg.type === 'send') {
                if (!msg.deliveryToken || !msg.envelope)
                    return;
                const targetToken = msg.deliveryToken;
                const targetWs = activeConnections.get(targetToken);
                if (targetWs && targetWs.readyState === ws_1.WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: 'deliver',
                        envelope: msg.envelope
                    }));
                }
                else {
                    const queued = messageQueue.get(targetToken) || [];
                    queued.push({
                        envelope: msg.envelope,
                        expiresAt: Date.now() + MESSAGE_TTL_MS
                    });
                    messageQueue.set(targetToken, queued);
                }
            }
        }
        catch (e) {
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
