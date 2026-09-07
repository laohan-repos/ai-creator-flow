import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Project } from "./types";
import { upgradeDraftPrompt } from "./draft-prompt";

const databasePath = path.join(process.cwd(), "data", "creatorflow.db");

function database() {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("CREATE TABLE IF NOT EXISTS book_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, book_title TEXT NOT NULL, author TEXT, mood TEXT, hook TEXT, summary TEXT, prompt_template TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  db.exec("CREATE TABLE IF NOT EXISTS project_scenes (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, scene_order INTEGER NOT NULL, heading TEXT NOT NULL, narration TEXT NOT NULL, speed REAL NOT NULL, duration REAL NOT NULL, image_prompt TEXT NOT NULL, image_url TEXT, audio_url TEXT, FOREIGN KEY(project_id) REFERENCES book_projects(id) ON DELETE CASCADE)");
  try { db.exec("ALTER TABLE project_scenes ADD COLUMN image_versions TEXT"); } catch {}
  db.exec("CREATE TABLE IF NOT EXISTS project_videos (project_id INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('intro', 'outro')), filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, duration REAL NOT NULL DEFAULT 0, content BLOB NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(project_id, kind), FOREIGN KEY(project_id) REFERENCES book_projects(id) ON DELETE CASCADE)");
  db.exec("CREATE TABLE IF NOT EXISTS intro_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, duration REAL NOT NULL, content BLOB NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  try { db.exec("ALTER TABLE project_videos ADD COLUMN duration REAL NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE book_projects ADD COLUMN draft_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE book_projects ADD COLUMN draft_prompt TEXT"); } catch {}
  try { db.exec("ALTER TABLE book_projects ADD COLUMN intro_template_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE book_projects ADD COLUMN background_music_id INTEGER"); } catch {}
  db.exec("CREATE TABLE IF NOT EXISTS project_draft_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, draft_url TEXT NOT NULL, draft_prompt TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(project_id) REFERENCES book_projects(id) ON DELETE CASCADE)");
  return db;
}

export async function saveProject(project: Project, promptTemplate: string) {
  const db = database();
  const result = db.prepare("INSERT INTO book_projects (book_title, author, mood, hook, summary, prompt_template, intro_template_id, background_music_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(project.bookTitle, project.author, project.mood, project.hook, project.summary, promptTemplate, project.introTemplateId || null, project.backgroundMusicId || null);
  const projectId = Number(result.lastInsertRowid);
  const insertScene = db.prepare("INSERT INTO project_scenes (project_id, scene_order, heading, narration, speed, duration, image_prompt, image_url, image_versions, audio_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const [index, scene] of project.scenes.entries()) insertScene.run(projectId, index, scene.heading, scene.narration, scene.speed, scene.duration, scene.imagePrompt, scene.imageUrl || null, JSON.stringify(scene.imageVersions || (scene.imageUrl ? [scene.imageUrl] : [])), scene.audioUrl || null);
  db.close();
  return { ...project, id: projectId };
}

export async function updateProjectAssets(project: Project) {
  if (!project.id) return;
  const db = database();
  db.prepare("UPDATE book_projects SET background_music_id = ? WHERE id = ?").run(project.backgroundMusicId || null, project.id);
  const update = db.prepare("UPDATE project_scenes SET heading = ?, narration = ?, speed = ?, duration = ?, image_prompt = ?, image_url = ?, image_versions = ?, audio_url = ? WHERE project_id = ? AND scene_order = ?");
  for (const [index, scene] of project.scenes.entries()) update.run(scene.heading, scene.narration, scene.speed, scene.duration, scene.imagePrompt, scene.imageUrl || null, JSON.stringify(scene.imageVersions || (scene.imageUrl ? [scene.imageUrl] : [])), scene.audioUrl || null, project.id, index);
  db.close();
}

export async function updateProjectMetadata(id: number, value: { bookTitle: string; author: string; mood: string }) {
  const db = database();
  const result = db.prepare("UPDATE book_projects SET book_title = ?, author = ?, mood = ? WHERE id = ?").run(value.bookTitle.trim(), value.author.trim(), value.mood.trim(), id);
  db.close();
  return result.changes > 0;
}

export async function deleteProject(id: number) {
  const db = database();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM project_scenes WHERE project_id = ?").run(id);
    db.prepare("DELETE FROM project_videos WHERE project_id = ?").run(id);
    db.prepare("DELETE FROM project_draft_versions WHERE project_id = ?").run(id);
    const result = db.prepare("DELETE FROM book_projects WHERE id = ?").run(id);
    db.exec("COMMIT");
    return result.changes > 0;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally { db.close(); }
}

export async function listProjects() {
  const db = database();
  const rows = db.prepare("SELECT id, book_title AS bookTitle, author, mood, created_at AS createdAt FROM book_projects ORDER BY id DESC LIMIT 50").all() as Array<{ id: number; bookTitle: string; author: string; mood: string; createdAt: string }>;
  db.close();
  return rows;
}

export async function getProject(id: number): Promise<Project | undefined> {
  const db = database();
  const project = db.prepare("SELECT p.id, p.book_title AS bookTitle, p.author, p.mood, p.hook, p.summary, p.draft_url AS draftUrl, p.draft_prompt AS draftPrompt, p.intro_template_id AS introTemplateId, i.name AS introTemplateName, i.duration AS introVideoDuration, p.background_music_id AS backgroundMusicId, b.name AS backgroundMusicName, b.duration AS backgroundMusicDuration FROM book_projects p LEFT JOIN intro_templates i ON i.id = p.intro_template_id LEFT JOIN intro_templates b ON b.id = p.background_music_id AND b.kind = 'bgm' WHERE p.id = ?").get(id) as Omit<Project, "scenes"> | undefined;
  if (!project) { db.close(); return undefined; }
  const scenes = db.prepare("SELECT scene_order AS sceneOrder, heading, narration, speed, duration, image_prompt AS imagePrompt, image_url AS imageUrl, image_versions AS imageVersions, audio_url AS audioUrl FROM project_scenes WHERE project_id = ? ORDER BY scene_order").all(id) as Array<{ sceneOrder: number; heading: string; narration: string; speed: number; duration: number; imagePrompt: string; imageUrl?: string; imageVersions?: string; audioUrl?: string }>;
  const videos = db.prepare("SELECT kind, duration FROM project_videos WHERE project_id = ?").all(id) as Array<{ kind: "intro" | "outro"; duration: number }>;
  const draftVersions = db.prepare("SELECT id, draft_url AS draftUrl, draft_prompt AS draftPrompt, created_at AS createdAt FROM project_draft_versions WHERE project_id = ? ORDER BY id DESC").all(id) as Array<{ id: number; draftUrl: string; draftPrompt: string; createdAt: string }>;
  db.close();
  const hasIntro = videos.some(video => video.kind === "intro");
  const versions = draftVersions.length ? draftVersions : project.draftUrl ? [{ id: 0, draftUrl: project.draftUrl, draftPrompt: project.draftPrompt || "", createdAt: "" }] : [];
  return { ...project, draftPrompt: upgradeDraftPrompt(project.draftPrompt), draftVersions: versions, introVideoUrl: project.introTemplateId ? `/api/intros?id=${project.introTemplateId}` : hasIntro ? `/api/projects/media?projectId=${id}&kind=intro` : undefined, introVideoDuration: project.introVideoDuration || videos.find(video => video.kind === "intro")?.duration, backgroundMusicUrl: project.backgroundMusicId ? `/api/intros?id=${project.backgroundMusicId}` : undefined, scenes: scenes.map(scene => ({ id: `scene-${String(scene.sceneOrder + 1).padStart(2, "0")}`, heading: scene.heading, narration: scene.narration, speed: scene.speed, duration: scene.duration, imagePrompt: scene.imagePrompt, imageUrl: scene.imageUrl || undefined, imageVersions: (() => { try { const versions = JSON.parse(scene.imageVersions || "[]"); return versions.length ? versions : scene.imageUrl ? [scene.imageUrl] : []; } catch { return scene.imageUrl ? [scene.imageUrl] : []; } })(), audioUrl: scene.audioUrl || undefined })) };
}

export async function saveProjectVideo(projectId: number, kind: "intro" | "outro", file: File, duration: number) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = database();
  db.prepare("INSERT INTO project_videos (project_id, kind, filename, mime_type, file_size, duration, content, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(project_id, kind) DO UPDATE SET filename = excluded.filename, mime_type = excluded.mime_type, file_size = excluded.file_size, duration = excluded.duration, content = excluded.content, updated_at = CURRENT_TIMESTAMP").run(projectId, kind, file.name, file.type || "video/mp4", bytes.length, duration, bytes);
  db.close();
}

export async function getProjectVideo(projectId: number, kind: "intro" | "outro") {
  const db = database();
  const row = db.prepare("SELECT filename, mime_type AS mimeType, duration, content FROM project_videos WHERE project_id = ? AND kind = ?").get(projectId, kind) as { filename: string; mimeType: string; duration: number; content: Uint8Array } | undefined;
  db.close();
  return row;
}

export async function saveProjectVideoDuration(projectId: number, kind: "intro" | "outro", duration: number) {
  const db = database();
  db.prepare("UPDATE project_videos SET duration = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND kind = ?").run(duration, projectId, kind);
  db.close();
}

export async function saveDraftUrl(projectId: number, draftUrl: string, draftPrompt: string) {
  const db = database();
  db.prepare("INSERT INTO project_draft_versions (project_id, draft_url, draft_prompt) VALUES (?, ?, ?)").run(projectId, draftUrl, draftPrompt);
  db.prepare("UPDATE book_projects SET draft_url = ?, draft_prompt = ? WHERE id = ?").run(draftUrl, draftPrompt, projectId);
  db.close();
}

export async function getDraftVersions(projectId: number) {
  const db = database();
  const versions = db.prepare("SELECT id, draft_url AS draftUrl, draft_prompt AS draftPrompt, created_at AS createdAt FROM project_draft_versions WHERE project_id = ? ORDER BY id DESC").all(projectId) as Array<{ id: number; draftUrl: string; draftPrompt: string; createdAt: string }>;
  db.close();
  return versions;
}

export async function setActiveDraftVersion(projectId: number, versionId: number) {
  const db = database();
  const version = db.prepare("SELECT draft_url AS draftUrl, draft_prompt AS draftPrompt FROM project_draft_versions WHERE id = ? AND project_id = ?").get(versionId, projectId) as { draftUrl: string; draftPrompt: string } | undefined;
  if (version) db.prepare("UPDATE book_projects SET draft_url = ?, draft_prompt = ? WHERE id = ?").run(version.draftUrl, version.draftPrompt, projectId);
  db.close();
  return version;
}

export async function deleteDraftVersion(projectId: number, versionId: number) {
  const db = database();
  const current = db.prepare("SELECT draft_url AS draftUrl FROM book_projects WHERE id = ?").get(projectId) as { draftUrl?: string } | undefined;
  const version = db.prepare("SELECT draft_url AS draftUrl FROM project_draft_versions WHERE id = ? AND project_id = ?").get(versionId, projectId) as { draftUrl: string } | undefined;
  db.prepare("DELETE FROM project_draft_versions WHERE id = ? AND project_id = ?").run(versionId, projectId);
  if (version && current?.draftUrl === version.draftUrl) {
    const replacement = db.prepare("SELECT draft_url AS draftUrl, draft_prompt AS draftPrompt FROM project_draft_versions WHERE project_id = ? ORDER BY id DESC LIMIT 1").get(projectId) as { draftUrl: string; draftPrompt: string } | undefined;
    db.prepare("UPDATE book_projects SET draft_url = ?, draft_prompt = ? WHERE id = ?").run(replacement?.draftUrl || null, replacement?.draftPrompt || null, projectId);
  }
  db.close();
  return getDraftVersions(projectId);
}
