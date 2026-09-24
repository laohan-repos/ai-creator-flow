import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const docs = path.join(root, "docs");
const required = ["CreatorFlow-需求文档.md", "设计稿"];
const screenshots = [
  "01-项目管理.png",
  "02-编辑项目.png",
  "03-模型配置.png",
  "04-素材库片头.png",
  "05-素材库音乐.png",
  "06-脚本生成.png",
  "07-分镜图片.png",
  "08-配音生成.png",
  "09-修改配音.png",
  "10-剪映草稿.png",
  "11-批量生产.png",
  "12-编辑图片与版本.png",
  "13-新建项目.png",
  "14-移动端新建项目.png",
];
const errors = [];

if (!existsSync(docs)) {
  errors.push("缺少 docs 目录");
} else {
  const actual = readdirSync(docs);
  for (const file of required) {
    if (!actual.includes(file)) errors.push(`缺少文件：docs/${file}`);
  }
  for (const file of actual) {
    if (!required.includes(file)) errors.push(`多余内容：docs/${file}`);
  }
}

const requirements = path.join(docs, required[0]);
if (existsSync(requirements)) {
  const content = readFileSync(requirements, "utf8");
  for (let index = 1; index <= 8; index++) {
    if (!content.includes(`| ${index}. `)) errors.push(`需求文档缺少模块 ${index}`);
  }
}

for (const file of required.filter(item => item.endsWith(".md"))) {
  const fullPath = path.join(docs, file);
  if (!existsSync(fullPath)) continue;
  const content = readFileSync(fullPath, "utf8");
  if (!content.trim()) errors.push(`文件为空：docs/${file}`);
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const localPath = target.split("#")[0];
    if (localPath && !existsSync(path.resolve(docs, localPath))) {
      errors.push(`无效文档链接：docs/${file} -> ${target}`);
    }
  }
}

const designDir = path.join(docs, "设计稿");
if (existsSync(designDir)) {
  const actual = readdirSync(designDir);
  for (const file of screenshots) {
    if (!actual.includes(file)) errors.push(`缺少设计图：docs/设计稿/${file}`);
  }
  for (const file of actual) {
    if (!screenshots.includes(file)) errors.push(`多余内容：docs/设计稿/${file}`);
  }
  for (const file of screenshots.filter(item => actual.includes(item))) {
    const header = readFileSync(path.join(designDir, file)).subarray(0, 8);
    if (!header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      errors.push(`文件不是有效的 PNG 图片：docs/设计稿/${file}`);
    }
  }
}

if (errors.length) {
  process.stderr.write(`文档检查失败：\n- ${errors.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write(`文档检查通过：八模块需求文档与 ${screenshots.length} 张页面设计图齐全。\n`);
