'use client';

import Link from 'next/link';
import { Mountain, Compass, Map, Users, Info, Menu, X, LogIn, Globe, LogOut, User , PenLine} from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ClayIcon from './ClayIcon';
import { getAuthUser, clearAuth, type SessionUser } from '@/lib/api';

const navItems = [
  { href: '/', label: '首页', icon: Mountain },
  { href: '/globe', label: '3D地球', icon: Globe },
  { href: '/explore', label: '探索发现', icon: Compass },
  { href: '/avoid', label: '避雷指南', icon: Map },
  { href: '/planner', label: '智能规划', icon: Users },
  { href: '/community', label: '游记社区', icon: PenLine },
  { href: '/about', label: '关于我们', icon: Info },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // 读取登录态（localStorage 只在客户端可用，挂载后读取避免水合不一致）
  useEffect(() => {
    setUser(getAuthUser());
  }, [pathname]);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    router.push('/');
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center">
              <ClayIcon name="mountain" size={36} alt="慧行山海 Logo" />
            </div>
            <span className="text-xl font-bold text-gradient-amber">慧行山海</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive(item.href)
                    ? 'text-amber-400 bg-white/10'
                    : 'text-gray-300 hover:text-amber-400 hover:bg-white/5'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}

            {/* 登录态：用户菜单 / 未登录：登录按钮 */}
            {user ? (
              <div className="relative ml-2">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-dark-900 text-sm font-bold">
                    {user.username?.[0] || 'U'}
                  </span>
                  <span className="text-sm text-white max-w-24 truncate">{user.username}</span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-44 rounded-xl glass border border-white/10 py-1.5 z-50 shadow-xl"
                    >
                      <div className="px-4 py-2 border-b border-white/5">
                        <p className="text-sm text-white font-medium truncate">{user.username}</p>
                        <p className="text-xs text-gray-500 truncate">{user.phone || user.email || '慧行山海用户'}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-red-400 hover:bg-white/5 transition-all"
                      >
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-dark-900 text-sm font-semibold hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
              >
                <LogIn className="w-4 h-4" />
                登录
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-white/5"
            aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive(item.href)
                    ? 'text-amber-400 bg-white/10'
                    : 'text-gray-300 hover:text-amber-400 hover:bg-white/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            {/* 移动端登录入口 */}
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm mt-2"
              >
                <User className="w-4 h-4" />
                {user.username}（点击退出登录）
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-dark-900 text-sm font-semibold mt-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="w-4 h-4" />
                登录 / 注册
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
