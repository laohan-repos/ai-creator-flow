import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const docs = path.join(root, "docs");
const required = ["CreatorFlow-需求文档.md", "CreatorFlow-设计稿.md"];
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

for (const file of required) {
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

if (errors.length) {
  process.stderr.write(`文档检查失败：\n- ${errors.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write("文档检查通过：docs 仅包含八模块需求文档与设计稿。\n");
