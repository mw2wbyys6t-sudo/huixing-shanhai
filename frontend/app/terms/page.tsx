import Link from 'next/link';
import { FileText, ChevronLeft } from 'lucide-react';

export const metadata = {
  title: '用户协议 - 慧行山海',
  description: '慧行山海平台用户服务协议：使用本平台前请仔细阅读。',
};

const sections = [
  {
    title: '一、服务说明',
    items: [
      '慧行山海是基于 AI 与电子地图的一站式旅游规划导览平台，提供景区信息浏览、避雷分析、智能行程规划等服务。',
      '平台展示的景区信息、避雷指数与 AI 生成内容仅供参考，实际出行请以景区官方与实时信息为准。',
    ],
  },
  {
    title: '二、账号规范',
    items: [
      '注册时请提供真实有效的手机号，并对账号下的所有操作负责。',
      '不得利用本平台发布虚假评价、违法违规内容，或以任何方式干扰平台正常运行。',
      '请妥善保管账号密码，因保管不善造成的损失由用户自行承担。',
    ],
  },
  {
    title: '三、用户内容',
    items: [
      '你上传的实拍照片与评价应为你原创或已获得授权，不得侵犯他人合法权益。',
      '为保障内容真实可信，平台有权对违规内容进行隐藏或删除处理。',
    ],
  },
  {
    title: '四、免责声明',
    items: [
      'AI 生成的行程规划与避雷分析基于公开信息推断，可能存在偏差，不构成任何形式的出行担保。',
      '因不可抗力（天气、灾害、景区临时关闭等）造成的损失，平台不承担责任。',
      '出行前请务必核实门票、开放时间等关键信息。',
    ],
  },
  {
    title: '五、协议变更',
    items: [
      '本协议可能随产品迭代更新，继续使用即视为接受更新后的协议。',
      '本协议最后更新日期：2026年9月6日。',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <div className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors mb-6 text-sm">
          <ChevronLeft className="w-4 h-4" />
          返回首页
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">用户协议</h1>
        </div>
        <p className="text-gray-400 mb-8">使用慧行山海前，请仔细阅读并理解本协议。</p>

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
