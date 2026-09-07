/**
 * 用户本地偏好：浏览足迹 + 心愿单收藏
 * 纯 localStorage 实现，无需登录即可使用
 */
import { API_BASE_URL, getAuthToken, type ScenicSpot } from './api';

const HISTORY_KEY = 'huixing_visit_history';
const FAV_KEY = 'huixing_favorites';
const MAX_HISTORY = 8;

export interface VisitRecord {
  id: string;
  name: string;
  image: string;
  visitedAt: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** 记录一次景区访问（去重置顶，最多保留 8 条） */
export function recordVisit(spot: Pick<ScenicSpot, 'id' | 'name' | 'images'>): void {
  if (typeof window === 'undefined') return;
  const list = safeParse<VisitRecord[]>(window.localStorage.getItem(HISTORY_KEY), []);
  const next: VisitRecord[] = [
    { id: spot.id, name: spot.name, image: spot.images?.[0] || '', visitedAt: Date.now() },
    ...list.filter((v) => v.id !== spot.id),
  ].slice(0, MAX_HISTORY);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  void pushPrefsIfAuthed();
}

export function getVisitHistory(): VisitRecord[] {
  if (typeof window === 'undefined') return [];
  return safeParse<VisitRecord[]>(window.localStorage.getItem(HISTORY_KEY), []);
}

export function clearVisitHistory(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(HISTORY_KEY);
}

/** 心愿单收藏 */
export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  return safeParse<string[]>(window.localStorage.getItem(FAV_KEY), []);
}

export function isFavorite(spotId: string): boolean {
  return getFavorites().includes(spotId);
}

export function toggleFavorite(spotId: string): boolean {
  if (typeof window === 'undefined') return false;
  const list = getFavorites();
  const next = list.includes(spotId) ? list.filter((id) => id !== spotId) : [...list, spotId];
  window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
  // 已登录时把变更推送到云端（fire-and-forget）
  void pushPrefsIfAuthed();
  window.dispatchEvent(new CustomEvent('huixing-fav-changed'));
  return next.includes(spotId);
}

// ==================== 登录用户的云端同步 ====================
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** 已登录时节流推送本地偏好到云端（600ms 防抖） */
export function pushPrefsIfAuthed(): void {
  if (!getAuthToken()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/user/prefs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ favorites: getFavorites(), history: getVisitHistory() }),
      });
    } catch {
      // 同步失败静默，本地数据不受影响
    }
  }, 600);
}

/**
 * 登录/注册成功后调用：拉取云端偏好并与本地合并（收藏并集、足迹按时间归并），
 * 合并结果同时写回本地与云端。失败静默（本地数据照常可用）。
 */
export async function mergePrefsOnLogin(): Promise<void> {
  const token = getAuthToken();
  if (!token || typeof window === 'undefined') return;
  try {
    const resp = await fetch(`${API_BASE_URL}/api/user/prefs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const remoteFavs: string[] = data.prefs?.favorites || [];
    const remoteHistory: VisitRecord[] = data.prefs?.history || [];

    const localFavs = getFavorites();
    const mergedFavs = Array.from(new Set([...localFavs, ...remoteFavs]));

    const localHistory = getVisitHistory();
    const byId = new Map<string, VisitRecord>();
    for (const rec of [...localHistory, ...remoteHistory]) {
      const prev = byId.get(rec.id);
      const at = rec.visitedAt || 0;
      const prevAt = prev?.visitedAt || 0;
      if (!prev || at > prevAt) byId.set(rec.id, { ...rec, visitedAt: at });
    }
    const mergedHistory = Array.from(byId.values()).sort((a, b) => b.visitedAt - a.visitedAt).slice(0, MAX_HISTORY);

    window.localStorage.setItem(FAV_KEY, JSON.stringify(mergedFavs));
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(mergedHistory));

    // 合并结果写回云端
    await fetch(`${API_BASE_URL}/api/user/prefs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ favorites: mergedFavs, history: mergedHistory }),
    });

    // 通知页面刷新收藏状态
    window.dispatchEvent(new CustomEvent('huixing-fav-changed'));
  } catch {
    // 网络失败不影响本地使用
  }
}
