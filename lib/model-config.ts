import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const MODEL_CAPABILITIES = ["image", "imageEdit", "multimodal", "video", "voice"] as const;
export type ModelCapability = typeof MODEL_CAPABILITIES[number];
export type ModelProvider = "custom" | "minimax";
export type CapabilityConfig = { provider: ModelProvider; baseUrl: string; model: string; voiceId: string; apiKeyConfigured: boolean };
export type ModelConfig = Record<ModelCapability, CapabilityConfig>;

type StoredCapability = { capability: ModelCapability; provider: string; baseUrl: string; model: string; voiceId: string; api_key: string | null };
const databasePath = path.join(process.cwd(), "data", "creatorflow.db");

const envModel: Record<ModelCapability, string> = {
  image: process.env.AI_IMAGE_MODEL || "",
  imageEdit: process.env.AI_IMAGE_EDIT_MODEL || "",
  multimodal: process.env.AI_TEXT_MODEL || "",
  video: process.env.AI_VIDEO_MODEL || "",
  voice: process.env.AI_VOICE_MODEL || "",
};

function fallback(capability: ModelCapability): CapabilityConfig {
  return {
    provider: "custom",
    baseUrl: process.env.AI_BASE_URL || "",
    model: envModel[capability],
    voiceId: capability === "voice" ? process.env.AI_VOICE_ID || "male-qn-qingse" : "",
    apiKeyConfigured: Boolean(process.env.AI_API_KEY),
  };
}

function database() {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("CREATE TABLE IF NOT EXISTS model_capability_settings (capability TEXT PRIMARY KEY, provider TEXT NOT NULL, base_url TEXT NOT NULL, model TEXT NOT NULL, voice_id TEXT NOT NULL DEFAULT '', api_key TEXT)");
  return db;
}

export async function getModelConfig(): Promise<ModelConfig> {
  const db = database();
  const rows = db.prepare("SELECT capability, provider, base_url AS baseUrl, model, voice_id AS voiceId, api_key FROM model_capability_settings").all() as StoredCapability[];
  db.close();
  const result = {} as ModelConfig;
  for (const capability of MODEL_CAPABILITIES) {
    const row = rows.find(item => item.capability === capability);
    result[capability] = row ? {
      provider: row.provider === "minimax" ? "minimax" : "custom",
      baseUrl: row.baseUrl,
      model: row.model,
      voiceId: row.voiceId || (capability === "voice" ? "male-qn-qingse" : ""),
      apiKeyConfigured: Boolean(row.api_key),
    } : fallback(capability);
  }
  return result;
}

export async function getCapabilityConfig(capability: ModelCapability) {
  return (await getModelConfig())[capability];
}

export async function getApiKey(capability: ModelCapability) {
  const db = database();
  const row = db.prepare("SELECT api_key FROM model_capability_settings WHERE capability = ?").get(capability) as { api_key?: string } | undefined;
  db.close();
  return row?.api_key || process.env.AI_API_KEY;
}

export async function saveCapabilityConfig(capability: ModelCapability, value: Omit<CapabilityConfig, "apiKeyConfigured">, apiKey?: string) {
  const config = {
    provider: value.provider === "minimax" ? "minimax" as const : "custom" as const,
    baseUrl: value.baseUrl.trim().replace(/\/$/, ""),
    model: value.model.trim(),
    voiceId: capability === "voice" ? value.voiceId.trim() : "",
  };
  const db = database();
  db.prepare("INSERT INTO model_capability_settings (capability, provider, base_url, model, voice_id, api_key) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(capability) DO UPDATE SET provider = excluded.provider, base_url = excluded.base_url, model = excluded.model, voice_id = excluded.voice_id, api_key = CASE WHEN excluded.api_key IS NULL OR excluded.api_key = '' THEN model_capability_settings.api_key ELSE excluded.api_key END").run(capability, config.provider, config.baseUrl, config.model, config.voiceId, apiKey?.trim() || null);
  db.close();
  return (await getModelConfig())[capability];
}
