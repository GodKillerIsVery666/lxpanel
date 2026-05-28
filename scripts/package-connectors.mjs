#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

// CLI 参数解析：--version <x.y.z> --channel <stable|candidate> --platforms <p1,p2,...>
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { version: "", channel: "stable", platforms: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--version" && args[i + 1]) { opts.version = args[++i]; continue; }
    if (args[i] === "--channel" && args[i + 1]) { opts.channel = args[++i]; continue; }
    if (args[i] === "--platforms" && args[i + 1]) { opts.platforms = args[++i].split(",").map((p) => p.trim()).filter(Boolean); continue; }
  }
  return opts;
}
const cli = parseArgs();
const version = cli.version || String(packageJson.version ?? "0.0.0");
const agentVersion = `node-agent-${version}`;
const channel = cli.channel;
const releaseSecret = process.env.LXPANEL_CONNECTOR_RELEASE_SECRET || `lxpanel-connector-release-${version}`;
const platforms = cli.platforms.length > 0 ? cli.platforms : ["win32-x64", "linux-x64", "darwin-arm64"];
const releaseDir = join(root, "release", "connectors");

await mkdir(releaseDir, { recursive: true });

const connectorSource = await readFile(join(root, "scripts", "lxpanel-connector.mjs"), "utf8");
const artifacts = [];
const checksumLines = [];

for (const platform of platforms) {
  const fileName = `lxpanel-connector-${agentVersion}-${platform}.tar.gz`;
  const archive = gzipSync(createTar([
    { name: "lxpanel-connector.mjs", content: connectorSource, mode: 0o755 },
    { name: "README.txt", content: connectorReadme(platform), mode: 0o644 }
  ]), { level: 9 });
  const artifactPath = join(releaseDir, fileName);
  await writeFile(artifactPath, archive);
  const digest = sha256(archive);
  const signature = createHmac("sha256", releaseSecret).update(digest).digest("base64url");
  await writeFile(`${artifactPath}.sig`, `${signature}\n`, "utf8");
  checksumLines.push(`${digest}  ${fileName}`, `${sha256(signature)}  ${fileName}.sig`);
  artifacts.push({
    id: `connector-${platform}`,
    channel,
    version: agentVersion,
    platform,
    url: `release/connectors/${fileName}`,
    sha256: digest,
    signature: `${fileName}.sig`,
    createdAt: new Date().toISOString()
  });
}

const unsignedManifest = { generatedAt: new Date().toISOString(), agentVersion, publicKeyId: "lxpanel-connector-release-v1", artifacts };
const manifest = { ...unsignedManifest, manifestSha256: sha256(JSON.stringify(unsignedManifest)) };
await writeFile(join(releaseDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(join(releaseDir, "SHA256SUMS"), `${checksumLines.join("\n")}\n`, "utf8");
console.log(`${relative(root, join(releaseDir, "manifest.json"))} ${manifest.manifestSha256}`);

function connectorReadme(platform) {
  return [
    `LXPanel connector ${agentVersion}`,
    `Platform: ${platform}`,
    "Run: node lxpanel-connector.mjs --api <panel-url> --token <connector-token>",
    "Verify: compare SHA256SUMS and .sig before installing."
  ].join("\n") + "\n";
}

function createTar(files) {
  return Buffer.concat([...files.map(tarFile), Buffer.alloc(1024, 0)]);
}

function tarFile(file) {
  const body = Buffer.from(file.content, "utf8");
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512, 0);
  return Buffer.concat([createHeader(file.name, body.length, file.mode), body, padding]);
}

function createHeader(name, size, mode) {
  const header = Buffer.alloc(512, 0);
  header.write(basename(name), 0, 100, "utf8");
  writeOctal(header, mode, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  header.write("ustar", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  let checksum = 0;
  for (const value of header) {
    checksum += value;
  }
  header.write(checksum.toString(8).padStart(6, "0"), 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function writeOctal(buffer, value, start, length) {
  const text = value.toString(8).padStart(length - 1, "0");
  buffer.write(text.slice(-length + 1), start, length - 1, "ascii");
  buffer[start + length - 1] = 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}