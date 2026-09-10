'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, Heart, Clock, MapPin, MessageSquare, Send } from 'lucide-react';
import Header from '@/components/Header';
import { notesAPI, getAuthUser, type NoteDetail } from '@/lib/api';

function NoteContent() {
  const params = useSearchParams();
  const noteId = Number(params.get('id'));

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentName, setCommentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!Number.isFinite(noteId) || noteId <= 0) {
      setLoading(false);
      return;
    }
    notesAPI
      .get(noteId)
      .then(setNote)
      .catch(() => setNote(null))
      .finally(() => setLoading(false));
  }, [noteId]);

  useEffect(() => {
    const user = getAuthUser();
    if (user?.username) setCommentName(user.username);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doLike = async () => {
    if (liked || likeBusy || !note) return;
    setLikeBusy(true);
    try {
      const r = await notesAPI.like(noteId);
      setNote({ ...note, likes: r.likes });
      setLiked(true);
    } finally {
      setLikeBusy(false);
    }
  };

  const doComment = async () => {
    if (!note) return;
    setError('');
    if (!commentText.trim()) return setError('评论不能为空');
    if (!commentName.trim()) return setError('请填写昵称');
    setSubmitting(true);
    try {
      await notesAPI.comment(noteId, { content: commentText.trim(), user_name: commentName.trim() });
      setCommentText('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl h-64 animate-pulse" />
    );
  }

  if (!note) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">游记不存在或已被删除</p>
        <Link href="/community" className="text-cyan-400 hover:text-cyan-300 text-sm">
          ← 返回游记社区
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-cyan-400 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        返回游记社区
      </Link>

      <article className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              note.type === '攻略'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
            }`}
          >
            {note.type}
          </span>
          {note.spot_name && note.spot_id && (
            <Link
              href={`/detail/${note.spot_id}`}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" />
              {note.spot_name}
            </Link>
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">{note.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pb-5 border-b border-white/10 mb-6">
          <span className="text-gray-300">{note.user_name}</span>
          {note.created_at && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {note.created_at.slice(0, 16).replace('T', ' ')}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {note.views} 阅读
          </span>
          <button
            onClick={doLike}
            disabled={liked || likeBusy}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
              liked
                ? 'bg-red-500/15 border-red-500/40 text-red-400'
                : 'border-white/15 text-gray-400 hover:text-red-400 hover:border-red-400/40'
            } disabled:opacity-60`}
            aria-pressed={liked}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-400' : ''}`} />
            {note.likes} 赞
          </button>
        </div>

        {/* 正文按空行分段 */}
        <div className="space-y-4">
          {(note.content || '').split(/\n{2,}|\r\n\r\n/).map((para, i) => (
            <p key={i} className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {para}
            </p>
          ))}
        </div>
      </article>

      {/* 评论区 */}
      <section className="glass rounded-2xl p-6 sm:p-8 mt-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          评论（{note.comments.length}）
        </h2>

        <div className="space-y-4 mb-6">
          {note.comments.length === 0 ? (
            <p className="text-sm text-gray-500">还没有评论，来说两句吧</p>
          ) : (
            note.comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-xs text-white shrink-0">
                  {c.user_name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300">{c.user_name}</span>
                    {c.created_at && (
                      <span className="text-[11px] text-gray-600">{c.created_at.slice(0, 16).replace('T', ' ')}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 pt-5 border-t border-white/10">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="说说你的看法…"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
          <div className="flex items-center gap-3">
            <input
              value={commentName}
              onChange={(e) => setCommentName(e.target.value)}
              maxLength={50}
              placeholder="昵称"
              className="w-36 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={doComment}
              disabled={submitting}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm hover:bg-cyan-500/30 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? '发送中…' : '发送评论'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </section>
    </>
  );
}

export default function NoteDetailPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Suspense
          fallback={
            <div className="glass rounded-2xl h-64 animate-pulse" />
          }
        >
          <NoteContent />
        </Suspense>
      </main>
    </div>
  );
}
