'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, CloudSun, BookOpen, Star, AlertTriangle, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import { newsAPI, type NewsFeed, type NewsItem } from '@/lib/api';

const CATEGORY_STYLE: Record<string, { badge: string; icon: typeof CloudSun }> = {
  天气动态: { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', icon: CloudSun },
  社区热文: { badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: BookOpen },
  最新评价: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: Star },
  避雷提醒: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', icon: AlertTriangle },
};

export default function NewsPage() {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setFeed(await newsAPI.get());
    } catch {
      setFeed(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = ['天气动态', '社区热文', '最新评价', '避雷提醒']
    .map((cat) => ({
      category: cat,
      style: CATEGORY_STYLE[cat] || CATEGORY_STYLE.天气动态,
      items: (feed?.items || []).filter((i: NewsItem) => i.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">旅游资讯</h1>
            <p className="text-gray-400 text-sm">
              实时聚合 · 热门目的地天气 / 社区动态 / 评价与避雷提醒
              {feed?.updated_at && (
                <span className="ml-2 text-gray-500">更新于 {feed.updated_at.replace('T', ' ')}</span>
              )}
            </p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-sm text-gray-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '刷新中…' : '刷新资讯'}
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-2xl h-24 animate-pulse" />
            ))}
          </div>
        ) : !feed || feed.items.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center text-gray-400">
            暂无资讯，点击刷新试试
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.category}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                  <g.style.icon className="w-5 h-5 text-cyan-400" />
                  {g.category}
                  <span className="text-xs font-normal text-gray-500">{g.items.length} 条</span>
                </h2>
                <div className="space-y-3">
                  {g.items.map((item, i) => (
                    <LinkOrCard key={g.category + i} item={item}>
                      <div className="glass glass-hover rounded-xl p-4 flex items-start gap-3">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${g.style.badge}`}
                        >
                          {item.source}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.summary}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-1" />
                      </div>
                    </LinkOrCard>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** 有链接时渲染为可点击卡片，否则为普通卡片 */
function LinkOrCard({ item, children }: { item: NewsItem; children: React.ReactNode }) {
  if (item.link && item.link !== '/explore') {
    return (
      <Link href={item.link} className="block">
        {children}
      </Link>
    );
  }
  return <div>{children}</div>;
}
