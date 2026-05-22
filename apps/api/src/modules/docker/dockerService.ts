import type { DockerContainer, DockerImage, DockerStatus } from "@lxpanel/shared";
import { runCommand } from "../../lib/command.js";

interface DockerContainerLine {
  ID?: unknown;
  Image?: unknown;
  Command?: unknown;
  CreatedAt?: unknown;
  Status?: unknown;
  State?: unknown;
  Names?: unknown;
  Ports?: unknown;
}

interface DockerImageLine {
  ID?: unknown;
  Repository?: unknown;
  Tag?: unknown;
  CreatedSince?: unknown;
  Size?: unknown;
}

export async function getDockerStatus(): Promise<DockerStatus> {
  const dockerVersion = await tryDocker(["version", "--format", "{{.Server.Version}}"]);
  const composeVersion = await tryDocker(["compose", "version", "--short"]);
  if (!dockerVersion.ok) {
    return {
      available: false,
      composeAvailable: false,
      error: dockerVersion.error
    };
  }
  return {
    available: true,
    composeAvailable: composeVersion.ok,
    version: dockerVersion.stdout.trim() || undefined,
    error: composeVersion.ok ? undefined : composeVersion.error
  };
}

export async function listDockerContainers(): Promise<DockerContainer[]> {
  const { stdout } = await runCommand("docker", ["ps", "-a", "--format", "{{json .}}"], 8_000);
  return parseDockerContainers(stdout);
}

export async function listDockerImages(): Promise<DockerImage[]> {
  const { stdout } = await runCommand("docker", ["images", "--format", "{{json .}}"], 8_000);
  return parseDockerImages(stdout);
}

export async function runDockerContainerAction(id: string, action: "start" | "stop" | "restart"): Promise<void> {
  await runCommand("docker", [action, id], action === "stop" ? 20_000 : 15_000);
}

export function parseDockerContainers(stdout: string): DockerContainer[] {
  return parseJsonLines<DockerContainerLine>(stdout).map((item) => ({
    id: asText(item.ID),
    name: asText(item.Names),
    image: asText(item.Image),
    command: optionalText(item.Command),
    createdAt: optionalText(item.CreatedAt),
    status: asText(item.Status),
    state: asText(item.State),
    ports: optionalText(item.Ports)
  })).filter((item) => item.id.length > 0);
}

export function parseDockerImages(stdout: string): DockerImage[] {
  return parseJsonLines<DockerImageLine>(stdout).map((item) => ({
    id: asText(item.ID),
    repository: asText(item.Repository),
    tag: asText(item.Tag),
    createdSince: optionalText(item.CreatedSince),
    size: asText(item.Size)
  })).filter((item) => item.id.length > 0);
}

async function tryDocker(args: readonly string[]): Promise<{ ok: true; stdout: string } | { ok: false; error: string }> {
  try {
    const result = await runCommand("docker", args, 5_000);
    return { ok: true, stdout: result.stdout };
  } catch (error) {
    return { ok: false, error: conciseError(error) };
  }
}

function parseJsonLines<TLine extends object>(stdout: string): TLine[] {
  const parsed: TLine[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const value = JSON.parse(trimmed) as unknown;
      if (typeof value === "object" && value !== null) {
        parsed.push(value as TLine);
      }
    } catch {
      continue;
    }
  }
  return parsed;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | undefined {
  const text = asText(value);
  return text.length > 0 ? text : undefined;
}

function conciseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.split("\n")[0] ?? error.message;
  }
  return "Docker 不可用。";
}
