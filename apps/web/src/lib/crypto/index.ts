/**
 * AES-256-GCM 加密工具。
 *
 * 用于加密存储用户的 API Key。
 *
 * 加密格式：`base64(iv) : base64(ciphertext) : base64(authTag)`
 * - iv: 12 字节初始化向量（GCM 推荐长度）
 * - ciphertext: 加密后的密文
 * - authTag: 16 字节认证标签（GCM 完整性校验）
 *
 * 密钥来源：
 * 1. 优先使用 `ENCRYPTION_KEY` 环境变量（32 字节 hex 或 base64）
 * 2. 否则从 `NEXTAUTH_SECRET` 派生（SHA-256 截断 32 字节）
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** GCM 推荐的 IV 长度 */
const IV_LENGTH = 12;

/** GCM 认证标签长度 */
const AUTH_TAG_LENGTH = 16;

/** 密钥长度（AES-256 = 32 字节） */
const KEY_LENGTH = 32;

/**
 * 获取加密密钥（32 字节）。
 *
 * 优先使用 ENCRYPTION_KEY，否则从 NEXTAUTH_SECRET 派生。
 * 密钥在进程内缓存。
 */
let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET;

  if (!raw) {
    throw new Error(
      "缺少加密密钥：请设置 ENCRYPTION_KEY 或 NEXTAUTH_SECRET 环境变量"
    );
  }

  // 如果是 64 位 hex 字符串，直接解析
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, "hex");
  } else if (/^[0-9a-zA-Z+/]{43}=$/.test(raw)) {
    // base64 编码的 32 字节
    cachedKey = Buffer.from(raw, "base64");
  } else {
    // 其他情况：SHA-256 派生
    cachedKey = createHash("sha256").update(raw).digest().subarray(0, KEY_LENGTH);
  }

  if (cachedKey.length !== KEY_LENGTH) {
    throw new Error(
      `加密密钥长度必须为 ${KEY_LENGTH} 字节，当前为 ${cachedKey.length} 字节`
    );
  }

  return cachedKey;
}

/**
 * 加密文本。
 *
 * @param plaintext 明文
 * @returns 加密字符串，格式 `iv:ciphertext:authTag`（均 base64 编码）
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, ciphertext, authTag]
    .map((buf) => buf.toString("base64"))
    .join(":");
}

/**
 * 解密文本。
 *
 * @param encrypted 加密字符串（encrypt() 的输出）
 * @returns 明文
 * @throws 如果密文损坏或认证失败
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("加密字符串格式错误，应为 iv:ciphertext:authTag");
  }

  const [ivB64, ciphertextB64, authTagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/**
 * 加密掩码：用于安全展示 API Key（仅显示前 4 位和后 4 位）。
 *
 * @param apiKey 原始 API Key
 * @returns 掩码字符串，如 `sk-a1b2****c3d4`
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "****";
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}
