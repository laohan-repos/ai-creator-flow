import { NextResponse } from "next/server";
import { deleteProject, getProject, listProjects, updateProjectAssets, updateProjectMetadata } from "../../../lib/projects";
import type { Project } from "../../../lib/types";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ projects: await listProjects() });
  const project = await getProject(Number(id));
  if (!project) return NextResponse.json({ error: "未找到该书籍解说" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: Request) {
  const { project, metadata } = await request.json() as { project?: Project; metadata?: { id?: number; bookTitle?: string; author?: string; mood?: string } };
  if (metadata?.id) {
    if (!metadata.bookTitle?.trim()) return NextResponse.json({ error: "书籍解说名称不能为空" }, { status: 400 });
    const updated = await updateProjectMetadata(metadata.id, { bookTitle: metadata.bookTitle, author: metadata.author || "", mood: metadata.mood || "" });
    return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "未找到该书籍解说" }, { status: 404 });
  }
  if (!project?.id) return NextResponse.json({ error: "缺少书籍解说 ID" }, { status: 400 });
  await updateProjectAssets(project);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "缺少书籍解说 ID" }, { status: 400 });
  return await deleteProject(id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "未找到该书籍解说" }, { status: 404 });
}
