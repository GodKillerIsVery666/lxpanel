import type { FastifyInstance } from "fastify";
import type { Services } from "../../server.js";

/**
 * 注册 Swagger UI 文档站点。
 * 在 /api/docs 提供基于 OpenAPI JSON 的可交互 API 文档。
 */
export function registerDocsRoutes(app: FastifyInstance, services: Services): void {
  // OpenAPI JSON 端点（由 platformStore 提供）
  app.get("/api/openapi.json", async (_request, _reply) => {
    const doc = services.platformStore.openApiDocument();
    return doc;
  });

  // Swagger UI HTML
  app.get("/api/docs", async (_request, reply) => {
    reply.header("content-type", "text/html; charset=utf-8");
    return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>LXPanel API 文档</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
<style>html{background:#1a1a2e}body{margin:0}</style></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui",
  presets: [SwaggerUIBundle.presets.apis],
  layout: "BaseLayout", deepLinking: true,
  defaultModelsExpandDepth: -1
});
</script></body></html>`;
  });
}
