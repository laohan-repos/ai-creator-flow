import { NextResponse } from "next/server";
import { getProject } from "../../../../lib/projects";
import { mediaResponse } from "../../../../lib/http-media";

export const runtime = "nodejs";

function dataUri(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) return undefined;
  return { mimeType: match[1], content: new Uint8Array(Buffer.from(match[2], "base64")) };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectId = Number(params.get("projectId"));
  const sceneIndex = Number(params.get("scene"));
  const kind = params.get("kind");
  if (!projectId || !Number.isInteger(sceneIndex) || sceneIndex < 0 || (kind !== "image" && kind !== "audio")) return NextResponse.json({ error: "素材参数错误" }, { status: 400 });
  const project = await getProject(projectId);
  const scene = project?.scenes[sceneIndex];
  const source = kind === "image" ? scene?.imageUrl : scene?.audioUrl;
  if (!source) return NextResponse.json({ error: "素材不存在" }, { status: 404 });
  const embedded = dataUri(source);
  if (embedded) return mediaResponse(request, embedded.content, embedded.mimeType, `${kind}-${sceneIndex + 1}.${kind === "image" ? "png" : "mp3"}`);
  if (!/^https?:\/\//.test(source)) return NextResponse.json({ error: "素材地址不可用" }, { status: 502 });
  try {
    const response = await fetch(source, { headers: request.headers.get("range") ? { Range: request.headers.get("range")! } : {}, signal: AbortSignal.timeout(120000) });
    if (!response.ok) return NextResponse.json({ error: `上游素材读取失败 (${response.status})` }, { status: 502 });
    const headers = new Headers();
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) { const value = response.headers.get(key); if (value) headers.set(key, value); }
    headers.set("Cache-Control", "private, max-age=3600");
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "素材读取失败" }, { status: 502 });
  }
}
