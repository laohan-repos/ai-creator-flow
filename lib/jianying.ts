import { getProject, getProjectVideo, saveDraftUrl, saveProjectVideoDuration } from "./projects";
import { DEFAULT_DRAFT_PROMPT, upgradeDraftPrompt } from "./draft-prompt";
import { probeMediaDuration } from "./media-duration";
import { getIntroTemplate } from "./intros";

const CAPCUT_API = "https://capcut-mate.jcaigc.cn/openapi/capcut-mate/v1";
const microseconds = (seconds: number) => Math.max(1, Math.round(seconds * 1_000_000));

type CaptionStyle = {
  border_color: string;
  font: string;
  font_size: number;
  line_spacing: number;
  text_color: string;
  transform_y: number;
  has_shadow?: boolean;
  shadow_info?: { shadow_color: string; shadow_alpha: number; shadow_diffuse: number; shadow_distance: number; shadow_angle: number };
};

const DEFAULT_TITLE_STYLE: CaptionStyle = { border_color: "#5b301e", font: "思源黑体", font_size: 16, line_spacing: 10, text_color: "#fff7e6", transform_y: 1420, has_shadow: true, shadow_info: { shadow_color: "#000000", shadow_alpha: 0.65, shadow_diffuse: 8, shadow_distance: 3, shadow_angle: -45 } };
const DEFAULT_AUTHOR_STYLE: CaptionStyle = { border_color: "#5b301e", font: "思源黑体", font_size: 9, line_spacing: 10, text_color: "#ffe2a6", transform_y: 1080 };
const DEFAULT_SUBTITLE_STYLE: CaptionStyle = { border_color: "#1f160f", font: "思源黑体", font_size: 10, line_spacing: 6, text_color: "#ffffff", transform_y: -1280, has_shadow: true, shadow_info: { shadow_color: "#000000", shadow_alpha: 0.8, shadow_diffuse: 6, shadow_distance: 3, shadow_angle: -45 } };

function promptSection(prompt: string, marker: string) {
  const start = prompt.indexOf(marker);
  if (start < 0) return "";
  const rest = prompt.slice(start);
  const next = rest.slice(marker.length).search(/\n\s*\d+\s*[.、]/);
  return next < 0 ? rest : rest.slice(0, marker.length + next);
}

function stringSetting(block: string, key: string, fallback: string) {
  return block.match(new RegExp(`${key}\\s*[:：=]?\\s*([^\\s\\r\\n]+)`, "i"))?.[1] || fallback;
}

function numberSetting(block: string, key: string, fallback: number) {
  const value = Number(block.match(new RegExp(`${key}\\s*[:：=]?\\s*(-?\\d+(?:\\.\\d+)?)`, "i"))?.[1]);
  return Number.isFinite(value) ? value : fallback;
}

function captionStyle(prompt: string, marker: string, fallback: CaptionStyle): CaptionStyle {
  const block = promptSection(prompt, marker);
  const hasShadowMatch = block.match(/has_shadow\s*[:：=]?\s*(true|false|1|0|是|否)/i);
  const hasShadow = hasShadowMatch ? /^(true|1|是)$/i.test(hasShadowMatch[1]) : fallback.has_shadow;
  const style: CaptionStyle = {
    border_color: stringSetting(block, "border_color", fallback.border_color),
    font: stringSetting(block, "font", fallback.font),
    font_size: numberSetting(block, "font_size", fallback.font_size),
    line_spacing: numberSetting(block, "line_spacing", fallback.line_spacing),
    text_color: stringSetting(block, "text_color", fallback.text_color),
    transform_y: numberSetting(block, "transform_y", fallback.transform_y),
  };
  if (hasShadow !== undefined) style.has_shadow = hasShadow;
  if (hasShadow) style.shadow_info = {
    shadow_color: stringSetting(block, "shadow_color", fallback.shadow_info?.shadow_color || "#000000"),
    shadow_alpha: numberSetting(block, "shadow_alpha", fallback.shadow_info?.shadow_alpha ?? 0.9),
    shadow_diffuse: numberSetting(block, "shadow_diffuse", fallback.shadow_info?.shadow_diffuse ?? 15),
    shadow_distance: numberSetting(block, "shadow_distance", fallback.shadow_info?.shadow_distance ?? 5),
    shadow_angle: numberSetting(block, "shadow_angle", fallback.shadow_info?.shadow_angle ?? -45),
  };
  return style;
}

