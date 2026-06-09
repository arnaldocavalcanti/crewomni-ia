/**
 * Symmetric encryption utilities using AES-256-GCM.
 * Key must be a 64-character hex string (32 bytes) stored in ENCRYPTION_KEY env var.
 *
 * Format of encrypted string: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12    // 96-bit IV recommended for GCM
const TAG_LENGTH = 16   // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Input format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function decrypt(encryptedText: string): string {
  const key = getKey()
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format — expected iv:authTag:ciphertext')
  }
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Encrypts a value only if it is non-null/non-empty.
 * Returns null if input is null/undefined/empty.
 */
export function encryptIfPresent(value: string | null | undefined): string | null {
  if (!value) return null
  return encrypt(value)
}

/**
 * Decrypts a value only if it is non-null/non-empty.
 * Returns null if input is null/undefined/empty.
 */
export function decryptIfPresent(value: string | null | undefined): string | null {
  if (!value) return null
  return decrypt(value)
}
