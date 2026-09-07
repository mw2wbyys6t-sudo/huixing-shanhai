'use client';

import { useEffect, useRef } from 'react';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

/**
 * 鼠标跟随波纹效果 - 自然水面涟漪风格
 * - 白色半透明圆环波纹，像水面涟漪
 * - 柔和扩散，微妙不突兀
 * - 点击产生多层同心涟漪
 * - 支持触摸设备
 * - Canvas 覆盖全屏，不影响页面交互
 */
export default function MouseRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0 });
  const animationRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 触屏设备与「减少动态效果」偏好下完全跳过，避免移动端掉帧与动效干扰
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isCoarsePointer || prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 创建单个涟漪（空闲时自动恢复渲染循环）
    const createRipple = (x: number, y: number, maxRadius: number = 50, speed: number = 1.5, alpha: number = 0.25) => {
      ripplesRef.current.push({
        x,
        y,
        radius: 0,
        maxRadius,
        alpha,
        speed,
        lineWidth: 1.5,
      });
      startLoop();
    };

    // 鼠标移动处理 - 自然频率
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const dx = e.clientX - mouseRef.current.lastX;
      const dy = e.clientY - mouseRef.current.lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 移动时产生小涟漪，频率适中
      if (now - lastSpawnRef.current > 80 && distance > 8) {
        createRipple(
          e.clientX,
          e.clientY,
          30 + Math.random() * 20,  // 小半径
          1 + Math.random() * 0.8,   // 慢扩散
          0.15 + Math.random() * 0.1 // 低透明度
        );
        lastSpawnRef.current = now;
      }

      mouseRef.current.lastX = e.clientX;
      mouseRef.current.lastY = e.clientY;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    // 鼠标点击 - 产生多层同心涟漪，像水滴落入水面
    const handleClick = (e: MouseEvent) => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          createRipple(
            e.clientX,
            e.clientY,
            60 + i * 25,      // 递增半径
            1.8 + i * 0.3,    // 递增速度
            0.3 - i * 0.05    // 递减透明度
          );
        }, i * 100);  // 延迟产生，形成涟漪扩散效果
      }
    };

    // 触摸处理
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const now = Date.now();
        if (now - lastSpawnRef.current > 100) {
          createRipple(touch.clientX, touch.clientY, 35, 1.2, 0.15);
          lastSpawnRef.current = now;
        }
      }
    };

    // 动画循环：无涟漪时暂停，有新涟漪时由 createRipple 重新启动，避免常驻重绘
    let loopRunning = false;
    const startLoop = () => {
      if (loopRunning) return;
      loopRunning = true;
      animationRef.current = requestAnimationFrame(animate);
    };
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        // 涟漪扩散
        ripple.radius += ripple.speed;
        ripple.alpha -= 0.008;  // 缓慢淡出

        if (ripple.alpha <= 0 || ripple.radius >= ripple.maxRadius) {
          return false;
        }

        // 绘制主涟漪圆环 - 白色半透明
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha})`;
        ctx.lineWidth = ripple.lineWidth;
        ctx.stroke();

        // 内圈微弱光晕 - 增加水面质感
        if (ripple.radius > 5) {
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.radius * 0.85, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha * 0.4})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // 外圈微弱光晕
        if (ripple.radius > 10) {
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.radius * 1.1, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha * 0.2})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        return true;
      });

      if (ripplesRef.current.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        loopRunning = false;
      }
    };

    startLoop();

    // 添加事件监听
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
