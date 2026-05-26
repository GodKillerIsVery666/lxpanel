import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../apps/api/dist/server.js";
import { loadConfig } from "../apps/api/dist/config/env.js";

const dataDir = await mkdtemp(join(tmpdir(), "lxpanel-e2e-"));
const app = await buildApp(loadConfig({ LXPANEL_DATA_DIR: dataDir, LXPANEL_SESSION_SECRET: "e2e-secret-with-enough-length-for-lxpanel" }));
try {
  const setup = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ username: "admin", password: "Admin-Password-2026" })
  });
  if (setup.statusCode !== 200) {
    throw new Error(`setup failed: ${setup.statusCode}`);
  }
  const cookie = setup.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
  const checks = [
    await app.inject({ method: "GET", url: "/api/system/overview", headers: { cookie } }),
    await app.inject({ method: "GET", url: "/api/security/posture", headers: { cookie } }),
    await app.inject({ method: "GET", url: "/api/security/hardening-plan", headers: { cookie } }),
    await app.inject({ method: "GET", url: "/api/apps/templates", headers: { cookie } }),
    await app.inject({ method: "GET", url: "/api/backups", headers: { cookie } })
  ];
  for (const response of checks) {
    if (response.statusCode !== 200) {
      throw new Error(`unexpected status ${response.statusCode}`);
    }
  }
  console.log("e2e smoke ok");
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
