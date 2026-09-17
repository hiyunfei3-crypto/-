import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: '点歌单',
  description: '虚拟主播点歌单：支持搜索、分类、收藏，一键复制歌名到直播间。',
 icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
