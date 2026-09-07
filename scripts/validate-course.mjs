import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "AGENTS.md",
  "docs/CreatorFlow-需求文档.md",
  "docs/course/README.md",
  "docs/course/environment-setup.md",
  "docs/course/architecture.md",
  "docs/course/design-spec.md",
  "docs/course/api-contracts.md",
  "docs/course/acceptance-checklist.md",
  "docs/course/instructor-guide.md",
  ...Array.from({ length: 8 }, (_, index) => `docs/course/tasks/${String(index + 1).padStart(2, "0")}-${[
    "project-shell",
    "project-storage",
    "model-config",
    "script-generation",
    "image-generation",
    "voice-generation",
    "assets",
    "draft-and-batch",
  ][index]}.md`),
  "docs/course/examples/sample-script.json",
  "docs/course/examples/assets/README.md",
  "docs/course/screenshots/README.md",
  "starter-template/package.json",
  "starter-template/app/page.tsx",
  "starter-template/app/create/page.tsx",
  "starter-template/app/assets/page.tsx",
];

const errors = [];
for (const file of required) if (!existsSync(path.join(root, file))) errors.push(`缺少文件：${file}`);

const samplePath = path.join(root, "docs/course/examples/sample-script.json");
if (existsSync(samplePath)) {
  try {
    const sample = JSON.parse(readFileSync(samplePath, "utf8"));
    if (!Array.isArray(sample.scenes) || sample.scenes.length !== 7) errors.push("示例脚本必须正好包含 7 个分镜");
    if (sample.scenes?.[1]?.narration !== "今天我们分享的是") errors.push("示例脚本 s1 固定口播错误");
    if (sample.scenes?.[2]?.narration !== `《${sample.bookTitle}》。`) errors.push("示例脚本 s2 固定口播错误");
    if (sample.scenes?.slice(0, 2).some(scene => scene.imagePrompt !== "")) errors.push("示例脚本 s0、s1 图片提示词必须为空");
    if (sample.scenes?.slice(2).some(scene => !scene.imagePrompt?.trim())) errors.push("示例脚本 s2–s6 图片提示词不能为空");
  } catch (error) {
    errors.push(`示例脚本 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`);
  }
}

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(item) : entry.name.endsWith(".md") ? [item] : [];
  });
}

for (const file of markdownFiles(path.join(root, "docs/course"))) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (/^(https?:|mailto:|#)/.test(target) || target.includes("{{")) continue;
    const cleanTarget = target.split("#")[0];
    if (cleanTarget && !existsSync(path.resolve(path.dirname(file), cleanTarget))) {
      errors.push(`无效文档链接：${path.relative(root, file)} -> ${target}`);
    }
  }
}

if (errors.length) {
  process.stderr.write(`课程资料检查失败：\n- ${errors.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write(`课程资料检查通过：${required.length} 个必需文件，示例脚本与内部链接有效。\n`);
