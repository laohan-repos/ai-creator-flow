import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { IntroTemplate } from "./types";

const databasePath = path.join(process.cwd(), "data", "creatorflow.db");

function database() {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("CREATE TABLE IF NOT EXISTS intro_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, duration REAL NOT NULL, content BLOB NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  try { db.exec("ALTER TABLE intro_templates ADD COLUMN kind TEXT NOT NULL DEFAULT 'intro'"); } catch {}
  try { db.exec("ALTER TABLE intro_templates ADD COLUMN source TEXT NOT NULL DEFAULT 'upload'"); } catch {}
  try { db.exec("ALTER TABLE intro_templates ADD COLUMN status TEXT NOT NULL DEFAULT 'ready'"); } catch {}
  try { db.exec("ALTER TABLE intro_templates ADD COLUMN task_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE intro_templates ADD COLUMN prompt TEXT"); } catch {}
  try { db.exec("ALTER TABLE book_projects ADD COLUMN intro_template_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE book_projects ADD COLUMN background_music_id INTEGER"); } catch {}
  const legacy = db.prepare("SELECT p.id AS projectId, v.filename, v.mime_type AS mimeType, v.file_size AS fileSize, v.duration, v.content FROM book_projects p JOIN project_videos v ON v.project_id = p.id AND v.kind = 'intro' WHERE p.intro_template_id IS NULL ORDER BY p.id").all() as Array<{ projectId: number; filename: string; mimeType: string; fileSize: number; duration: number; content: Uint8Array }>;
  if (legacy.length) {
    const existingCount = Number((db.prepare("SELECT COUNT(*) AS count FROM intro_templates").get() as { count: number }).count);
    const insert = db.prepare("INSERT INTO intro_templates (name, filename, mime_type, file_size, duration, content, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const attach = db.prepare("UPDATE book_projects SET intro_template_id = ? WHERE id = ?");
    for (const [index, item] of legacy.entries()) {
      const result = insert.run(`旧片头 #${item.projectId}`, item.filename, item.mimeType, item.fileSize, item.duration, item.content, existingCount === 0 && index === 0 ? 1 : 0);
      attach.run(Number(result.lastInsertRowid), item.projectId);
    }
  }
  return db;
}

export async function listIntroTemplates(kind: "intro" | "outro" | "bgm" = "intro"): Promise<IntroTemplate[]> {
  const db = database();
  const rows = db.prepare("SELECT id, name, filename, mime_type AS mimeType, duration, is_default AS isDefault, kind, source, status, task_id AS taskId, prompt FROM intro_templates WHERE kind = ? ORDER BY is_default DESC, id DESC").all(kind) as Array<{ id: number; name: string; filename: string; mimeType: string; duration: number; isDefault: number; kind: "intro" | "outro" | "bgm"; source: "upload" | "seedance"; status: "ready" | "queued" | "running" | "failed"; taskId?: string; prompt?: string }>;
  db.close();
  return rows.map(row => ({ ...row, isDefault: Boolean(row.isDefault), videoUrl: `/api/intros?id=${row.id}` }));
}

export async function saveIntroTemplate(name: string, file: File, duration: number, kind: "intro" | "outro" | "bgm" = "intro") {
  const content = new Uint8Array(await file.arrayBuffer());
  const db = database();
  const count = Number((db.prepare("SELECT COUNT(*) AS count FROM intro_templates WHERE kind = ?").get(kind) as { count: number }).count);
  const result = db.prepare("INSERT INTO intro_templates (name, filename, mime_type, file_size, duration, content, is_default, kind, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'upload', 'ready')").run(name, file.name, file.type || "video/mp4", content.length, duration, content, kind === "intro" && count === 0 ? 1 : 0, kind);
  db.close();
  return Number(result.lastInsertRowid);
}

export async function getIntroTemplate(id: number) {
  const db = database();
  const row = db.prepare("SELECT id, name, filename, mime_type AS mimeType, duration, content, kind, source, status, task_id AS taskId FROM intro_templates WHERE id = ?").get(id) as { id: number; name: string; filename: string; mimeType: string; duration: number; content: Uint8Array; kind: "intro" | "outro" | "bgm"; source: "upload" | "seedance"; status: string; taskId?: string } | undefined;
  db.close();
  return row;
}

export async function setDefaultIntro(id: number) {
  const db = database();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE intro_templates SET is_default = 0 WHERE kind = 'intro'").run();
    const result = db.prepare("UPDATE intro_templates SET is_default = 1 WHERE id = ? AND kind = 'intro'").run(id);
    if (!result.changes) throw new Error("片头不存在");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  db.close();
}

export async function deleteIntroTemplate(id: number) {
  const db = database();
  const used = Number((db.prepare("SELECT COUNT(*) AS count FROM book_projects WHERE intro_template_id = ? OR background_music_id = ?").get(id, id) as { count: number }).count);
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE book_projects SET intro_template_id = NULL WHERE intro_template_id = ?").run(id);
    db.prepare("UPDATE book_projects SET background_music_id = NULL WHERE background_music_id = ?").run(id);
    db.prepare("DELETE FROM intro_templates WHERE id = ?").run(id);
    const remaining = db.prepare("SELECT id FROM intro_templates WHERE kind = 'intro' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
    const hasDefault = db.prepare("SELECT id FROM intro_templates WHERE kind = 'intro' AND is_default = 1 LIMIT 1").get();
    if (!hasDefault && remaining) db.prepare("UPDATE intro_templates SET is_default = 1 WHERE id = ?").run(remaining.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  db.close();
  return used;
}

export async function saveSeedanceTemplate(name: string, kind: "intro" | "outro", prompt: string, taskId: string, duration: number) {
  const db = database();
  const result = db.prepare("INSERT INTO intro_templates (name, filename, mime_type, file_size, duration, content, is_default, kind, source, status, task_id, prompt) VALUES (?, '', 'video/mp4', 0, ?, ?, 0, ?, 'seedance', 'queued', ?, ?)").run(name, duration, new Uint8Array(), kind, taskId, prompt);
  db.close();
  return Number(result.lastInsertRowid);
}

export async function updateSeedanceTemplate(id: number, status: "queued" | "running" | "ready" | "failed", video?: { content: Uint8Array; duration: number }) {
  const db = database();
  if (video) {
    db.prepare("UPDATE intro_templates SET status = ?, filename = ?, mime_type = 'video/mp4', file_size = ?, duration = ?, content = ? WHERE id = ?").run(status, `seedance-${id}.mp4`, video.content.length, video.duration, video.content, id);
    const item = db.prepare("SELECT kind FROM intro_templates WHERE id = ?").get(id) as { kind?: string } | undefined;
    if (item?.kind === "intro" && !db.prepare("SELECT id FROM intro_templates WHERE kind = 'intro' AND is_default = 1 LIMIT 1").get()) db.prepare("UPDATE intro_templates SET is_default = 1 WHERE id = ?").run(id);
  }
  else db.prepare("UPDATE intro_templates SET status = ? WHERE id = ?").run(status, id);
  db.close();
}
