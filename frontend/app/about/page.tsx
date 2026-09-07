'use client';

import {
  Mountain,
  Eye,
  Shield,
  Sparkles,
  Map,
  Cpu,
  Database,
  Cloud,
  Code,
  Layers,
  Target,
  Heart,
  Users,
  Mail,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';

const coreFeatures = [
  {
    icon: Eye,
    title: '看见河山',
    description: '720°全景漫游 + 多时段景观 + 1:1实景三维复刻 + 实时天气叠加 + 游客实拍墙 + VR沉浸模式',
    color: 'from-cyan-400 to-blue-500',
  },
  {
    icon: Shield,
    title: '避雷避坑',
    description: '智能避雷指数 + 跨平台真实评价聚合 + 宣传图vs实拍对比 + 时令适配推荐 + 避雷标签系统 + 真实度评分',
    color: 'from-amber-400 to-red-500',
  },
  {
    icon: Sparkles,
    title: '智能规划',
    description: '7大专业智能体协同（LangGraph 编排）+ 预算管控 + 质量评估反馈循环 + NLP 避雷分析',
    color: 'from-purple-400 to-pink-500',
  },
];

const techStack = [
  { icon: Code, name: 'Next.js 14', desc: 'React 框架 + 静态导出' },
  { icon: Layers, name: 'Tailwind CSS', desc: '原子化 CSS + Glassmorphism' },
  { icon: Cpu, name: 'FastAPI', desc: 'Python 异步后端框架' },
  { icon: Database, name: 'SQLite / PostgreSQL', desc: '关系数据库 + SQLAlchemy ORM' },
  { icon: Cloud, name: '高德地图 API', desc: '3D地图 + 路线规划 + 天气' },
  { icon: Map, name: 'LangGraph + DeepSeek', desc: '多 Agent 工作流编排引擎' },
];

const milestones = [
  { time: '2026.09', title: 'MVP 完成', desc: '"看见+避雷"核心体验上线：景区库 + 避雷指数 + 全景查看器 + 多 Agent 行程规划' },
  { time: '2026.09', title: '工程化加固', desc: '认证体系、上传服务、输入校验、密钥管理与数据一致性全面加固' },
  { time: '计划中', title: 'Phase 2 增强', desc: '跨平台评价自动聚合 + RAG 知识库 + 避雷分析自动化' },
  { time: '计划中', title: 'Phase 3 沉浸', desc: '真实全景素材接入 + 实景三维 + VR 模式 + WebXR' },
  { time: '计划中', title: 'Phase 4 壁垒', desc: '核心算法竞争力：遗传算法CSP + 分层TSP + 社区生态' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero 区域 */}
      <section className="pt-32 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm mb-6">
            <Mountain className="w-4 h-4" />
            慧行山海 · 让每一次旅行都不踩雷
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            出发前，先看见
            <span className="text-gradient-amber">真实的河山</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            不做信息聚合，做体验前置；不做纯推荐，做避雷导航。
            <br />
            帮你智能识别"这个地方到底值不值得去"
          </p>
        </div>
      </section>

      {/* 核心理念 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coreFeatures.map((feature, index) => (
            <div
              key={index}
              className="glass glass-hover rounded-2xl p-8 group"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 产品差异化 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="glass rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">与市面产品的核心区别</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white mb-1">vs 携程/飞猪/马蜂窝</h4>
                  <p className="text-sm text-gray-400">它们重交易（订票订酒店），我们不做交易，专注"规划体验"</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white mb-1">vs 小红书/抖音</h4>
                  <p className="text-sm text-gray-400">它们是碎片化种草/避雷信息，我们做结构化评估</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white mb-1">vs Google Earth</h4>
                  <p className="text-sm text-gray-400">它有3D地图但没有避雷系统，我们两者结合</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white mb-1">vs 传统旅游网站</h4>
                  <p className="text-sm text-gray-400">它们只有精修宣传图，我们提供真实全景+游客实拍+智能避雷指数</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 技术架构 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">技术栈</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {techStack.map((tech, index) => (
            <div
              key={index}
              className="glass glass-hover rounded-xl p-6 text-center group"
            >
              <tech.icon className="w-8 h-8 text-amber-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h4 className="font-semibold text-white text-sm mb-1">{tech.name}</h4>
              <p className="text-xs text-gray-500">{tech.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 七层架构 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="glass rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">七层架构设计</h2>
          <div className="space-y-3">
            {[
              { layer: '第1层', name: '展示层', desc: 'Next.js + Tailwind + React Three Fiber + 实景环视 + 高德地图', color: 'from-cyan-500 to-blue-500' },
              { layer: '第2层', name: '接入层', desc: 'FastAPI + JWT认证 + OAuth2.0 + 令牌桶限流 + API网关路由', color: 'from-blue-500 to-indigo-500' },
              { layer: '第3层', name: '编排层', desc: 'LangGraph状态机 + 意图路由 + 条件分支 + 并行执行 + 反馈循环', color: 'from-indigo-500 to-purple-500' },
              { layer: '第4层', name: 'Agent层', desc: '10大专业智能体：意图解析/目的地推荐/天气适配/景点推荐/行程规划/预算管控/地图路线/验证冲突/客服咨询/避雷分析', color: 'from-purple-500 to-pink-500' },
              { layer: '第5层', name: '算法层', desc: '避雷指数算法 + NLP 情感分析 + LangGraph 多Agent工作流 + 质量评估自动修订', color: 'from-pink-500 to-rose-500' },
              { layer: '第6层', name: '数据层', desc: 'PostgreSQL + pgvector + Redis缓存 + ChatMemory对话记忆 + RL经验库 + 对象存储', color: 'from-rose-500 to-orange-500' },
              { layer: '第7层', name: '外部服务层', desc: '通义千问DashScope + 高德地图API + MCP工具协议 + OpenMeteo天气 + 跨平台评价数据', color: 'from-orange-500 to-amber-500' },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
              >
                <div className={`w-20 h-10 rounded-lg bg-gradient-to-r ${item.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {item.layer}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white mb-1">{item.name}</h4>
                  <p className="text-sm text-gray-400 truncate">{item.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 发展历程 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">发展路线图</h2>
        <div className="relative">
          {/* 时间线 */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500 via-purple-500 to-cyan-500" />
          
          <div className="space-y-8">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex gap-6 pl-12 relative">
                {/* 节点 */}
                <div className="absolute left-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center border-4 border-dark-900">
                  <span className="text-xs font-bold text-white">{index + 1}</span>
                </div>
                
                <div className="glass rounded-2xl p-6 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-amber-400">{milestone.time}</span>
                    <h3 className="text-lg font-bold text-white">{milestone.title}</h3>
                  </div>
                  <p className="text-gray-400 text-sm">{milestone.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 团队/联系 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="glass rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Heart className="w-6 h-6 text-red-400" />
                关于我们
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                慧行山海是一个专注于中国旅游的智能规划平台。我们相信，每一次旅行都应该是美好的回忆，而不是踩雷的经历。
                通过智能技术和真实数据，我们帮助用户在出发前就能"看见"目的地的真实面貌，做出更明智的旅行决策。
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-300">
                  <Target className="w-5 h-5 text-amber-400" />
                  <span>使命：让每一次旅行都不踩雷</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span>愿景：成为最值得信赖的旅游决策平台</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-6">联系我们</h3>
              <div className="space-y-4">
                <a href="mailto:contact@huixing-shanhai.com" className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">邮箱</div>
                    <div className="text-white font-medium group-hover:text-amber-400 transition-colors">contact@huixing-shanhai.com</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="glass border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Mountain className="w-5 h-5 text-dark-900" />
              </div>
              <span className="text-lg font-bold text-gradient-amber">慧行山海</span>
            </div>
            <p className="text-sm text-gray-400">
              © 2026 慧行山海 · 专注中国旅游 · 智能行程规划
            </p>
            <div className="flex gap-4 text-sm text-gray-400">
              <Link href="/about" className="hover:text-amber-400 transition-colors">关于我们</Link>
              <Link href="/privacy" className="hover:text-amber-400 transition-colors">隐私政策</Link>
              <Link href="/terms" className="hover:text-amber-400 transition-colors">用户协议</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
