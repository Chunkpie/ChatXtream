import {
    initCrypto,
    deriveStorageKey,
    generateIdentity,
    encryptLocalData,
    decryptLocalData,
    toBase64,
    fromBase64,
    sodium,
    type IdentityKeys
} from './crypto';
import { saveLocalState, getLocalState, hasLocalState } from './storage';

export let isCryptoReady = false;
export let hasIdentity = false;
export let identityStore: IdentityKeys | null = null;

type Listener = () => void;
const listeners: Listener[] = [];

export const subscribe = (listener: Listener) => {
    listeners.push(listener);
    return () => {
        const idx = listeners.indexOf(listener);
        if (idx > -1) listeners.splice(idx, 1);
    };
};

const notify = () => {
    listeners.forEach(l => l());
};

export const initIdentityStore = async () => {
    await initCrypto();
    isCryptoReady = true;
    hasIdentity = await hasLocalState('encryptedIdentity');
    notify();
};

export const createIdentity = async (passphrase: string) => {
    const salt = sodium.randombytes_buf(sodium.crypto_generichash_KEYBYTES);
    const key = await deriveStorageKey(passphrase, salt);
    
    const identity = generateIdentity();
    
    const serialized = JSON.stringify({
        encryptionKeypair: {
            publicKey: toBase64(identity.encryptionKeypair.publicKey),
            privateKey: toBase64(identity.encryptionKeypair.privateKey)
        },
        signingKeypair: {
            publicKey: toBase64(identity.signingKeypair.publicKey),
            privateKey: toBase64(identity.signingKeypair.privateKey)
        }
    });

    const { ciphertext, nonce } = encryptLocalData(key, sodium.from_string(serialized));

    await saveLocalState('encryptedIdentity', {
        ciphertext: toBase64(ciphertext),
        nonce: toBase64(nonce),
        salt: toBase64(salt)
    });

    hasIdentity = true;
    identityStore = identity;
    notify();
};

export const unlockIdentity = async (passphrase: string): Promise<boolean> => {
    const data = await getLocalState('encryptedIdentity');
    if (!data) return false;

    const salt = fromBase64(data.salt);
    const key = await deriveStorageKey(passphrase, salt);

    const ciphertext = fromBase64(data.ciphertext);
    const nonce = fromBase64(data.nonce);

    const decrypted = decryptLocalData(key, nonce, ciphertext);
    if (!decrypted) {
        return false;
    }

    const serialized = JSON.parse(sodium.to_string(decrypted));
    
    identityStore = {
        encryptionKeypair: {
            publicKey: fromBase64(serialized.encryptionKeypair.publicKey),
            privateKey: fromBase64(serialized.encryptionKeypair.privateKey),
            keyType: 'curve25519'
        },
        signingKeypair: {
            publicKey: fromBase64(serialized.signingKeypair.publicKey),
            privateKey: fromBase64(serialized.signingKeypair.privateKey),
            keyType: 'ed25519'
        }
    };

    hasIdentity = true;
    notify();
    return true;
};
