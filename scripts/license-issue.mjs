import { existsSync, readFileSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const privateKey = args.privateKey ? readFileSync(args.privateKey, "utf8") : generatePrivateKey();
const payload = {
  plan: args.plan ?? "team",
  licensedTo: args.licensedTo ?? "LXPanel Customer",
  machineCode: args.machineCode ?? "",
  expiresAt: args.expiresAt ?? "",
  issuedAt: new Date().toISOString(),
  issuer: args.issuer ?? "lxpanel-license-tool"
};

const payloadText = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
const signatureText = sign("sha256", Buffer.from(payloadText), privateKey).toString("base64url");
const offlineToken = `${payloadText}.${signatureText}`;

console.log(JSON.stringify({ payload, offlineToken, generatedPrivateKey: args.privateKey ? undefined : privateKey }, null, 2));

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") {
      parsed.help = true;
      continue;
    }
    if (!value.startsWith("--")) {
      continue;
    }
    const key = toCamelCase(value.slice(2));
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  if (parsed.privateKey && !existsSync(parsed.privateKey)) {
    throw new Error(`private key not found: ${parsed.privateKey}`);
  }
  return parsed;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function generatePrivateKey() {
  return generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
}

function printHelp() {
  console.log("Usage: npm run license:issue -- --private-key ./license.key --licensed-to Acme --plan team --machine-code xxxx --expires-at 2027-01-01T00:00:00.000Z");
}
