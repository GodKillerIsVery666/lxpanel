import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const keyLength = 64;
const scryptCost = 16_384;
const scryptBlockSize = 8;
const scryptParallelism = 1;
const maxMemory = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomToken(16);
  const derived = await derivePassword(password, salt, scryptCost, scryptBlockSize, scryptParallelism);
  return ["scrypt", scryptCost, scryptBlockSize, scryptParallelism, salt, derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const cost = Number.parseInt(parts[1] ?? "", 10);
  const blockSize = Number.parseInt(parts[2] ?? "", 10);
  const parallelism = Number.parseInt(parts[3] ?? "", 10);
  const salt = parts[4] ?? "";
  const expected = Buffer.from(parts[5] ?? "", "base64url");
  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelism)) {
    return false;
  }

  const actual = await derivePassword(password, salt, cost, blockSize, parallelism);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

async function derivePassword(password: string, salt: string, cost: number, blockSize: number, parallelism: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: maxMemory
    }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(derivedKey));
    });
  });
}
