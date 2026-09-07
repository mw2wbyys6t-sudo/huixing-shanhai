'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Compass, AlertTriangle, Sparkles, ChevronRight, Star, Clock, Heart } from 'lucide-react';
import Header from '@/components/Header';
import ScenicCard from '@/components/ScenicCard';
import ClayIcon from '@/components/ClayIcon';
import { scenicAPI, type ScenicSpot } from '@/lib/api';
import { getVisitHistory, getFavorites, type VisitRecord } from '@/lib/user-prefs';

const heroSlides = [
  {
    title: '黄山 · 天下第一奇山',
    subtitle: '奇松 · 怪石',
    description: '五岳归来不看山，黄山归来不看岳。云海、温泉、冬雪，四季皆景。',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Huangshan_fengjing.jpg?width=1280',
  },
  {
    title: '张家界 · 阿凡达秘境',
    subtitle: '峰林 · 峡谷',
    description: '石英砂岩峰林地貌，电影《阿凡达》取景地，悬浮山震撼世界。',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Avatar_World_38058-Zhangjiajie_(49046813673).jpg?width=1280',
  },
  {
    title: '九寨沟 · 人间仙境',
    subtitle: '彩林 · 叠瀑',
    description: '翠海、叠瀑、彩林、雪峰、藏情、蓝冰，六绝奇观，大自然的调色盘。',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Reed_Lake_(Jiuzhaigou_Valley)_20260511-5.jpg?width=1280',
  },
  {
    title: '长城 · 万里巨龙',
    subtitle: '历史 · 雄关',
    description: '不到长城非好汉，世界文化遗产，中华民族的脊梁。',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Great_Wall_of_China_July_2006.JPG?width=1280',
  },
];

// 热门城市（与站内景区数据一致，点击即可命中结果）
const hotCities = ['北京', '上海', '天津', '苏州', '南京', '哈尔滨', '大连', '沈阳', '承德', '秦皇岛'];

export default function HomePage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendSpots, setRecommendSpots] = useState<ScenicSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<VisitRecord[]>([]);
  const [favIds, setFavIds] = useState<string[]>([]);

  // 读取本地足迹与心愿单（客户端挂载后）
  useEffect(() => {
    setHistory(getVisitHistory());
    setFavIds(getFavorites());
  }, []);

  // 自动轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 加载推荐景区
  useEffect(() => {
    const loadRecommend = async () => {
      try {
        const data = await scenicAPI.getRecommend({ limit: 6 });
        setRecommendSpots(data.items);
      } catch (error) {
        console.error('加载推荐景区失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRecommend();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero 轮播区域 */}
      <section className="relative h-[600px] overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.image})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-900/95 via-purple-900/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-transparent to-transparent" />
          </div>
        ))}

        <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-10 h-px bg-gradient-to-r from-amber-400 to-transparent" />
              <span className="text-amber-400 text-sm tracking-[0.2em] uppercase">发现真实河山</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              出发前，先看见
              <span className="text-gradient-amber">真实的河山</span>
            </h1>
            <p className="text-lg text-gray-300 mb-8">
              720°全景漫游 · 智能避雷指数 · 行程规划
              <br />
              不做信息聚合，做体验前置；不做纯推荐，做避雷导航
            </p>

            {/* 搜索框 */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <ClayIcon name="search" size={20} alt="搜索" />
                </div>
                <input
                  type="text"
                  placeholder="搜索景区名称、省份或城市..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass text-white placeholder-gray-400 focus:outline-none focus:border-amber-500/50 transition-all"
                />
              </div>
              <button
                type="submit"
                className="btn-amber px-6 py-3.5 rounded-xl font-semibold flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                搜索
              </button>
            </form>

            {/* 热门城市 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                热门：
              </span>
              {hotCities.map((city) => (
                <Link
                  key={city}
                  href={`/explore?city=${encodeURIComponent(city)}`}
                  className="px-3 py-1 rounded-full text-sm text-gray-300 hover:text-amber-400 hover:bg-white/5 border border-white/10 transition-all"
                >
                  {city}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* 轮播指示器 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide ? 'w-8 bg-amber-400' : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </section>

      {/* 核心功能入口 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/explore" className="glass-cyan glass-hover rounded-2xl p-6 group">
            <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center mb-4">
              <ClayIcon name="eye" size={52} alt="看见河山" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
              看见河山
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              720°全景漫游 · 多时段景观 · 1:1实景三维复刻 · 实时天气叠加 · 游客实拍墙
            </p>
            <div className="flex items-center gap-1 text-cyan-400 text-sm">
              开始探索 <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link href="/avoid" className="glass-coral glass-hover rounded-2xl p-6 group">
            <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center mb-4">
              <ClayIcon name="warning" size={52} alt="避雷避坑" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-coral-400 transition-colors">
              避雷避坑
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              智能避雷指数 · 跨平台真实评价聚合 · 宣传图vs实拍对比 · 时令适配推荐
            </p>
            <div className="flex items-center gap-1 text-coral-400 text-sm">
              查看指南 <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link href="/planner" className="glass-purple glass-hover rounded-2xl p-6 group">
            <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center mb-4">
              <ClayIcon name="sparkles" size={52} alt="智能行程规划" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
              智能行程规划
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              智能行程生成 · 预算管控 · 最优路线规划 · 避雷提示 · 逐日时间调度
            </p>
            <div className="flex items-center gap-1 text-purple-400 text-sm">
              立即规划 <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* 推荐景区 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <ClayIcon name="star" size={32} alt="精选推荐" />
              精选推荐景区
            </h2>
            <p className="text-gray-400">从世界遗产到秘境山川，发现属于你的旅行灵感</p>
          </div>
          <Link
            href="/explore"
            className="hidden sm:flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
          >
            查看全部 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-white/5" />
                <div className="p-4 space-y-3">
                  <div className="h-6 bg-white/10 rounded w-3/4" />
                  <div className="h-4 bg-white/5 rounded w-1/2" />
                  <div className="h-4 bg-white/5 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : recommendSpots.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">暂无推荐景区</h3>
            <p className="text-gray-400">请确认后端服务已启动，或前往探索页浏览全部景区</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendSpots.map((spot, index) => (
              <ScenicCard key={spot.id} spot={spot} index={index} />
            ))}
          </div>
        )}
      </section>

      {/* 最近浏览 */}
      {history.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Clock className="w-6 h-6 text-cyan-400" />
              你的足迹
              <span className="text-sm text-gray-500 font-normal">最近看过的景区</span>
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {history.map((item) => (
              <Link
                key={item.id}
                href={`/detail/${item.id}`}
                className="glass glass-hover rounded-xl overflow-hidden flex-shrink-0 w-44 group"
              >
                <div className="relative h-24 bg-dark-800">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                  {favIds.includes(item.id) && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-dark-900/70 flex items-center justify-center">
                      <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm text-white truncate group-hover:text-amber-400 transition-colors">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(item.visitedAt).toLocaleDateString('zh-CN')} 浏览
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 页脚 */}
      <footer className="glass border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Compass className="w-5 h-5 text-dark-900" />
              </div>
              <span className="text-lg font-bold text-gradient-amber">慧行山海</span>
            </div>
            <p className="text-sm text-gray-400">
              © 2026 慧行山海 · 专注中国旅游 · 智能行程规划
            </p>
            <div className="flex gap-4 text-sm text-gray-400">
              <Link href="/about" className="hover:text-amber-400 transition-colors">关于我们</Link>
              <Link href="/privacy" className="hover:text-amber-400 transition-colors">隐私政策</Link>
              <Link href="/terms" className="hover:text-amber-400 transition-colors">用户协议</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
