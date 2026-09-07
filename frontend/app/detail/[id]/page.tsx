import type { Metadata } from 'next';
import DetailClient from './DetailClient';
import scenicData from '@/lib/scenic_data.json';

// 静态导出参数 - 20个景区
export function generateStaticParams() {
  return scenicData.map((spot) => ({ id: spot.id }));
}

// 每个景区独立标题与描述（SEO）
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const spot = scenicData.find((s) => s.id === params.id);
  if (!spot) {
    return { title: '景区详情' };
  }
  return {
    title: `${spot.name} · ${spot.province}${spot.city}旅游攻略与避雷指数`,
    description: `${spot.name}（${spot.level}）：${spot.description.slice(0, 80)}…避雷指数 ${spot.avoid.avoid_index}，最佳游览时间 ${spot.avoid.best_time}。`,
  };
}

export default function DetailPage() {
  return <DetailClient />;
}
