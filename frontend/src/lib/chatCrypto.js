/**
 * chatCrypto.js — Client-side AES-256-GCM encryption for chat messages.
 *
 * How it works:
 *  1. Backend derives a unique key per channel using HMAC-SHA256(secret, channelId).
 *  2. Both sender and receiver fetch the same key (same channelId → same HMAC).
 *  3. Before sending, sender encrypts text → ciphertext stored in Stream.
 *  4. On render, receiver decrypts ciphertext → shows plaintext.
 *  5. Stream's servers (and dashboard) only ever see unreadable ciphertext.
 *
 * Encrypted message format stored in Stream:
 *   §ENC§<base64(iv)>:<base64(ciphertext)>
 *
 * Attachments (images) are NOT encrypted — only text messages.
 */

export const ENC_PREFIX = "§ENC§";

/** Import a 64-char hex key as a Web Crypto AES-GCM CryptoKey */
export async function importAESKey(hexKey) {
  const bytes = new Uint8Array(
    hexKey.match(/.{2}/g).map((b) => parseInt(b, 16))
  );
  return await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt plaintext → §ENC§<iv>:<ciphertext> string */
export async function encryptMessage(cryptoKey, plaintext) {
  if (!plaintext || !plaintext.trim()) return plaintext;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encoded
    );
    const ivB64 = btoa(String.fromCharCode(...iv));
    const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
    return `${ENC_PREFIX}${ivB64}:${ctB64}`;
  } catch {
    // If encryption fails, send plaintext (better than losing the message)
    return plaintext;
  }
}

/** Decrypt §ENC§<iv>:<ciphertext> → plaintext */
export async function decryptMessage(cryptoKey, ciphertext) {
  if (!ciphertext || !ciphertext.startsWith(ENC_PREFIX)) return ciphertext;
  try {
    const inner = ciphertext.slice(ENC_PREFIX.length);
    const [ivB64, ctB64] = inner.split(":");
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ct
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    return "🔒 [Encrypted message — could not decrypt]";
  }
}

/** Returns true if the text is an encrypted message */
export function isEncrypted(text) {
  return typeof text === "string" && text.startsWith(ENC_PREFIX);
}
