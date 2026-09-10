/**
 * 慧行山海 API 调用封装
 * 支持本地数据回退（静态部署无后端时使用内置数据）
 */

import scenicData from './scenic_data.json';

// 后端地址统一出口：本地开发默认 8000 端口，部署时通过 NEXT_PUBLIC_API_URL 注入
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 只读接口基址（后端路由挂载在 /api 前缀下；无后端时失败自动回退本地数据）
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api`;

/** 后端上传文件的相对路径（如 /uploads/xx.jpg）转成完整可访问地址 */
export function resolveFileUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

// ==================== 登录态工具 ====================
const TOKEN_KEY = 'huixing_token';
const USER_KEY = 'huixing_user';

export interface SessionUser {
  id: string;
  phone?: string | null;
  email?: string | null;
  username: string;
  avatar?: string | null;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: SessionUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

/** 携带登录态的 fetch 封装（供需要鉴权的接口使用） */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export interface AvoidIndex {
  avoid_index: number;
  avoid_tags: string[];
  best_time: string;
  tips: string;
}

export interface ScenicSpot {
  id: string;
  name: string;
  province: string;
  city: string;
  type: string;
  level: string;
  rating: number;
  review_count: string;
  description: string;
  images: string[];
  latitude: number;
  longitude: number;
  best_season: string;
  ticket: string;      // 门票费用参考
  transport: string;   // 交通建议
  tags: string[];
  avoid: AvoidIndex;
}

export interface WeatherInfo {
  city: string;
  temperature: string;
  weather: string;
  wind: string;
  humidity: string;
  report_time: string;
  isMock?: boolean; // 后端不可用时的示例数据标记
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: T[];
}

// 本地数据缓存
const localSpots = scenicData as ScenicSpot[];

// 模拟天气数据
const mockWeatherData: Record<string, WeatherInfo> = {
  '北京': { city: '北京', temperature: '22', weather: '晴', wind: '东北风3级', humidity: '45', report_time: '2026-09-05 10:00', isMock: true },
  '上海': { city: '上海', temperature: '26', weather: '多云', wind: '东南风2级', humidity: '68', report_time: '2026-09-05 10:00', isMock: true },
  '杭州': { city: '杭州', temperature: '25', weather: '阴', wind: '东风2级', humidity: '72', report_time: '2026-09-05 10:00', isMock: true },
  '成都': { city: '成都', temperature: '21', weather: '小雨', wind: '北风1级', humidity: '85', report_time: '2026-09-05 10:00', isMock: true },
  '西安': { city: '西安', temperature: '20', weather: '晴', wind: '西北风2级', humidity: '50', report_time: '2026-09-05 10:00', isMock: true },
  '厦门': { city: '厦门', temperature: '28', weather: '晴', wind: '东南风3级', humidity: '75', report_time: '2026-09-05 10:00', isMock: true },
  '丽江': { city: '丽江', temperature: '18', weather: '晴', wind: '西南风2级', humidity: '55', report_time: '2026-09-05 10:00', isMock: true },
  '黄山': { city: '黄山', temperature: '16', weather: '多云', wind: '东南风3级', humidity: '78', report_time: '2026-09-05 10:00', isMock: true },
  '九寨沟': { city: '九寨沟', temperature: '14', weather: '晴', wind: '西北风2级', humidity: '60', report_time: '2026-09-05 10:00', isMock: true },
  '张家界': { city: '张家界', temperature: '19', weather: '阴', wind: '东风2级', humidity: '80', report_time: '2026-09-05 10:00', isMock: true },
};

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // API请求失败时，使用本地数据回退
    console.log('API请求失败，使用本地数据回退:', endpoint);
    throw error;
  }
}

// 景区相关 API
export const scenicAPI = {
  // 获取景区列表
  getList: async (params?: {
    page?: number;
    page_size?: number;
    province?: string;
    type?: string;
    level?: string;
  }): Promise<PaginatedResponse<ScenicSpot>> => {
    try {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.page_size) query.set('page_size', String(params.page_size));
      if (params?.province) query.set('province', params.province);
      if (params?.type) query.set('type', params.type);
      if (params?.level) query.set('level', params.level);
      const queryStr = query.toString();
      return await fetchAPI<PaginatedResponse<ScenicSpot>>(`/spots${queryStr ? `?${queryStr}` : ''}`);
    } catch (error) {
      // 本地数据回退
      let filtered = [...localSpots];
      if (params?.province && params.province !== '全部') {
        filtered = filtered.filter(s => s.province === params.province);
      }
      if (params?.type && params.type !== '全部') {
        filtered = filtered.filter(s => s.type === params.type);
      }
      const page = params?.page || 1;
      const page_size = params?.page_size || 12;
      const start = (page - 1) * page_size;
      const items = filtered.slice(start, start + page_size);
      return {
        total: filtered.length,
        page,
        page_size,
        total_pages: Math.ceil(filtered.length / page_size),
        items,
      };
    }
  },

  // 获取景区详情
  getDetail: async (id: string): Promise<ScenicSpot> => {
    try {
      return await fetchAPI<ScenicSpot>(`/spots/${id}`);
    } catch (error) {
      // 本地数据回退
      const spot = localSpots.find(s => s.id === id);
      if (spot) return spot;
      throw new Error('景区不存在');
    }
  },

  // 搜索景区
  search: async (q: string): Promise<{ query: string; total: number; items: ScenicSpot[] }> => {
    try {
      return await fetchAPI<{ query: string; total: number; items: ScenicSpot[] }>(`/spots/search?q=${encodeURIComponent(q)}`);
    } catch (error) {
      // 本地数据回退
      const lowerQ = q.toLowerCase();
      const items = localSpots.filter(s =>
        s.name.toLowerCase().includes(lowerQ) ||
        s.city.toLowerCase().includes(lowerQ) ||
        s.province.toLowerCase().includes(lowerQ) ||
        s.tags.some(t => t.toLowerCase().includes(lowerQ))
      );
      return { query: q, total: items.length, items };
    }
  },

  // 获取避雷指数
  getAvoidIndex: async (id: string): Promise<AvoidIndex> => {
    try {
      return await fetchAPI<AvoidIndex>(`/spots/${id}/avoid`);
    } catch (error) {
      // 本地数据回退
      const spot = localSpots.find(s => s.id === id);
      if (spot) return spot.avoid;
      throw new Error('景区不存在');
    }
  },

  // 推荐景区
  getRecommend: async (params?: { province?: string; city?: string; limit?: number }): Promise<{ total: number; items: ScenicSpot[] }> => {
    try {
      const query = new URLSearchParams();
      if (params?.province) query.set('province', params.province);
      if (params?.city) query.set('city', params.city);
      if (params?.limit) query.set('limit', String(params.limit));
      const queryStr = query.toString();
      return await fetchAPI<{ total: number; items: ScenicSpot[] }>(`/spots/recommend${queryStr ? `?${queryStr}` : ''}`);
    } catch (error) {
      // 本地数据回退
      let items = [...localSpots];
      if (params?.province) {
        const sameProvince = items.filter(s => s.province === params.province);
        if (sameProvince.length > 0) items = sameProvince;
      }
      // 按评分排序
      items.sort((a, b) => b.rating - a.rating);
      const limit = params?.limit || 8;
      return { total: items.length, items: items.slice(0, limit) };
    }
  },
};

// 天气 API
export const weatherAPI = {
  getWeather: async (city: string): Promise<WeatherInfo> => {
    try {
      return await fetchAPI<WeatherInfo>(`/weather?city=${encodeURIComponent(city)}`);
    } catch (error) {
      // 本地模拟数据回退
      if (mockWeatherData[city]) {
        return mockWeatherData[city];
      }
      // 默认天气
      return {
        city,
        temperature: '22',
        weather: '晴',
        wind: '微风',
        humidity: '60',
        report_time: '2026-09-05 10:00',
        isMock: true,
      };
    }
  },
};

// 省份 API
export const provinceAPI = {
  getList: async (): Promise<{ total: number; items: string[] }> => {
    try {
      return await fetchAPI<{ total: number; items: string[] }>('/provinces');
    } catch (error) {
      // 本地数据回退
      const provinces = Array.from(new Set(localSpots.map(s => s.province)));
      return { total: provinces.length, items: provinces };
    }
  },
};


// ==================== 实时聚合旅游资讯 API ====================
export interface NewsItem {
  category: string;  // 天气动态 | 社区热文 | 最新评价 | 避雷提醒
  title: string;
  summary: string;
  source: string;
  time: string;
  link: string;
}

export interface NewsFeed {
  success: boolean;
  count: number;
  updated_at: string;
  items: NewsItem[];
}

export const newsAPI = {
  get: async (): Promise<NewsFeed> => fetchAPI<NewsFeed>('/news'),
};

// ==================== 游记/攻略社区 API ====================
export interface NoteItem {
  id: number;
  title: string;
  type: string; // 游记 | 攻略
  spot_id: string | null;
  spot_name: string | null;
  user_name: string;
  views: number;
  likes: number;
  created_at: string | null;
  excerpt: string;
}

export interface NoteCommentItem {
  id: number;
  user_name: string;
  content: string;
  created_at: string | null;
}

export interface NoteDetail extends Omit<NoteItem, 'excerpt'> {
  content: string;
  comments: NoteCommentItem[];
}

export const notesAPI = {
  list: async (params: { page?: number; page_size?: number; type?: string; spot_id?: string; sort?: string }): Promise<{ total: number; items: NoteItem[] }> => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.type) q.set('type', params.type);
    if (params.spot_id) q.set('spot_id', params.spot_id);
    if (params.sort) q.set('sort', params.sort);
    return fetchAPI<{ total: number; items: NoteItem[] }>('/notes?' + q.toString());
  },
  get: async (id: number): Promise<NoteDetail> => fetchAPI<NoteDetail>('/notes/' + id),
  submit: async (payload: { title: string; content: string; type: string; spot_id?: string; spot_name?: string; user_name: string }): Promise<{ success: boolean; note_id: number }> =>
    postJSON<{ success: boolean; note_id: number }>('/api/notes/submit', payload),
  like: async (id: number): Promise<{ success: boolean; likes: number }> =>
    postJSON<{ success: boolean; likes: number }>('/api/notes/' + id + '/like'),
  comment: async (id: number, payload: { content: string; user_name: string }): Promise<{ success: boolean }> =>
    postJSON<{ success: boolean }>('/api/notes/' + id + '/comments', payload),
};

// ==================== 美食 API（高德 POI，后端代理） ====================
export interface FoodPlace {
  id: string;
  name: string;
  address: string;
  distance: number | null;  // 距景区直线距离（米），城市搜索时为 null
  tel: string;
  image: string | null;
  tags: string[];
  rating: string | null;
  cost: number | string | null;  // 人均消费（元）
  type: string;                  // 末级类目：火锅店/日本料理…
  location: string;              // "lng,lat"，用于生成高德导航链接
}

/** 生成高德导航链接（免 Key 的 URI API，新窗口打开） */
export function amapNavUrl(name: string, location: string): string {
  // location 与 name 均编码，防止特殊字符破坏 URL 结构（href 本身由 React 转义，无 XSS 风险）
  return `https://uri.amap.com/marker?position=${encodeURIComponent(location)}&name=${encodeURIComponent(name)}&src=huixing-shanhai&callnative=0`;
}

