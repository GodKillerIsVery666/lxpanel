import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";
import { requireUser, sessionCookieName } from "../auth/authMiddleware.js";
import { generateRegistrationOptions, generateAssertionOptions, verifyRegistrationResult, verifyAssertionResult } from "./webauthnService.js";
import { randomToken } from "../../lib/crypto.js";
import { signValue } from "../../lib/sessionCookie.js";

/** 临时存储挑战值 { challenge: { userId, timestamp } } */
const pendingChallenges = new Map<string, { userId: string; timestamp: number }>();

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 分钟

export function registerWebAuthnRoutes(app: FastifyInstance, services: Services): void {
  // 获取 WebAuthn 状态（是否已有凭据）
  app.get("/api/auth/webauthn/status", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const state = await services.stateStore.read();
    const credentials = (state.webauthnCredentials ?? []).filter((cred) => cred.userId === user.id);
    return { enabled: credentials.length > 0, credentialCount: credentials.length };
  });

  // 生成注册选项
  app.post("/api/auth/webauthn/register/begin", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const state = await services.stateStore.read();
    const existingCreds = (state.webauthnCredentials ?? []).filter((cred) => cred.userId === user.id);
    const options = generateRegistrationOptions(
      user.id,
      user.username,
      existingCreds.map((cred) => ({ id: cred.id, transports: cred.transports }))
    );
    // 存储挑战
    pendingChallenges.set(options.challenge, { userId: user.id, timestamp: Date.now() });
    return { options };
  });

  // 完成注册
  app.post("/api/auth/webauthn/register/complete", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const result = request.body as { credential: { id: string; rawId: string; response: { clientDataJSON: string; attestationObject: string } } };
    const credential = result.credential;

    // 查找匹配的挑战
    let matchedChallenge: string | null = null;
    for (const [challenge, data] of pendingChallenges) {
      if (data.userId === user.id) {
        matchedChallenge = challenge;
        break;
      }
    }
    if (!matchedChallenge) {
      await reply.code(400).send({ message: "未找到注册挑战，请重新开始。" });
      return;
    }
    pendingChallenges.delete(matchedChallenge);

    const expectedOrigin = `${request.protocol}://${request.hostname}`;
    const verified = verifyRegistrationResult(credential, matchedChallenge, expectedOrigin);
    if (!verified) {
      await reply.code(400).send({ message: "凭据验证失败。" });
      return;
    }

    // 保存凭据
    await services.stateStore.update((state) => ({
      data: {
        ...state,
        webauthnCredentials: [
          ...(state.webauthnCredentials ?? []),
          {
            id: credential.id,
            userId: user.id,
            publicKey: verified.publicKey.toString("base64"),
            counter: verified.counter,
            transports: [],
            createdAt: new Date().toISOString(),
            deviceName: ""
          }
        ]
      },
      result: undefined
    }));

    await services.auditLog.append({ actor: user.username, action: "webauthn.register", target: credential.id, ip: request.ip, status: "success" });
    return { ok: true, credentialId: credential.id };
  });

  // 生成断言选项（登录开始）
  app.post("/api/auth/webauthn/login/begin", async (request, reply) => {
    const { username } = (request.body ?? {}) as { username?: string };
    if (!username) {
      await reply.code(400).send({ message: "需要用户名。" });
      return;
    }
    const state = await services.stateStore.read();
    const user = state.users.find((u) => u.username === username);
    if (!user) {
      await reply.code(404).send({ message: "用户不存在。" });
      return;
    }
    const credentials = (state.webauthnCredentials ?? []).filter((cred) => cred.userId === user.id);
    if (credentials.length === 0) {
      await reply.code(400).send({ message: "该用户未注册通行密钥。" });
      return;
    }
    const options = generateAssertionOptions(
      credentials.map((cred) => ({ id: cred.id, transports: cred.transports }))
    );
    pendingChallenges.set(options.challenge, { userId: user.id, timestamp: Date.now() });
    return { options };
  });

  // 完成断言验证（登录完成）
  app.post("/api/auth/webauthn/login/complete", async (request, reply) => {
    const result = request.body as {
      credential: { id: string; response: { clientDataJSON: string; authenticatorData: string; signature: string } }
    };
    const credentialData = result.credential;

    // 查找挑战
    let matchedChallenge: string | null = null;
    let userId = "";
    for (const [challenge, data] of pendingChallenges) {
      const age = Date.now() - data.timestamp;
      if (age < CHALLENGE_TTL_MS) {
        matchedChallenge = challenge;
        userId = data.userId;
        break;
      }
    }
    if (!matchedChallenge) {
      await reply.code(400).send({ message: "挑战已过期，请重新开始。" });
      return;
    }
    pendingChallenges.delete(matchedChallenge);

    // 查找凭据和公钥
    const state = await services.stateStore.read();
    const storedCred = (state.webauthnCredentials ?? []).find((cred) => cred.id === credentialData.id);
    if (!storedCred) {
      await reply.code(400).send({ message: "凭据不存在。" });
      return;
    }

    const expectedOrigin = `${request.protocol}://${request.hostname}`;
    const publicKey = Buffer.from(storedCred.publicKey, "base64");
    const verified = verifyAssertionResult(credentialData, matchedChallenge, expectedOrigin, publicKey, storedCred.counter);
    if (!verified) {
      await reply.code(400).send({ message: "断言验证失败。" });
      return;
    }

    // 更新计数器
    await services.stateStore.update((state_) => ({
      data: {
        ...state_,
        webauthnCredentials: (state_.webauthnCredentials ?? []).map((cred) =>
          cred.id === credentialData.id ? { ...cred, counter: verified.counter, lastUsedAt: new Date().toISOString() } : cred
        )
      },
      result: undefined
    }));

    // 创建会话（复用现有 auth 流程）
    const user = state.users.find((u) => u.id === userId);
    if (!user) {
      await reply.code(500).send({ message: "用户不存在。" });
      return;
    }
    const sessionSecret = await services.authStore.createSession(user.id);
    const signed = signValue(sessionSecret, services.config.sessionSecret);
    reply.setCookie(sessionCookieName, signed, {
      httpOnly: true, sameSite: "lax", path: "/",
      secure: services.config.cookieSecure,
      maxAge: 7 * 24 * 60 * 60
    });
    await services.auditLog.append({ actor: user.username, action: "webauthn.login", target: credentialData.id, ip: request.ip, status: "success" });
    return { user: { id: user.id, username: user.username, role: user.role } };
  });

  // 列出凭据
  app.get("/api/auth/webauthn/credentials", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const state = await services.stateStore.read();
    const credentials = (state.webauthnCredentials ?? []).filter((cred) => cred.userId === user.id);
    return { credentials: credentials.map((cred) => ({ id: cred.id, deviceName: cred.deviceName, createdAt: cred.createdAt, lastUsedAt: cred.lastUsedAt })) };
  });

  // 删除凭据
  app.delete("/api/auth/webauthn/credentials", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const { credentialId } = (request.query ?? {}) as { credentialId?: string };
    if (!credentialId) {
      await reply.code(400).send({ message: "需要凭据 ID。" });
      return;
    }
    await services.stateStore.update((state) => ({
      data: {
        ...state,
        webauthnCredentials: (state.webauthnCredentials ?? []).filter((cred) => !(cred.id === credentialId && cred.userId === user.id))
      },
      result: undefined
    }));
    await services.auditLog.append({ actor: user.username, action: "webauthn.delete_credential", target: credentialId, ip: request.ip, status: "success" });
    return { ok: true };
  });
}
