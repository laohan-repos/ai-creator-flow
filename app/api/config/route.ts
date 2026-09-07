import { NextResponse } from "next/server";
import { getModelConfig, MODEL_CAPABILITIES, saveCapabilityConfig, type ModelCapability } from "../../../lib/model-config";

export async function GET() { return NextResponse.json(await getModelConfig()); }

export async function PUT(request: Request) {
  const body = await request.json() as Partial<{ capability: ModelCapability; provider: "custom" | "minimax"; baseUrl: string; model: string; voiceId: string; apiKey: string }>;
  if (!body.capability || !MODEL_CAPABILITIES.includes(body.capability)) return NextResponse.json({ error: "无效的模型能力类型" }, { status: 400 });
  await saveCapabilityConfig(body.capability, { provider: body.provider === "minimax" ? "minimax" : "custom", baseUrl: body.baseUrl || "", model: body.model || "", voiceId: body.voiceId || "" }, body.apiKey);
  return NextResponse.json(await getModelConfig());
}
