import { NextResponse } from "next/server";
import { getApiKey, getCapabilityConfig, MODEL_CAPABILITIES, type ModelCapability } from "../../../../lib/model-config";
import { apiRoot, apiUrl } from "../../../../lib/api-url";

export async function POST(request: Request) {
  const body = await request.json() as Partial<{ capability: ModelCapability; baseUrl: string; model: string; voiceId: string; apiKey: string }>;
  if (!body.capability || !MODEL_CAPABILITIES.includes(body.capability)) return NextResponse.json({ error: "无效的模型能力类型" }, { status: 400 });
  const baseUrl = body.baseUrl?.trim().replace(/\/$/, "");
  const model = body.model?.trim();
  const apiKey = body.apiKey?.trim() || await getApiKey(body.capability);
  if (!baseUrl || !model || !apiKey) return NextResponse.json({ error: "请填写 Base URL、API Key 和模型名称" }, { status: 400 });

  try {
    if (body.capability === "voice") {
      const savedVoiceConfig = await getCapabilityConfig("voice");
      const response = await fetch(apiUrl(baseUrl, "/t2a_v2"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          text: "语音合成连接测试。",
          stream: false,
          voice_setting: { voice_id: body.voiceId?.trim() || savedVoiceConfig.voiceId || "male-qn-qingse", speed: 1, vol: 1, pitch: 0 },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) return NextResponse.json({ error: `连接失败（HTTP ${response.status}）` }, { status: 502 });
      const payload = await response.json().catch(() => undefined) as { data?: { audio?: string }; base_resp?: { status_msg?: string } } | undefined;
      if (!payload?.data?.audio) return NextResponse.json({ error: payload?.base_resp?.status_msg || "语音接口未返回音频" }, { status: 502 });
      return NextResponse.json({ ok: true, message: "连接成功，语音合成可用" });
    }
    const response = await fetch(apiUrl(baseUrl, "/models"), { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const exactEndpoint = apiRoot(baseUrl) !== baseUrl;
      if (exactEndpoint && (response.status === 404 || response.status === 405)) {
        const probe = await fetch(baseUrl, { method: "OPTIONS", headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
        if (probe.status !== 404 && probe.status < 500) return NextResponse.json({ ok: true, message: "接口地址可访问；服务未提供模型列表，未校验模型名称" });
      }
      return NextResponse.json({ error: `连接失败（HTTP ${response.status}）` }, { status: 502 });
    }
    const payload = await response.json().catch(() => undefined) as { data?: Array<{ id?: string }> } | undefined;
    const models = payload?.data?.map(item => item.id).filter(Boolean) || [];
    const modelFound = models.length ? models.includes(model) : undefined;
    return NextResponse.json({ ok: true, message: modelFound === false ? `连接成功，但模型列表中未找到 ${model}` : `连接成功，${model} 可用` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "连接超时（15 秒）" : error instanceof Error ? error.message : "连接测试失败" }, { status: 502 });
  }
}
