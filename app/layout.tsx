import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "CreatorFlow · 书籍视频工坊",
  description: "把一本书变成可编辑的图文视频素材包"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
