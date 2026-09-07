import type { Metadata } from 'next';
import './globals.css';
import MouseRipple from '@/components/MouseRipple';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '慧行山海 — 基于 AI 与电子地图的一站式旅游规划导览平台',
    template: '%s - 慧行山海',
  },
  description:
    '出发前，先看见真实的河山；出发后，不踩任何一个雷。720°全景漫游 · AI避雷指数 · 智能行程规划 · 游客实拍墙。',
  keywords: '旅游规划,全景漫游,避雷指南,智能旅游,行程规划,慧行山海',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '慧行山海',
    title: '慧行山海 — 一站式旅游规划导览平台',
    description: '出发前，先看见真实的河山；出发后，不踩任何一个雷。',
    images: [{ url: `${basePath}/icons/mountain.png`, width: 1024, height: 1024, alt: '慧行山海' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '慧行山海 — 一站式旅游规划导览平台',
    description: '出发前，先看见真实的河山；出发后，不踩任何一个雷。',
    images: [`${basePath}/icons/mountain.png`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-radial-glow min-h-screen">
        {/* 鼠标跟随波纹效果 */}
        <MouseRipple />
        {children}
      </body>
    </html>
  );
}
