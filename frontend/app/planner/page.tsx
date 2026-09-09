'use client';

import { useState, useEffect, ReactNode } from 'react';
import {
  Sparkles,
  MapPin,
  Calendar,
  Wallet,
  Users,
  Heart,
  Clock,
  ChevronRight,
  Route,
  Send,
  RefreshCw,
  Download,
  Share2,
  CheckCircle,
  XCircle,
  UtensilsCrossed,
  Phone,
  Navigation,
  Star,
} from 'lucide-react';
import Header from '@/components/Header';
import SpotLinkText from '@/components/SpotLinkText';
import { API_BASE_URL, foodAPI, amapNavUrl, type FoodPlace } from '@/lib/api';

interface StepStatus {
  name: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

const destinations = ['北京', '上海', '天津', '苏州', '南京', '哈尔滨', '大连', '沈阳', '承德', '秦皇岛'];
const travelerTypes = ['亲子游', '情侣游', '闺蜜游', '独自旅行', '家庭出游', '商务旅行'];
const preferences = ['自然风光', '人文历史', '美食探店', '购物休闲', '网红打卡', '深度体验'];

/** 轻量 Markdown 渲染：支持标题/加粗/无序列表/有序列表/普通段落 */
function renderMarkdown(text: string): ReactNode {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listBuffer.length === 0 || !listType) return;
    const items = listBuffer.map((item, i) => (
      <li key={i} className="flex items-start gap-2 text-sm text-gray-300 leading-relaxed">
        <span className="text-purple-400 mt-0.5 flex-shrink-0">{listType === 'ol' ? `${item.match(/^\d+\./)?.[0] || '·'}` : '·'}</span>
        <span>{renderInline(listType === 'ol' ? item.replace(/^\d+\.\s*/, '') : item.replace(/^[-*]\s*/, ''))}</span>
      </li>
    ));
    nodes.push(
      listType === 'ol' ? (
        <div key={nodes.length} className="space-y-1.5">{items}</div>
      ) : (
        <ul key={nodes.length} className="space-y-1.5">{items}</ul>
      )
    );
    listBuffer = [];
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      flushList();
      const level = line.match(/^#+/)![0].length;
      const content = line.replace(/^#+\s*/, '');
      nodes.push(
        level <= 2 ? (
          <h3 key={nodes.length} className="text-lg font-bold text-white mt-2">{renderInline(content)}</h3>
        ) : (
          <h4 key={nodes.length} className="text-base font-semibold text-amber-400 mt-1.5">{renderInline(content)}</h4>
        )
      );
    } else if (/^[-*]\s+/.test(line)) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(line);
    } else if (/^\d+\.\s+/.test(line)) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(line);
    } else {
      flushList();
      nodes.push(
        <p key={nodes.length} className="text-sm text-gray-300 leading-relaxed">{renderInline(line)}</p>
      );
    }
  }
  flushList();
  return nodes;
}

/** 行内渲染：加粗 + 景区名自动转详情链接 */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="text-white font-semibold">
        <SpotLinkText text={part.slice(2, -2)} linkClassName="text-cyan-300" />
      </strong>
    ) : (
      <SpotLinkText key={i} text={part} linkClassName="text-cyan-300" />
    )
  );
}