function parseDraftPrompt(prompt: string) {
  const resolution = prompt.match(/(\d{3,4})\s*[:x×]\s*(\d{3,4})/i);
  return {
    width: resolution ? Number(resolution[1]) : 1080,
    height: resolution ? Number(resolution[2]) : 1920,
    titleStyle: captionStyle(prompt, "添加标题", DEFAULT_TITLE_STYLE),
    authorStyle: captionStyle(prompt, "添加作者", DEFAULT_AUTHOR_STYLE),
    subtitleStyle: captionStyle(prompt, "添加字幕", DEFAULT_SUBTITLE_STYLE),
  };
}

async function postApi<T extends Record<string, unknown>>(name: string, payload: Record<string, unknown>) {
  const response = await fetch(`${CAPCUT_API}/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await response.text();
  let data: T & { detail?: string };
  try { data = JSON.parse(text); } catch { throw new Error(`${name} 返回了无法解析的响应 (${response.status})`); }
  if (!response.ok) throw new Error(`${name} 失败：${data.detail || response.status}`);
  return data;
}

async function audioDuration(url: string, filename: string) {
  const match = url.match(/^data:[^;,]+;base64,(.+)$/s);
  const content = match ? new Uint8Array(Buffer.from(match[1], "base64")) : new Uint8Array(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer());
  return microseconds(await probeMediaDuration(content, filename));
}

function imageDimensions(content: Uint8Array) {
  if (content.length >= 24 && content[0] === 0x89 && content[1] === 0x50 && content[2] === 0x4e && content[3] === 0x47) {
    const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG SOF markers carry the raster dimensions. Ignore metadata and scan to the first SOF block.
  for (let index = 2; index + 9 < content.length; index += 1) {
    if (content[index] !== 0xff || content[index + 1] === 0x00 || content[index + 1] === 0xff) continue;
    const marker = content[index + 1];
    const length = (content[index + 2] << 8) + content[index + 3];
    if (length < 2) break;
    if (marker >= 0xc0 && marker <= 0xc3) return { height: (content[index + 5] << 8) + content[index + 6], width: (content[index + 7] << 8) + content[index + 8] };
    index += length + 1;
  }
  return undefined;
}

async function imageFillScale(url: string) {
  try {
    const encoded = url.match(/^data:[^;,]+;base64,(.+)$/s)?.[1];
    const content = encoded ? new Uint8Array(Buffer.from(encoded, "base64")) : new Uint8Array(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer());
    const dimensions = imageDimensions(content);
    if (!dimensions?.width || !dimensions.height) return 1;
    const sourceRatio = dimensions.width / dimensions.height;
    const canvasRatio = 1080 / 1920;
    return Number(Math.max(sourceRatio / canvasRatio, canvasRatio / sourceRatio, 1).toFixed(3));
  } catch { return 1; }
}

function subtitleChunks(text: string, start: number, end: number) {
  const chunks = text.match(/[^，。！？；、,.!?;]+[，。！？；、,.!?;]?/g)?.map(value => value.trim()).filter(Boolean) || [text];
  const weight = chunks.reduce((total, value) => total + Math.max(1, value.replace(/\s/g, "").length), 0);
  let cursor = start;
  return chunks.map((text, index) => {
    const chunkEnd = index === chunks.length - 1 ? end : cursor + Math.round((end - start) * Math.max(1, text.replace(/\s/g, "").length) / weight);
    const caption = { start: cursor, end: chunkEnd, text };
    cursor = chunkEnd;
    return caption;
  });
}

function authorCaption(text: string) {
  const value = text.replace(/\s+/g, " ").trim() || "作者待核实";
  if (value.length <= 16 || value.includes("\n")) return value;
  const middle = value.length / 2;
  const breaks = Array.from(value.matchAll(/[，；、,;]/g), match => (match.index || 0) + 1)
    .filter(index => index >= value.length * 0.3 && index <= value.length * 0.7);
  const splitAt = breaks.sort((left, right) => Math.abs(left - middle) - Math.abs(right - middle))[0] || Math.ceil(middle);
  return `${value.slice(0, splitAt)}\n${value.slice(splitAt)}`;
}

function adaptiveAuthorStyle(style: CaptionStyle, text: string): CaptionStyle {
  const longestLine = Math.max(...text.split("\n").map(line => line.length));
  const fontSize = longestLine > 20 ? 7 : longestLine > 15 ? 8 : longestLine > 11 ? 9 : 10;
  return { ...style, font_size: Math.min(style.font_size, fontSize), line_spacing: text.includes("\n") ? Math.min(style.line_spacing, 6) : style.line_spacing };
}

const randomBetween = (minimum: number, maximum: number) => minimum + Math.random() * (maximum - minimum);

type KeyframeProperty = "UNIFORM_SCALE" | "KFTypePositionX" | "KFTypePositionY" | "KFTypeRotation";

function randomImageKeyframes(segmentId: string, duration: number, fillScale: number, pattern: number) {
  const direction = Math.random() >= 0.5 ? 1 : -1;
  const values: Partial<Record<KeyframeProperty, [number, number]>> = {};
  if (pattern === 0) { // Strong push-in with a small horizontal drift.
    values.UNIFORM_SCALE = [fillScale + randomBetween(0.05, 0.08), fillScale + randomBetween(0.24, 0.32)];
    values.KFTypePositionX = [-0.055 * direction, 0.055 * direction];
  } else if (pattern === 1) { // Pull back and rise/fall slightly.
    values.UNIFORM_SCALE = [fillScale + randomBetween(0.24, 0.32), fillScale + randomBetween(0.05, 0.08)];
    values.KFTypePositionY = [0.055 * direction, -0.055 * direction];
  } else if (pattern === 2) { // Noticeable horizontal pan.
    values.UNIFORM_SCALE = [fillScale + 0.2, fillScale + 0.2];
    values.KFTypePositionX = [-randomBetween(0.12, 0.17) * direction, randomBetween(0.12, 0.17) * direction];
  } else if (pattern === 3) { // Noticeable vertical pan.
    values.UNIFORM_SCALE = [fillScale + 0.22, fillScale + 0.22];
    values.KFTypePositionY = [-randomBetween(0.1, 0.15) * direction, randomBetween(0.1, 0.15) * direction];
  } else if (pattern === 4) { // Diagonal Ken Burns move.
    values.UNIFORM_SCALE = [fillScale + 0.12, fillScale + 0.24];
    values.KFTypePositionX = [-0.1 * direction, 0.1 * direction];
    values.KFTypePositionY = [0.075 * direction, -0.075 * direction];
  } else { // Subtle cinematic roll with a counter-pan.
    values.UNIFORM_SCALE = [fillScale + 0.2, fillScale + 0.26];
    values.KFTypeRotation = [-randomBetween(1.8, 3) * direction, randomBetween(1.8, 3) * direction];
    values.KFTypePositionX = [0.07 * direction, -0.07 * direction];
  }
  return Object.entries(values).flatMap(([property, [start, end]]) => [
    { segment_id: segmentId, property: property as KeyframeProperty, offset: 0, value: Number(start.toFixed(3)) },
    { segment_id: segmentId, property: property as KeyframeProperty, offset: duration, value: Number(end.toFixed(3)) },
  ]);
}

export async function createJianyingDraft(projectId: number, draftPrompt = DEFAULT_DRAFT_PROMPT, localMediaBase = "http://127.0.0.1:3000") {
  draftPrompt = upgradeDraftPrompt(draftPrompt);
  const project = await getProject(projectId);
  if (!project) throw new Error("书籍项目不存在");
  if (!project.scenes.length) throw new Error("项目没有分镜");
  if (project.scenes.slice(2).some(scene => !scene.imageUrl)) throw new Error("请先为 s2–s6 生成配图");
  if (project.scenes.some(scene => !scene.audioUrl)) throw new Error("请先为全部分镜生成旁白");
  const intro = project.introTemplateId ? await getIntroTemplate(project.introTemplateId) : await getProjectVideo(projectId, "intro");
  if (!intro) throw new Error("当前项目没有选择片头，请在第一步选择片头后重新生成项目");
  const draftConfig = parseDraftPrompt(draftPrompt || DEFAULT_DRAFT_PROMPT);

  const introSeconds = intro.duration > 0 ? intro.duration : await probeMediaDuration(intro.content, intro.filename);
  if (intro.duration <= 0) await saveProjectVideoDuration(projectId, "intro", introSeconds);
  const introDuration = microseconds(introSeconds);
  const introUrl = project.introTemplateId ? `${localMediaBase}/api/intros?id=${project.introTemplateId}` : `${localMediaBase}/api/projects/media?projectId=${projectId}&kind=intro`;
  const audioAssets = await Promise.all(project.scenes.map(async (scene, index) => {
    const url = `${localMediaBase}/api/projects/assets?projectId=${projectId}&scene=${index}&kind=audio`;
    const duration = await audioDuration(scene.audioUrl!, `voice-${index + 1}.mp3`);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`第 ${index + 1} 段旁白无法取得真实时长`);
    return { url, duration };
  }));
  const openingBudget = project.scenes.slice(0, 2).reduce((sum, scene) => sum + Math.max(0.01, Number(scene.duration) || 0), 0);
  let timelineCursor = 0;
  const sceneTimeline = project.scenes.map((scene, index) => {
    if (index === 2) timelineCursor = introDuration;
    const start = timelineCursor;
    const duration = index < 2
      ? (index === 1 ? introDuration - start : Math.round(introDuration * Math.max(0.01, Number(scene.duration) || 0) / openingBudget))
      : audioAssets[index].duration;
    if (index < 2 && audioAssets[index].duration > duration + 80_000) throw new Error(`s${index} 旁白 ${Number(audioAssets[index].duration / 1_000_000).toFixed(2)} 秒，超过片头分配的 ${Number(duration / 1_000_000).toFixed(2)} 秒；请重新生成该段旁白或选择更长片头`);
    timelineCursor += duration;
    return { scene, start, end: timelineCursor, duration, audioDuration: audioAssets[index].duration, audioUrl: audioAssets[index].url };
  });
  const contentEnd = timelineCursor;
  const bookInfoStart = sceneTimeline[2]?.start ?? introDuration;
  const bookInfoEnd = contentEnd;

  let { draft_url: draftUrl } = await postApi<{ draft_url: string }>("create_draft", { width: draftConfig.width, height: draftConfig.height });
  if (!draftUrl) throw new Error("create_draft 未返回草稿地址");

  const introResult = await postApi<{ draft_url: string }>("add_videos", { draft_url: draftUrl, video_infos: JSON.stringify([{ video_url: introUrl, start: 0, end: introDuration, duration: introDuration, volume: 0.6 }]) });
  draftUrl = introResult.draft_url || draftUrl;

  const imageTimeline = sceneTimeline.slice(2);
  const imageInfos = await Promise.all(imageTimeline.map(async (item, index) => ({
    image_url: `${localMediaBase}/api/projects/assets?projectId=${projectId}&scene=${index + 2}&kind=image`,
    start: item.start,
    end: item.end,
    width: draftConfig.width,
    height: draftConfig.height,
    scale: await imageFillScale(item.scene.imageUrl!),
  })));
  const imageScale = Math.max(...imageInfos.map(item => item.scale));
  const imageResult = await postApi<{ draft_url: string; segment_ids?: string[] }>("add_images", { draft_url: draftUrl, image_infos: JSON.stringify(imageInfos.map(({ scale: _scale, ...item }) => item)), alpha: 1, scale_x: imageScale, scale_y: imageScale, transform_x: 0, transform_y: 0 });
  draftUrl = imageResult.draft_url || draftUrl;

  const segmentIds = imageResult.segment_ids || [];
  if (segmentIds.length === imageTimeline.length) {
    const animationPatterns = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    const keyframes = segmentIds.flatMap((segmentId, index) => randomImageKeyframes(segmentId, imageTimeline[index].duration, imageScale, animationPatterns[index % animationPatterns.length]));
    const result = await postApi<{ draft_url: string }>("add_keyframes", { draft_url: draftUrl, keyframes: JSON.stringify(keyframes) });
    draftUrl = result.draft_url || draftUrl;
  }

  const titleResult = await postApi<{ draft_url: string }>("add_captions", { draft_url: draftUrl, captions: JSON.stringify([{ start: bookInfoStart, end: bookInfoEnd, text: `《${project.bookTitle}》` }]), ...draftConfig.titleStyle });
  draftUrl = titleResult.draft_url || draftUrl;
  const authorText = authorCaption(project.author || "作者待核实");
  const authorResult = await postApi<{ draft_url: string }>("add_captions", { draft_url: draftUrl, captions: JSON.stringify([{ start: bookInfoStart, end: bookInfoEnd, text: authorText }]), ...adaptiveAuthorStyle(draftConfig.authorStyle, authorText) });
  draftUrl = authorResult.draft_url || draftUrl;

  const captions = sceneTimeline.flatMap(item => subtitleChunks(item.scene.narration, item.start, item.end));
  const captionResult = await postApi<{ draft_url: string }>("add_captions", { draft_url: draftUrl, captions: JSON.stringify(captions), ...draftConfig.subtitleStyle });
  draftUrl = captionResult.draft_url || draftUrl;

  const audioInfos = sceneTimeline.map(item => ({ audio_url: item.audioUrl, start: item.start, end: item.start + item.audioDuration, duration: item.audioDuration, volume: 1 }));
  const audioResult = await postApi<{ draft_url: string }>("add_audios", { draft_url: draftUrl, audio_infos: JSON.stringify(audioInfos) });
  draftUrl = audioResult.draft_url || draftUrl;

  if (project.backgroundMusicId) {
    const backgroundMusic = await getIntroTemplate(project.backgroundMusicId);
    if (!backgroundMusic || backgroundMusic.kind !== "bgm" || !backgroundMusic.content.length) throw new Error("所选背景音乐不存在，请重新选择");
    const musicDuration = microseconds(backgroundMusic.duration);
    if (!Number.isFinite(musicDuration) || musicDuration <= 0) throw new Error("所选背景音乐没有可用时长");
    const musicUrl = `${localMediaBase}/api/intros?id=${project.backgroundMusicId}`;
    const musicInfos = [];
    for (let start = 0; start < contentEnd; start += musicDuration) {
      const duration = Math.min(musicDuration, contentEnd - start);
      musicInfos.push({ audio_url: musicUrl, start, end: start + duration, duration, volume: 0.12 });
    }
    const musicResult = await postApi<{ draft_url: string }>("add_audios", { draft_url: draftUrl, audio_infos: JSON.stringify(musicInfos) });
    draftUrl = musicResult.draft_url || draftUrl;
  }

  const saved = await postApi<{ draft_url: string }>("save_draft", { draft_url: draftUrl });
  draftUrl = saved.draft_url || draftUrl;
  await saveDraftUrl(projectId, draftUrl, draftPrompt || DEFAULT_DRAFT_PROMPT);
  return draftUrl;
}
