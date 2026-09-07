'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ShieldAlert,
  Shield,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Filter,
} from 'lucide-react';
import Header from '@/components/Header';
import AvoidIndexBadge from '@/components/AvoidIndexBadge';
import { scenicAPI, type ScenicSpot } from '@/lib/api';

export default function AvoidPage() {
  const [spots, setSpots] = useState<ScenicSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    const loadSpots = async () => {
      try {
        const data = await scenicAPI.getList({ page_size: 20 });
        // 按避雷指数降序排序
        const sorted = [...data.items].sort((a, b) => b.avoid.avoid_index - a.avoid.avoid_index);
        setSpots(sorted);
      } catch (error) {
        console.error('加载景区失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSpots();
  }, []);

  const getLevel = (index: number) => {
    if (index >= 3) return 'high';
    if (index >= 2) return 'medium';
    return 'low';
  };

  const filteredSpots = filterLevel === 'all'
    ? spots
    : spots.filter((s) => getLevel(s.avoid.avoid_index) === filterLevel);

  const highRiskCount = spots.filter((s) => getLevel(s.avoid.avoid_index) === 'high').length;
  const mediumRiskCount = spots.filter((s) => getLevel(s.avoid.avoid_index) === 'medium').length;
  const lowRiskCount = spots.filter((s) => getLevel(s.avoid.avoid_index) === 'low').length;

  // 统计所有避雷标签
  const allTags = spots.flatMap((s) => s.avoid.avoid_tags);
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="min-h-screen">
      <Header />

      {/* 页面标题 */}
      <section className="pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">避雷指南</h1>
          </div>
          <p className="text-gray-400 ml-[3.25rem]">智能避雷指数 · 跨平台真实评价聚合 · 宣传图vs实拍对比</p>
          <p className="text-xs text-gray-500 mt-2 ml-[3.25rem]">
            数据说明：避雷指数由 AI 分析平台评价数据并结合人工校准生成，仅供参考；实际出行请以景区官方信息为准。
          </p>
        </div>
      </section>

      {/* 风险统计卡片 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <ShieldAlert className="w-8 h-8 text-red-400" />
              <span className="text-3xl font-bold text-red-400">{highRiskCount}</span>
            </div>
            <h3 className="text-lg font-semibold text-white">高风险景区</h3>
            <p className="text-sm text-gray-400">避雷指数 ≥ 3.0，建议谨慎前往</p>
          </div>

          <div className="glass rounded-2xl p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <Shield className="w-8 h-8 text-yellow-400" />
              <span className="text-3xl font-bold text-yellow-400">{mediumRiskCount}</span>
            </div>
            <h3 className="text-lg font-semibold text-white">中风险景区</h3>
            <p className="text-sm text-gray-400">避雷指数 2.0-2.9，注意避开高峰</p>
          </div>

          <div className="glass rounded-2xl p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <ShieldCheck className="w-8 h-8 text-green-400" />
              <span className="text-3xl font-bold text-green-400">{lowRiskCount}</span>
            </div>
            <h3 className="text-lg font-semibold text-white">低风险景区</h3>
            <p className="text-sm text-gray-400">避雷指数 {'<'} 2.0，可放心前往</p>
          </div>
        </div>
      </section>

      {/* 热门避雷标签 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            热门避雷标签
          </h2>
          <div className="flex flex-wrap gap-3">
            {topTags.map(([tag, count]) => (
              <div
                key={tag}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20"
              >
                <span className="text-sm text-red-400">{tag}</span>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 避雷指数排行榜 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">避雷指数排行榜</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            {(['all', 'high', 'medium', 'low'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  filterLevel === level
                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                    : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                {level === 'all' ? '全部' : level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-white/10 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-white/10 rounded w-1/4" />
                    <div className="h-4 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredSpots.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <ShieldAlert className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">该风险等级暂无景区</h3>
            <p className="text-gray-400">切换其他风险等级或查看全部景区</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSpots.map((spot, index) => {
              const level = getLevel(spot.avoid.avoid_index);
              const rankColor = index === 0 ? 'text-red-400' : index === 1 ? 'text-orange-400' : index === 2 ? 'text-yellow-400' : 'text-gray-400';
              
              return (
                <Link
                  key={spot.id}
                  href={`/detail/${spot.id}`}
                  className="glass glass-hover rounded-2xl p-6 block group"
                >
                  <div className="flex items-center gap-6">
                    {/* 排名 */}
                    <div className={`text-2xl font-bold ${rankColor} w-8 text-center`}>
                      {index + 1}
                    </div>

                    {/* 景区信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors">
                          {spot.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                          {spot.level}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        {spot.province} · {spot.city} · 评分 {spot.rating}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {spot.avoid.avoid_tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 避雷指数 */}
                    <div className="flex flex-col items-end gap-2">
                      <AvoidIndexBadge index={spot.avoid.avoid_index} size="sm" showLabel={false} />
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{spot.avoid.best_time}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 避雷知识科普 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="glass rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">避雷避坑指南</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                这些坑要避开
              </h3>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">●</span>
                  <span>节假日热门景区人流量暴增，排队2小时游玩10分钟</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">●</span>
                  <span>宣传图过度美化，实际景色与图片差距大</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">●</span>
                  <span>景区内消费价格虚高，餐饮、纪念品性价比低</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">●</span>
                  <span>部分景点存在强制消费、套路导游等问题</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">●</span>
                  <span>季节不对景色大打折扣，如枯水期的瀑布</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                这样玩更省心
              </h3>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">●</span>
                  <span>提前查看避雷指数和真实游客评价，做到心中有数</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">●</span>
                  <span>选择最佳季节前往，避开雨季、枯水期等不利时段</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">●</span>
                  <span>工作日或淡季出行，人流量少体验更好</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">●</span>
                  <span>使用720°全景提前查看景区真实面貌</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">●</span>
                  <span>对比宣传图和游客实拍，判断景区真实度</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
