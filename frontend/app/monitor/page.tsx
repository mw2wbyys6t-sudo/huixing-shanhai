'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  MapPin,
  Calendar,
  Wallet,
} from 'lucide-react';
import Header from '@/components/Header';
import { API_BASE_URL } from '@/lib/api';

interface WorkflowLog {
  id: number;
  session_id: string;
  user_input: string;
  intent: string;
  intent_confidence: number;
  extracted_entities: any;
  agent_results: any;
  final_output: string;
  quality_score: number;
  feedback_rounds: number;
  total_time: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  avg_time: number;
  avg_quality: number;
}

export default function WorkflowMonitorPage() {
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    success: 0,
    failed: 0,
    avg_time: 0,
    avg_quality: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/workflow/logs?page=1&page_size=50`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setLoadError(false);

        // 计算统计数据
        const logs = data.logs || [];
        const successLogs = logs.filter((l: WorkflowLog) => l.status === 'completed');
        const failedLogs = logs.filter((l: WorkflowLog) => l.status === 'failed');
        const avgTime = logs.length > 0
          ? logs.reduce((sum: number, l: WorkflowLog) => sum + (l.total_time || 0), 0) / logs.length
          : 0;
        const avgQuality = successLogs.length > 0
          ? successLogs.reduce((sum: number, l: WorkflowLog) => sum + (l.quality_score || 0), 0) / successLogs.length
          : 0;

        setStats({
          total: logs.length,
          success: successLogs.length,
          failed: failedLogs.length,
          avg_time: avgTime,
          avg_quality: avgQuality,
        });
      }
    } catch (error) {
      console.error('加载工作流日志失败:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getIntentLabel = (intent: string) => {
    const labels: Record<string, string> = {
      destination_recommend: '目的地推荐',
      itinerary_planning: '行程规划',
      avoid_analysis: '避雷分析',
      weather_query: '天气查询',
      budget_planning: '预算规划',
      general_query: '通用查询',
    };
    return labels[intent] || intent;
  };

  const getQualityColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-amber-400';
    return 'text-red-400';
  };

  const getQualityBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/20 border-green-500/30';
    if (score >= 6) return 'bg-amber-500/20 border-amber-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  return (
    <div className="min-h-screen">
      <Header />

      <div className="pt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-400" />
              工作流监控面板
            </h1>
            <p className="text-gray-400">实时监控多 Agent 协同工作流的执行情况和性能指标</p>
          </div>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">总执行次数</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>

          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">成功率</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">{stats.success} 成功 / {stats.failed} 失败</div>
          </div>

          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-sm text-gray-400">平均执行时间</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.avg_time.toFixed(1)}s</div>
          </div>

          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-gray-400">平均质量评分</span>
            </div>
            <div className={`text-3xl font-bold ${getQualityColor(stats.avg_quality)}`}>
              {stats.avg_quality.toFixed(1)}
            </div>
          </div>
        </div>

        {/* 工作流日志列表 */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              最近执行日志
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 relative">
                <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
              </div>
              <p className="text-gray-400">加载中...</p>
            </div>
          ) : loadError ? (
            <div className="p-12 text-center">
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500/50" />
              <p className="text-gray-300 mb-2">工作流日志加载失败</p>
              <p className="text-sm text-gray-500 mb-4">无法连接后端服务，请确认后端已启动后重试</p>
              <button
                onClick={loadLogs}
                className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors"
              >
                重新加载
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-2">暂无工作流执行记录</p>
              <p className="text-sm text-gray-500">前往智能规划页生成行程，这里会显示执行记录</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logs.map((log) => (
                <div key={log.id}>
                  {/* 日志摘要 */}
                  <div
                    className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* 状态图标 */}
                        {log.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        )}

                        {/* 用户输入 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{log.user_input}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-purple-400">{getIntentLabel(log.intent)}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 指标 */}
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="text-center">
                          <div className={`text-lg font-bold ${getQualityColor(log.quality_score)}`}>
                            {log.quality_score?.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">质量评分</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-cyan-400">{log.total_time?.toFixed(1)}s</div>
                          <div className="text-xs text-gray-500">执行时间</div>
                        </div>
                        {expandedId === log.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 详细信息 */}
                  {expandedId === log.id && (
                    <div className="p-6 bg-white/5 border-t border-white/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 左侧：实体和Agent */}
                        <div className="space-y-4">
                          {/* 提取的实体 */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">提取的实体</h4>
                            <div className="flex flex-wrap gap-2">
                              {log.extracted_entities && Object.entries(log.extracted_entities).map(([key, value]) => (
                                value && (
                                  <span
                                    key={key}
                                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300"
                                  >
                                    {key}: {String(value)}
                                  </span>
                                )
                              ))}
                            </div>
                          </div>

                          {/* Agent执行情况 */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Agent 执行情况</h4>
                            <div className="space-y-2">
                              {log.agent_results && Object.entries(log.agent_results).map(([name, result]: [string, any]) => (
                                <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                                  <div className="flex items-center gap-2">
                                    {result.success ? (
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-400" />
                                    )}
                                    <span className="text-sm text-white">{name}</span>
                                  </div>
                                  <span className="text-xs text-gray-400">{result.execution_time?.toFixed(2)}s</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 右侧：最终输出 */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">最终输出</h4>
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 max-h-96 overflow-y-auto">
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans">
                              {log.final_output || '无输出'}
                            </pre>
                          </div>
                          {log.error_message && (
                            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                              <p className="text-xs text-red-400">{log.error_message}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
