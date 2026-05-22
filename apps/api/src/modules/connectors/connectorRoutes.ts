import type { FastifyInstance } from "fastify";
import { ConnectorCommandResultSchema, ConnectorHeartbeatSchema, CreateConnectorCommandSchema, CreateConnectorSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole, requireUser } from "../auth/authMiddleware.js";

export function registerConnectorRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/connectors", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { connectors: await services.connectorStore.list() };
  });

  app.get<{ Querystring: { connectorId?: string } }>("/api/connectors/commands", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { commands: await services.connectorStore.listCommands(request.query.connectorId) };
  });

  app.post("/api/connectors", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    const input = CreateConnectorSchema.parse(request.body);
    const result = await services.connectorStore.create(input);
    await services.auditLog.append({ actor: user.username, action: "connector.create", target: result.connector.name, ip: request.ip, status: "success" });
    return result;
  });

  app.post("/api/connectors/commands", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateConnectorCommandSchema.parse(request.body);
    const command = await services.connectorStore.createCommand(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "connector.command.create", target: command.id, ip: request.ip, status: "success" });
    return { command };
  });

  app.post("/api/connectors/heartbeat", async (request, reply) => {
    const authorization = request.headers.authorization ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) {
      await reply.code(401).send({ message: "缺少连接器令牌。" });
      return;
    }
    const input = ConnectorHeartbeatSchema.parse(request.body ?? {});
    const connector = await services.connectorStore.heartbeat(token, input);
    if (!connector) {
      await reply.code(401).send({ message: "连接器令牌无效。" });
      return;
    }
    return { connector };
  });

  app.get("/api/connectors/commands/poll", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      await reply.code(401).send({ message: "缺少连接器令牌。" });
      return;
    }
    const commands = await services.connectorStore.claimCommands(token);
    if (!commands) {
      await reply.code(401).send({ message: "连接器令牌无效。" });
      return;
    }
    return { commands };
  });

  app.post("/api/connectors/commands/result", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      await reply.code(401).send({ message: "缺少连接器令牌。" });
      return;
    }
    const input = ConnectorCommandResultSchema.parse(request.body);
    const command = await services.connectorStore.completeCommand(token, input);
    if (!command) {
      await reply.code(404).send({ message: "连接器命令不存在。" });
      return;
    }
    await services.auditLog.append({ actor: command.connectorName ?? "connector", action: "connector.command.result", target: command.id, status: command.status === "success" ? "success" : "error" });
    return { command };
  });
}

function readBearerToken(authorization: string | undefined): string {
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
}
