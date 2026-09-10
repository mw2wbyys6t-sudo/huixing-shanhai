/**
 * 构建后生成静态 sitemap.xml 与 robots.txt 到 public/
 * （Next 14 静态导出模式对 metadata 路由支持不稳定，改为纯静态文件最可靠）
 *
 * 用法：node scripts/gen-sitemap.mjs
 * 环境变量：NEXT_PUBLIC_SITE_URL（站点域名）、NEXT_PUBLIC_BASE_PATH（子路径）
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 与 next.config.js 的默认值保持一致（子路径部署时两个值必须相同）
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/app/app_17dfqqgrsds';
const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') + basePath;
const today = new Date().toISOString().slice(0, 10);

const scenic = JSON.parse(readFileSync(join(root, 'lib', 'scenic_data.json'), 'utf-8'));

const staticPages = ['', '/explore', '/avoid', '/planner', '/globe', '/assistant', '/about', '/privacy', '/terms'];
const urls = [
  ...staticPages.map((p) => ({ loc: `${base}${p}`, priority: p === '' ? '1.0' : '0.8' })),
  ...scenic.map((s) => ({ loc: `${base}/detail/${s.id}`, priority: '0.7' })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;

const robots = `User-Agent: *
Allow: /
# robots 协议要求 Disallow 为路径（不能是完整 URL）
Disallow: ${basePath}/monitor

Sitemap: ${base}/sitemap.xml
`;

// 写入 public/（源码一致性）；静态导出后还需写入 out/ 覆盖 next build 提前复制的旧版本
const targets = [join(root, 'public')];
const outDir = join(root, 'out');
if (existsSync(outDir)) targets.push(outDir);
for (const dir of targets) {
  writeFileSync(join(dir, 'sitemap.xml'), sitemap);
  writeFileSync(join(dir, 'robots.txt'), robots);
}
console.log(`✓ 已生成 sitemap.xml（${urls.length} 个URL）与 robots.txt -> ${targets.map((t) => t.split(/[\/]/).pop()).join(' + ')}`);