export const foodAPI = {
  /** 景区周边美食（后端按景区坐标 2km 搜索并缓存） */
  getSpotFood: async (spotId: string): Promise<FoodPlace[]> => {
    const data = await fetchAPI<{ total: number; items: FoodPlace[] }>(`/spots/${spotId}/food`);
    return data.items;
  },
  /** 城市特色美食（规划页目的地美食推荐） */
  getCityFood: async (city: string): Promise<FoodPlace[]> => {
    const data = await fetchAPI<{ city: string; total: number; items: FoodPlace[] }>(`/food/city?city=${encodeURIComponent(city)}`);
    return data.items;
  },
};

// 统计 API
export const statsAPI = {
  getStats: async (): Promise<{
    total_spots: number;
    total_provinces: number;
    total_cities: number;
    total_types: number;
    avg_rating: number;
    avg_avoid_index: number;
    provinces: string[];
    types: string[];
  }> => {
    try {
      return await fetchAPI('/stats');
    } catch (error) {
      // 本地数据回退
      const provinces = Array.from(new Set(localSpots.map(s => s.province)));
      const cities = Array.from(new Set(localSpots.map(s => s.city)));
      const types = Array.from(new Set(localSpots.map(s => s.type)));
      const avg_rating = localSpots.reduce((sum, s) => sum + s.rating, 0) / localSpots.length;
      const avg_avoid_index = localSpots.reduce((sum, s) => sum + s.avoid.avoid_index, 0) / localSpots.length;
      return {
        total_spots: localSpots.length,
        total_provinces: provinces.length,
        total_cities: cities.length,
        total_types: types.length,
        avg_rating: Math.round(avg_rating * 10) / 10,
        avg_avoid_index: Math.round(avg_avoid_index * 10) / 10,
        provinces,
        types,
      };
    }
  },
};

