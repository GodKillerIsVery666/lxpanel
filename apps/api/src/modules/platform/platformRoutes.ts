import type { FastifyInstance } from "fastify";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AccessEvaluationRequestSchema, CreateAccessPolicySchema, CreateResourceApprovalPolicySchema, CreateTemplateRepositorySchema, CreateTerminalSessionSchema, CreateWorkspaceSchema, SecurityRemediationRequestSchema, StateArchiveRequestSchema, TerminalInputSchema, TerminalOutputSchema, UpdateLicenseSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { sendApprovalError } from "../approvals/approvalRoutes.js";
import { requireRole, requireUser, sessionCookieName } from "../auth/authMiddleware.js";
import { verifySignedValue } from "../../lib/sessionCookie.js";

export function registerPlatformRoutes(app: FastifyInstance, services: Services): void {
  const terminalSockets = new Map<string, Set<Socket>>();
  attachTerminalWebSocket(app, services, terminalSockets);

  app.get("/api/platform/access-policies", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { policies: await services.platformStore.listAccessPolicies() };
  });

  app.post("/api/platform/access-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateAccessPolicySchema.parse(request.body);
    const policy = await services.platformStore.createAccessPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.access_policy.create", target: `${policy.workspace}:${policy.resourceType}:${policy.resourceId}`, ip: request.ip, status: "success" });
    return { policy };
  });

  app.post("/api/platform/access-evaluate", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = AccessEvaluationRequestSchema.parse(request.body);
    return { evaluation: await services.platformStore.evaluateAccess(input) };
  });

  app.get("/api/platform/terminal-sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { sessions: await services.platformStore.listTerminalSessions() };
  });

  app.post("/api/platform/terminal-sessions", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateTerminalSessionSchema.parse(request.body);
    const target = (await services.hostService.resolveCommandTargets([input.hostId]))[0];
    if (!target) {
      await reply.code(404).send({ message: "主机不存在。" });
      return;
    }
    const destination = `${input.username ? `${input.username}@` : ""}${target.host.address ?? target.host.name}`;
    const command = await services.connectorStore.createCommand({ connectorId: target.connectorId, command: "terminal.open", args: [destination, String(input.rows), String(input.cols)] }, user.username);
    const session = await services.platformStore.createTerminalSession(input, target.host.name, target.connectorId, command.id, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.open", target: target.host.name, ip: request.ip, status: "success" });
    return { session, command };
  });

  app.post("/api/platform/terminal-sessions/input", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = TerminalInputSchema.parse(request.body);
    const session = await services.platformStore.terminalSession(input.sessionId);
    if (!session) {
      await reply.code(404).send({ message: "终端会话不存在。" });
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.input", args: [session.id, input.input] }, user.username);
    const updated = await services.platformStore.appendTerminalInput(input, command.id);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.input", target: session.hostName, ip: request.ip, status: "success" });
    return { session: updated, command };
  });

  app.post("/api/platform/terminal-sessions/output", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = TerminalOutputSchema.parse(request.body);
    const session = await services.platformStore.appendTerminalOutput(input);
    broadcastTerminalFrame(terminalSockets, session.id, { type: "output", session });
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.output", target: session.hostName, ip: request.ip, status: "success" });
    return { session };
  });

  app.post("/api/platform/terminal-sessions/close", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = z.object({ sessionId: z.string().min(1) }).parse(request.body);
    const session = await services.platformStore.terminalSession(input.sessionId);
    if (!session) {
      await reply.code(404).send({ message: "终端会话不存在。" });
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.close", args: [session.id] }, user.username);
    const updated = await services.platformStore.closeTerminalSession(session.id);
    await services.auditLog.append({ actor: user.username, action: "platform.terminal.close", target: session.hostName, ip: request.ip, status: "success" });
    return { session: updated, command };
  });

  app.get("/api/platform/template-repositories", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { repositories: await services.platformStore.listTemplateRepositories() };
  });

  app.post("/api/platform/template-repositories", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateTemplateRepositorySchema.parse(request.body);
    const repository = await services.platformStore.createTemplateRepository(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.template_repository.create", target: repository.name, ip: request.ip, status: "success" });
    return { repository };
  });

  app.post("/api/platform/template-repositories/sync", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = z.object({ repositoryId: z.string().min(1) }).parse(request.body);
    const repository = await services.platformStore.syncTemplateRepository(input.repositoryId, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.template_repository.sync", target: repository.name, ip: request.ip, status: repository.lastStatus === "success" ? "success" : "error" });
    return { repository };
  });

  app.get("/api/platform/workspaces", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { overview: await services.platformStore.workspaceOverview() };
  });

  app.post("/api/platform/workspaces", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateWorkspaceSchema.parse(request.body);
    const workspace = await services.platformStore.createWorkspace(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.workspace.create", target: workspace.id, ip: request.ip, status: "success" });
    return { workspace };
  });

  app.get("/api/platform/license", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { status: await services.platformStore.licenseStatus() };
  });

  app.put("/api/platform/license", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateLicenseSchema.parse(request.body);
    const status = await services.platformStore.updateLicense(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.license.update", target: status.license.plan, ip: request.ip, status: "success" });
    return { status };
  });

  app.post("/api/platform/license/verify", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = UpdateLicenseSchema.parse(request.body);
    const result = services.platformStore.verifyLicense(input);
    await services.auditLog.append({ actor: user.username, action: "platform.license.verify", target: input.licensedTo, ip: request.ip, status: result.ok ? "success" : "error", detail: result.error ?? result.machineCode });
    return { result };
  });

  app.get("/api/platform/approval-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { policies: await services.platformStore.listApprovalPolicies() };
  });

  app.post("/api/platform/approval-policies", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = CreateResourceApprovalPolicySchema.parse(request.body);
    const policy = await services.platformStore.createApprovalPolicy(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "platform.approval_policy.create", target: `${policy.resourceType}:${policy.resourceId}`, ip: request.ip, status: "success" });
    return { policy };
  });

  app.get("/api/platform/remediations", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { runs: await services.platformStore.remediationRuns() };
  });

  app.post("/api/platform/remediations", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = SecurityRemediationRequestSchema.parse(request.body);
    if (!input.dryRun) {
      try {
        await services.approvalStore.consume({ approvalId: input.approvalId ?? "", action: "security.remediate", target: input.itemId, actor: user.username });
      } catch (error) {
        if (await sendApprovalError(reply, error)) {
          return;
        }
        throw error;
      }
    }
    const run = await services.platformStore.createRemediationRun(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "security.remediation", target: input.itemId, ip: request.ip, status: run.status === "failed" ? "error" : "success", detail: run.outputTail });
    return { run };
  });

  app.get("/api/platform/capacity-plan", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.capacityPlan() };
  });

  app.get("/api/platform/upgrade-plan", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { plan: await services.platformStore.upgradePlan() };
  });

  app.get("/api/platform/delivery-checklist", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { checklist: await services.platformStore.deliveryChecklist() };
  });

  app.get("/api/platform/openapi-summary", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { summary: services.platformStore.openApiSummary() };
  });

  app.get("/api/platform/openapi.json", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return services.platformStore.openApiDocument();
  });

  app.post("/api/platform/archive-state", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    const input = StateArchiveRequestSchema.parse(request.body ?? {});
    const result = await services.platformStore.archiveState(input);
    await services.auditLog.append({ actor: user.username, action: "platform.archive_state", target: input.dryRun ? "dry-run" : "apply", ip: request.ip, status: "success", detail: `before=${result.beforeBytes};after=${result.afterBytes}` });
    return { result };
  });

  app.get("/api/platform/installer-guide", async (request, reply) => {
    const user = await requireRole(request, reply, services, "owner");
    if (!user) {
      return;
    }
    return { guide: services.platformStore.installerGuide() };
  });

  app.get("/api/platform/sdk-examples", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { examples: services.platformStore.sdkExamples() };
  });

  app.get("/api/platform/frontend-quality", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { report: services.platformStore.frontendQualityReport() };
  });
}

