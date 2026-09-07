import Link from 'next/link';
import { Shield, ChevronLeft } from 'lucide-react';

export const metadata = {
  title: '隐私政策 - 慧行山海',
  description: '慧行山海平台隐私政策：我们如何收集、使用和保护你的个人信息。',
};

const sections = [
  {
    title: '一、我们收集的信息',
    items: [
      '账号信息：注册时提供的手机号、用户名、密码（密码经单向加密后存储，任何人无法查看明文）。',
      '使用数据：你浏览景区、使用行程规划与智能助手时产生的匿名化访问统计。',
      '上传内容：你主动发布的实拍照片与评价内容。',
    ],
  },
  {
    title: '二、信息的使用方式',
    items: [
      '为你提供景区推荐、行程规划、避雷分析等核心功能。',
      '改进产品体验：分析匿名化的使用统计以优化服务。',
      '不会将你的个人信息出售、共享给任何第三方用于广告目的。',
    ],
  },
  {
    title: '三、信息的存储与安全',
    items: [
      '所有数据传输均通过加密通道进行。',
      '密码采用 PBKDF2 单向哈希算法加盐存储，即使数据库泄露也无法还原明文。',
      '上传的照片仅用于景区实拍墙展示，你可以随时要求删除。',
    ],
  },
  {
    title: '四、你的权利',
    items: [
      '随时查看、更正你的账号信息。',
      '删除账号及关联数据（请联系平台支持）。',
      '退出登录后，本地设备上的登录凭证将被立即清除。',
    ],
  },
  {
    title: '五、政策更新',
    items: [
      '本政策可能随产品迭代更新，重大变更将通过站内公告通知。',
      '本政策最后更新日期：2026年9月6日。',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <div className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors mb-6 text-sm">
          <ChevronLeft className="w-4 h-4" />
          返回首页
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">隐私政策</h1>
        </div>
        <p className="text-gray-400 mb-8">你的信任对我们很重要。本政策说明我们如何处理你的个人信息。</p>

        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="glass rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">{section.title}</h2>
              <ul className="space-y-2.5">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300 leading-relaxed">
                    <span className="text-amber-400 mt-0.5">·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
