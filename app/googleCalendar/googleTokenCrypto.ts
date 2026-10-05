import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("Missing GOOGLE_TOKEN_ENCRYPTION_SECRET for Google Calendar token storage.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptGoogleToken(value: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleToken(value: string) {
  const [ivText, authTagText, ciphertextText] = value.split(".");
  if (!ivText || !authTagText || !ciphertextText) {
    throw new Error("Stored Google token is not in the expected encrypted format.");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