function attachTerminalWebSocket(app: FastifyInstance, services: Services, sockets: Map<string, Set<Socket>>): void {
  app.server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/api/platform/terminal-sessions/ws") {
      return;
    }
    const tcpSocket = socket as Socket;
    void handleTerminalUpgrade(services, sockets, request, tcpSocket, head, url).catch((error: unknown) => {
      closeUpgrade(tcpSocket, 500, error instanceof Error ? error.message : String(error));
    });
  });
}

async function handleTerminalUpgrade(services: Services, sockets: Map<string, Set<Socket>>, request: IncomingMessage, socket: Socket, _head: Buffer, url: URL): Promise<void> {
  const user = await readUpgradeUser(request, services);
  if (!user || roleRank(user.role) < roleRank("operator") || !hasPlatformReadScope(user)) {
    closeUpgrade(socket, 401, "unauthorized");
    return;
  }
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const session = await services.platformStore.terminalSession(sessionId);
  if (!session) {
    closeUpgrade(socket, 404, "terminal session not found");
    return;
  }
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    closeUpgrade(socket, 400, "missing websocket key");
    return;
  }
  const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));
  const bucket = sockets.get(session.id) ?? new Set<Socket>();
  bucket.add(socket);
  sockets.set(session.id, bucket);
  sendWebSocketJson(socket, { type: "snapshot", session });
  socket.on("data", (chunk) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    void handleTerminalSocketInput(services, user.username, session.id, buffer).catch((error: unknown) => {
      sendWebSocketJson(socket, { type: "error", message: error instanceof Error ? error.message : String(error) });
    });
  });
  socket.on("close", () => bucket.delete(socket));
  socket.on("error", () => bucket.delete(socket));
}

