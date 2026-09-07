'use client';

import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface AvoidIndexBadgeProps {
  index: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function AvoidIndexBadge({ index, size = 'md', showLabel = true }: AvoidIndexBadgeProps) {
  const level = index >= 3 ? 'high' : index >= 2 ? 'medium' : 'low';
  
  const config = {
    high: {
      color: 'text-red-400',
      bg: 'bg-red-500/20 border-red-500/30',
      icon: ShieldAlert,
      label: '高风险',
      desc: '建议谨慎前往',
    },
    medium: {
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20 border-yellow-500/30',
      icon: Shield,
      label: '中风险',
      desc: '注意避开高峰',
    },
    low: {
      color: 'text-green-400',
      bg: 'bg-green-500/20 border-green-500/30',
      icon: ShieldCheck,
      label: '低风险',
      desc: '放心前往',
    },
  };

  const cfg = config[level];
  const Icon = cfg.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border ${cfg.bg} ${sizeClasses[size]}`}>
      <Icon className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} ${cfg.color}`} />
      <div className="flex flex-col">
        <span className={`font-bold ${cfg.color}`}>
          避雷指数 {index}
          {showLabel && <span className="ml-1 font-normal">· {cfg.label}</span>}
        </span>
        {size !== 'sm' && (
          <span className="text-xs text-gray-400">{cfg.desc}</span>
        )}
      </div>
    </div>
  );
}
