/**
 * WebAuthn 通行密钥认证服务。
 * 使用 Node.js 内置 crypto 模块实现 FIDO2 WebAuthn 验证。
 *
 * 参考：https://w3c.github.io/webauthn/
 */
import { createHash, randomBytes, verify } from "node:crypto";
import { randomToken } from "../../lib/crypto.js";
import type { WebAuthnCredential, WebAuthnRegistrationOptions, WebAuthnAssertionOptions } from "@lxpanel/shared";

const RP_NAME = "LXPanel";
const RP_ID = "localhost"; // 生产环境需改为实际域名

/**
 * 生成 WebAuthn 注册选项（挑战）。
 */
export function generateRegistrationOptions(userId: string, userName: string, excludeCredentials: { id: string; transports: string[] }[] = []): WebAuthnRegistrationOptions {
  const challenge = randomToken(32);
  return {
    challenge,
    rp: { name: RP_NAME, id: RP_ID },
    user: { id: userId, name: userName, displayName: userName },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },   // ES256
      { type: "public-key", alg: -257 }  // RS256
    ],
    attestation: "none",
    excludeCredentials: excludeCredentials.map((cred) => ({
      id: cred.id,
      type: "public-key" as const,
      transports: cred.transports
    }))
  };
}

/**
 * 生成 WebAuthn 断言选项（登录挑战）。
 */
export function generateAssertionOptions(allowCredentials: { id: string; transports: string[] }[]): WebAuthnAssertionOptions {
  const challenge = randomToken(32);
  return {
    challenge,
    rpId: RP_ID,
    allowCredentials: allowCredentials.map((cred) => ({
      id: cred.id,
      type: "public-key" as const,
      transports: cred.transports
    })),
    userVerification: "preferred"
  };
}

/**
 * 验证 WebAuthn 注册结果（attestation）。
 * 返回解析后的凭据信息。
 */
export function verifyRegistrationResult(
  credential: { id: string; rawId: string; response: { clientDataJSON: string; attestationObject: string } },
  expectedChallenge: string,
  expectedOrigin: string
): { credentialId: string; publicKey: Buffer; counter: number } | null {
  try {
    const clientData = JSON.parse(fromBase64Url(credential.response.clientDataJSON));
    if (clientData.challenge !== expectedChallenge) {
      return null;
    }
    if (clientData.origin !== expectedOrigin) {
      return null;
    }
    if (clientData.type !== "webauthn.create") {
      return null;
    }

    // 解析 attestationObject
    const attData = fromBase64UrlToBuffer(credential.response.attestationObject);
    // 简化：跳过 attestation format + 语句，提取 authData 中的公钥
    const publicKey = extractPublicKeyFromAttestation(attData);
    if (!publicKey) {
      return null;
    }

    return {
      credentialId: credential.id,
      publicKey,
      counter: 0
    };
  } catch {
    return null;
  }
}

/**
 * 验证 WebAuthn 断言结果（assertion signature）。
 */
export function verifyAssertionResult(
  assertion: { id: string; response: { clientDataJSON: string; authenticatorData: string; signature: string } },
  expectedChallenge: string,
  expectedOrigin: string,
  publicKey: Buffer,
  prevCounter: number
): { counter: number } | null {
  try {
    const clientData = JSON.parse(fromBase64Url(assertion.response.clientDataJSON));
    if (clientData.challenge !== expectedChallenge) {
      return null;
    }
    if (clientData.origin !== expectedOrigin) {
      return null;
    }
    if (clientData.type !== "webauthn.get") {
      return null;
    }

    const authData = fromBase64UrlToBuffer(assertion.response.authenticatorData);
    const clientDataHash = createHash("sha256").update(Buffer.from(assertion.response.clientDataJSON, "utf8")).digest();
    const signatureBase = Buffer.concat([authData, clientDataHash]);

    const signature = Buffer.from(assertion.response.signature, "base64");

    // 验证签名 (使用公钥)
    const verified = verify(
      null,
      signatureBase,
      publicKey,
      signature
    );
    if (!verified) {
      return null;
    }

    // 提取签名计数器
    if (authData.length < 4) {
      return null;
    }
    const counter = authData.readUInt32BE(authData.length - 4);
    if (counter <= prevCounter) {
      return null; // 可能存在凭据克隆
    }

    return { counter };
  } catch {
    return null;
  }
}

function fromBase64Url(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

function fromBase64UrlToBuffer(input: string): Buffer {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

function extractPublicKeyFromAttestation(raw: Buffer): Buffer | null {
  try {
    if (raw.length < 4) {
      return null;
    }
    const fmtLen = raw[0];
    if (fmtLen === undefined) {
      return null;
    }
    const offset = 1 + fmtLen;
    if (offset >= raw.length) {
      return null;
    }
    // 返回 authData 整体作为公钥标记
    // 实际生产环境需要解析 COSE 公钥
    return raw.subarray(offset);
  } catch {
    return null;
  }
}
