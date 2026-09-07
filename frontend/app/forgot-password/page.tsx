'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Mountain,
  Eye,
  Shield,
  Sparkles,
  Phone,
  Lock,
  MessageSquare,
  EyeOff,
  KeyRound,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import ClayIcon from '@/components/ClayIcon';
import { authAPI } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'verify' | 'reset' | 'success'>('verify');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeTip, setCodeTip] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 组件卸载时清理倒计时
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  const handleVerify = async (e: React.FormEvent) => {
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

    // 验证码的真实校验在重置接口中完成，此步仅收集信息
    setStep('reset');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authAPI.resetPassword({
        phone: phone.trim(),
        code: code.trim(),
        new_password: newPassword,
      });
      if (result.success) {
        setStep('success');
      } else {
        setError(result.message || '重置失败，请稍后重试');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-radial-glow flex">
      {/* 左侧品牌展示区 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://commons.wikimedia.org/wiki/Special:FilePath/Huangshan_fengjing.jpg?width=1280)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-dark-900/80 to-cyan-900/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/60 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center">
              <ClayIcon name="mountain" size={48} alt="慧行山海 Logo" />
            </div>
            <span className="text-2xl font-bold text-gradient-amber">慧行山海</span>
          </Link>

          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              找回密码
              <br />
              <span className="text-gradient-amber">重新开启旅程</span>
            </h1>
            <p className="text-lg text-gray-300 max-w-md leading-relaxed">
              忘记密码不用担心，通过手机号验证即可快速重置密码，继续你的旅行规划。
            </p>

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

      {/* 右侧表单区 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center">
              <ClayIcon name="mountain" size={48} alt="慧行山海 Logo" />
            </div>
            <span className="text-2xl font-bold text-gradient-amber">慧行山海</span>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`flex items-center gap-2 ${step === 'verify' ? 'text-amber-400' : step === 'reset' || step === 'success' ? 'text-green-400' : 'text-gray-500'}`}>
              {step === 'verify' ? <MessageSquare className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              <span className="text-sm">验证身份</span>
            </div>
            <div className={`w-8 h-px ${step === 'reset' || step === 'success' ? 'bg-green-400' : 'bg-gray-600'}`} />
            <div className={`flex items-center gap-2 ${step === 'reset' ? 'text-amber-400' : step === 'success' ? 'text-green-400' : 'text-gray-500'}`}>
              {step === 'success' ? <CheckCircle className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              <span className="text-sm">重置密码</span>
            </div>
            <div className={`w-8 h-px ${step === 'success' ? 'bg-green-400' : 'bg-gray-600'}`} />
            <div className={`flex items-center gap-2 ${step === 'success' ? 'text-green-400' : 'text-gray-500'}`}>
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">完成</span>
            </div>
          </div>

          {/* 标题 */}
          <div className="text-center mb-8">
            {step === 'verify' && (
              <>
                <h2 className="text-3xl font-bold text-white mb-2">验证身份</h2>
                <p className="text-gray-400">输入手机号和验证码，验证你的身份</p>
              </>
            )}
            {step === 'reset' && (
              <>
                <h2 className="text-3xl font-bold text-white mb-2">重置密码</h2>
                <p className="text-gray-400">设置你的新密码</p>
              </>
            )}
            {step === 'success' && (
              <>
                <h2 className="text-3xl font-bold text-white mb-2">密码已重置</h2>
                <p className="text-gray-400">你可以使用新密码登录了</p>
              </>
            )}
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

          {/* 第一步：验证身份 */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">手机号</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    placeholder="请输入注册时的手机号"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="w-full pl-12 pr-4 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">验证码</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="请输入验证码"
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl btn-amber font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    下一步
                  </>
                )}
              </button>
            </form>
          )}

          {/* 第二步：重置密码 */}
          {step === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请设置新密码（至少6位）"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="请再次输入新密码"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 rounded-xl glass text-white placeholder-gray-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl btn-amber font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                    重置中...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    确认重置
                  </>
                )}
              </button>
            </form>
          )}

          {/* 第三步：成功 */}
          {step === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <p className="text-gray-300">
                密码已成功重置，请使用新密码登录你的账号。
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl btn-amber font-semibold"
              >
                去登录
              </Link>
            </div>
          )}

          {/* 底部链接 */}
          {step !== 'success' && (
            <div className="mt-6 text-center space-y-2">
              <div>
                <Link href="/login" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
                  想起密码了？去登录
                </Link>
              </div>
              <div>
                <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">
                  返回首页浏览
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
