import type { FastifyInstance } from "fastify";
import { ConnectorHeartbeatSchema, CreateConnectorSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireUser } from "../auth/authMiddleware.js";

export function registerConnectorRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/connectors", async (request, reply) => {
    const user = await requireUser(request, reply, services);
    if (!user) {
      return;
    }
    return { connectors: await services.connectorStore.list() };
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
}
