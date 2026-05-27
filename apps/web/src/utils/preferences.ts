import { navItems, type ViewId } from "../navigation.js";

export type TableDensity = "comfortable" | "compact";

const activeViewKey = "lxpanel.activeView";
const recentViewsKey = "lxpanel.recentViews";
const tableDensityKey = "lxpanel.tableDensity";

export function readActiveViewPreference(): ViewId {
  const storedView = readString(activeViewKey);
  return isViewId(storedView) ? storedView : "dashboard";
}

export function saveActiveViewPreference(view: ViewId): void {
  writeString(activeViewKey, view);
}

export function readRecentViewsPreference(): ViewId[] {
  const parsed = readJson(recentViewsKey);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isViewId).slice(0, 5);
}

export function addRecentViewPreference(activeView: ViewId, current: ViewId[]): ViewId[] {
  const nextViews = mergeRecentViews(activeView, current);
  writeJson(recentViewsKey, nextViews);
  return nextViews;
}

export function mergeRecentViews(activeView: ViewId, current: ViewId[], limit = 5): ViewId[] {
  return [activeView, ...current.filter((view) => view !== activeView)].slice(0, limit);
}

export function readTableDensityPreference(): TableDensity {
  const storedDensity = readString(tableDensityKey);
  return isTableDensity(storedDensity) ? storedDensity : "comfortable";
}

export function saveTableDensityPreference(density: TableDensity): void {
  writeString(tableDensityKey, density);
}

export function isTableDensity(value: unknown): value is TableDensity {
  return value === "comfortable" || value === "compact";
}

export function isViewId(value: unknown): value is ViewId {
  return typeof value === "string" && navItems.some((item) => item.id === value);
}

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 浏览器禁用存储时保持 UI 可用。
  }
}

function readJson(key: string): unknown {
  const value = readString(key);
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}
