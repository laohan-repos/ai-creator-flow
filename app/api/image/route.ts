import { NextResponse } from "next/server";
import { getApiKey, getCapabilityConfig } from "../../../lib/model-config";
import { apiUrl } from "../../../lib/api-url";

function minorSafePrompt(prompt: string) {
  const rewritten = prompt
    .replace(/《小王子》|小王子/g, "象征纯真与远方的成年星际旅人")
    .replace(/小男孩|小女孩|男孩|女孩|儿童|孩子|孩童|少年|少女|未成年人?/g, "成年人物")
    .replace(/幼小|年幼|童年/g, "成年后的回忆意象");
  return `${rewritten}。安全构图要求：所有可辨认人物均明确为二十五岁以上成年人；若原场景涉及未成年人，改用成年人物、远景剪影、空镜或象征性物件表达；人物衣着完整，姿态自然，不包含任何敏感、暴力或危险呈现。`;
}

function safetyBlocked(status: number, message: string) {
  return status === 400 && /青少年|儿童|未成年|minor|child|youth|safety|防护限制|适当描绘/i.test(message);
}

export async function POST(request: Request) {
  const { prompt } = await request.json() as { prompt?: string };
  if (!prompt?.trim()) return NextResponse.json({ error: "缺少配图提示词" }, { status: 400 });
  const config = await getCapabilityConfig("image");
  const baseUrl = config.baseUrl;
  const apiKey = await getApiKey("image");
  const model = config.model;
  if (!baseUrl || !apiKey || !model) return NextResponse.json({ error: "请先在模型配置中保存 Token Plan Key、Base URL 和文生图模型。" }, { status: 412 });
  try {
    const isMiniMax = config.provider === "minimax";
    const generate = async (imagePrompt: string) => {
      const response = await fetch(apiUrl(baseUrl, isMiniMax ? "/image_generation" : "/images/generations"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(isMiniMax ? { model, prompt: `${imagePrompt}。画面中不要出现文字、Logo 或水印。`, aspect_ratio: "9:16", n: 1, response_format: "url", prompt_optimizer: true } : { model, prompt: `${imagePrompt}。画面中不要出现文字、Logo 或水印。`, size: "1024x1536", n: 1, response_format: "b64_json" })
      });
      const text = await response.text();
      return { response, text };
    };
    let requestResult = await generate(prompt.trim());
    let safetyAdjusted = false;
    if (!requestResult.response.ok && safetyBlocked(requestResult.response.status, requestResult.text)) {
      requestResult = await generate(minorSafePrompt(prompt.trim()));
      safetyAdjusted = true;
    }
    if (!requestResult.response.ok) {
      let providerMessage = "";
      try { providerMessage = JSON.stringify(JSON.parse(requestResult.text)); } catch { providerMessage = requestResult.text; }
      throw new Error(safetyAdjusted ? `图片经安全改写后仍被模型拒绝，请手动修改提示词（${requestResult.response.status}）` : `图片模型请求失败（${requestResult.response.status}）${providerMessage ? `：${providerMessage.slice(0, 240)}` : ""}`);
    }
    const payload = JSON.parse(requestResult.text) as { data?: Array<{ b64_json?: string; url?: string }> | { image_urls?: string[] } };
    const imageResult = Array.isArray(payload.data) ? payload.data[0] : undefined;
    const imageUrl = imageResult?.b64_json ? `data:image/png;base64,${imageResult.b64_json}` : imageResult?.url || (!Array.isArray(payload.data) ? payload.data?.image_urls?.[0] : undefined);
    if (!imageUrl) throw new Error("图片模型未返回图片");
    return NextResponse.json({ imageUrl, mode: "ai", safetyAdjusted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "生成图片失败" }, { status: 502 });
  }
}