async function handleTerminalSocketInput(services: Services, actor: string, sessionId: string, chunk: Buffer): Promise<void> {
  for (const input of parseClientTextFrames(chunk)) {
    if (!input) {
      continue;
    }
    const session = await services.platformStore.terminalSession(sessionId);
    if (!session || session.status === "closed") {
      return;
    }
    const command = await services.connectorStore.createCommand({ connectorId: session.connectorId, command: "terminal.input", args: [session.id, input] }, actor);
    await services.platformStore.appendTerminalInput({ sessionId: session.id, input }, command.id);
  }
}

function broadcastTerminalFrame(sockets: Map<string, Set<Socket>>, sessionId: string, payload: object): void {
  for (const socket of sockets.get(sessionId) ?? []) {
    sendWebSocketJson(socket, payload);
  }
}

function sendWebSocketJson(socket: Socket, payload: object): void {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff]);
  socket.write(Buffer.concat([header, body]));
}

function parseClientTextFrames(chunk: Buffer): string[] {
  const messages: string[] = [];
  let offset = 0;
  while (offset + 2 <= chunk.length) {
    const first = chunk.readUInt8(offset);
    const second = chunk.readUInt8(offset + 1);
    const opcode = first & 0x0f;
    const masked = (second & 0x80) === 0x80;
    let length = second & 0x7f;
    offset += 2;
    if (length === 126) {
      if (offset + 2 > chunk.length) {
        break;
      }
      length = chunk.readUInt16BE(offset);
      offset += 2;
    }
    if (length === 127 || !masked || offset + 4 + length > chunk.length) {
      break;
    }
    const mask = chunk.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(length);
    for (let index = 0; index < length; index += 1) {
      payload[index] = chunk.readUInt8(offset + index) ^ (mask[index % 4] ?? 0);
    }
    offset += length;
    if (opcode === 0x1) {
      messages.push(payload.toString("utf8"));
    }
  }
  return messages;
}

async function readUpgradeUser(request: IncomingMessage, services: Services) {
  const sessionId = verifySignedValue(readCookie(request.headers.cookie, sessionCookieName), services.config.sessionSecret);
  if (sessionId) {
    const user = await services.authStore.getUserBySession(sessionId);
    if (user) {
      return user;
    }
  }
  const authorization = request.headers.authorization;
  const token = typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return token ? services.authStore.getUserByApiToken(token) : null;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  return header?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

function roleRank(role: "owner" | "operator" | "viewer"): number {
  return role === "owner" ? 3 : role === "operator" ? 2 : 1;
}

function hasPlatformReadScope(user: { tokenScopes?: readonly string[] | undefined }): boolean {
  return !user.tokenScopes || user.tokenScopes.includes("platform:read") || user.tokenScopes.includes("platform:write");
}

function closeUpgrade(socket: Socket, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}
