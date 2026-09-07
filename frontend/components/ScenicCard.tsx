'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { MapPin, Star, MessageCircle, AlertTriangle, Clock, Heart } from 'lucide-react';
import type { ScenicSpot } from '@/lib/api';
import { isFavorite, toggleFavorite } from '@/lib/user-prefs';

interface ScenicCardProps {
  spot: ScenicSpot;
  index?: number;
}

export default function ScenicCard({ spot, index = 0 }: ScenicCardProps) {
  const [fav, setFav] = useState(false);

  // 挂载后读取收藏状态，并跟随全局收藏变化
  useEffect(() => {
    const sync = () => setFav(isFavorite(spot.id));
    sync();
    window.addEventListener('huixing-fav-changed', sync);
    return () => window.removeEventListener('huixing-fav-changed', sync);
  }, [spot.id]);

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFav(toggleFavorite(spot.id));
  };

  const avoidLevel = spot.avoid.avoid_index >= 3 ? 'high' : spot.avoid.avoid_index >= 2 ? 'medium' : 'low';
  const avoidColor = avoidLevel === 'high' ? 'text-red-400' : avoidLevel === 'medium' ? 'text-yellow-400' : 'text-green-400';
  const avoidBg = avoidLevel === 'high' ? 'bg-red-500/20 border-red-500/30' : avoidLevel === 'medium' ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-green-500/20 border-green-500/30';

  return (
    <Link
      href={`/detail/${spot.id}`}
      className="glass glass-hover rounded-2xl overflow-hidden block group animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* 图片区域 */}
      <div className="relative h-48 overflow-hidden">
        {spot.images[0] ? (
          <Image
            src={spot.images[0]}
            alt={spot.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="img-placeholder h-full">
            <MapPin className="w-12 h-12" />
          </div>
        )}
        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-transparent to-transparent" />

        {/* 等级标签（5A 金色 / 4A 银色，其余灰色） */}
        <div
          className={`absolute top-3 left-3 px-2 py-1 rounded-md text-white text-xs font-bold ${
            spot.level === '5A'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600'
              : spot.level === '4A'
              ? 'bg-gradient-to-r from-slate-400 to-slate-500'
              : 'bg-white/30'
          }`}
        >
          {spot.level}
        </div>

        {/* 避雷指数 */}
        <div className={`absolute top-3 right-3 px-2 py-1 rounded-md border ${avoidBg} flex items-center gap-1`}>
          <AlertTriangle className={`w-3 h-3 ${avoidColor}`} />
          <span className={`text-xs font-bold ${avoidColor}`}>避雷 {spot.avoid.avoid_index}</span>
        </div>

        {/* 心愿单收藏（常显，点按不跳转） */}
        <button
          onClick={handleFav}
          aria-label={fav ? '移出心愿单' : '加入心愿单'}
          aria-pressed={fav}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-dark-900/60 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Heart className={`w-4 h-4 transition-all ${fav ? 'text-red-400 fill-red-400' : 'text-white'}`} />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
          {spot.name}
        </h3>

        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <MapPin className="w-4 h-4" />
          <span>{spot.province} · {spot.city}</span>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-semibold text-white">{spot.rating}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">{spot.review_count}条点评</span>
          </div>
        </div>

        <p className="text-sm text-gray-400 line-clamp-2 mb-3">
          {spot.description}
        </p>

        {/* 最佳季节 */}
        <div className="flex items-center gap-1 text-xs text-cyan-400">
          <Clock className="w-3 h-3" />
          <span>最佳季节：{spot.best_season}</span>
        </div>

        {/* AI 避雷标签 */}
        {spot.avoid.avoid_tags && spot.avoid.avoid_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {spot.avoid.avoid_tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 标签 */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {spot.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-gray-300 border border-white/10"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
