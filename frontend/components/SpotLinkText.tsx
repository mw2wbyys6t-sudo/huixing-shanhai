'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import scenicData from '@/lib/scenic_data.json';

interface Segment {
  type: 'text' | 'link';
  content: string;
  id?: string;
}

const SPOT_NAMES = (scenicData as Array<{ id: string; name: string }>)
  .map((s) => ({ name: s.name, id: s.id }))
  .sort((a, b) => b.name.length - a.name.length); // 长名优先，避免"故宫"截胡"故宫博物院"

const NAME_MAP = new Map(SPOT_NAMES.map((s) => [s.name, s.id]));

/**
 * 把文本中的站内景区名自动转为可点击的详情链接。
 * 用于 AI 行程/助手回复：模型提到的任何景区都能一键跳转查看避雷指数与实景。
 */
export default function SpotLinkText({ text, linkClassName = '' }: { text: string; linkClassName?: string }) {
  const segments = useMemo<Segment[]>(() => {
    let segs: Segment[] = [{ type: 'text', content: text }];
    for (const { name, id } of SPOT_NAMES) {
      const next: Segment[] = [];
      for (const seg of segs) {
        if (seg.type !== 'text' || !seg.content.includes(name)) {
          next.push(seg);
          continue;
        }
        const pieces = seg.content.split(name);
        pieces.forEach((piece, i) => {
          if (i > 0) next.push({ type: 'link', content: name, id });
          if (piece) next.push({ type: 'text', content: piece });
        });
      }
      segs = next;
    }
    return segs;
  }, [text]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'link' && seg.id ? (
          <Link
            key={i}
            href={`/detail/${seg.id}`}
            title={`查看 ${seg.content} 详情`}
            className={`underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity ${linkClassName}`}
          >
            {seg.content}
          </Link>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </>
  );
}

export { NAME_MAP };
