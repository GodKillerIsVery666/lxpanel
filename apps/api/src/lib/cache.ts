/** 可选 Redis 缓存层。通过 LXPANEL_REDIS_URL 启用（需安装 redis 包）。 */

export function isCacheEnabled(): boolean {
  return Boolean(process.env.LXPANEL_REDIS_URL ?? "");
}

export function getCache(): null {
  return null;
}

export async function closeCache(): Promise<void> {
  // noop
}

