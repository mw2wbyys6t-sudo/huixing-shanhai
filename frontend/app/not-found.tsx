import Link from 'next/link';
import { Compass, ChevronRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-3xl p-12 max-w-lg w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-6">
          <Compass className="w-8 h-8 text-dark-900" />
        </div>
        <h1 className="text-5xl font-bold text-white mb-3">404</h1>
        <p className="text-gray-300 mb-2">这片山河还没有被探索过</p>
        <p className="text-sm text-gray-500 mb-8">你访问的页面不存在或已被移除</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-xl btn-amber font-semibold inline-flex items-center justify-center gap-2"
          >
            返回首页
          </Link>
          <Link
            href="/explore"
            className="w-full sm:w-auto px-6 py-3 rounded-xl glass hover:bg-white/10 transition-all text-gray-300 inline-flex items-center justify-center gap-2"
          >
            去探索景区
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
