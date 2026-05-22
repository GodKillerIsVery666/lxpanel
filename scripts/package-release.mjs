import { createHash } from "node:crypto";
import { createWriteStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = String(manifest.version ?? "0.0.0");
const releaseDir = join(root, "release");
const archiveName = `lxpanel-${version}.tar.gz`;
const archivePath = join(releaseDir, archiveName);
const topDir = `lxpanel-${version}`;

const includePaths = [
  "README.md",
  "package.json",
  "package-lock.json",
  "apps/api/package.json",
  "apps/api/dist",
  "apps/web/package.json",
  "apps/web/dist",
  "packages/shared/package.json",
  "packages/shared/dist",
  "deploy",
  "docs",
  "scripts/install-linux.sh"
];

const requiredPaths = [
  "apps/api/dist/server.js",
  "apps/web/dist/index.html",
  "packages/shared/dist/index.js"
];

for (const item of requiredPaths) {
  if (!existsSync(join(root, item))) {
    console.error(`Missing build artifact: ${item}`);
    process.exit(1);
  }
}

function listFiles(item) {
  const absolute = join(root, item);
  if (!existsSync(absolute)) {
    return [];
  }
  const stat = statSync(absolute);
  if (stat.isFile()) {
    return [item];
  }
  return readdirSync(absolute).flatMap((child) => listFiles(join(item, child)));
}

function writeOctal(buffer, value, start, length) {
  const text = value.toString(8).padStart(length - 1, "0");
  buffer.write(text.slice(-length + 1), start, length - 1, "ascii");
  buffer[start + length - 1] = 0;
}

function splitTarName(name) {
  if (Buffer.byteLength(name) <= 100) {
    return { name, prefix: "" };
  }
  const parts = name.split("/");
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const fileName = parts.slice(index).join("/");
    const prefix = parts.slice(0, index).join("/");
    if (Buffer.byteLength(fileName) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name: fileName, prefix };
    }
  }
  throw new Error(`Path is too long for ustar: ${name}`);
}

function createHeader(name, size, mode) {
  const header = Buffer.alloc(512, 0);
  const names = splitTarName(name);
  header.write(names.name, 0, 100, "utf8");
  writeOctal(header, mode, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  header.write("ustar", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  header.write(names.prefix, 345, 155, "utf8");
  let checksum = 0;
  for (const value of header) {
    checksum += value;
  }
  const checksumText = checksum.toString(8).padStart(6, "0");
  header.write(checksumText, 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function tarFile(relativePath) {
  const absolute = join(root, relativePath);
  const normalized = `${topDir}/${relativePath.split(sep).join("/")}`;
  const body = readFileSync(absolute);
  const mode = basename(relativePath).endsWith(".sh") ? 0o755 : 0o644;
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512, 0);
  return Buffer.concat([createHeader(normalized, body.length, mode), body, padding]);
}

const files = includePaths.flatMap(listFiles).sort((left, right) => left.localeCompare(right));
const archive = gzipSync(Buffer.concat([...files.map(tarFile), Buffer.alloc(1024, 0)]), { level: 9 });
await mkdir(dirname(archivePath), { recursive: true });
await new Promise((resolve, reject) => {
  const stream = createWriteStream(archivePath);
  stream.on("error", reject);
  stream.on("finish", resolve);
  stream.end(archive);
});

const sha256 = createHash("sha256").update(archive).digest("hex");
await writeFile(`${archivePath}.sha256`, `${sha256}  ${archiveName}\n`, "utf8");
console.log(`${relative(root, archivePath)} ${sha256}`);
