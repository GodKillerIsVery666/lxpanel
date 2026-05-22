import type { FastifyInstance } from "fastify";
import { CreateTaskSchema, TaskRunRequestSchema, UpdateTaskScheduleSchema } from "@lxpanel/shared";
import type { Services } from "../../server.js";
import { requireRole } from "../auth/authMiddleware.js";

export function registerTaskRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/tasks", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    return { tasks: await services.taskStore.listTasks(), runs: await services.taskStore.listRuns() };
  });

  app.post("/api/tasks", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = CreateTaskSchema.parse(request.body);
    const task = await services.taskStore.createTask(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "task.create", target: task.name, ip: request.ip, status: "success" });
    return { task };
  });

  app.post("/api/tasks/run", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = TaskRunRequestSchema.parse(request.body);
    const run = await services.taskStore.runTask(input.taskId, user.username);
    await services.auditLog.append({ actor: user.username, action: "task.run", target: run.taskName, ip: request.ip, status: run.status === "success" ? "success" : "error" });
    return { run };
  });

  app.patch("/api/tasks/schedule", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    const input = UpdateTaskScheduleSchema.parse(request.body);
    const task = await services.taskStore.updateTaskSchedule(input, user.username);
    await services.auditLog.append({ actor: user.username, action: "task.schedule", target: task.name, ip: request.ip, status: "success" });
    return { task };
  });

  app.delete<{ Querystring: { taskId?: string } }>("/api/tasks", async (request, reply) => {
    const user = await requireRole(request, reply, services, "operator");
    if (!user) {
      return;
    }
    if (!request.query.taskId) {
      await reply.code(400).send({ message: "缺少 taskId。" });
      return;
    }
    await services.taskStore.deleteTask(request.query.taskId);
    await services.auditLog.append({ actor: user.username, action: "task.delete", target: request.query.taskId, ip: request.ip, status: "success" });
    return { ok: true };
  });
}
