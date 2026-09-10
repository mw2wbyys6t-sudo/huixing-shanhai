'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  MapPin,
  Star,
  MessageCircle,
  Clock,
  ArrowLeft,
  Cloud,
  Thermometer,
  Wind,
  Droplets,
  AlertTriangle,
  CheckCircle,
  Camera,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Upload,
  Image as ImageIcon,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Heart,
  UtensilsCrossed,
  Phone,
  Navigation,
  Film,
  Ticket,
  Bus,
} from 'lucide-react';
import Header from '@/components/Header';
import AvoidIndexBadge from '@/components/AvoidIndexBadge';
import ScenicCard from '@/components/ScenicCard';
import SpotPanorama from '@/components/Panorama/SpotPanorama';
import { scenicAPI, weatherAPI, foodAPI, amapNavUrl, API_BASE_URL, resolveFileUrl, getAuthUser, authFetch, type ScenicSpot, type WeatherInfo, type FoodPlace } from '@/lib/api';
import { recordVisit, isFavorite, toggleFavorite } from '@/lib/user-prefs';
import scenicVideos from '@/lib/scenic_videos.json';

/** 景区宣传视频（B站公开数据，采集脚本产出） */
interface SpotVideo {
  bvid: string;
  title: string;
  author: string;
  mid: number;
  url: string;
  pic: string;
  duration: number;
}
const videoMap = scenicVideos as Record<string, SpotVideo | undefined>;

/** 秒数 → "m:ss" */
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 带加载失败兜底的图片组件：加载失败时显示占位图而非裂图 */
function SafeImage({ src, alt, sizes, className = '' }: { src: string; alt: string; sizes?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className={`img-placeholder flex items-center justify-center ${className}`}>
        <MapPin className="w-10 h-10 opacity-60" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  );
}

