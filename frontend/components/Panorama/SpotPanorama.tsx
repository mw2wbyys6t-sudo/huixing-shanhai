'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { MoveHorizontal, MapPin, RotateCcw } from 'lucide-react';

export type PanoramaTime = 'morning' | 'noon' | 'sunset' | 'night';

// 时段光影：用真实照片 + 色调滤镜模拟不同时辰的光线氛围
const TIME_FILTERS: Record<PanoramaTime, { filter: string; overlay: string }> = {
  morning: { filter: 'sepia(0.22) saturate(1.08) brightness(1.03)', overlay: 'linear-gradient(to top, rgba(255,150,50,0.10), transparent 60%)' },
  noon: { filter: 'none', overlay: 'none' },
  sunset: { filter: 'sepia(0.32) saturate(1.22) hue-rotate(-12deg) brightness(0.96)', overlay: 'linear-gradient(to top, rgba(230,80,30,0.16), transparent 60%)' },
  night: { filter: 'brightness(0.55) saturate(0.85)', overlay: 'linear-gradient(to top, rgba(10,20,60,0.40), transparent 65%)' },
};

// 画面超采样倍率：图片大于画框，环视时四周不留缝
const X_SCALE = 1.6;
const Y_SCALE = 1.22;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.4;
const FRICTION = 0.93;      // 惯性衰减
const AUTO_SPEED = 0.32;    // 空闲自动摇镜速度（px/帧）

interface SpotPanoramaProps {
  imageUrl?: string;
  title?: string;
  height?: number;
  timeOfDay?: PanoramaTime;
}

/**
 * 景区实景环视 2.5D：
 * - 真实照片超采样铺满（超出画框），拖拽带惯性与阻尼，像转动视角而非拖动图片
 * - 支持上下环视、滚轮无级变焦、空闲时自动缓慢摇镜
 * - 时段切换通过光影滤镜体现光线氛围
 */