export default function PlannerPage() {
  const [formData, setFormData] = useState({
    destination: '北京',
    days: 3,
    budget: 5000,
    people: 2,
    travelerType: '情侣游',
    preferences: ['自然风光', '美食探店'] as string[],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalOutput, setFinalOutput] = useState('');
  const [generateError, setGenerateError] = useState('');
  const [copied, setCopied] = useState(false);
  // 目的地美食推荐（行程生成后加载）
  const [cityFoods, setCityFoods] = useState<FoodPlace[]>([]);
  const [cityFoodState, setCityFoodState] = useState<'hidden' | 'ready'>('hidden');

  // 行程生成成功后加载目的地美食（失败静默隐藏，不影响主流程）
  useEffect(() => {
    if (!finalOutput || isGenerating) return;
    let alive = true;
    foodAPI.getCityFood(formData.destination)
      .then((items) => {
        if (!alive) return;
        if (items.length > 0) {
          setCityFoods(items);
          setCityFoodState('ready');
        } else {
          setCityFoodState('hidden');
        }
      })
      .catch(() => {
        if (alive) setCityFoodState('hidden');
      });
    return () => { alive = false; };
  }, [finalOutput, isGenerating, formData.destination]);
  const [workflowStatus, setWorkflowStatus] = useState<{
    currentStep: string;
    steps: StepStatus[];
    qualityScore: number;
    feedbackRounds: number;
    totalTime: number;
  }>({
    currentStep: '',
    steps: [
      { name: 'intent', label: '意图解析', status: 'pending' },
      { name: 'weather', label: '天气分析', status: 'pending' },
      { name: 'attraction', label: '景点推荐', status: 'pending' },
      { name: 'budget', label: '预算规划', status: 'pending' },
      { name: 'avoid', label: '避雷分析', status: 'pending' },
      { name: 'itinerary', label: '行程生成', status: 'pending' },
      { name: 'validator', label: '质量评估', status: 'pending' },
    ],
    qualityScore: 0,
    feedbackRounds: 0,
    totalTime: 0,
  });

  const togglePreference = (pref: string) => {
    setFormData((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(pref)
        ? prev.preferences.filter((p) => p !== pref)
        : [...prev.preferences, pref],
    }));
  };

  const generateItinerary = async () => {
    setIsGenerating(true);
    setFinalOutput('');
    setGenerateError('');

    // 重置工作流状态
    setWorkflowStatus((prev) => ({
      ...prev,
      currentStep: 'intent',
      steps: prev.steps.map((s) => ({ ...s, status: 'pending' as const })),
      qualityScore: 0,
      feedbackRounds: 0,
      totalTime: 0,
    }));

    // 构建用户需求描述
    const userMessage = `${formData.travelerType}，${formData.people}人，去${formData.destination}${formData.days}天，预算${formData.budget}元，偏好：${formData.preferences.join('、')}`;

    try {
      // 调用 SSE 流式响应 API，实时显示工作流执行进度
      const response = await fetch(`${API_BASE_URL}/api/workflow/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error('后端服务暂不可用，请确认后端已启动');
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: any = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                const eventType = eventData.type;

                if (eventType === 'start') {
                  setWorkflowStatus((prev) => ({
                    ...prev,
                    currentStep: 'intent',
                    steps: prev.steps.map((s) => ({ ...s, status: 'pending' as const })),
                  }));
                } else if (eventType === 'progress') {
                  const stepName = eventData.step;
                  setWorkflowStatus((prev) => ({
                    ...prev,
                    currentStep: stepName,
                    steps: prev.steps.map((s) => {
                      const order = ['intent', 'weather', 'attraction', 'budget', 'avoid', 'itinerary', 'validator'];
                      const stepIndex = order.indexOf(stepName);
                      const currentIndex = order.indexOf(s.name);
                      if (s.name === stepName) {
                        return { ...s, status: 'running' as const };
                      } else if (currentIndex < stepIndex) {
                        return { ...s, status: 'completed' as const };
                      }
                      return s;
                    }),
                  }));
                } else if (eventType === 'complete') {
                  finalData = eventData.data;
                  setWorkflowStatus((prev) => ({
                    ...prev,
                    currentStep: '',
                    steps: prev.steps.map((s) => ({ ...s, status: 'completed' as const })),
                    qualityScore: finalData.quality_score,
                    feedbackRounds: finalData.feedback_rounds || 0,
                    totalTime: finalData.total_time,
                  }));
                } else if (eventType === 'error') {
                  throw new Error(eventData.message || '工作流执行失败');
                }
              } catch (e) {
                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                  throw e;
                }
                // 忽略 JSON 解析错误
              }
            }
          }
        }
      }

      if (finalData && finalData.final_output) {
        setFinalOutput(finalData.final_output);
      } else {
        throw new Error('工作流未返回有效结果，请稍后重试');
      }
    } catch (error) {
      console.error('行程生成失败:', error);
      setGenerateError(
        error instanceof Error
          ? error.message
          : '行程生成失败，请检查后端服务是否启动后重试'
      );
      // 失败时标记错误状态
      setWorkflowStatus((prev) => ({
        ...prev,
        currentStep: '',
        steps: prev.steps.map((s) =>
          s.status === 'running' ? { ...s, status: 'failed' as const } : s
        ),
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  // 导出行程为文本文件
  const handleExport = () => {
    const content = [
      `慧行山海 · 智能行程规划`,
      `${formData.destination} ${formData.days}日${formData.travelerType}`,
      `${formData.people}人出行 · 总预算 ¥${formData.budget}`,
      `质量评分 ${workflowStatus.qualityScore.toFixed(1)}/10 · 生成用时 ${workflowStatus.totalTime.toFixed(1)}s`,
      '',
      finalOutput,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `行程规划-${formData.destination}${formData.days}天.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 复制行程到剪贴板
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(finalOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时的兜底：选中文本方式
      const textarea = document.createElement('textarea');
      textarea.value = finalOutput;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* 页面标题 */}
      <section className="pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">智能行程规划</h1>
          </div>
          <p className="text-gray-400 ml-[3.25rem]">智能行程生成 · 预算管控 · 最优路线规划 · 避雷提示</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {!finalOutput && !isGenerating && !generateError && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 规划表单 */}
            <div className="lg:col-span-2">
              <div className="glass rounded-2xl p-8">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Route className="w-5 h-5 text-purple-400" />
                  告诉我你的旅行需求
                </h2>

                <div className="space-y-6">
                  {/* 目的地 */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      目的地
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {destinations.map((dest) => (
                        <button
                          key={dest}
                          onClick={() => setFormData((prev) => ({ ...prev, destination: dest }))}
                          className={`px-4 py-2 rounded-lg text-sm transition-all ${
                            formData.destination === dest
                              ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400'
                              : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          {dest}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 天数和预算 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                        <Calendar className="w-4 h-4 text-purple-400" />
                        旅行天数
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={formData.days}
                          onChange={(e) => setFormData((prev) => ({ ...prev, days: parseInt(e.target.value) }))}
                          className="flex-1 accent-purple-500"
                        />
                        <span className="text-lg font-bold text-purple-400 w-12 text-center">{formData.days}天</span>
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                        <Wallet className="w-4 h-4 text-purple-400" />
                        预算（元）
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1000"
                          max="20000"
                          step="500"
                          value={formData.budget}
                          onChange={(e) => setFormData((prev) => ({ ...prev, budget: parseInt(e.target.value) }))}
                          className="flex-1 accent-purple-500"
                        />
                        <span className="text-lg font-bold text-purple-400 w-20 text-center">¥{formData.budget}</span>
                      </div>
                    </div>
                  </div>

                  {/* 人数和出行类型 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                        <Users className="w-4 h-4 text-purple-400" />
                        出行人数
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            onClick={() => setFormData((prev) => ({ ...prev, people: n }))}
                            className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                              formData.people === n
                                ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400'
                                : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                        <Heart className="w-4 h-4 text-purple-400" />
                        出行类型
                      </label>
                      <select
                        value={formData.travelerType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, travelerType: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
                      >
                        {travelerTypes.map((type) => (
                          <option key={type} value={type} className="bg-dark-800">{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 偏好 */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      旅行偏好（可多选）
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {preferences.map((pref) => (
                        <button
                          key={pref}
                          onClick={() => togglePreference(pref)}
                          className={`px-4 py-2 rounded-lg text-sm transition-all ${
                            formData.preferences.includes(pref)
                              ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 text-purple-400'
                              : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 生成按钮 */}
                  <button
                    onClick={generateItinerary}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg hover:from-purple-400 hover:to-pink-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
                  >
                    <Send className="w-5 h-5" />
                    生成智能行程
                  </button>
                </div>
              </div>
            </div>

            {/* 侧边信息 */}
            <div className="space-y-6">
              <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  智能规划能力
                </h3>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span>逐日行程编排 + 时间调度</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span>预算管控 + 费用估算</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span>多 Agent 并行分析（天气 / 景点 / 预算 / 避雷）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span>避雷提示 + 时令推荐</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span>天气适配 + 室内外活动匹配</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✓</span>
                    <span>质量评估 + 低分自动修订循环</span>
                  </li>
                </ul>
              </div>

              <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">当前配置摘要</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">目的地</span>
                    <span className="text-white font-medium">{formData.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">天数</span>
                    <span className="text-white font-medium">{formData.days}天</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">预算</span>
                    <span className="text-purple-400 font-bold">¥{formData.budget}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">人数</span>
                    <span className="text-white font-medium">{formData.people}人</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">类型</span>
                    <span className="text-white font-medium">{formData.travelerType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">人均预算</span>
                    <span className="text-amber-400 font-bold">¥{Math.round(formData.budget / formData.people)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 生成中动画 - 工作流执行可视化 */}
        {isGenerating && (
          <div className="glass rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">多 Agent 协同规划中...</h3>
              <p className="text-gray-400 text-sm">LangGraph 工作流引擎 · 7大专业 Agent 并行执行</p>
            </div>

            {/* 工作流执行进度 */}
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {workflowStatus.steps.map((step) => (
                  <div
                    key={step.name}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      step.status === 'completed'
                        ? 'bg-green-500/10 border-green-500/30'
                        : step.status === 'running'
                        ? 'bg-purple-500/10 border-purple-500/40 animate-pulse'
                        : step.status === 'failed'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      {step.status === 'completed' && (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                      {step.status === 'running' && (
                        <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                      )}
                      {step.status === 'failed' && (
                        <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                          <span className="text-white text-xs">✗</span>
                        </div>
                      )}
                      {step.status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
                      )}
                      <span
                        className={`text-xs font-medium ${
                          step.status === 'completed'
                            ? 'text-green-400'
                            : step.status === 'running'
                            ? 'text-purple-400'
                            : step.status === 'failed'
                            ? 'text-red-400'
                            : 'text-gray-500'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 当前执行步骤 */}
              {workflowStatus.currentStep && (
                <div className="text-center mb-4">
                  <span className="text-sm text-purple-400">
                    当前执行：{workflowStatus.steps.find((s) => s.name === workflowStatus.currentStep)?.label}
                  </span>
                </div>
              )}

              {/* 执行信息 */}
              <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Route className="w-3.5 h-3.5" />
                  <span>LangGraph 引擎</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>7 Agent 协同</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>约30-60秒</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 失败错误态（带重试） */}
        {generateError && !isGenerating && (
          <div className="glass rounded-2xl p-12 text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500/60" />
            <h3 className="text-xl font-bold text-white mb-2">行程生成失败</h3>
            <p className="text-gray-400 mb-1">{generateError}</p>
            <p className="text-sm text-gray-500 mb-6">
              请确认后端服务已启动（http://localhost:8000），然后重试。
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={generateItinerary}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-400 hover:to-pink-400 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重新生成
              </button>
              <button
                onClick={() => setGenerateError('')}
                className="px-6 py-3 rounded-xl glass hover:bg-white/10 transition-all text-gray-300"
              >
                返回修改需求
              </button>
            </div>
          </div>
        )}

        {/* 工作流执行结果摘要（成功后显示） */}
        {finalOutput && !isGenerating && workflowStatus.totalTime > 0 && (
          <div className="glass-purple rounded-2xl p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-white">LangGraph 工作流</span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <div className="text-sm text-gray-400">
                  执行时间：<span className="text-cyan-400 font-medium">{workflowStatus.totalTime.toFixed(1)}s</span>
                </div>
                <div className="text-sm text-gray-400">
                  质量评分：<span className="text-amber-400 font-medium">{workflowStatus.qualityScore.toFixed(1)}/10</span>
                </div>
                <div className="text-sm text-gray-400">
                  反馈循环：<span className="text-green-400 font-medium">{workflowStatus.feedbackRounds}轮</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {workflowStatus.qualityScore >= 7 ? (
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs border border-green-500/30 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    质量达标
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs border border-amber-500/30">
                    已自动修订
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 行程结果：AI 真实输出 */}
        {finalOutput && !isGenerating && (
          <div className="space-y-6">
            {/* 行程概览 */}
            <div className="glass rounded-2xl p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {formData.destination} {formData.days}日{formData.travelerType || ''}行程
                  </h2>
                  <p className="text-gray-400">{formData.people}人出行 · 总预算 ¥{formData.budget} · AI 多 Agent 协同生成</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={generateItinerary}
                    className="px-4 py-2 rounded-lg glass hover:bg-white/10 transition-all text-gray-300 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新生成
                  </button>
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 rounded-lg glass hover:bg-white/10 transition-all text-gray-300 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    导出
                  </button>
                  <button
                    onClick={handleShare}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-400 hover:to-pink-400 transition-all flex items-center gap-2"
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    {copied ? '已复制' : '分享'}
                  </button>
                </div>
              </div>

              {/* AI 输出正文 */}
              <div className="space-y-3 max-h-[720px] overflow-y-auto pr-2">{renderMarkdown(finalOutput)}</div>
            </div>

            {/* 目的地美食推荐（高德 POI） */}
            {cityFoodState === 'ready' && (
              <div className="glass rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-orange-400" />
                    {formData.destination}美食推荐
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      高德地图
                    </span>
                  </h2>
                  <span className="text-xs text-gray-500">为行程加分的一口</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cityFoods.map((food) => (
                    <div key={food.id} className="glass glass-hover rounded-xl p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm truncate">{food.name}</h3>
                        {food.type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 shrink-0">
                            {food.type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        {food.rating && (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {food.rating}
                          </span>
                        )}
                        {food.cost != null && <span>人均 ¥{String(food.cost).replace(/\.00$/, '')}</span>}
                      </div>
                      {food.address && (
                        <p className="text-xs text-gray-500 mt-1.5 truncate">{food.address}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        {food.tel && (
                          <a
                            href={`tel:${food.tel}`}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            {food.tel}
                          </a>
                        )}
                        {food.location && (
                          <a
                            href={amapNavUrl(food.name, food.location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            导航前往
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 返回修改 */}
            <div className="text-center">
              <button
                onClick={() => setFinalOutput('')}
                className="px-6 py-3 rounded-xl glass hover:bg-white/10 transition-all text-gray-300 flex items-center gap-2 mx-auto"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                返回修改需求
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
