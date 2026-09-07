'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, MapPin, ChevronLeft, ChevronRight, Compass, ArrowUpDown, Heart } from 'lucide-react';
import Header from '@/components/Header';
import ScenicCard from '@/components/ScenicCard';
import { scenicAPI, provinceAPI, type ScenicSpot } from '@/lib/api';
import { getFavorites } from '@/lib/user-prefs';

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCity = searchParams.get('city') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery || initialCity);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || initialCity);
  const [spots, setSpots] = useState<ScenicSpot[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<'default' | 'rating' | 'avoid'>('default');
  const [favOnly, setFavOnly] = useState(false);
  const [favIds, setFavIds] = useState<string[]>([]);
  const requestSeqRef = useRef(0);

  const types = ['全部', '名胜', '自然', '亲子', '城市'];

  // 读取心愿单（客户端挂载后）
  useEffect(() => {
    setFavIds(getFavorites());
  }, []);

  // 搜索防抖 300ms：停止输入后才触发请求
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 加载省份列表
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const data = await provinceAPI.getList();
        setProvinces(data.items);
      } catch (error) {
        console.error('加载省份失败:', error);
      }
    };
    loadProvinces();
  }, []);

  // 加载景区列表（全量拉取，排序/收藏筛选/分页在客户端完成；带请求序号防竞态）
  useEffect(() => {
    const seq = ++requestSeqRef.current;
    const loadSpots = async () => {
      setLoading(true);
      try {
        let items: ScenicSpot[];

        if (debouncedQuery.trim()) {
          // 搜索模式：搜索结果同时应用省份/类型筛选
          const searchData = await scenicAPI.search(debouncedQuery.trim());
          let filtered = searchData.items;
          if (selectedProvince) {
            filtered = filtered.filter((s) => s.province === selectedProvince);
          }
          if (selectedType && selectedType !== '全部') {
            filtered = filtered.filter((s) => s.type === selectedType);
          }
          items = filtered;
        } else {
          // 列表模式（一次拉全量，数据规模小）
          const data = await scenicAPI.getList({
            page: 1,
            page_size: 50,
            province: selectedProvince || undefined,
            type: selectedType && selectedType !== '全部' ? selectedType : undefined,
          });
          items = data.items;
        }

        // 仅接受最新一次请求的结果
        if (seq === requestSeqRef.current) {
          setSpots(items);
        }
      } catch (error) {
        console.error('加载景区失败:', error);
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    };
    loadSpots();
  }, [selectedProvince, selectedType, debouncedQuery]);

  // 客户端排序 → 收藏筛选 → 分页
  const filteredSpots = useMemo(() => {
    let list = [...spots];
    if (favOnly) list = list.filter((s) => favIds.includes(s.id));
    if (sortKey === 'rating') list.sort((a, b) => b.rating - a.rating);
    if (sortKey === 'avoid') list.sort((a, b) => a.avoid.avoid_index - b.avoid.avoid_index);
    return list;
  }, [spots, sortKey, favOnly, favIds]);

  const totalPages = Math.max(1, Math.ceil(filteredSpots.length / 12));
  const pagedSpots = useMemo(() => {
    const start = (currentPage - 1) * 12;
    return filteredSpots.slice(start, start + 12);
  }, [filteredSpots, currentPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setCurrentPage(1);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setCurrentPage(1);
  };

  // 分页页码（带省略号）
  const pageButtons = (() => {
    const pages: (number | 'ellipsis-l' | 'ellipsis-r')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis-l');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis-r');
      pages.push(totalPages);
    }
    return pages;
  })();

  return (
    <div className="min-h-screen">
      <Header />

      {/* 页面标题 */}
      <section className="pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">探索发现</h1>
          </div>
          <p className="text-gray-400 ml-[3.25rem]">720°全景漫游 · 多时段景观 · 发现属于你的旅行灵感</p>
        </div>
      </section>

      {/* 筛选和搜索 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="glass rounded-2xl p-6">
          {/* 搜索框 */}
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索景区名称、省份或城市..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500/50 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold hover:from-cyan-400 hover:to-cyan-500 transition-all flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              搜索
            </button>
          </form>

          {/* 筛选器 */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">筛选：</span>
            </div>

            {/* 省份筛选 */}
            <select
              value={selectedProvince}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="">全部省份</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>

            {/* 类型筛选 */}
            <div className="flex gap-2">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    selectedType === type
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* 排序 */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as 'default' | 'rating' | 'avoid');
                  setCurrentPage(1);
                }}
                aria-label="排序方式"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="default">默认排序</option>
                <option value="rating">评分最高</option>
                <option value="avoid">避雷指数最低</option>
              </select>
            </div>

            {/* 只看心愿单 */}
            <button
              onClick={() => {
                setFavOnly(!favOnly);
                setCurrentPage(1);
              }}
              aria-pressed={favOnly}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                favOnly
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                  : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Heart className={`w-4 h-4 ${favOnly ? 'fill-red-400 text-red-400' : ''}`} />
              心愿单
            </button>

            {/* 结果统计 */}
            <div className="ml-auto text-sm text-gray-400">
              共 <span className="text-cyan-400 font-semibold">{filteredSpots.length}</span> 个景区
            </div>
          </div>
        </div>
      </section>

      {/* 景区列表 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
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
        ) : filteredSpots.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">未找到匹配的景区</h3>
            <p className="text-gray-400">
              {favOnly && spots.length > 0 ? '心愿单里还没有该筛选条件下的景区' : '试试其他关键词或筛选条件'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagedSpots.map((spot, index) => (
                <ScenicCard key={spot.id} spot={spot} index={index} />
              ))}
            </div>

            {/* 分页 */}
            {!searchQuery && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg glass disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                {pageButtons.map((page, idx) =>
                  typeof page === 'number' ? (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                        currentPage === page
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                          : 'glass text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={`${page}-${idx}`} className="px-1 text-gray-500">
                      …
                    </span>
                  )
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg glass disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    }>
      <ExploreContent />
    </Suspense>
  );
}
