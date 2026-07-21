import _sodium from 'libsodium-wrappers';

export let sodium: typeof _sodium;

export const initCrypto = async () => {
    await _sodium.ready;
    sodium = _sodium;
};

// Derive a 32-byte key from a user passphrase for local storage encryption
export const deriveStorageKey = async (passphrase: string, salt: Uint8Array): Promise<Uint8Array> => {
    return sodium.crypto_pwhash(
        sodium.crypto_secretbox_KEYBYTES,
        passphrase,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_ARGON2ID13
    );
};



export interface IdentityKeys {
    encryptionKeypair: any;
    signingKeypair: any;
}

// Generate new X25519 and Ed25519 keypairs
export const generateIdentity = (): IdentityKeys => {
    const encryptionKeypair = sodium.crypto_kx_keypair();
    const signingKeypair = sodium.crypto_sign_keypair();
    return { encryptionKeypair, signingKeypair };
};

// Encrypt data for local storage (using SecretBox)
export const encryptLocalData = (key: Uint8Array, data: Uint8Array): { ciphertext: Uint8Array, nonce: Uint8Array } => {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(data, nonce, key);
    return { ciphertext, nonce };
};

// Decrypt local data
export const decryptLocalData = (key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array | null => {
    try {
        return sodium.crypto_secretbox_open_easy(ciphertext, nonce, key) || null;
    } catch {
        return null;
    }
};

// Convert Uint8Array to Hex string for easy display (e.g. fingerprint)
export const toHex = (buf: Uint8Array): string => sodium.to_hex(buf);
export const fromHex = (hex: string): Uint8Array => sodium.from_hex(hex);

export const toBase64 = (buf: Uint8Array): string => sodium.to_base64(buf, sodium.base64_variants.URLSAFE_NO_PADDING);
export const fromBase64 = (b64: string): Uint8Array => sodium.from_base64(b64, sodium.base64_variants.URLSAFE_NO_PADDING);
