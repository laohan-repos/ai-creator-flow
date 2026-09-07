import { NextResponse } from "next/server";
import { deleteIntroTemplate, getIntroTemplate, listIntroTemplates, saveIntroTemplate, saveSeedanceTemplate, setDefaultIntro, updateSeedanceTemplate } from "../../../lib/intros";
import { probeMediaDuration } from "../../../lib/media-duration";
import { mediaResponse } from "../../../lib/http-media";
import { getApiKey, getCapabilityConfig } from "../../../lib/model-config";
import { apiUrl } from "../../../lib/api-url";

export const runtime = "nodejs";

function assetKind(value: unknown): "intro" | "outro" | "bgm" {
  return value === "outro" || value === "bgm" ? value : "intro";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const kind = assetKind(url.searchParams.get("kind"));
  if (!id) return NextResponse.json({ intros: await listIntroTemplates(kind) });
  const intro = await getIntroTemplate(id);
  if (!intro) return NextResponse.json({ error: "片头不存在" }, { status: 404 });
  if (!intro.content.length) return NextResponse.json({ error: "Seedance 视频仍在生成中" }, { status: 409 });
  return mediaResponse(request, intro.content, intro.mimeType, intro.filename);
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json() as { name?: string; kind?: "intro" | "outro"; prompt?: string; duration?: number };
    const kind = assetKind(body.kind) === "outro" ? "outro" : "intro";
    const prompt = body.prompt?.trim();
    const duration = Math.min(12, Math.max(2, Math.round(Number(body.duration) || 5)));
    if (!prompt) return NextResponse.json({ error: "请输入 Seedance 视频提示词" }, { status: 400 });
    const config = await getCapabilityConfig("video");
    const apiKey = await getApiKey("video");
    if (!config.baseUrl || !config.model || !apiKey) return NextResponse.json({ error: "请先配置 Seedance 视频模型" }, { status: 412 });
    try {
      const response = await fetch(apiUrl(config.baseUrl, "/contents/generations/tasks"), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: config.model, content: [{ type: "text", text: prompt }], ratio: "9:16", duration, resolution: "720p", watermark: false, generate_audio: false }) });
      const data = await response.json() as { id?: string; error?: { message?: string } };
      if (!response.ok || !data.id) throw new Error(data.error?.message || `Seedance 请求失败（HTTP ${response.status}）`);
      const id = await saveSeedanceTemplate(body.name?.trim() || `${kind === "intro" ? "片头" : "片尾"} ${new Date().toLocaleDateString("zh-CN")}`, kind, prompt, data.id, duration);
      return NextResponse.json({ id, taskId: data.id, intros: await listIntroTemplates(kind) });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Seedance 任务创建失败" }, { status: 502 }); }
  }
  const form = await request.formData();
  const file = form.get("file");
  const kind = assetKind(form.get("kind"));
  const label = kind === "intro" ? "片头" : kind === "bgm" ? "背景音乐" : "片尾";
  if (!(file instanceof File)) return NextResponse.json({ error: `请选择${label}${kind === "bgm" ? "文件" : "视频"}` }, { status: 400 });
  const name = String(form.get("name") || "").trim() || file.name.replace(/\.[^.]+$/, "") || `未命名${label}`;
  if (kind === "bgm" ? !file.type.startsWith("audio/") : !file.type.startsWith("video/")) return NextResponse.json({ error: `只能上传${kind === "bgm" ? "音频" : "视频"}文件` }, { status: 415 });
  const sizeLimit = kind === "bgm" ? 30 : 100;
  if (file.size > sizeLimit * 1024 * 1024) return NextResponse.json({ error: `${label}不能超过 ${sizeLimit}MB` }, { status: 413 });
  try {
    const duration = await probeMediaDuration(new Uint8Array(await file.arrayBuffer()), file.name);
    const id = await saveIntroTemplate(name, file, duration, kind);
    return NextResponse.json({ id, duration, intros: await listIntroTemplates(kind) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : `${label}上传失败` }, { status: 422 });
  }
}

export async function PATCH(request: Request) {
  const { id, action } = await request.json() as { id?: number; action?: "refresh" };
  if (!id) return NextResponse.json({ error: "缺少片头 ID" }, { status: 400 });
  if (action === "refresh") {
    const template = await getIntroTemplate(id);
    if (!template?.taskId) return NextResponse.json({ error: "该素材不是 Seedance 任务" }, { status: 400 });
    const config = await getCapabilityConfig("video");
    const apiKey = await getApiKey("video");
    if (!config.baseUrl || !apiKey) return NextResponse.json({ error: "请先配置 Seedance 视频模型" }, { status: 412 });
    try {
      const response = await fetch(apiUrl(config.baseUrl, `/contents/generations/tasks/${template.taskId}`), { headers: { Authorization: `Bearer ${apiKey}` } });
      const data = await response.json() as { status?: string; content?: { video_url?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || `任务查询失败（HTTP ${response.status}）`);
      if (data.status === "succeeded" && data.content?.video_url) {
        const videoResponse = await fetch(data.content.video_url);
        if (!videoResponse.ok) throw new Error("生成成功，但视频下载失败");
        const content = new Uint8Array(await videoResponse.arrayBuffer());
        const duration = await probeMediaDuration(content, `seedance-${id}.mp4`);
        await updateSeedanceTemplate(id, "ready", { content, duration });
      } else await updateSeedanceTemplate(id, data.status === "failed" || data.status === "expired" || data.status === "cancelled" ? "failed" : data.status === "running" ? "running" : "queued");
      return NextResponse.json({ status: data.status, intros: await listIntroTemplates(template.kind) });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "任务查询失败" }, { status: 502 }); }
  }
  try { await setDefaultIntro(id); return NextResponse.json({ intros: await listIntroTemplates() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "设置失败" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "缺少片头 ID" }, { status: 400 });
  try { const detachedProjects = await deleteIntroTemplate(id); return NextResponse.json({ intros: await listIntroTemplates(), detachedProjects }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 409 }); }
}
