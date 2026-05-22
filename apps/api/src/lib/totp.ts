import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const periodSeconds = 30;
const digits = 6;

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildTotpUri(secret: string, accountName: string, issuer = "LXPanel"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(digits), period: String(periodSeconds) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function verifyTotpCode(secret: string, code: string, nowMs = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/u.test(code)) {
    return false;
  }
  const counter = Math.floor(nowMs / 1000 / periodSeconds);
  for (let offset = -window; offset <= window; offset += 1) {
    if (safeEqual(code, generateCode(secret, counter + offset))) {
      return true;
    }
  }
  return false;
}

export function generateTotpCodeForTest(secret: string, nowMs = Date.now()): string {
  return generateCode(secret, Math.floor(nowMs / 1000 / periodSeconds));
}

function generateCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binary = (((digest.at(offset) ?? 0) & 0x7f) << 24)
    | (((digest.at(offset + 1) ?? 0) & 0xff) << 16)
    | (((digest.at(offset + 2) ?? 0) & 0xff) << 8)
    | ((digest.at(offset + 3) ?? 0) & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/u, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) {
      throw new Error("TOTP secret 格式不合法。");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
