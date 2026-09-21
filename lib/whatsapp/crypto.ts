import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Application-layer encryption for kalendar_whatsapp_config.twilio_auth_token_encrypted
 * (workflows/whatsapp-booking.md — data-model step).
 *
 * Deliberately NOT pgcrypto/pgsodium: the encryption key lives only in this
 * env var, read only in this file, never passed as a SQL parameter — so the
 * key never touches the DB layer at all, even transiently in a query. The DB
 * column stores only opaque ciphertext.
 *
 * AES-256-GCM: a random 12-byte IV per encryption, the 16-byte auth tag
 * appended, everything base64-encoded as "iv:tag:ciphertext" (colon-joined,
 * each segment base64) so it round-trips through a plain `text` column with
 * no ambiguity about where one part ends and the next begins.
 *
 * WHATSAPP_CONFIG_ENCRYPTION_KEY: any string, 32+ chars recommended — passed
 * through scrypt to derive a proper 32-byte AES-256 key rather than requiring
 * the raw env var to be exactly 32 bytes.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SCRYPT_SALT = "kalendar-whatsapp-config-v1"; // fixed salt: the key is a secret env var, not a password

function getKey(): Buffer {
  const secret = process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "WHATSAPP_CONFIG_ENCRYPTION_KEY is not set — required to encrypt/decrypt WhatsApp Twilio credentials."
    );
  }
  return scryptSync(secret, SCRYPT_SALT, 32);
}

export function encryptWhatsappSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptWhatsappSecret(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted WhatsApp secret (expected iv:tag:ciphertext).");
  }
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
