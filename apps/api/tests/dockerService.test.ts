import { describe, expect, it } from "vitest";
import { parseDockerContainers, parseDockerImages } from "../src/modules/docker/dockerService.js";

describe("Docker 输出解析", () => {
  it("解析容器 JSON 行", () => {
    const stdout = [
      JSON.stringify({ ID: "abc123", Image: "nginx:latest", Command: "nginx -g", CreatedAt: "2026-05-22 09:00", Status: "Up 2 minutes", State: "running", Names: "web", Ports: "0.0.0.0:80->80/tcp" }),
      JSON.stringify({ ID: "def456", Image: "redis:7", Status: "Exited", State: "exited", Names: "cache" })
    ].join("\n");

    expect(parseDockerContainers(stdout)).toEqual([
      { id: "abc123", image: "nginx:latest", command: "nginx -g", createdAt: "2026-05-22 09:00", status: "Up 2 minutes", state: "running", name: "web", ports: "0.0.0.0:80->80/tcp" },
      { id: "def456", image: "redis:7", status: "Exited", state: "exited", name: "cache" }
    ]);
  });

  it("跳过无效 JSON 行并解析镜像", () => {
    const stdout = `not-json\n${JSON.stringify({ ID: "sha256:abc", Repository: "lxpanel", Tag: "dev", CreatedSince: "1 hour ago", Size: "120MB" })}`;

    expect(parseDockerImages(stdout)).toEqual([
      { id: "sha256:abc", repository: "lxpanel", tag: "dev", createdSince: "1 hour ago", size: "120MB" }
    ]);
  });
});
