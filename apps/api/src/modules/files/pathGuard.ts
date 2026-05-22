import { isAbsolute, relative, resolve } from "node:path";

export interface ManagedPath {
  root: string;
  path: string;
}

export function resolveManagedPath(inputPath: string | undefined, roots: readonly string[]): ManagedPath {
  if (roots.length === 0) {
    throw new Error("未配置可管理目录。");
  }
  const normalizedRoots = roots.map((root) => resolve(root));
  const candidate = inputPath && isAbsolute(inputPath)
    ? resolve(inputPath)
    : resolve(normalizedRoots[0] ?? ".", inputPath ?? ".");
  const root = normalizedRoots.find((item) => isInside(item, candidate));
  if (!root) {
    throw new Error("路径不在允许的管理目录内。");
  }
  return { root, path: candidate };
}

function isInside(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  if (fromRoot === "") {
    return true;
  }
  return !fromRoot.startsWith("..") && !isAbsolute(fromRoot);
}
