import { NextResponse } from "next/server";
import { createJianyingDraft } from "../../../../lib/jianying";
import { deleteDraftVersion, getDraftVersions, setActiveDraftVersion } from "../../../../lib/projects";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const { projectId, draftPrompt } = await request.json() as { projectId?: number; draftPrompt?: string };
  if (!projectId) return NextResponse.json({ error: "缺少书籍解说 ID" }, { status: 400 });
  const requestUrl = new URL(request.url);
  const localMediaBase = `http://127.0.0.1:${requestUrl.port || "3000"}`;
  try {
    const draftUrl = await createJianyingDraft(projectId, draftPrompt, localMediaBase);
    return NextResponse.json({ draftUrl, draftVersions: await getDraftVersions(projectId) });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "草稿生成失败" }, { status: 502 }); }
}

export async function PATCH(request: Request) {
  const { projectId, versionId } = await request.json() as { projectId?: number; versionId?: number };
  if (!projectId || !versionId) return NextResponse.json({ error: "缺少书籍解说或版本 ID" }, { status: 400 });
  const version = await setActiveDraftVersion(projectId, versionId);
  if (!version) return NextResponse.json({ error: "草稿版本不存在" }, { status: 404 });
  return NextResponse.json({ draftUrl: version.draftUrl, draftPrompt: version.draftPrompt, draftVersions: await getDraftVersions(projectId) });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = Number(searchParams.get("projectId"));
  const versionId = Number(searchParams.get("versionId"));
  if (!projectId || !versionId) return NextResponse.json({ error: "缺少书籍解说或版本 ID" }, { status: 400 });
  return NextResponse.json({ draftVersions: await deleteDraftVersion(projectId, versionId) });
}
