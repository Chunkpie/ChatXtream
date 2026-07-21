import { sodium, toBase64, fromBase64, toHex, fromHex, type IdentityKeys } from './crypto';

export interface Envelope {
    ciphertext: string; // Base64 crypto_box_seal
}

export interface Payload {
    fromFingerprint: string;
    senderSigningPubKey: string; // Base64
    text: string;
    timestamp: number;
}

export interface SignedPayload {
    payloadJson: string;
    signature: string; // Base64 signature
}

// Fingerprint is now a concatenation of both public keys (Encryption + Signing)
export const getMyFingerprint = (identity: IdentityKeys): string => {
    return toHex(identity.encryptionKeypair.publicKey) + toHex(identity.signingKeypair.publicKey);
};

// Delivery token is Hash(EncryptionPubKey)
export const computeDeliveryToken = (encryptionPubKey: Uint8Array): string => {
    const hash = sodium.crypto_hash_sha256(encryptionPubKey);
    return toHex(hash);
};

export const getMyDeliveryToken = (identity: IdentityKeys): string => {
    return computeDeliveryToken(identity.encryptionKeypair.publicKey);
};

export const createSealedEnvelope = (identity: IdentityKeys, recipientFingerprintHex: string, text: string): Envelope => {
    // Recipient fingerprint is 128 hex chars. First 64 is encryption key, last 64 is signing key.
    if (recipientFingerprintHex.length !== 128) throw new Error("Invalid recipient fingerprint");
    
    const recipientPubKey = fromHex(recipientFingerprintHex.substring(0, 64));
    
    const payload: Payload = {
        fromFingerprint: getMyFingerprint(identity),
        senderSigningPubKey: toBase64(identity.signingKeypair.publicKey),
        text,
        timestamp: Date.now()
    };
    
    const payloadJson = JSON.stringify(payload);
    
    // Sign the payload using our signing key
    const signature = sodium.crypto_sign_detached(
        sodium.from_string(payloadJson),
        identity.signingKeypair.privateKey
    );
    
    const signedPayload: SignedPayload = {
        payloadJson,
        signature: toBase64(signature)
    };
    
    // Seal the envelope for the recipient (anonymous sender from the network's perspective)
    // crypto_box_seal creates an ephemeral keypair for forward secrecy of the SENDER identity,
    // though the RECIPIENT's long-term key is used, meaning past messages are vulnerable if recipient key is compromised.
    // (A full Double Ratchet would rotate the recipient's key).
    const ciphertext = sodium.crypto_box_seal(
        sodium.from_string(JSON.stringify(signedPayload)),
        recipientPubKey
    );
    
    return {
        ciphertext: toBase64(ciphertext)
    };
};

export const openSealedEnvelope = (identity: IdentityKeys, envelope: Envelope): Payload | null => {
    try {
        const ciphertext = fromBase64(envelope.ciphertext);
        
        // Decrypt
        const decrypted = sodium.crypto_box_seal_open(
            ciphertext,
            identity.encryptionKeypair.publicKey,
            identity.encryptionKeypair.privateKey
        );
        
        if (!decrypted) return null;
        
        const signedPayload: SignedPayload = JSON.parse(sodium.to_string(decrypted));
        const payload: Payload = JSON.parse(signedPayload.payloadJson);
        
        // Verify signature
        const senderSigningPubKey = fromBase64(payload.senderSigningPubKey);
        const isValid = sodium.crypto_sign_verify_detached(
            fromBase64(signedPayload.signature),
            sodium.from_string(signedPayload.payloadJson),
            senderSigningPubKey
        );
        
        if (!isValid) {
            console.error("Invalid signature");
            return null;
        }
        
        // Ensure the sender's fingerprint actually matches the signing pubkey they provided
        const expectedFingerprintEnd = toHex(senderSigningPubKey);
        if (!payload.fromFingerprint.endsWith(expectedFingerprintEnd)) {
            console.error("Fingerprint mismatch");
            return null;
        }
        
        return payload;
    } catch (e) {
        console.error("Failed to open envelope", e);
        return null;
    }
};
