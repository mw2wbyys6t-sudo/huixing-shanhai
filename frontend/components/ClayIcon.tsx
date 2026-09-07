'use client';

interface ClayIconProps {
  name: 'mountain' | 'eye' | 'warning' | 'sparkles' | 'search' | 'map-pin' | 'star' | 'compass';
  size?: number;
  className?: string;
  alt?: string;
}

// 图标路径映射
const iconMap: Record<string, string> = {
  mountain: '/icons/mountain.png',
  eye: '/icons/eye.png',
  warning: '/icons/warning.png',
  sparkles: '/icons/sparkles.png',
  search: '/icons/search.png',
  'map-pin': '/icons/map-pin.png',
  star: '/icons/star.png',
  compass: '/icons/compass.png',
};

/**
 * 3D粘土风格图标组件
 * 用真实3D渲染图标替换矢量图标，降低AI感，增加手工质感
 * basePath 构建时注入：开发环境为空，部署环境通过 NEXT_PUBLIC_BASE_PATH 设置
 */
export default function ClayIcon({ name, size = 24, className = '', alt }: ClayIconProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const iconSrc = `${basePath}${iconMap[name] || '/icons/mountain.png'}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={iconSrc}
        alt={alt || name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        }}
        loading="lazy"
      />
    </div>
  );
}
