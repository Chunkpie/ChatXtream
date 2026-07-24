import './style.css';
import {
    initIdentityStore,
    hasIdentity,
    isCryptoReady,
    identityStore,
    createIdentity,
    unlockIdentity,
    subscribe
} from './lib/identity';
import { getMyFingerprint, createSealedEnvelope, openSealedEnvelope, computeDeliveryToken } from './lib/protocol';
import { relay } from './lib/relay';
import { fromHex } from './lib/crypto';

const app = document.querySelector<HTMLDivElement>('#app')!;

interface Message {
    fromMe: boolean;
    text: string;
    timestamp: number;
}

let activeContactFingerprint = '';
const messages: Message[] = [];

const render = () => {
    if (!isCryptoReady) {
        app.innerHTML = `<div class="container"><p>Initializing cryptography...</p></div>`;
        return;
    }

    if (identityStore) {
        const myFingerprint = getMyFingerprint(identityStore);
        
        app.innerHTML = `
            <div class="chat-container fade-in">
                <div class="sidebar">
                    <h2>Identity</h2>
                    <p class="subtitle" style="font-size: 12px; margin-bottom: 5px;">Your Fingerprint:</p>
                    <code class="fingerprint-small" onclick="navigator.clipboard.writeText('${myFingerprint}')" title="Click to copy">${myFingerprint.substring(0, 16)}...${myFingerprint.substring(myFingerprint.length - 16)}</code>
                    
                    <div style="margin-top: 2rem;">
                        <h3>New Chat</h3>
                        <input type="text" id="contact-fingerprint" placeholder="Paste Contact Fingerprint" value="${activeContactFingerprint}" />
                        <button id="start-chat" class="solid">Connect</button>
                    </div>
                </div>
                
                <div class="chat-area">
                    <div class="chat-header">
                        ${activeContactFingerprint ? `Chatting with: <code>${activeContactFingerprint.substring(0, 16)}...</code>` : 'Select a contact to start chatting'}
                    </div>
                    
                    <div class="messages" id="messages-container">
                        ${messages.map(m => `
                            <div class="message ${m.fromMe ? 'sent' : 'received'}">
                                <div class="bubble">${m.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                                <div class="time">${new Date(m.timestamp).toLocaleTimeString()}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <form id="send-form" class="chat-input" ${!activeContactFingerprint ? 'style="display:none;"' : ''}>
                        <input type="text" id="msg-input" placeholder="Type a message..." required autocomplete="off" />
                        <button type="submit" class="solid">Send</button>
                    </form>
                </div>
            </div>
        `;
        
        // Scroll to bottom
        const msgContainer = document.getElementById('messages-container');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;

        document.getElementById('start-chat')?.addEventListener('click', () => {
            const fp = (document.getElementById('contact-fingerprint') as HTMLInputElement).value.trim();
            if (fp.length === 128) {
                activeContactFingerprint = fp;
                render();
            } else {
                alert("Invalid fingerprint. Must be 128 hex characters.");
            }
        });

        document.getElementById('send-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('msg-input') as HTMLInputElement;
            const text = input.value.trim();
            if (!text || !activeContactFingerprint) return;

            // Create envelope
            try {
                const envelope = createSealedEnvelope(identityStore!, activeContactFingerprint, text);
                
                // Get target delivery token (Hash of their encryption pubkey)
                // The encryption pubkey is the first 64 chars of the fingerprint
                const recipientPubKeyHex = activeContactFingerprint.substring(0, 64);
                const recipientPubKeyBytes = fromHex(recipientPubKeyHex);
                const targetToken = computeDeliveryToken(recipientPubKeyBytes);
                
                // Send via relay
                relay.send(targetToken, envelope.ciphertext);
                
                // Add to local UI
                messages.push({
                    fromMe: true,
                    text,
                    timestamp: Date.now()
                });
                
                input.value = '';
                render();
            } catch (err) {
                console.error("Failed to send message", err);
                alert("Encryption failed. Check contact fingerprint.");
            }
        });
        
        return;
    }

    if (hasIdentity) {
        app.innerHTML = `
            <div class="container fade-in">
                <h1>Unlock Identity</h1>
                <form id="unlock-form" class="card">
                    <p>Enter your passphrase to decrypt your local keys.</p>
                    <input type="password" id="passphrase" placeholder="Passphrase" required />
                    <button type="submit" class="solid">Unlock</button>
                    <p id="error-msg" class="error"></p>
                </form>
            </div>
        `;
        document.getElementById('unlock-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pass = (document.getElementById('passphrase') as HTMLInputElement).value;
            const success = await unlockIdentity(pass);
            if (!success) {
                const err = document.getElementById('error-msg')!;
                err.textContent = 'Incorrect passphrase.';
            } else {
                // Initialize relay
                relay.init(identityStore!, handleIncomingMessage);
            }
        });
        return;
    }

    app.innerHTML = `
        <div class="container fade-in">
            <h1>Create Identity</h1>
            <form id="create-form" class="card">
                <p>Generate a new anonymous identity. Your keys never leave this device.</p>
                <div class="warning">
                    <strong>Warning:</strong> If you lose this passphrase, your identity cannot be recovered.
                </div>
                <input type="password" id="passphrase" placeholder="Choose a strong passphrase" required minlength="8" />
                <button type="submit" class="solid">Generate Keys</button>
            </form>
        </div>
    `;
    document.getElementById('create-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target as HTMLFormElement;
        const submitBtn = btn.querySelector('button')!;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Generating...';
        
        const pass = (document.getElementById('passphrase') as HTMLInputElement).value;
        await createIdentity(pass);
        // Initialize relay
        relay.init(identityStore!, handleIncomingMessage);
    });
};

const handleIncomingMessage = (envelopeBase64: string) => {
    if (!identityStore) return;
    const payload = openSealedEnvelope(identityStore, { ciphertext: envelopeBase64 });
    
    if (payload) {
        messages.push({
            fromMe: false,
            text: payload.text,
            timestamp: payload.timestamp
        });
        // Auto-switch to this contact if no active contact
        if (!activeContactFingerprint) {
            activeContactFingerprint = payload.fromFingerprint;
        }
        render();
    } else {
        console.warn("Received a message that could not be decrypted/verified.");
    }
};

// Initial render
render();

// Re-render on state change
subscribe(render);

// Boot
initIdentityStore();
