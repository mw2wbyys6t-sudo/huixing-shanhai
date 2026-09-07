/**
 * 用户本地偏好：浏览足迹 + 心愿单收藏
 * 纯 localStorage 实现，无需登录即可使用
 */
import type { ScenicSpot } from './api';

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
  return next.includes(spotId);
}