export default function DetailClient() {
  const params = useParams();
  const router = useRouter();
  const spotId = params.id as string;

  const [spot, setSpot] = useState<ScenicSpot | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [relatedSpots, setRelatedSpots] = useState<ScenicSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showCompare, setShowCompare] = useState(false);
  const [avoidAnalysis, setAvoidAnalysis] = useState<any>(null);
  const [avoidLoading, setAvoidLoading] = useState(false);
  const [noReviewData, setNoReviewData] = useState(false);
  const [ugcPhotos, setUgcPhotos] = useState<any[]>([]);
  const [ugcList, setUgcList] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [ugcRating, setUgcRating] = useState(5);
  const [toast, setToast] = useState('');
  const [panoramaTime, setPanoramaTime] = useState<'morning' | 'noon' | 'sunset' | 'night'>('noon');
  const [favState, setFavState] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  // 周边美食（高德 POI）
  const [foods, setFoods] = useState<FoodPlace[]>([]);
  const [foodState, setFoodState] = useState<'loading' | 'ready' | 'hidden'>('loading');

  // 轻量提示（替代原生 alert）
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 加载景区详情
  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      try {
        const data = await scenicAPI.getDetail(spotId);
        setSpot(data);

        // 加载天气
        try {
          const weatherData = await weatherAPI.getWeather(data.city);
          setWeather(weatherData);
        } catch (e) {
          console.log('天气加载失败');
        }

        // 加载相关推荐（同省份）
        try {
          const related = await scenicAPI.getRecommend({ province: data.province, limit: 4 });
          setRelatedSpots(related.items.filter((s) => s.id !== spotId));
        } catch (e) {
          console.log('相关推荐加载失败');
        }

        // 加载周边美食（高德 POI；失败时隐藏板块，不打扰主流程）
        try {
          const items = await foodAPI.getSpotFood(spotId);
          if (items.length > 0) {
            setFoods(items);
            setFoodState('ready');
          } else {
            setFoodState('hidden');
          }
        } catch (e) {
          setFoodState('hidden');
        }
      } catch (error) {
        console.error('加载景区详情失败:', error);
        router.push('/explore');
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [spotId, router]);

  // 记录浏览足迹 + 恢复收藏状态
  useEffect(() => {
    if (spot) {
      recordVisit(spot);
      setFavState(isFavorite(spot.id));
    }
  }, [spot]);

  const handleToggleFav = () => {
    if (!spot) return;
    const nowFav = toggleFavorite(spot.id);
    setFavState(nowFav);
    showToast(nowFav ? '已加入心愿单 ❤' : '已从心愿单移除');
  };

  // 加载评价列表（返回评价文本，供避雷分析复用）
  const loadReviews = async (): Promise<string[]> => {
    const texts: string[] = [];
    try {
      const reviewsResp = await fetch(`${API_BASE_URL}/api/reviews/list/${spotId}?page=1&page_size=50`);
      if (reviewsResp.ok) {
        const reviewsData = await reviewsResp.json();
        const list = reviewsData.reviews || [];
        setReviews(list);
        list.forEach((r: any) => {
          if (r.content) texts.push(r.content);
        });
      }
    } catch {
      // 评价接口不可用时静默
    }
    return texts;
  };

  // 加载 AI 避雷分析（基于平台真实评价数据；无评价时提示用户而非编造输入）
  const loadAvoidAnalysis = async () => {
    if (!spot) return;
    setAvoidLoading(true);
    setNoReviewData(false);
    try {
      // 收集站内真实评价：评价库 + 实拍照片描述
      const texts = await loadReviews();
      try {
        const ugcResp = await fetch(`${API_BASE_URL}/api/ugc/photos/${spotId}?page=1&page_size=50`);
        if (ugcResp.ok) {
          const ugcData = await ugcResp.json();
          (ugcData.photos || []).forEach((p: any) => {
            if (p.description) texts.push(p.description);
          });
        }
      } catch {
        // 同上
      }

      // 无真实评价数据时不调用 AI 编造分析
      if (texts.length === 0) {
        setAvoidAnalysis(null);
        setNoReviewData(true);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/avoid/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spot_id: spotId,
          spot_name: spot.name,
          reviews: texts,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAvoidAnalysis(data.analysis);
      } else {
        setAvoidAnalysis(null);
        setNoReviewData(true);
      }
    } catch (error) {
      console.error('避雷分析加载失败:', error);
      setAvoidAnalysis(null);
      setNoReviewData(true);
    } finally {
      setAvoidLoading(false);
    }
  };

  // 提交评价 → 刷新评价列表 → 重新触发 AI 避雷分析（真实数据闭环）
  const handleSubmitReview = async () => {
    const content = reviewContent.trim();
    if (!content) {
      showToast('请填写评价内容');
      return;
    }
    setReviewSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('spot_id', spotId);
      formData.append('spot_name', spot?.name || '');
      formData.append('user_name', getAuthUser()?.username || '匿名用户');
      formData.append('rating', String(reviewRating));
      formData.append('content', content);

      const resp = await fetch(`${API_BASE_URL}/api/reviews/submit`, { method: 'POST', body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || '提交失败');
      }
      showToast('评价发布成功，AI 将基于真实评价更新避雷分析');
      setReviewContent('');
      setReviewRating(5);
      setShowReviewForm(false);
      await loadAvoidAnalysis();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '提交失败，请稍后重试');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // 景区加载完成后自动加载避雷分析
  useEffect(() => {
    if (spot) {
      loadAvoidAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  // 返回探索列表（显式跳转，避免从外部链接进入时退出站点）
  const goBackToList = () => {
    router.push('/explore');
  };
  // 加载 UGC 实拍照片列表
  const loadUgcPhotos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ugc/photos/${spotId}?page=1&page_size=20`);
      if (response.ok) {
        const data = await response.json();
        setUgcList(data.photos || []);
      }
    } catch (error) {
      console.error('加载UGC照片失败:', error);
    }
  };

  // 点赞实拍照片（乐观更新 + 后端同步）
  const handleLikePhoto = async (photoId: number) => {
    setUgcList((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, likes: (p.likes || 0) + 1, liked: true } : p))
    );
    try {
      await fetch(`${API_BASE_URL}/api/ugc/like/${photoId}`, { method: 'POST' });
    } catch {
      // 点赞同步失败不影响本地反馈
    }
  };

  // 页面加载时加载 UGC 照片
  useEffect(() => {
    if (spot) {
      loadUgcPhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  if (loading || !spot) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="pt-24 max-w-7xl mx-auto px-4">
          <div className="glass rounded-2xl overflow-hidden animate-pulse">
            <div className="h-96 bg-white/5" />
            <div className="p-8 space-y-4">
              <div className="h-8 bg-white/10 rounded w-1/3" />
              <div className="h-4 bg-white/5 rounded w-1/2" />
              <div className="h-4 bg-white/5 rounded w-full" />
              <div className="h-4 bg-white/5 rounded w-2/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allImages = spot.images.length > 0 ? spot.images : [''];

  return (
    <div className="min-h-screen">
      <Header />

      {/* 返回按钮 */}
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={goBackToList}
          className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
      </div>

      {/* 主图片区域 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="relative glass rounded-2xl overflow-hidden">
          <div className="relative h-[500px]">
            {allImages[currentImageIndex] ? (
              <SafeImage
                src={allImages[currentImageIndex]}
                alt={spot.name}
                sizes="(max-width: 1200px) 100vw, 1200px"
                className="object-cover"
              />
            ) : (
              <div className="img-placeholder h-full">
                <MapPin className="w-16 h-16" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-dark-900/90 via-transparent to-transparent" />

            {/* 图片切换按钮 */}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex((i) => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full glass hover:bg-white/20 transition-all"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={() => setCurrentImageIndex((i) => (i + 1) % allImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full glass hover:bg-white/20 transition-all"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </>
            )}

            {/* 标题信息 */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-md bg-red-500/80 text-white text-sm font-bold">
                      {spot.level}
                    </span>
                    <span className="px-3 py-1 rounded-md bg-white/10 text-white text-sm">
                      {spot.type}
                    </span>
                  </div>
                  <h1 className="text-4xl font-bold text-white mb-3">{spot.name}</h1>
                  <div className="flex items-center gap-4 text-gray-300">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{spot.province} · {spot.city}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-semibold text-white">{spot.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      <span>{spot.review_count}条点评</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleFav}
                    aria-label={favState ? '移出心愿单' : '加入心愿单'}
                    aria-pressed={favState}
                    title={favState ? '移出心愿单' : '加入心愿单'}
                    className="w-11 h-11 rounded-full glass hover:bg-white/15 transition-all flex items-center justify-center"
                  >
                    <Heart
                      className={`w-5 h-5 transition-all ${
                        favState ? 'text-red-400 fill-red-400 scale-110' : 'text-white'
                      }`}
                    />
                  </button>
                  <AvoidIndexBadge index={spot.avoid.avoid_index} size="lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 内容区域 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧主内容 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 景区简介 */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                景区简介
              </h2>
              <p className="text-gray-300 leading-relaxed">{spot.description}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {spot.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-sm bg-white/5 text-gray-300 border border-white/10"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* 门票与交通 */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-emerald-400" />
                门票与交通
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">门票费用参考</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{spot.ticket || '以景区当日公示为准'}</p>
                </div>
                <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bus className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-cyan-400">交通建议</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{spot.transport || '建议使用地图导航规划出行路线'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">门票价格为参考信息，可能随季节与政策调整，出行前请以景区官方公示为准。</p>
            </div>

            {/* 景区实景环视 */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-cyan-400" />
                  景区实景环视
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    看见河山
                  </span>
                </h2>
              </div>

              {/* 多时段光影切换 */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-gray-400 mr-2">时段光影：</span>
                {[
                  { key: 'morning', label: '清晨', icon: Sunrise, color: 'text-orange-400' },
                  { key: 'noon', label: '正午', icon: Sun, color: 'text-yellow-400' },
                  { key: 'sunset', label: '黄昏', icon: Sunset, color: 'text-red-400' },
                  { key: 'night', label: '夜晚', icon: Moon, color: 'text-blue-400' },
                ].map((time) => (
                  <button
                    key={time.key}
                    onClick={() => setPanoramaTime(time.key as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                      panoramaTime === time.key
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <time.icon className={`w-3.5 h-3.5 ${panoramaTime === time.key ? time.color : ''}`} />
                    {time.label}
                  </button>
                ))}
              </div>

              <SpotPanorama
                imageUrl={spot.images[0]}
                title={`${spot.name}实景（${panoramaTime === 'morning' ? '清晨' : panoramaTime === 'noon' ? '正午' : panoramaTime === 'sunset' ? '黄昏' : '夜晚'}）`}
                height={400}
                timeOfDay={panoramaTime}
              />
              <p className="text-xs text-gray-500 mt-3">
                基于景区真实照片的环视浏览：按住拖动即可左右环视全景。切换时段查看不同光线氛围。
              </p>
            </div>

            {/* 宣传视频（B站官方播放器嵌入，来源与作者标注） */}
            {(() => {
              const video = videoMap[spotId];
              if (!video?.bvid || !video.author) return null;
              return (
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Film className="w-5 h-5 text-rose-400" />
                      宣传视频
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        哔哩哔哩
                      </span>
                    </h2>
                    <span className="text-xs text-gray-500">时长 {fmtDuration(video.duration)}</span>
                  </div>
                  <div className="relative w-full rounded-xl overflow-hidden bg-black/50" style={{ aspectRatio: '16 / 9' }}>
                    <iframe
                      src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(video.bvid)}&autoplay=0&danmaku=0&high_quality=1`}
                      title={`${video.title} - ${video.author}`}
                      loading="lazy"
                      allowFullScreen
                      scrolling="no"
                      frameBorder={0}
                      allow="encrypted-media; fullscreen; picture-in-picture"
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                  {/* 来源与作者标注（必需） */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-xs text-gray-400 min-w-0 truncate">
                      来源：哔哩哔哩
                      {' '}@<a
                        href={`https://space.bilibili.com/${video.mid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {video.author}
                      </a>
                      {' '}· {video.title}
                    </p>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-colors shrink-0 ml-auto"
                    >
                      去B站看原视频 ↗
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* 宣传图 vs 实拍对比 */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  宣传图 vs 真实实拍
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    避雷避坑
                  </span>
                </h2>
                <button
                  onClick={() => setShowCompare(!showCompare)}
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {showCompare ? '收起对比' : '查看对比'}
                </button>
              </div>
              {showCompare && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-center text-sm text-gray-400 mb-2">官方宣传图</div>
                    <div className="relative h-48 rounded-xl overflow-hidden">
                      {spot.images[0] && (
                        <SafeImage
                          src={spot.images[0]}
                          alt="宣传图"
                          sizes="(max-width: 768px) 50vw, 300px"
                          className="object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent" />
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-amber-500/80 text-white text-xs font-bold">
                        精修美化
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-center text-sm text-gray-400 mb-2">游客真实实拍</div>
                    <div className="relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-dark-700 to-dark-900">
                      {ugcList.length > 0 && ugcList[0].image_url ? (
                        <Image
                          src={resolveFileUrl(ugcList[0].image_url)}
                          alt="游客真实实拍"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 300px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">实拍图待上传</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-green-500/80 text-white text-xs font-bold">
                        真实无修
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-400 mt-4">
                通过对比官方宣传图和游客真实实拍，帮助你判断景区真实面貌，避免"照骗"陷阱。
              </p>
            </div>

            {/* 周边美食（高德 POI 实时数据） */}
            {foodState === 'ready' && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-orange-400" />
                    周边美食
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      高德地图
                    </span>
                  </h2>
                  <span className="text-xs text-gray-500">{spot.name} 2km 内</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {foods.map((food) => (
                    <div
                      key={food.id}
                      className="glass glass-hover rounded-xl p-3 flex gap-3 group"
                    >
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-white/5">
                        {food.image ? (
                          <SafeImage
                            src={food.image}
                            alt={food.name}
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UtensilsCrossed className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm truncate">{food.name}</h3>
                          {food.type && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 shrink-0">
                              {food.type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          {food.rating && (
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400" />
                              {food.rating}
                            </span>
                          )}
                          {food.cost != null && <span>人均 ¥{String(food.cost).replace(/\.00$/, '')}</span>}
                          {food.distance != null && (
                            <span className="text-cyan-400">
                              {food.distance < 1000 ? `${food.distance}m` : `${(food.distance / 1000).toFixed(1)}km`}
                            </span>
                          )}
                        </div>
                        {food.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {food.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-auto pt-2">
                          {food.tel && (
                            <a
                              href={`tel:${food.tel}`}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400 transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              {food.tel}
                            </a>
                          )}
                          {food.location && (
                            <a
                              href={amapNavUrl(food.name, food.location)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
                            >
                              <Navigation className="w-3 h-3" />
                              导航前往
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  数据来源：高德地图 POI（餐饮服务类目），按距离与热度综合排序。
                </p>
              </div>
            )}

            {/* AI 智能避雷分析 */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  AI 智能避雷分析
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    NLP 情感分析
                  </span>
                </h2>
                <button
                  onClick={loadAvoidAnalysis}
                  disabled={avoidLoading}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                >
                  {avoidLoading ? '分析中...' : '重新分析'}
                </button>
              </div>

              {avoidLoading && !avoidAnalysis && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
                  <p className="text-sm text-gray-400">AI 正在分析跨平台评价数据...</p>
                  <p className="text-xs text-gray-500 mt-1">情感分析 · 关键词提取 · 避雷标签生成</p>
                </div>
              )}

              {avoidAnalysis && (
                <div className="space-y-6">
                  {/* 核心指标 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-amber rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-amber-400 mb-1">{avoidAnalysis.avoid_index}</div>
                      <div className="text-xs text-gray-400">避雷指数</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {avoidAnalysis.avoid_index < 2 ? '推荐前往' : avoidAnalysis.avoid_index < 3 ? '谨慎考虑' : '建议避雷'}
                      </div>
                    </div>
                    <div className="glass-cyan rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-cyan-400 mb-1">{avoidAnalysis.authenticity_score}%</div>
                      <div className="text-xs text-gray-400">真实度评分</div>
                      <div className="text-xs text-gray-500 mt-1">已过滤水军</div>
                    </div>
                    <div className="glass-purple rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-purple-400 mb-1">{avoidAnalysis.avoid_tags?.length || 0}</div>
                      <div className="text-xs text-gray-400">避雷标签</div>
                      <div className="text-xs text-gray-500 mt-1">AI 自动生成</div>
                    </div>
                  </div>

                  {/* 关键词分析 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        正面关键词
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {avoidAnalysis.positive_keywords?.map((kw: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-full text-xs bg-green-500/10 border border-green-500/30 text-green-400"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" />
                        负面关键词
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {avoidAnalysis.negative_keywords?.map((kw: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-full text-xs bg-red-500/10 border border-red-500/30 text-red-400"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 避雷标签 */}
                  <div>
                    <h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      避雷标签
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {avoidAnalysis.avoid_tags?.map((tag: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 rounded-lg text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* AI 总结 */}
                  <div className="glass-purple rounded-xl p-4">
                    <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      AI 分析总结
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed">{avoidAnalysis.summary}</p>
                  </div>

                  {/* 出行建议 */}
                  <div>
                    <h4 className="text-sm font-medium text-cyan-400 mb-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      出行建议
                    </h4>
                    <ul className="space-y-2">
                      {avoidAnalysis.suggestions?.map((suggestion: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {!avoidLoading && !avoidAnalysis && !noReviewData && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-600 mb-4" />
                  <p className="text-sm text-gray-400">避雷分析加载失败</p>
                  <button
                    onClick={loadAvoidAnalysis}
                    className="mt-4 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors"
                  >
                    重新分析
                  </button>
                </div>
              )}

              {!avoidLoading && !avoidAnalysis && noReviewData && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <MessageCircle className="w-12 h-12 text-gray-600 mb-4" />
                  <p className="text-sm text-gray-300 font-medium mb-1">暂无真实评价数据</p>
                  <p className="text-xs text-gray-500 max-w-md leading-relaxed">
                    AI 避雷分析基于平台真实用户评价生成，该景区还没有足够的评价数据。
                    右侧「AI 避雷指南」展示的是基础避雷信息；
                    欢迎上传实拍照片或发表评价，帮助更多旅行者避雷。
                  </p>
                </div>
              )}
            </div>

            {/* 游客评价 */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-cyan-400" />
                  游客评价
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    {reviews.length} 条真实评价
                  </span>
                </h2>
                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {showReviewForm ? '收起' : '写评价'}
                </button>
              </div>

              {/* 写评价表单 */}
              {showReviewForm && (
                <div className="glass-cyan rounded-xl p-4 mb-6 animate-fade-in">
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-2">你的评分</label>
                    <div className="flex gap-1" role="radiogroup" aria-label="评分">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          role="radio"
                          aria-checked={reviewRating === star}
                          aria-label={`${star} 星`}
                          className="p-1 hover:scale-110 transition-transform"
                          onClick={() => setReviewRating(star)}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-2">真实体验（人流量、排队、收费、交通……说说避雷点或推荐点）</label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      placeholder="你的评价会成为 AI 避雷分析的数据源，帮助下一位旅行者避坑"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                    />
                    <div className="text-xs text-gray-600 mt-1 text-right">{reviewContent.length}/500</div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowReviewForm(false)}
                      className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting || !reviewContent.trim()}
                      className="px-6 py-2 rounded-lg btn-cyan text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reviewSubmitting ? '发布中…' : '发布评价'}
                    </button>
                  </div>
                </div>
              )}

              {/* 评价列表 */}
              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.slice(0, 10).map((review) => (
                    <div key={review.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                            <span className="text-xs text-white font-bold">{review.user_name?.[0] || 'U'}</span>
                          </div>
                          <span className="text-sm text-white">{review.user_name || '匿名用户'}</span>
                          <span className="text-xs text-gray-500">
                            {review.created_at ? new Date(review.created_at).toLocaleDateString('zh-CN') : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= Math.round(review.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{review.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-1">还没有评价</p>
                  <p className="text-xs text-gray-500 mb-4">第一批评价将直接驱动该景区的 AI 避雷分析</p>
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="px-5 py-2 rounded-lg btn-cyan text-sm font-medium inline-flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    写第一条评价
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 右侧信息栏 */}
          <div className="space-y-6">
            {/* 天气信息 */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-cyan-400" />
                实时天气
              </h3>
              {weather ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-white">{weather.temperature}°C</div>
                      <div className="text-gray-400">{weather.weather}</div>
                    </div>
                    <Cloud className="w-12 h-12 text-cyan-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Wind className="w-4 h-4 text-gray-400" />
                      <span>{weather.wind}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Droplets className="w-4 h-4 text-gray-400" />
                      <span>湿度 {weather.humidity}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    更新时间：{weather.report_time}
                    {weather.isMock && <span className="ml-1 text-amber-500/80">· 示例数据</span>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Thermometer className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">天气数据加载中...</p>
                </div>
              )}
            </div>

            {/* 避雷指南 */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                AI 避雷指南
              </h3>
              <div className="space-y-4">
                <AvoidIndexBadge index={spot.avoid.avoid_index} />
                
                <div>
                  <div className="text-sm text-gray-400 mb-2">避雷标签：</div>
                  <div className="flex flex-wrap gap-2">
                    {spot.avoid.avoid_tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-sm text-cyan-400 mb-1">
                    <Clock className="w-4 h-4" />
                    最佳游览时间
                  </div>
                  <p className="text-sm text-gray-300">{spot.avoid.best_time}</p>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-sm text-green-400 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    避雷小贴士
                  </div>
                  <p className="text-sm text-gray-300">{spot.avoid.tips}</p>
                </div>
              </div>
            </div>

            {/* 实用信息 */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">实用信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">景区等级</span>
                  <span className="text-white font-semibold">{spot.level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">景区类型</span>
                  <span className="text-white">{spot.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">所在地区</span>
                  <span className="text-white">{spot.province} {spot.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">最佳季节</span>
                  <span className="text-cyan-400">{spot.best_season}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">综合评分</span>
                  <span className="text-amber-400 font-bold">{spot.rating} / 5.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* UGC 游客实拍墙 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-green-400" />
              游客实拍墙
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                UGC 真实分享
              </span>
            </h2>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg btn-amber text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              上传实拍
            </button>
          </div>

          {/* 上传表单 */}
          {showUpload && (
            <div className="glass-purple rounded-xl p-4 mb-6 animate-fade-in">
              <h3 className="text-sm font-medium text-purple-400 mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                分享你的实拍照片
              </h3>
              <div className="space-y-4">
                {/* 照片上传 */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">上传照片（最多9张）</label>
                  <div className="flex flex-wrap gap-2">
                    {ugcPhotos.map((photo, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                        <Image
                          src={photo.preview}
                          alt={`实拍${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                        <button
                          onClick={() => setUgcPhotos(ugcPhotos.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-red-500/80"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {ugcPhotos.length < 9 && (
                      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all">
                        <ImageIcon className="w-6 h-6 text-gray-500 mb-1" />
                        <span className="text-xs text-gray-500">添加</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            files.forEach((file) => {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setUgcPhotos((prev) =>
                                  prev.length >= 9 ? prev : [...prev, { preview: ev.target?.result as string, file }]
                                );
                              };
                              reader.readAsDataURL(file);
                            });
                            // 重置以便重复选择同一文件时仍触发 onChange
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 评分 */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">你的评分</label>
                  <div className="flex gap-1" role="radiogroup" aria-label="评分">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={ugcRating === star}
                        aria-label={`${star} 星`}
                        className="p-1 hover:scale-110 transition-transform"
                        onClick={() => setUgcRating(star)}
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= ugcRating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 评价文字 */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2">分享你的游玩体验</label>
                  <textarea
                    id="ugc-content"
                    rows={3}
                    placeholder="说说你的真实感受，比如景色、人流、交通、餐饮等..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>

                {/* 提交按钮 */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowUpload(false)}
                    className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      if (ugcPhotos.length === 0) return;

                      // 后端要求登录后上传
                      const authUser = getAuthUser();
                      if (!authUser) {
                        showToast('请先登录后再上传实拍');
                        return;
                      }

                      const contentInput = document.getElementById('ugc-content') as HTMLTextAreaElement;
                      const content = contentInput ? contentInput.value : '';
                      const uploader = authUser.username || '游客用户';

                      try {
                        // 串行上传（避免并发多张吃满限流配额）
                        for (const photo of ugcPhotos) {
                          const formData = new FormData();
                          formData.append('file', photo.file);
                          formData.append('spot_id', spotId);
                          formData.append('spot_name', spot?.name || '');
                          formData.append('user_name', uploader);
                          formData.append('description', content);
                          formData.append('rating', ugcRating.toString());

                          const response = await authFetch(`${API_BASE_URL}/api/upload/photo`, {
                            method: 'POST',
                            body: formData,
                          });
                          if (!response.ok) {
                            const err = await response.json().catch(() => ({}));
                            throw new Error(err.detail || `上传失败（${response.status}）`);
                          }
                        }

                        showToast('实拍照片上传成功，感谢分享！');
                        setShowUpload(false);
                        setUgcPhotos([]);
                        setUgcRating(5);
                        // 刷新实拍列表
                        loadUgcPhotos();
                      } catch (error) {
                        console.error('上传失败:', error);
                        showToast(error instanceof Error ? error.message : '上传失败，请稍后重试');
                      }
                    }}
                    disabled={ugcPhotos.length === 0}
                    className="px-6 py-2 rounded-lg btn-purple text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    发布实拍
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 实拍照片网格 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {ugcList.length > 0 ? (
              ugcList.map((photo: any) => (
                <div key={photo.id} className="glass glass-hover rounded-xl overflow-hidden group cursor-pointer">
                  <div className="relative h-40 bg-gradient-to-br from-dark-700 to-dark-900">
                    {photo.image_url ? (
                      <Image
                        src={resolveFileUrl(photo.image_url)}
                        alt={photo.description || '实拍照片'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="w-12 h-12 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white line-clamp-2">{photo.description || '暂无描述'}</p>
                    </div>
                    {photo.rating && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {photo.rating}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                          <span className="text-xs text-white font-bold">{photo.user_name?.[0] || 'U'}</span>
                        </div>
                        <span className="text-xs text-gray-400">{photo.user_name || '匿名用户'}</span>
                      </div>
                      <button
                        onClick={() => handleLikePhoto(photo.id)}
                        disabled={photo.liked}
                        aria-label="点赞"
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          photo.liked ? 'text-red-400 cursor-default' : 'text-gray-500 hover:text-red-400'
                        }`}
                      >
                        <span className="text-red-400">♥</span>
                        {photo.likes || 0}
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {photo.created_at ? new Date(photo.created_at).toLocaleDateString('zh-CN') : '刚刚'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 glass rounded-xl p-10 text-center">
                <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-300 font-medium mb-1">还没有游客实拍</p>
                <p className="text-xs text-gray-500 mb-4">
                  实拍墙只展示真实用户上传的照片。你就是第一位分享者——点击右上角「上传实拍」，帮大家看见真实面貌。
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="px-5 py-2 rounded-lg btn-amber text-sm font-medium inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  上传第一张实拍
                </button>
              </div>
            )}
          </div>

          {ugcList.length > 0 && (
            <div className="text-center mt-6 text-xs text-gray-500">
              已展示全部 {ugcList.length} 张真实实拍 · 上传的照片仅作真实分享用途
            </div>
          )}
        </div>
      </section>

      {/* 相关推荐 */}
      {relatedSpots.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <h2 className="text-2xl font-bold text-white mb-6">同省份推荐</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedSpots.map((spot, index) => (
              <ScenicCard key={spot.id} spot={spot} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* 轻量提示 toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl bg-dark-800/95 border border-white/15 shadow-2xl text-sm text-white backdrop-blur-md animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