export default function SpotPanorama({ imageUrl, title = '景区实景', height = 400, timeOfDay = 'noon' }: SpotPanoramaProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const state = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    zoom: 1,
    targetZoom: 1,
    dir: 1 as 1 | -1, // 自动摇镜方向
    dragging: false,
    lastX: 0,
    lastY: 0,
    auto: true, // 首次交互前的自动摇镜
  });
  const [showHint, setShowHint] = useState(true);
  const [offCenter, setOffCenter] = useState(false);
  const [dragging, setDragging] = useState(false);

  // 环视范围（随变焦扩大）
  const bounds = useCallback(() => {
    const w = wrapRef.current?.clientWidth || 800;
    const h = wrapRef.current?.clientHeight || height;
    const zoom = state.current.zoom;
    return {
      maxX: Math.max(0, (w * X_SCALE * zoom - w) / 2),
      maxY: Math.max(0, (h * Y_SCALE * zoom - h) / 2),
    };
  }, [height]);

  // 渲染循环：惯性、自动摇镜、变焦缓动、边界回弹
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = state.current;
      const { maxX, maxY } = bounds();

      if (s.dragging) {
        // 拖拽中：允许轻微越界（松手后回弹）
        s.x = Math.max(-maxX * 1.12, Math.min(maxX * 1.12, s.x));
        s.y = Math.max(-maxY * 1.12, Math.min(maxY * 1.12, s.y));
      } else {
        // 惯性
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= FRICTION;
        s.vy *= FRICTION;
        if (Math.abs(s.vx) < 0.02) s.vx = 0;
        if (Math.abs(s.vy) < 0.02) s.vy = 0;

        // 自摇摆镜：方向变量到边界翻转，往复扫视
        if (s.auto && s.vx === 0 && s.vy === 0) {
          s.x += s.dir * AUTO_SPEED;
          if (s.x >= maxX) { s.x = maxX; s.dir = -1; }
          else if (s.x <= -maxX) { s.x = -maxX; s.dir = 1; }
        }

        // 边界回弹（越界部分软性拉回）
        if (s.x < -maxX) { s.x += (-maxX - s.x) * 0.18; if (Math.abs(s.x + maxX) < 0.5) s.x = -maxX; }
        if (s.x > maxX) { s.x += (maxX - s.x) * 0.18; if (Math.abs(s.x - maxX) < 0.5) s.x = maxX; }
        if (s.y < -maxY) { s.y += (-maxY - s.y) * 0.18; if (Math.abs(s.y + maxY) < 0.5) s.y = -maxY; }
        if (s.y > maxY) { s.y += (maxY - s.y) * 0.18; if (Math.abs(s.y - maxY) < 0.5) s.y = maxY; }
      }

      // 变焦缓动
      s.zoom += (s.targetZoom - s.zoom) * 0.16;
      if (Math.abs(s.targetZoom - s.zoom) < 0.001) s.zoom = s.targetZoom;
      const { maxX: mx, maxY: my } = bounds();
      // 非拖拽时收敛到有效边界（拖拽中的 1.12 越界交给上方回弹逻辑）
      if (!s.dragging) {
        s.x = Math.max(-mx, Math.min(mx, s.x));
        s.y = Math.max(-my, Math.min(my, s.y));
      }

      // 应用变换
      const stage = stageRef.current;
      const wrap = wrapRef.current;
      if (stage && wrap) {
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        stage.style.width = `${w * X_SCALE * s.zoom}px`;
        stage.style.height = `${h * Y_SCALE * s.zoom}px`;
        stage.style.transform = `translate(calc(-50% + ${s.x}px), calc(-50% + ${s.y}px))`;
      }

      // 复位按钮可见性（自动摇镜期间不显示；节流：仅状态翻转时更新）
      setOffCenter((prev) => {
        const next = !s.auto && (Math.abs(s.x) > 12 || Math.abs(s.y) > 12 || s.zoom > 1.05);
        return prev === next ? prev : next;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bounds]);

  const stopAuto = () => { state.current.auto = false; };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    stopAuto();
    setShowHint(false);
    state.current.dragging = true;
    setDragging(true);
    state.current.lastX = e.clientX;
    state.current.lastY = e.clientY;
    state.current.vx = 0;
    state.current.vy = 0;
    wrapRef.current?.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX;
    const dy = e.clientY - s.lastY;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    // 抓取式环视：画面跟随指针反向移动
    s.x -= dx;
    s.y -= dy;
    s.vx = -dx * 0.9;   // 记录速度用于松手惯性
    s.vy = -dy * 0.9;
  }, []);

  const stopDrag = useCallback(() => {
    state.current.dragging = false;
    setDragging(false);
  }, []);

  // 滚轮变焦：原生非被动监听（React 的 onWheel 为 passive，preventDefault 无效）
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      state.current.auto = false;
      const s = state.current;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.targetZoom * (1 - e.deltaY * 0.0012)));
      s.targetZoom = next;
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // 键盘环视（可达性 + 演示友好）
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const s = state.current;
    stopAuto();
    setShowHint(false);
    const step = 48;
    if (e.key === 'ArrowLeft') { s.vx = -step * 0.4; s.x -= step; }
    else if (e.key === 'ArrowRight') { s.vx = step * 0.4; s.x += step; }
    else if (e.key === 'ArrowUp') { s.y -= step * 0.6; }
    else if (e.key === 'ArrowDown') { s.y += step * 0.6; }
    else if (e.key === '+' || e.key === '=') { s.targetZoom = Math.min(ZOOM_MAX, s.targetZoom + 0.2); }
    else if (e.key === '-') { s.targetZoom = Math.max(ZOOM_MIN, s.targetZoom - 0.2); }
    else return;
    e.preventDefault();
  }, []);

  // 复位视角
  const resetView = useCallback(() => {
    const s = state.current;
    s.x = 0; s.y = 0; s.vx = 0; s.vy = 0; s.targetZoom = 1;
  }, []);

  // 升级贴图清晰度：Wikimedia 直链 width=800 → 1600
  const hiResUrl = useMemoUrl(imageUrl);

  const cfg = TIME_FILTERS[timeOfDay];

  if (!hiResUrl) {
    return (
      <div className="img-placeholder rounded-xl flex flex-col items-center justify-center" style={{ height }}>
        <MapPin className="w-10 h-10 opacity-50 mb-2" />
        <p className="text-xs text-gray-500">该景区暂无实景图片</p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative rounded-xl overflow-hidden bg-dark-800 select-none"
      style={{ height, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="application"
      aria-label={`${title}（拖动或方向键环视，滚轮缩放）`}
    >
      {/* 超采样画面（尺寸由渲染循环按变焦动态设置） */}
      <div
        ref={stageRef}
        className="absolute top-1/2 left-1/2 will-change-transform"
        style={{ filter: cfg.filter, transform: 'translate(-50%, -50%)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hiResUrl}
          alt={title}
          draggable={false}
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>

      {/* 时段光影叠加 */}
      {cfg.overlay !== 'none' && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: cfg.overlay }} />
      )}

      {/* 电影感暗角（增加纵深） */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.26) 100%)' }}
      />

      {/* 底部操作提示 */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-xs text-gray-200 flex items-center gap-1.5">
        <MoveHorizontal className="w-3.5 h-3.5" />
        实景照片 · 拖动环视 · 滚轮缩放
      </div>

      {/* 首次引导（交互后淡出） */}
      {showHint && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700">
          <div className="px-5 py-2.5 rounded-full bg-black/45 backdrop-blur-sm text-sm text-white flex items-center gap-2 animate-pulse">
            <MoveHorizontal className="w-4 h-4" />
            按住拖动，环视实景
          </div>
        </div>
      )}

      {/* 复位按钮（视角偏离中心时出现） */}
      {offCenter && (
        <button
          onClick={resetView}
          aria-label="复位视角"
          className="absolute top-3 right-3 p-2 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Wikimedia 直链清晰度升级（仅针对 Special:FilePath 的 width 参数）
function useMemoUrl(url?: string): string {
  if (!url) return '';
  try {
    if (url.includes('Special:FilePath') && url.includes('width=800')) {
      return url.replace('width=800', 'width=1600');
    }
  } catch {
    // 忽略异常，返回原地址
  }
  return url;
}