// ==================== 认证 API（真实后端接口） ====================
interface AuthResult {
  token: string;
  user: SessionUser;
}

async function postAuth<T>(path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const response = await fetch(`${API_BASE_URL}${path}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { detail?: string }).detail || '请求失败，请稍后重试');
  }
  return data as T;
}

/** 带登录态的 JSON POST（社区等需要关联用户的接口） */
async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { detail?: string }).detail || '请求失败，请稍后重试');
  }
  return data as T;
}

export const authAPI = {
  /** 发送短信验证码（演示模式：验证码在响应 message 中返回） */
  sendCode: (phone: string): Promise<{ success: boolean; message: string; expires_in: number }> =>
    postAuth('/api/auth/send-code', undefined, { phone }),

  /** 账号密码登录（手机号/邮箱/用户名） */
  login: (account: string, password: string): Promise<AuthResult> =>
    postAuth<AuthResult>('/api/auth/login', { account, password }),

  /** 手机验证码登录 */
  loginByCode: (phone: string, code: string): Promise<AuthResult> =>
    postAuth<AuthResult>('/api/auth/login/code', { phone, code }),

  /** 注册 */
  register: (payload: { phone: string; code: string; password: string; username?: string }): Promise<AuthResult> =>
    postAuth<AuthResult>('/api/auth/register', payload),

  /** 重置密码 */
  resetPassword: (payload: { phone: string; code: string; new_password: string }): Promise<{ success: boolean; message: string }> =>
    postAuth('/api/auth/reset-password', payload),

  /** 登出 */
  logout: async (): Promise<void> => {
    const token = getAuthToken();
    clearAuth();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout?token=${encodeURIComponent(token)}`, { method: 'POST' });
      } catch {
        // 网络失败不影响本地登出
      }
    }
  },
};
