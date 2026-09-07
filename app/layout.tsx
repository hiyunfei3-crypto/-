import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: '循环 ON REPEAT · 私人歌单',
 description: '按心情发现歌单，搜索喜欢的歌曲和歌手，把音乐偏爱收进你的私人收藏。',
 icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
