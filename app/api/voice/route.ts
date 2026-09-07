import { NextResponse } from "next/server";
import { getApiKey, getCapabilityConfig } from "../../../lib/model-config";
import { probeMediaDuration } from "../../../lib/media-duration";
import { apiUrl } from "../../../lib/api-url";

export async function POST(request: Request) {
  const { text, speed, targetDuration } = await request.json() as { text?: string; speed?: number; targetDuration?: number };
  const config = await getCapabilityConfig("voice");
  const apiKey = await getApiKey("voice");
  if (!text?.trim()) return NextResponse.json({ error: "缺少旁白文本" }, { status: 400 });
  if (!config.baseUrl || !config.model || !apiKey) return NextResponse.json({ error: "请先配置语音模型和 API Key" }, { status: 412 });
  let voiceSpeed = Math.min(2, Math.max(0.5, Number(speed) || 1));
  try {
    async function synthesize(currentSpeed: number) {
      const response = await fetch(apiUrl(config.baseUrl, "/t2a_v2"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: config.model, text, stream: false, output_format: "hex", voice_setting: { voice_id: config.voiceId || "male-qn-qingse", speed: currentSpeed, vol: 1, pitch: 0 }, audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 }, subtitle_enable: false })
      });
      if (!response.ok) throw new Error(`语音模型请求失败 (${response.status})`);
      const payload = await response.json() as { data?: { audio?: string }; base_resp?: { status_code?: number; status_msg?: string } };
      if (!payload.data?.audio) throw new Error(payload.base_resp?.status_msg || "语音模型未返回音频");
      const bytes = new Uint8Array(Buffer.from(payload.data.audio, "hex"));
      return { bytes, duration: await probeMediaDuration(bytes, "voice.mp3") };
    }
    let audio = await synthesize(voiceSpeed);
    if (targetDuration && audio.duration > targetDuration && voiceSpeed < 2) {
      voiceSpeed = Math.min(2, Number((voiceSpeed * audio.duration / targetDuration * 1.03).toFixed(2)));
      audio = await synthesize(voiceSpeed);
    }
    if (targetDuration && audio.duration > targetDuration + 0.08) throw new Error(`旁白需要 ${audio.duration.toFixed(2)} 秒，但片头分配给本段只有 ${targetDuration.toFixed(2)} 秒；请缩短口播或更换更长片头`);
    return NextResponse.json({ audioUrl: `data:audio/mpeg;base64,${Buffer.from(audio.bytes).toString("base64")}`, duration: audio.duration, speed: voiceSpeed });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "语音生成失败" }, { status: 502 }); }
}
