'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mountain,
  Eye,
  Shield,
  Sparkles,
  Mail,
  Lock,
  Phone,
  MessageSquare,
  EyeOff,
  CheckCircle,
  LogIn,
  UserPlus,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import ClayIcon from '@/components/ClayIcon';
import { authAPI, setAuth } from '@/lib/api';
import { mergePrefsOnLogin } from '@/lib/user-prefs';

export default function LoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<'password' | 'code'>('password');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeTip, setCodeTip] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 组件卸载时清理倒计时
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCodeCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCodeCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    if (!phone || phone.length !== 11) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    try {
      const result = await authAPI.sendCode(phone);
      // 演示模式：后端把验证码拼在 message 里返回，方便体验
      setCodeTip(result.message.includes('演示模式') ? result.message : '验证码已发送');
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (loginType === 'password') {
      if (!account || !password) {
        setError('请输入账号和密码');
        return;
      }
    } else {
      if (!phone || !code) {
        setError('请输入手机号和验证码');
        return;
      }
    }

    setIsLoading(true);

    try {
      const result =
        loginType === 'password'
          ? await authAPI.login(account.trim(), password)
          : await authAPI.loginByCode(phone.trim(), code.trim());

      setAuth(result.token, result.user);
      // 登录后同步云端偏好（心愿单/足迹与本地合并）
      void mergePrefsOnLogin();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试');
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: 'eye' as const,
      title: '看见河山',
      desc: '720°全景漫游，未出发先看见真实面貌',
      color: 'from-cyan-400 to-blue-500',
    },
    {
      icon: 'warning' as const,
      title: '避雷避坑',
      desc: '智能避雷指数，一眼判断值不值得去',
      color: 'from-amber-400 to-red-500',
    },
    {
      icon: 'sparkles' as const,
      title: '智能规划',
      desc: '10大智能体协同，生成专属行程方案',
      color: 'from-purple-400 to-pink-500',
    },
  ];

  return (
    <div className="min-h-screen bg-radial-glow flex">
      {/* 左侧品牌展示区 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* 背景图 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://commons.wikimedia.org/wiki/Special:FilePath/Huangshan_fengjing.jpg?width=1280)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-dark-900/80 to-cyan-900/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/60 via-transparent to-transparent" />

        {/* 内容 */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center">
              <ClayIcon name="mountain" size={48} alt="慧行山海 Logo" />
            </div>
            <span className="text-2xl font-bold text-gradient-amber">慧行山海</span>
          </Link>

          {/* 标语 */}
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              出发前，先看见
              <br />
              <span className="text-gradient-amber">真实的河山</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-md leading-relaxed">
              不做信息聚合，做体验前置；不做纯推荐，做避雷导航。
              帮你智能识别"这个地方到底值不值得去"。
            </p>

            {/* 特色功能 */}
            <div className="space-y-4 pt-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-4 p-4 rounded-xl ${index === 0 ? 'glass-cyan' : index === 1 ? 'glass-coral' : 'glass-purple'}`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                    <ClayIcon name={feature.icon} size={38} alt={feature.title} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-gray-400">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部统计 */}
          <div className="flex items-center gap-8 text-sm">
            <div>
              <div className="text-2xl font-bold text-amber-400">20+</div>
              <div className="text-gray-400">精选景区</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="text-2xl font-bold text-cyan-400">720°</div>
              <div className="text-gray-400">全景漫游</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="text-2xl font-bold text-purple-400">10大</div>
              <div className="text-gray-400">智能规划</div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧登录表单区 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center">
              <ClayIcon name="mountain" size={48} alt="慧行山海 Logo" />
            </div>
            <span className="text-2xl font-bold text-gradient-amber">慧行山海</span>
          </div>

          {/* 登录卡片 */}
          <div className="glass rounded-3xl p-8 sm:p-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">欢迎回来</h2>
              <p className="text-gray-400 text-sm">登录慧行山海，开启你的智能旅行</p>
            </div>

            {/* 登录类型切换 */}
            <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
              <button
                onClick={() => setLoginType('password')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  loginType === 'password'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                账号密码登录
              </button>
              <button
                onClick={() => setLoginType('code')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  loginType === 'code'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                验证码登录
              </button>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            {/* 验证码发送提示 */}
            {codeTip && !error && (
              <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="text-sm text-cyan-300">{codeTip}</span>
              </div>
            )}

            {/* 登录表单 */}
            <form onSubmit={handleLogin} className="space-y-4">
              {loginType === 'password' ? (
                <>
                  {/* 账号输入 */}
                  <div>
                    <label htmlFor="login-account" className="block text-sm text-gray-400 mb-2">账号</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="login-account"
                        type="text"
                        value={account}
                        onChange={(e) => setAccount(e.target.value)}
                        placeholder="请输入手机号/邮箱/用户名"
                        autoComplete="username"
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* 密码输入 */}
                  <div>
                    <label htmlFor="login-password" className="block text-sm text-gray-400 mb-2">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* 忘记密码 */}
                  <div className="flex items-center justify-end">
                    <Link href="/forgot-password" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
                      忘记密码？
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  {/* 手机号输入 */}
                  <div>
                    <label htmlFor="login-phone" className="block text-sm text-gray-400 mb-2">手机号</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="login-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="请输入手机号"
                        autoComplete="tel"
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* 验证码输入 */}
                  <div>
                    <label htmlFor="login-code" className="block text-sm text-gray-400 mb-2">验证码</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          id="login-code"
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="请输入6位验证码"
                          autoComplete="one-time-code"
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={sendCode}
                        disabled={codeCountdown > 0}
                        className={`px-5 py-3.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                          codeCountdown > 0
                            ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500'
                        }`}
                      >
                        {codeCountdown > 0 ? `${codeCountdown}s 后重发` : '获取验证码'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    登 录
                  </>
                )}
              </button>
            </form>

            {/* 分割线 */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-500">其他登录方式</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* 第三方登录（暂未开放） */}
            <div className="flex justify-center gap-4">
              <button type="button" disabled title="微信登录（即将开放）" className="w-12 h-12 rounded-xl glass flex items-center justify-center group opacity-50 cursor-not-allowed">
                <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                </svg>
              </button>
              <button type="button" disabled title="支付宝登录（即将开放）" className="w-12 h-12 rounded-xl glass flex items-center justify-center group opacity-50 cursor-not-allowed">
                <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.422 20.787c-.551 1.033-1.792 1.717-3.172 1.717H6.75c-2.169 0-3.938-1.769-3.938-3.938V5.438c0-2.169 1.769-3.938 3.938-3.938h10.5c2.169 0 3.938 1.769 3.938 3.938v13.13c0 .48-.087.942-.247 1.375l-.002.006c-.04.108-.085.213-.135.316l-.001.002c-.155.31-.356.595-.595.843l-.002.002c-.078.079-.16.153-.247.223l-.002.001c-.094.075-.192.144-.294.207l-.003.002c-.115.07-.235.131-.36.182l-.005.002c-.132.054-.269.097-.41.128l-.006.001c-.147.032-.298.049-.45.049h-.002zM12 6.563c-2.983 0-5.438 2.16-5.438 4.844 0 1.71.948 3.227 2.422 4.18l-.797 2.39h1.594l.563-1.688c.53.14 1.094.22 1.656.22 2.983 0 5.438-2.16 5.438-4.844S14.983 6.563 12 6.563zm-2.438 4.844c0-.47.39-.844.875-.844s.875.374.875.844-.39.844-.875.844-.875-.374-.875-.844zm4.875 0c0-.47.39-.844.875-.844s.875.374.875.844-.39.844-.875.844-.875-.374-.875-.844z"/>
                </svg>
              </button>
              <button type="button" disabled title="QQ登录（即将开放）" className="w-12 h-12 rounded-xl glass flex items-center justify-center group opacity-50 cursor-not-allowed">
                <svg className="w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.527 5.947 16.423 2 12 2S4.473 5.947 4.473 9.24c0 .274.013.804.014.836l-1.08 2.695a39.547 39.547 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6-.18 7.14-.389 7.483-.189.078-.132.133-.458-.301-.778-.482-.356-1.233-.647-1.845-.835 1.638-1.384 2.394-3.302 2.394-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.582-1.39-.438-4.673z"/>
                </svg>
              </button>
            </div>

            {/* 注册链接 */}
            <div className="text-center mt-8">
              <span className="text-sm text-gray-400">还没有账号？</span>
              <Link href="/register" className="text-sm text-amber-400 hover:text-amber-300 font-medium ml-1 inline-flex items-center gap-1">
                立即注册
                <UserPlus className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* 服务条款 */}
          <p className="text-center text-xs text-gray-500 mt-6">
            登录即表示同意
            <Link href="/terms" className="text-gray-400 hover:text-amber-400 mx-1">《用户协议》</Link>
            和
            <Link href="/privacy" className="text-gray-400 hover:text-amber-400 mx-1">《隐私政策》</Link>
          </p>

          {/* 返回首页 */}
          <div className="text-center mt-4">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1">
              <KeyRound className="w-4 h-4" />
              返回首页浏览
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
