import { NextResponse } from "next/server";
import { getProjectVideo, saveProjectVideo } from "../../../../lib/projects";
import { probeMediaDuration } from "../../../../lib/media-duration";
import { mediaResponse } from "../../../../lib/http-media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const projectId = Number(form.get("projectId"));
  const kind = form.get("kind");
  const file = form.get("file");
  const browserDuration = Number(form.get("duration"));
  if (!projectId || (kind !== "intro" && kind !== "outro") || !(file instanceof File)) return NextResponse.json({ error: "上传参数不完整" }, { status: 400 });
  if (!file.type.startsWith("video/")) return NextResponse.json({ error: "只能上传视频文件" }, { status: 415 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "视频不能超过 100MB" }, { status: 413 });
  try {
    const duration = Number.isFinite(browserDuration) && browserDuration > 0
      ? browserDuration
      : await probeMediaDuration(new Uint8Array(await file.arrayBuffer()), file.name);
    await saveProjectVideo(projectId, kind, file, duration);
    return NextResponse.json({ videoUrl: `/api/projects/media?projectId=${projectId}&kind=${kind}&v=${Date.now()}`, duration });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? `无法读取视频时长：${error.message}` : "无法读取视频时长" }, { status: 422 });
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectId = Number(params.get("projectId"));
  const kind = params.get("kind");
  if (!projectId || (kind !== "intro" && kind !== "outro")) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const video = await getProjectVideo(projectId, kind);
  if (!video) return NextResponse.json({ error: "视频不存在" }, { status: 404 });
  return mediaResponse(request, video.content, video.mimeType, video.filename);
}
