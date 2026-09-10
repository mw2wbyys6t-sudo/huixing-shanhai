'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Heart, MapPin, PenLine, Clock } from 'lucide-react';
import Header from '@/components/Header';
import { notesAPI, type NoteItem } from '@/lib/api';

type Filter = '' | '游记' | '攻略';

export default function CommunityPage() {
  const router = useRouter();
  const [items, setItems] = useState<NoteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('');
  const [sort, setSort] = useState<'time' | 'likes'>('time');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    notesAPI
      .list({ page, page_size: 10, type: filter || undefined, sort })
      .then((d) => {
        if (!alive) return;
        setItems(d.items);
        setTotal(d.total);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">游记社区</h1>
            <p className="text-gray-400 text-sm">真实游客的游记与攻略 · {total} 篇</p>
          </div>
          <button
            onClick={() => router.push('/community/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:from-purple-400 hover:to-pink-400 transition-all"
          >
            <PenLine className="w-4 h-4" />
            发布游记/攻略
          </button>
        </div>

        {/* 筛选与排序 */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {(['', '游记', '攻略'] as Filter[]).map((f) => (
            <button
              key={f || 'all'}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                filter === f
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                  : 'glass text-gray-400 hover:text-white'
              }`}
            >
              {f || '全部'}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {([['time', '最新'], ['likes', '最热']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setSort(k);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  sort === k ? 'bg-white/15 text-white' : 'glass text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <PenLine className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">还没有内容，来写第一篇游记吧！</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((n) => (
              <Link
                key={n.id}
                href={`/community/note?id=${n.id}`}
                className="glass glass-hover rounded-2xl p-5 block group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      n.type === '攻略'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    }`}
                  >
                    {n.type}
                  </span>
                  {n.spot_name && n.spot_id && (
                    <span className="text-[11px] text-cyan-400/80 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {n.spot_name}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors mb-1">
                  {n.title}
                </h2>
                <p className="text-sm text-gray-400 line-clamp-2 mb-3">{n.excerpt}…</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{n.user_name}</span>
                  {n.created_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {n.created_at.slice(0, 10)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {n.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {n.likes}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 rounded-lg glass text-sm text-gray-300 disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 rounded-lg glass text-sm text-gray-300 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
