#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { hostname, platform, release } from "node:os";
import { dirname, join } from "node:path";

const args = parseArgs(process.argv.slice(2));
const rootDir = process.cwd();

const checks = await Promise.all([
  checkPackageScripts(),
  checkFile("apps/api/dist/server.js", "api-build", "API build output"),
  checkFile("apps/web/dist/index.html", "web-build", "Web build output"),
  checkFile("scripts/migrate-state.mjs", "state-migration", "State migration script"),
  checkFile("scripts/lxpanel-connector.mjs", "connector-agent", "Connector agent script"),
  checkFile("release/connectors/manifest.json", "connector-manifest", "Connector release manifest"),
  checkFile("release/connectors/SHA256SUMS", "connector-checksums", "Connector release checksums"),
  checkFile("docs/roadmap.md", "roadmap", "Roadmap document"),
  checkLatestRelease()
]);

const artifacts = await collectArtifacts();
const unsigned = {
  generatedAt: new Date().toISOString(),
  product: "LXPanel",
  host: hostname(),
  platform: `${platform()} ${release()}`,
  node: process.version,
  root: rootDir,
  checks,
  artifacts
};
const report = { ...unsigned, sha256: sha256(JSON.stringify(unsigned)) };

if (typeof args.output === "string" && args.output.length > 0) {
  const outputPath = join(rootDir, args.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (args.json === true || typeof args.output !== "string") {
  console.log(JSON.stringify(report, null, 2));
} else {
  const failed = checks.filter((check) => check.status === "error");
  console.log(`diagnostics ok=${failed.length === 0} sha256=${report.sha256}`);
}

process.exitCode = checks.some((check) => check.status === "error") ? 1 : 0;

async function checkPackageScripts() {
  try {
    const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"));
    const scripts = packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {};
    const required = ["build", "smoke", "e2e", "package:release", "diagnose:release"];
    const missing = required.filter((name) => typeof scripts[name] !== "string");
    return check("package-scripts", missing.length === 0 ? "ok" : "error", missing.length === 0 ? "Required release scripts are present." : `Missing scripts: ${missing.join(", ")}`);
  } catch (error) {
    return check("package-scripts", "error", error instanceof Error ? error.message : String(error));
  }
}

async function checkFile(path, id, title) {
  try {
    const file = join(rootDir, path);
    const info = await stat(file);
    return check(id, info.isFile() ? "ok" : "error", `${title}: ${path} (${info.size} bytes)`);
  } catch {
    return check(id, "error", `${title} missing: ${path}`);
  }
}

async function checkLatestRelease() {
  const releases = await releaseFiles();
  if (releases.length === 0) {
    return check("release-package", "warn", "No release/lxpanel-*.tar.gz package found.");
  }
  const latest = releases.at(-1);
  if (!latest) {
    return check("release-package", "warn", "No release package found.");
  }
  const buffer = await readFile(join(rootDir, "release", latest));
  return check("release-package", "ok", `${latest} sha256=${sha256(buffer)}`);
}

async function collectArtifacts() {
  const files = [
    "package.json",
    "README.md",
    "docs/roadmap.md",
    "docs/architecture.md",
    "apps/web/dist/index.html",
    "apps/api/dist/server.js",
    "release/connectors/manifest.json",
    "release/connectors/SHA256SUMS"
  ];
  const releases = (await releaseFiles()).map((file) => `release/${file}`);
  const artifactPaths = [...files, ...releases];
  const artifacts = [];
  for (const path of artifactPaths) {
    try {
      const buffer = await readFile(join(rootDir, path));
      artifacts.push({ path, bytes: buffer.length, sha256: sha256(buffer) });
    } catch {
      artifacts.push({ path, missing: true });
    }
  }
  return artifacts;
}

async function releaseFiles() {
  try {
    const entries = await readdir(join(rootDir, "release"));
    return entries.filter((entry) => /^lxpanel-.+\.tar\.gz$/u.test(entry)).sort();
  } catch {
    return [];
  }
}

function check(id, status, detail) {
  return { id, status, detail };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--json") {
      parsed.json = true;
      continue;
    }
    if (value === "--output") {
      parsed.output = values[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (value.startsWith("--output=")) {
      parsed.output = value.slice("--output=".length);
    }
  }
  return parsed;
}