import { NextResponse } from "next/server";
import { getApiKey, getCapabilityConfig } from "../../../lib/model-config";
import { saveProject } from "../../../lib/projects";
import type { Project } from "../../../lib/types";
import { DEFAULT_SCRIPT_PROMPT } from "../../../lib/script-prompt";
import { getIntroTemplate } from "../../../lib/intros";
import { apiUrl } from "../../../lib/api-url";

const REQUIRED_OPENING_STRUCTURE = `

【不可覆盖的分镜结构】
s0：根据当前书籍内容生成一句简短的开场钩子。
s1：narration 必须逐字等于“今天我们分享的是”。
s2：narration 必须逐字等于“《当前书名》。”，其中当前书名替换为本次书名。
s3–s6：才可以讲作者、背景、情节、观点和情绪升华。
s1 不得出现年代、地点、人物或情节。s0、s1 使用片头视频，imagePrompt 必须为空；s2–s6 才需要独立 imagePrompt。`;

export async function POST(request: Request) {
  const input = await request.json() as { bookTitle?: string; promptTemplate?: string; introTemplateId?: number; backgroundMusicId?: number };
  const bookTitle = input.bookTitle?.trim();
  const intro = input.introTemplateId ? await getIntroTemplate(input.introTemplateId) : undefined;
  const backgroundMusic = input.backgroundMusicId ? await getIntroTemplate(input.backgroundMusicId) : undefined;
  if (!intro) return NextResponse.json({ error: "请先在第一步选择片头" }, { status: 400 });
  if (intro.duration < 2.3) return NextResponse.json({ error: `片头只有 ${intro.duration.toFixed(2)} 秒，无法完整容纳 s0、s1；请选择至少 2.3 秒的片头` }, { status: 400 });
  if (input.backgroundMusicId && backgroundMusic?.kind !== "bgm") return NextResponse.json({ error: "所选背景音乐不存在，请重新选择" }, { status: 400 });

  const config = await getCapabilityConfig("multimodal");
  const baseUrl = config.baseUrl;
  const apiKey = await getApiKey("multimodal");
  const model = config.model;
  if (!baseUrl || !apiKey || !model) {
    return NextResponse.json({ error: "请先在模型配置中保存 Token Plan Key、Base URL 和多模态模型。" }, { status: 412 });
  }

  const prompt = `${(input.promptTemplate?.trim() || DEFAULT_SCRIPT_PROMPT).replace(/{{bookTitle}}/g, bookTitle || "未指定，由你选一本适合解读的书")}${REQUIRED_OPENING_STRUCTURE}\n所选片头真实时长为 ${intro.duration.toFixed(3)} 秒，s0 必须足够简短，使 s0、s1 的口播可以完整容纳在该片头内。s2 是片头之后的独立书名分镜。整条视频目标为 26 秒。`;
  try {
    const response = await fetch(apiUrl(baseUrl, "/chat/completions"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "user", content: prompt }], ...(config.provider === "minimax" ? {} : { response_format: { type: "json_object" } }) })
    });
    if (!response.ok) throw new Error(`模型请求失败 (${response.status})`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = (data.choices?.[0]?.message?.content || "{}").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const parsed = JSON.parse(content) as Omit<Project, "scenes"> & { scenes?: Omit<Project["scenes"][number], "id">[] };
    if (parsed.scenes?.length !== 7) throw new Error(`模型必须返回 s0–s6 共 7 个独立分镜，当前返回 ${parsed.scenes?.length || 0} 个`);
    parsed.scenes.forEach((scene, index) => {
      if (!scene.narration?.trim()) throw new Error(`s${index} 缺少独立口播`);
      if (index >= 2 && !scene.imagePrompt?.trim()) throw new Error(`s${index} 缺少匹配画面的配图提示词`);
    });
    const resolvedBookTitle = (bookTitle || parsed.bookTitle || "书名待核实").trim().replace(/^《/, "").replace(/》[。.]?$/, "");
    const scenes = parsed.scenes.map((scene, index) => ({ ...scene, heading: scene.heading?.trim() || `s${index}`, id: `scene-${String(index + 1).padStart(2, "0")}`, speed: Number(scene.speed) || 1, duration: Number(scene.duration) || 1 }));
    const s2Narration = `《${resolvedBookTitle}》。`;
    const spokenLength = (value: string) => Math.max(1, value.replace(/[\s，。！？、；：“”‘’《》,.!?;:'"-]/g, "").length);
    const openingWeights = [spokenLength(scenes[0].narration), spokenLength("今天我们分享的是") / 1.2];
    const totalOpeningWeight = openingWeights.reduce((sum, value) => sum + value, 0);
    const s1Duration = Number(Math.min(intro.duration - 0.8, Math.max(1, intro.duration * openingWeights[1] / totalOpeningWeight)).toFixed(3));
    const s0Duration = Number((intro.duration - s1Duration).toFixed(3));
    const s2Duration = Math.max(0.8, Number(scenes[2].duration) || 1);
    const bodyBudget = Math.max(4, 26 - intro.duration - s2Duration);
    const modelBodyDuration = scenes.slice(3).reduce((sum, scene) => sum + Math.max(0.1, Number(scene.duration) || 0), 0);
    for (let index = 3; index < scenes.length; index += 1) scenes[index].duration = Number((bodyBudget * Math.max(0.1, Number(scenes[index].duration) || 0) / modelBodyDuration).toFixed(2));
    scenes[0] = { ...scenes[0], heading: "开场钩子", speed: 1, duration: s0Duration, imagePrompt: "" };
    scenes[1] = {
      ...scenes[1],
      heading: "引出书籍",
      narration: "今天我们分享的是",
      speed: 1.2,
      duration: s1Duration,
      imagePrompt: "",
    };
    scenes[2] = {
      ...scenes[2],
      heading: "书名揭示",
      narration: s2Narration,
      speed: 1,
      duration: s2Duration,
      imagePrompt: `${parsed.scenes[2].imagePrompt.trim()}；画面必须围绕《${resolvedBookTitle}》最具代表性的核心意象，不出现文字、书名、Logo或水印。`,
    };
    const project = { ...parsed, bookTitle: resolvedBookTitle, introTemplateId: intro.id, introTemplateName: intro.name, introVideoUrl: `/api/intros?id=${intro.id}`, introVideoDuration: intro.duration, backgroundMusicId: backgroundMusic?.id, backgroundMusicName: backgroundMusic?.name, backgroundMusicDuration: backgroundMusic?.duration, backgroundMusicUrl: backgroundMusic ? `/api/intros?id=${backgroundMusic.id}` : undefined, scenes } as Project;
    return NextResponse.json({ project: await saveProject(project, input.promptTemplate || DEFAULT_SCRIPT_PROMPT), mode: "ai" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "生成失败" }, { status: 502 });
  }
}
