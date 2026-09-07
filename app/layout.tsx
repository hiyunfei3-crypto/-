import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: '循环 ON REPEAT · 私人歌单',
 description: '543 首私人歌单，保留原编号与 SC 标记，按歌名、编号搜索并收藏喜欢的歌曲。',
 icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="zh-CN" className="dark"><body>{children}</body></html>;
}
