import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "CreatorFlow · 学员项目",
  description: "使用 Codex 构建书籍解说生产工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

