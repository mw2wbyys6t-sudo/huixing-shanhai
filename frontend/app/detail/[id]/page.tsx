import type { Metadata } from 'next';
import DetailClient from './DetailClient';
import scenicData from '@/lib/scenic_data.json';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// 静态导出参数 - 全部景区
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

// 结构化数据（TouristAttraction schema）
// "4.5w" / "9819" 等点评数字符串解析为数字
function parseReviewCount(text: string): number {
  const m = text.match(/^([\d.]+)([w])?$/);
  if (!m) return 1;
  return m[2] ? Math.round(parseFloat(m[1]) * 10000) : parseInt(m[1], 10);
}
function JsonLd({ id }: { id: string }) {
  const spot = scenicData.find((s) => s.id === id);
  if (!spot) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: spot.name,
    description: spot.description,
    image: spot.images[0] || undefined,
    url: `${SITE_URL}${basePath}/detail/${spot.id}`,
    address: {
      '@type': 'PostalAddress',
      // 国内景区省份+城市；国际景区 province 为国家名，直接作 addressCountry
      addressRegion: spot.id.startsWith('CN-') ? spot.province : undefined,
      addressCountry: spot.id.startsWith('CN-') ? 'CN' : spot.province,
      addressLocality: spot.city,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: spot.latitude,
      longitude: spot.longitude,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: spot.rating,
      bestRating: 5,
      ratingCount: parseReviewCount(spot.review_count),
    },
  };
  return (
    <script
      type="application/ld+json"
      // 转义 "<" 防止内容中出现 "</script>" 逃逸脚本上下文（Next.js 官方推荐写法）
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export default function DetailPage({ params }: { params: { id: string } }) {
  return (
    <>
      <JsonLd id={params.id} />
      <DetailClient />
    </>
  );
}
