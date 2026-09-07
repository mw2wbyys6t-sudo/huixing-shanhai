'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Globe3D, { colorByAvoidIndex, type GlobeSpot } from '@/components/Globe3D';
import ClayIcon from '@/components/ClayIcon';
import { ChevronRight, MapPin, Star, AlertTriangle, Compass } from 'lucide-react';
import scenicData from '@/lib/scenic_data.json';

// 景区数据（与3D地球上的标记点对应，来自站内真实数据库）
const scenicSpots = scenicData as Array<{
  id: string;
  name: string;
  province: string;
  city: string;
  rating: number;
  latitude: number;
  longitude: number;
  avoid: { avoid_index: number; avoid_tags: string[] };
  tags: string[];
  description: string;
}>;

export default function GlobePage() {
  const router = useRouter();

  // 转换为 Globe3D 需要的标记点数据（按避雷指数着色）
  const globeSpots: GlobeSpot[] = useMemo(
    () =>
      scenicSpots.map((spot) => ({
        id: spot.id,
        name: spot.name,
        lat: spot.latitude,
        lng: spot.longitude,
        color: colorByAvoidIndex(spot.avoid.avoid_index),
        desc: spot.tags.slice(0, 2).join(' · ') || '精选景区',
      })),
    []
  );

  return (
    <div className="min-h-screen bg-radial-glow">
      <Header />

      {/* 页面标题 */}
      <section className="pt-24 pb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-px bg-gradient-to-r from-amber-400 to-transparent" />
          <span className="text-amber-400 text-sm tracking-[0.2em] uppercase">3D 地球探索</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">
          转动地球，<span className="text-gradient-amber">发现你的目的地</span>
        </h1>
        <p className="text-gray-400 max-w-2xl">
          在 3D 地球上浏览 {scenicSpots.length} 个精选景区，拖拽旋转、滚轮缩放，点击标记点进入景区详情。
        </p>
      </section>

      {/* 3D地球 */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-8">
        <div className="glass rounded-3xl overflow-hidden">
          <Globe3D
            height="600px"
            spots={globeSpots}
            onSpotSelect={(spot) => router.push(`/detail/${spot.id}`)}
          />
        </div>
      </section>

      {/* 景区列表 */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-400" />
            地球上的精选景区
          </h2>
          <Link
            href="/explore"
            className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1"
          >
            查看全部 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {scenicSpots.map((spot) => (
            <Link
              key={spot.id}
              href={`/detail/${spot.id}`}
              className="glass glass-hover rounded-2xl p-4 group cursor-pointer transition-all"
            >
              {/* 颜色标记 */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: colorByAvoidIndex(spot.avoid.avoid_index),
                    boxShadow: `0 0 10px ${colorByAvoidIndex(spot.avoid.avoid_index)}`,
                  }}
                />
                <span className="text-xs text-gray-400">{spot.province} · {spot.city}</span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                {spot.name}
              </h3>

              {/* 评分和避雷指数 */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm text-white">{spot.rating}</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle
                    className={`w-4 h-4 ${
                      spot.avoid.avoid_index < 2.5 ? 'text-green-400' : spot.avoid.avoid_index < 3.5 ? 'text-amber-400' : 'text-red-400'
                    }`}
                  />
                  <span className="text-sm text-gray-300">避雷 {spot.avoid.avoid_index}</span>
                </div>
              </div>

              {/* 标签 */}
              <div className="flex flex-wrap gap-1.5">
                {spot.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 功能说明 */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16">
        <div className="glass rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Compass className="w-6 h-6 text-cyan-400" />
            3D 地球功能说明
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl glass-cyan flex items-center justify-center mb-3">
                <ClayIcon name="eye" size={32} alt="全景漫游" />
              </div>
              <h3 className="font-bold text-white">720° 全景漫游</h3>
              <p className="text-sm text-gray-400">点击景区标记点，进入 720° 全景漫游模式，沉浸式体验目的地真实面貌。</p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl glass-coral flex items-center justify-center mb-3">
                <ClayIcon name="warning" size={32} alt="避雷指数" />
              </div>
              <h3 className="font-bold text-white">智能避雷指数</h3>
              <p className="text-sm text-gray-400">每个景区标记点按避雷指数着色，从绿到红表示避雷风险等级。</p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl glass-purple flex items-center justify-center mb-3">
                <ClayIcon name="sparkles" size={32} alt="智能规划" />
              </div>
              <h3 className="font-bold text-white">智能行程规划</h3>
              <p className="text-sm text-gray-400">在 3D 地球上选择心仪目的地，前往智能规划页一键生成专属行程。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
