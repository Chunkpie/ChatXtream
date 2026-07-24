import { getMyDeliveryToken } from './protocol';
import type { IdentityKeys } from './crypto';

type MessageHandler = (envelopeBase64: string) => void;

class RelayClient {
    private ws: WebSocket | null = null;
    private messageHandler: MessageHandler | null = null;
    private identity: IdentityKeys | null = null;
    private reconnectTimer: any = null;

    init(identity: IdentityKeys, onMessage: MessageHandler) {
        this.identity = identity;
        this.messageHandler = onMessage;
        this.connect();
        this.startChaffing();
    }

    private connect() {
        if (this.ws) {
            this.ws.close();
        }

        // Use localhost for local dev. In production, this would be an env var.
        this.ws = new WebSocket('ws://localhost:3000');

        this.ws.onopen = () => {
            console.log("Connected to relay");
            if (this.identity) {
                const token = getMyDeliveryToken(this.identity);
                this.ws?.send(JSON.stringify({
                    type: 'subscribe',
                    token
                }));
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'deliver' && msg.envelope) {
                    if (this.messageHandler) {
                        this.messageHandler(msg.envelope);
                    }
                }
            } catch (e) {
                console.error("Failed to parse relay message", e);
            }
        };

        this.ws.onclose = () => {
            console.log("Disconnected from relay, reconnecting...");
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        };
    }

    send(targetDeliveryToken: string, envelopeBase64: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send message");
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'send',
            deliveryToken: targetDeliveryToken,
            envelope: envelopeBase64
        }));
    }

    private startChaffing() {
        // Send a random 2KB string every 15 seconds to defeat timing analysis
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Generate deterministic length dummy data
                const dummyPadding = "X".repeat(2048); 
                this.ws.send(JSON.stringify({
                    type: 'chaff',
                    padding: dummyPadding
                }));
            }
        }, 15000);
    }
}

export const relay = new RelayClient();
