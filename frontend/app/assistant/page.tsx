'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ClayIcon from '@/components/ClayIcon';
import {
  Send,
  MapPin,
  Calendar,
  Wallet,
  Users,
  Compass,
  AlertTriangle,
  ChevronRight,
  Plus,
  MessageSquare,
  Clock,
  Trash2,
} from 'lucide-react';
import { API_BASE_URL, getAuthUser } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'text' | 'itinerary' | 'avoid' | 'recommendation';
  data?: any;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const WELCOME_MESSAGE = '你好！我是慧行山海智能旅行助手，可以帮你：\n\n- 推荐目的地和景点\n- 规划详细行程和预算\n- 分析景区避雷指数\n- 提供时令旅游建议\n\n有什么可以帮你的吗？';

// 快捷问题
const quickQuestions = [
  { icon: MapPin, text: '推荐一个适合3天短途游的目的地', category: '推荐' },
  { icon: Calendar, text: '9月去九寨沟合适吗？有什么注意事项？', category: '时令' },
  { icon: Wallet, text: '带父母去云南5天，预算8000怎么安排？', category: '规划' },
  { icon: AlertTriangle, text: '三亚有哪些坑需要避开？', category: '避雷' },
];

const STORAGE_KEY = 'huixing_assistant_conversations';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function newWelcome(): Message {
  return {
    id: `welcome_${Date.now()}`,
    role: 'assistant',
    content: WELCOME_MESSAGE,
    timestamp: new Date().toISOString(),
    type: 'text',
  };
}

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const user = typeof window !== 'undefined' ? getAuthUser() : null;
  const displayName = user?.username || '我';

  // 初始化：从 localStorage 恢复对话
  useEffect(() => {
    const saved = loadConversations();
    if (saved.length > 0) {
      setConversations(saved);
      setCurrentConversationId(saved[0].id);
    } else {
      // 首次使用：创建一个欢迎对话
      const first: Conversation = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [newWelcome()],
        createdAt: new Date().toISOString(),
      };
      setConversations([first]);
      setCurrentConversationId(first.id);
    }
  }, []);

  // 对话变更时持久化（只保留最近 20 条，防止本地存储无限增长）
  useEffect(() => {
    if (conversations.length > 0) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 20)));
      } catch {
        // 存储失败不影响使用
      }
    }
  }, [conversations]);

  // 后端健康检查（在线状态真实反映连通性）
  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/`, { signal: AbortSignal.timeout(4000) });
        setBackendOnline(resp.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, []);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, isLoading]);

  const currentConversation = conversations.find((c) => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  // 发送消息（消息统一写入 conversations，保证切换对话不丢失）
  const handleSend = useCallback(
    async (content?: string) => {
      const messageContent = content || input;
      if (!messageContent.trim() || isLoading) return;

      const userMessage: Message = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: messageContent.trim(),
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      const convId = currentConversationId;
      // 在 updater 之外读取当前对话（updater 应为纯函数）
      const currentConv = conversations.find((c) => c.id === convId);
      const history = (currentConv?.messages || []).filter(
        (m) => m.id !== 'welcome' && !m.id.startsWith('welcome_')
      );
      const isFirstUserMessage = (currentConv?.messages || []).every((m) => m.role !== 'user');
      const nextTitle = isFirstUserMessage ? messageContent.slice(0, 20) : currentConv?.title || '新对话';

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === convId
            ? { ...conv, title: nextTitle, messages: [...conv.messages, userMessage] }
            : conv
        )
      );
      setInput('');
      setIsLoading(true);

      // 调用后端 API
      let responseContent = '';
      try {
        const apiResponse = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageContent,
            conversation_id: convId,
            history: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (apiResponse.ok) {
          const data = await apiResponse.json();
          responseContent = data.reply || '抱歉，我没有理解你的问题，请换一种方式描述。';
        } else {
          responseContent = 'AI服务暂时不可用，请稍后重试。';
        }
      } catch {
        responseContent = '网络连接失败，请确认后端服务已启动后再试。';
      }

      const assistantMessage: Message = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === convId ? { ...conv, messages: [...conv.messages, assistantMessage] } : conv
        )
      );
      setIsLoading(false);
    },
    [input, isLoading, currentConversationId, conversations]
  );

  // 新建对话
  const handleNewConversation = () => {
    const conv: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [newWelcome()],
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) => [conv, ...prev]);
    setCurrentConversationId(conv.id);
    setSidebarOpen(false);
  };

  // 删除对话（在 updater 之外决定后续选中项，避免渲染期副作用）
  const handleDeleteConversation = (id: string) => {
    const next = conversations.filter((c) => c.id !== id);
    if (next.length > 0) {
      setConversations(next);
      if (currentConversationId === id) {
        setCurrentConversationId(next[0].id);
      }
    } else {
      const fresh: Conversation = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [newWelcome()],
        createdAt: new Date().toISOString(),
      };
      setConversations([fresh]);
      setCurrentConversationId(fresh.id);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-radial-glow flex flex-col">
      <Header />

      <div className="flex-1 flex pt-16">
        {/* 移动端遮罩 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 侧边栏：桌面常驻，移动端抽屉 */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 lg:w-72 w-0'
          } fixed lg:relative z-40 lg:z-auto top-16 bottom-0 left-0 lg:top-auto lg:bottom-auto transition-all duration-300 overflow-hidden border-r border-white/10 bg-dark-900/95 lg:bg-transparent`}
        >
          <div className="w-72 h-full flex flex-col p-4">
            {/* 新建对话按钮 */}
            <button
              onClick={handleNewConversation}
              className="w-full py-3 px-4 rounded-xl btn-amber font-semibold flex items-center justify-center gap-2 mb-4"
            >
              <Plus className="w-5 h-5" />
              新建对话
            </button>

            {/* 历史对话 */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="text-xs text-gray-500 px-2 mb-2">历史对话</div>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCurrentConversationId(conv.id);
                      setSidebarOpen(false);
                    }
                  }}
                  className={`group flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all ${
                    currentConversationId === conv.id
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                  onClick={() => {
                    setCurrentConversationId(conv.id);
                    setSidebarOpen(false);
                  }}
                >
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{conv.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(conv.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    aria-label={`删除对话 ${conv.title}`}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* 快捷功能 */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-xs text-gray-500 px-2 mb-2">快捷功能</div>
              <Link
                href="/planner"
                className="flex items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all"
              >
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-300">行程规划</span>
                <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
              </Link>
              <Link
                href="/avoid"
                className="flex items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all"
              >
                <AlertTriangle className="w-4 h-4 text-coral-400" />
                <span className="text-sm text-gray-300">避雷指南</span>
                <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
              </Link>
              <Link
                href="/globe"
                className="flex items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all"
              >
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-300">3D 地球</span>
                <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
              </Link>
            </div>
          </div>
        </aside>

        {/* 主聊天区域 */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* 顶部栏 */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? '收起侧栏' : '展开侧栏'}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all lg:hidden"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden">
                  <ClayIcon name="sparkles" size={32} alt="智能助手" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">智能旅行助手</h1>
                  <p className="text-xs text-gray-500">DeepSeek 驱动 · 实时分析</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {backendOnline === null ? (
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                  检测中
                </span>
              ) : backendOnline ? (
                <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  在线
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  离线
                </span>
              )}
            </div>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* 头像 */}
                  <div className="flex-shrink-0">
                    {message.role === 'assistant' ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden">
                        <ClayIcon name="sparkles" size={40} alt="助手" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                        <Users className="w-5 h-5 text-dark-900" />
                      </div>
                    )}
                  </div>

                  {/* 消息内容 */}
                  <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {message.role === 'assistant' ? '智能助手' : displayName}
                      </span>
                      <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                    </div>
                    <div
                      className={`inline-block max-w-full p-4 rounded-2xl text-left ${
                        message.role === 'user'
                          ? 'bg-amber-500/20 border border-amber-500/30 text-white'
                          : 'glass text-gray-200'
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* 加载中 */}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                    <ClayIcon name="sparkles" size={40} alt="助手" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">智能助手</span>
                      <span className="text-xs text-gray-500">正在思考...</span>
                    </div>
                    <div className="glass p-4 rounded-2xl inline-block">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 快捷问题 */}
          {messages.filter((m) => m.role === 'user').length === 0 && !isLoading && (
            <div className="px-4 sm:px-6 pb-4">
              <div className="max-w-3xl mx-auto">
                <div className="text-sm text-gray-500 mb-3">试试这些问题：</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quickQuestions.map((q, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(q.text)}
                      className="glass glass-hover p-4 rounded-xl text-left flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <q.icon className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-amber-400 mb-1">{q.category}</div>
                        <div className="text-sm text-gray-300 group-hover:text-white transition-colors">
                          {q.text}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 输入框 */}
          <div className="px-4 sm:px-6 py-4 border-t border-white/10">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <label htmlFor="assistant-input" className="sr-only">输入你的问题</label>
                  <input
                    id="assistant-input"
                    type="text"
                    placeholder="输入你的问题，例如：推荐一个适合3天短途游的目的地..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      // 仅在非输入法组合状态下回车发送，避免拼音候选确认误发
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        handleSend();
                      }
                    }}
                    className="w-full px-5 py-4 rounded-2xl glass text-white placeholder-gray-500 focus:outline-none transition-all pr-12"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    aria-label="发送"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl btn-amber flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-center mt-3">
                智能助手生成的内容仅供参考，具体信息请以实际情况为准
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
