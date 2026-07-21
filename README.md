<div align="center">
  <h1>ChatXtream</h1>

  <p><strong>An open-source anonymity-first chat platform built for privacy — runs fully decentralized, or with self-hosted relays for persistent delivery.</strong></p>
  
  <p>
    <a href="#-key-features"><img src="https://img.shields.io/badge/Features-Extensive-007EC6?labelColor=555555" alt="Features"></a>
    <a href="#-how-it-works-the-protocol"><img src="https://img.shields.io/badge/Stack-TypeScript_%7C_Node.js-8A2BE2?labelColor=555555" alt="Stack"></a>
    <a href="#-hosting--deployment-for-admins"><img src="https://img.shields.io/badge/Docker-Ready-007EC6?logo=docker&labelColor=555555" alt="Docker"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-4c1?labelColor=555555" alt="License: MIT"></a>
  </p>

  <p><em>Generate identity keys locally, exchange fingerprints securely, route via sealed sender, and chat with true metadata resistance—<br/>run fully self-hosted at zero cost, or connect to public relays for instant delivery.</em></p>
</div>

--- 

---

## Table of Contents

- [Why ChatXtream?](#why-chatxtream)
- [Key Features](#key-features)
- [Threat Model & Guarantees](#threat-model--guarantees)
- [How It Works (The Protocol)](#how-it-works-the-protocol)
- [Quick Start (For Users)](#quick-start-for-users)
- [Hosting & Deployment (For Admins)](#hosting--deployment-for-admins)
  - [Running Locally](#running-locally)
  - [Deploying to Production](#deploying-to-production)
- [Contributing](#contributing)
- [License](#license)

---

## Why ChatXtream?

Traditional "secure" messengers often protect the *content* of your messages (via End-to-End Encryption) but drastically fail to protect your **metadata**. They know who you are, when you are online, and exactly who you are messaging. 

ChatXtream is built for scenarios where absolute metadata privacy is a requirement:
*   **Journalists & Sources:** Communicate securely without leaving a digital trail of "who spoke to whom and when" on a central server that can be subpoenaed.
*   **Activists & Organizers:** Coordinate in restrictive environments where traditional messaging apps are monitored, blocked, or require tying an account to a real-world phone number.
*   **Privacy Advocates:** Anyone who wants to chat with a friend without feeding their social graph to a corporation.

---

## Key Features

*   **Zero Accounts:** Identity is generated entirely on your device using cryptographic keypairs (`libsodium`).
*   **Sealed Sender Protocol:** The relay server routes messages using ephemeral tokens. It never knows the true identity of the sender or the recipient.
*   **Stateless Relay:** The backend has no database. It only holds encrypted messages in RAM for offline users, deleting them automatically after a 24-hour TTL.
*   **End-to-End Encrypted (E2EE):** All messages are encrypted locally using `Curve25519` before ever touching the network.
*   **No IP Tracking:** Rate-limiting and routing are completely decoupled from IP addresses.
*   **Self-Hostable:** Deploy the backend anywhere. It costs virtually nothing to run and can be hidden behind Tor or Cloudflare.

---

## Threat Model & Guarantees

Transparency is critical for anonymity tools. Here is exactly what ChatXtream protects against, and what it does *not*.

| Adversary | What they can see | What ChatXtream defends against |
| :--- | :--- | :--- |
| **Relay Server Operator** | Encrypted blobs, connection timing | **Content** (via E2EE), **Identity Linkage** (via sealed sender). The server does not know who sent a message. |
| **Network Eavesdropper (ISP)** | TLS-wrapped traffic to the relay | **Content & Destination**. (Traffic *timing/volume* can still be inferred). |
| **Compromised Recipient Device** | Their own message history | **Nothing** — device security is out of scope. If your friend's phone is hacked, the chat is compromised. |
| **Legal/Subpoena Request** | Whatever the server stores | **Minimized** by storing *no* plaintext metadata and writing *nothing* to disk. |

> **Disclaimer:** ChatXtream aims to be meaningfully better than standard E2EE messengers regarding metadata. However, it does not currently claim to defeat global nation-state adversaries monitoring all global network timing (e.g., NSA). For life-or-death anonymity, use Tor/Tails.

---

## How It Works (The Protocol)

ChatXtream's architecture is split into a **Client** (Vanilla TypeScript/Svelte) and a **Relay** (Node.js/WebSocket).

### 1. Identity Generation
When you open the app, it uses `libsodium` to generate two keypairs:
1.  **X25519** (For E2EE Encryption)
2.  **Ed25519** (For Identity Signing)

These keys are encrypted using an **Argon2id** derived key (based on your passphrase) and stored safely inside your browser's IndexedDB. Your private keys *never* leave your device.

### 2. The Fingerprint
Your public identity is a 128-character hexadecimal string. This is a concatenation of your public encryption key and your public signing key. Because there is no central user directory, you must exchange this fingerprint out-of-band with your contact.

### 3. Sealed Sender Routing
When you send a message to a contact:
1.  Your app hashes their public encryption key to generate a **Delivery Token**.
2.  Your app packages your message, signs it with your Ed25519 key, and encrypts it using `crypto_box_seal` (Anonymous Public-Key Encryption) targeted at their public key.
3.  The app sends `{ deliveryToken, encryptedEnvelope }` to the Relay Server.
4.  The server looks up the `deliveryToken` and forwards the envelope. If the user is offline, it holds it in RAM for 24 hours. The server cannot read the envelope, nor does it know who sent it.

---

## Quick Start (For Users)

Want to just use the app? If an instance is already hosted, follow these steps:

1. **Generate your Identity:** Open the app and enter a strong, memorable passphrase. 
2. **Get your Fingerprint:** Copy your 128-character hexadecimal fingerprint.
3. **Exchange Fingerprints Securely:** Send your fingerprint to your contact using a secure secondary channel (e.g., an encrypted email, Signal, PGP message, or in-person QR scan).
4. **Start Chatting:** Paste your contact's fingerprint into the "New Chat" box. 

---

## Hosting & Deployment (For Admins)

Deploying your own ChatXtream instance ensures you don't have to trust anyone else's relay server. The stack is incredibly lightweight.

### Prerequisites
*   Node.js (v18+)
*   npm or yarn

### Running Locally (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ChatXtream.git
   cd ChatXtream
   ```

2. **Start the Backend Relay**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *The WebSocket server will start on `ws://localhost:3000`.*

3. **Start the Frontend Client**
   Open a new terminal window:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The frontend will be available at `http://localhost:5173`.*

### Running via Docker (Easiest)

If you have Docker and Docker Compose installed, you can spin up the entire stack with a single command:

```bash
git clone https://github.com/yourusername/ChatXtream.git
cd ChatXtream
docker-compose up -d --build
```

- **Frontend** will be available at `http://localhost:8080`
- **Backend Relay** will run at `http://localhost:3000`

### Deploying to Production

**1. The Frontend (Vercel, Netlify, GitHub Pages)**
Before building the frontend, open `frontend/src/lib/relay.ts` and change the WebSocket URL to your production backend URL (e.g., `wss://relay.yourdomain.com`).
```bash
cd frontend
npm run build
```
Upload the resulting `/dist` folder to any static hosting provider. It costs $0 to host.

**2. The Backend Relay (VPS, Render, Railway)**
Deploy the `backend` folder to any Node.js environment. Because it uses no database and only stores messages in memory, a basic $5/month VPS on DigitalOcean or Linode can handle thousands of concurrent users.
*   Make sure you put the backend behind a reverse proxy (like Nginx or Caddy) to handle SSL/TLS so you can use `wss://` instead of `ws://`.

---

## Contributing

ChatXtream is an open-source privacy initiative. Contributions, bug reports, and security audits are highly encouraged!

**High Priority Roadmap Items:**
- [ ] Implement a full Double Ratchet (Signal protocol) to achieve perfect forward secrecy.
- [ ] Implement QR code scanning for easier in-person fingerprint exchange.
- [ ] Add Tor Hidden Service integration scripts.
- [ ] Add traffic padding/batching to blunt network timing analysis.

Please see `CONTRIBUTING.md` for guidelines on how to submit pull requests.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

*ChatXtream - Privacy is not a feature, it's the default.*
