import { createHmac, timingSafeEqual } from "node:crypto";

export function signValue(value: string, secret: string): string {
  return `${value}.${signatureFor(value, secret)}`;
}

export function verifySignedValue(signedValue: string | undefined, secret: string): string | null {
  if (!signedValue) {
    return null;
  }
  const separator = signedValue.lastIndexOf(".");
  if (separator < 1) {
    return null;
  }
  const value = signedValue.slice(0, separator);
  const signature = signedValue.slice(separator + 1);
  const expected = signatureFor(value, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer) ? value : null;
}

function signatureFor(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
