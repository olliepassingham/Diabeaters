const ENCODING = new TextEncoder();

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const trimmed = secret.trim();
  if (trimmed.length < 16) {
    throw new Error("EXERCISE_CGM_MONITOR_SECRET must be at least 16 characters.");
  }
  const hash = await crypto.subtle.digest("SHA-256", ENCODING.encode(trimmed));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
};

export async function encryptExerciseCgmSecret(
  plaintext: string,
  secretEnv: string,
): Promise<EncryptedSecret> {
  const key = await deriveAesKey(secretEnv);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    ENCODING.encode(plaintext),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptExerciseCgmSecret(
  encrypted: EncryptedSecret,
  secretEnv: string,
): Promise<string> {
  const key = await deriveAesKey(secretEnv);
  const iv = base64ToBytes(encrypted.iv);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
