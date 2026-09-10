'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, MapPin } from 'lucide-react';
import Header from '@/components/Header';
import { notesAPI, scenicAPI, getAuthUser, type ScenicSpot } from '@/lib/api';

export default function NewNotePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'游记' | '攻略'>('游记');
  const [content, setContent] = useState('');
  const [userName, setUserName] = useState('');
  const [spotQuery, setSpotQuery] = useState('');
  const [spotMatches, setSpotMatches] = useState<ScenicSpot[]>([]);
  const [spot, setSpot] = useState<ScenicSpot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getAuthUser();
    if (user?.username) setUserName(user.username);
  }, []);

  // 关联景区联想（300ms 防抖）
  useEffect(() => {
    if (!spotQuery.trim() || spot?.name === spotQuery.trim()) {
      setSpotMatches([]);
      return;
    }
    const t = setTimeout(() => {
      scenicAPI
        .search(spotQuery.trim())
        .then((d) => setSpotMatches(d.items.slice(0, 5)))
        .catch(() => setSpotMatches([]));
    }, 300);
    return () => clearTimeout(t);
  }, [spotQuery, spot]);

  const submit = async () => {
    setError('');
    if (title.trim().length < 2) return setError('标题至少 2 个字');
    if (content.trim().length < 10) return setError('正文至少 10 个字');
    if (!userName.trim()) return setError('请填写署名');
    setSubmitting(true);
    try {
      const res = await notesAPI.submit({
        title: title.trim(),
        content: content.trim(),
        type,
        spot_id: spot?.id,
        spot_name: spot?.name,
        user_name: userName.trim(),
      });
      router.push(`/community/note?id=${res.note_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败，请稍后重试');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h1 className="text-2xl font-bold text-white mb-1">发布游记 / 攻略</h1>
        <p className="text-gray-400 text-sm mb-8">分享真实体验，帮后来的旅行者少踩坑</p>

        <div className="glass rounded-2xl p-6 space-y-5">
          {/* 标题 */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">标题（2-100 字）</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="例如：故宫一日游完整攻略"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* 类型 */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">类型</label>
            <div className="flex gap-3">
              {(['游记', '攻略'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-5 py-2 rounded-xl text-sm transition-all ${
                    type === t
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 关联景区（可选） */}
          <div className="relative">
            <label className="block text-xs text-gray-400 mb-2">关联景区（可选）</label>
            {spot ? (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <span className="text-sm text-cyan-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {spot.name}（{spot.province}）
                </span>
                <button onClick={() => setSpot(null)} className="text-xs text-gray-400 hover:text-white">
                  移除
                </button>
              </div>
            ) : (
              <>
                <input
                  value={spotQuery}
                  onChange={(e) => setSpotQuery(e.target.value)}
                  placeholder="输入景区名搜索，如：故宫"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
                {spotMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full glass rounded-xl overflow-hidden">
                    {spotMatches.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSpot(s);
                          setSpotQuery(s.name);
                          setSpotMatches([]);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                      >
                        {s.name}
                        <span className="text-gray-500 ml-2 text-xs">
                          {s.province} · {s.level}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 正文 */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">正文（至少 10 字）</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder={'记录你的行程、花费、避雷点与推荐……\n换行分段，正文会按段落展示。'}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 leading-relaxed"
            />
          </div>

          {/* 署名 */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">署名</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              maxLength={50}
              placeholder="你的昵称"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-400 hover:to-pink-400 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? '发布中…' : '发布'}
          </button>
        </div>
      </main>
    </div>
  );
}
