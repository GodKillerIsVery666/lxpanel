import { existsSync } from "node:fs";
import { join } from "node:path";

const required = [
  "packages/shared/dist/index.js",
  "apps/api/dist/server.js",
  "apps/web/dist/index.html"
];

const missing = required.filter((item) => !existsSync(join(process.cwd(), item)));
if (missing.length > 0) {
  console.error(`缺少构建产物: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("smoke ok");
