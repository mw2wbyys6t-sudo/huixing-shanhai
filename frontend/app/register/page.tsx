'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mountain,
  Eye,
  Shield,
  Sparkles,
  Phone,
  Lock,
  User,
  MessageSquare,
  EyeOff,
  CheckCircle,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';
import ClayIcon from '@/components/ClayIcon';
import { authAPI, setAuth } from '@/lib/api';
import { mergePrefsOnLogin } from '@/lib/user-prefs';

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeTip, setCodeTip] = useState('');
  const [agreed, setAgreed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 组件卸载时清理倒计时
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    try {
      const result = await authAPI.sendCode(phone);
      setCodeTip(result.message.includes('演示模式') ? result.message : '验证码已发送');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone || phone.length !== 11) {
      setError('请输入正确的手机号');
      return;
    }
    if (!code) {
      setError('请输入验证码');
      return;
    }
    if (!username || username.length < 2) {
      setError('请输入至少2个字符的用户名');
      return;
    }
    if (!password || password.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (!agreed) {
      setError('请先阅读并同意用户协议和隐私政策');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authAPI.register({
        phone: phone.trim(),
        code: code.trim(),
        password,
        username: username.trim(),
      });
      setAuth(result.token, result.user);
      void mergePrefsOnLogin();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请稍后重试');
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: 'eye' as const,
      title: '看见河山',
      desc: '720°全景漫游，未出发先看见真实面貌',
    },
    {
      icon: 'warning' as const,
      title: '避雷避坑',
      desc: '智能避雷指数，一眼判断值不值得去',
    },
    {
      icon: 'sparkles' as const,
      title: '智能规划',
      desc: '10大智能体协同，生成专属行程方案',
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
              加入慧行山海
              <br />
              <span className="text-gradient-amber">开启你的旅程</span>
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

      {/* 右侧注册表单区 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center">
              <ClayIcon name="mountain" size={48} alt="慧行山海 Logo" />
            </div>
            <span className="text-2xl font-bold text-gradient-amber">慧行山海</span>
          </div>

          {/* 标题 */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">创建账号</h2>
            <p className="text-gray-400">加入慧行山海，开启你的智能旅行</p>
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

          {/* 注册表单 */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* 手机号 */}
            <div>
              <label htmlFor="reg-phone" className="block text-sm text-gray-300 mb-2">手机号</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="reg-phone"
                  type="tel"
                  placeholder="请输入手机号"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full pl-12 pr-4 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 验证码 */}
            <div>
              <label htmlFor="reg-code" className="block text-sm text-gray-300 mb-2">验证码</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="reg-code"
                    type="text"
                    placeholder="请输入验证码"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-12 pr-4 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={codeCountdown > 0}
                  className={`px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    codeCountdown > 0
                      ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                  }`}
                >
                  {codeCountdown > 0 ? `${codeCountdown}s` : '获取验证码'}
                </button>
              </div>
            </div>

            {/* 用户名 */}
            <div>
              <label htmlFor="reg-username" className="block text-sm text-gray-300 mb-2">用户名</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="reg-username"
                  type="text"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="reg-password" className="block text-sm text-gray-300 mb-2">密码</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请设置密码（至少6位）"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 确认密码 */}
            <div>
              <label htmlFor="reg-confirm" className="block text-sm text-gray-300 mb-2">确认密码</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="reg-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 用户协议 */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="agreement"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-600 bg-transparent text-amber-500 focus:ring-amber-500/20"
              />
              <label htmlFor="agreement" className="text-sm text-gray-400">
                我已阅读并同意
                <Link href="/terms" className="text-amber-400 hover:text-amber-300">《用户协议》</Link>
                和
                <Link href="/privacy" className="text-amber-400 hover:text-amber-300">《隐私政策》</Link>
              </label>
            </div>

            {/* 注册按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl btn-amber font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                  注册中...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  立即注册
                </>
              )}
            </button>
          </form>

          {/* 已有账号 */}
          <div className="mt-6 text-center">
            <span className="text-gray-400 text-sm">已有账号？</span>
            <Link href="/login" className="text-amber-400 hover:text-amber-300 text-sm font-medium ml-1">
              立即登录
            </Link>
          </div>

          {/* 返回首页 */}
          <div className="mt-4 text-center">
            <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">
              返回首页浏览
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
