import { NextResponse } from "next/server";
import { getApiKey, getCapabilityConfig } from "../../../../lib/model-config";
import { apiUrl } from "../../../../lib/api-url";

export async function POST(request: Request) {
  const form = await request.formData();
  const prompt = String(form.get("prompt") || "").trim();
  const image = form.get("image");
  if (!prompt) return NextResponse.json({ error: "请输入图生图编辑提示词" }, { status: 400 });
  if (!(image instanceof File)) return NextResponse.json({ error: "请上传要编辑的图片" }, { status: 400 });
  const config = await getCapabilityConfig("imageEdit");
  const apiKey = await getApiKey("imageEdit");
  if (!config.baseUrl || !apiKey || !config.model) return NextResponse.json({ error: "请先在模型配置中保存图生图模型、Base URL 和 API Key。" }, { status: 412 });
  try {
    const body = new FormData();
    body.append("model", config.model);
    body.append("prompt", prompt);
    body.append("size", "1024x1536");
    body.append("n", "1");
    body.append("response_format", "b64_json");
    body.append("image", image, image.name || "image.png");
    const response = await fetch(apiUrl(config.baseUrl, "/images/edits"), { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body });
    if (!response.ok) throw new Error(`图生图模型请求失败 (${response.status})`);
    const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    const result = payload.data?.[0];
    const imageUrl = result?.b64_json ? `data:image/png;base64,${result.b64_json}` : result?.url;
    if (!imageUrl) throw new Error("图生图模型未返回图片");
    return NextResponse.json({ imageUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "图生图失败" }, { status: 502 });
  }
}
