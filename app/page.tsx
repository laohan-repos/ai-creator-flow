"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { IntroTemplate, Project, Scene } from "../lib/types";
import { DEFAULT_SCRIPT_PROMPT } from "../lib/script-prompt";
import { DEFAULT_DRAFT_PROMPT } from "../lib/draft-prompt";

const initial: Project = { bookTitle: "", author: "", mood: "", hook: "", summary: "", scenes: [] };
type ModelCapability = "image" | "imageEdit" | "multimodal" | "video" | "voice";
type CapabilityConfig = { provider: "custom" | "minimax"; baseUrl: string; model: string; voiceId: string; apiKeyConfigured: boolean };
type ProjectListItem = { id: number; bookTitle: string; author: string; mood: string; createdAt: string };
const capabilityLabels: Record<ModelCapability, string> = { image: "文生图", imageEdit: "图生图", multimodal: "多模态", video: "视频", voice: "语音合成" };
const capabilityModelPlaceholders: Record<ModelCapability, string> = { image: "例如：gpt-image-2", imageEdit: "例如：gpt-image-2", multimodal: "例如：gpt-5.4", video: "例如：seedance-1-0-pro", voice: "例如：speech-2.8-hd" };
const emptyCapability = (): CapabilityConfig => ({ provider: "custom", baseUrl: "", model: "", voiceId: "", apiKeyConfigured: false });
const BATCH_STEPS = ["准备去重清单", "生成书籍解说脚本", "生成分镜图片", "生成分镜配音", "生成剪映草稿", "完成本条任务"];
type BatchTask = { index: number; status: "waiting" | "running" | "completed" | "failed"; title?: string; error?: string };

export default function Home() {
  const pathname = usePathname();
  const [form, setForm] = useState({ bookTitle: "", introTemplateId: 0, backgroundMusicId: 0 });
  const [project, setProject] = useState<Project>(initial);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_SCRIPT_PROMPT);
  const [promptOpen, setPromptOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(DEFAULT_DRAFT_PROMPT);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [library, setLibrary] = useState<ProjectListItem[]>([]);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectListItem | null>(null);
  const [projectActionNotice, setProjectActionNotice] = useState("");
  const [intros, setIntros] = useState<IntroTemplate[]>([]);
  const [backgroundMusic, setBackgroundMusic] = useState<IntroTemplate[]>([]);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [modelConfig, setModelConfig] = useState<Record<ModelCapability, CapabilityConfig>>({ image: emptyCapability(), imageEdit: emptyCapability(), multimodal: emptyCapability(), video: emptyCapability(), voice: { ...emptyCapability(), voiceId: "male-qn-qingse" } });
  const [activeModelTab, setActiveModelTab] = useState<ModelCapability>("image");
  const [selectedStep, setSelectedStep] = useState(1);
  const [imagePromptSceneId, setImagePromptSceneId] = useState<string | null>(null);
  const [voiceEditSceneId, setVoiceEditSceneId] = useState<string | null>(null);
  const [generatingVoiceSceneId, setGeneratingVoiceSceneId] = useState<string | null>(null);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<string | null>(null);
  const [imageEditSceneId, setImageEditSceneId] = useState<string | null>(null);
  const [imageEditPrompt, setImageEditPrompt] = useState("");
  const [editingImage, setEditingImage] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [testingModel, setTestingModel] = useState(false);
  const [modelTestNotice, setModelTestNotice] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchCount, setBatchCount] = useState(1);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchNotice, setBatchNotice] = useState("");
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([]);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(0);
  const [batchStepIndex, setBatchStepIndex] = useState(0);
  const [batchStepDetail, setBatchStepDetail] = useState("");
  const apiKeyInput = useRef<HTMLInputElement>(null);
  const duration = useMemo(() => project.scenes.reduce((total, scene) => total + Number(scene.duration || 0), 0), [project]);
  const durationDisplay = useMemo(() => duration.toFixed(2).replace(/\.00$/, ""), [duration]);
  const batchCompletedCount = batchTasks.filter(task => task.status === "completed").length;
  const batchProgress = batchTasks.length ? Math.min(100, Math.round((batchCompletedCount + (batchGenerating ? (batchStepIndex + 1) / BATCH_STEPS.length : 0)) / batchTasks.length * 100)) : 0;
  const selectedIntro = useMemo(() => intros.find(item => item.id === form.introTemplateId), [intros, form.introTemplateId]);
  const selectedBackgroundMusic = useMemo(() => backgroundMusic.find(item => item.id === form.backgroundMusicId), [backgroundMusic, form.backgroundMusicId]);
  const selectedIntroCompatible = Boolean(selectedIntro && selectedIntro.duration >= 2.3);

  useEffect(() => {
    fetch("/api/config").then(response => response.json()).then(setModelConfig).catch(() => undefined);
    fetch("/api/projects").then(response => response.json()).then(data => setLibrary(data.projects || [])).catch(() => undefined);
    fetch("/api/intros").then(response => response.json()).then(data => {
      const items = data.intros || [];
      setIntros(items);
      const selected = items.find((item: IntroTemplate) => item.isDefault) || items[0];
      if (selected) setForm(current => ({ ...current, introTemplateId: selected.id }));
    }).catch(() => undefined);
    fetch("/api/intros?kind=bgm").then(response => response.json()).then(data => setBackgroundMusic(data.intros || [])).catch(() => undefined);
    const query = new URLSearchParams(window.location.search);
    if (query.get("model") === "1") setConfigOpen(true);
    const projectId = Number(query.get("project"));
    if (projectId > 0) openProject(projectId);
  }, []);

  useEffect(() => {
    const handleImageClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const preview = target.closest(".image-row-preview");
      const row = preview?.closest(".image-scene-row");
      if (!row) return;
      const index = Array.from(document.querySelectorAll(".image-scene-row")).indexOf(row);
      const scene = project.scenes.slice(2)[index];
      if (scene) { setImageEditSceneId(scene.id); setImageEditPrompt(""); }
    };
    document.addEventListener("click", handleImageClick);
    return () => document.removeEventListener("click", handleImageClick);
  }, [project.scenes]);

  useEffect(() => {
    const handlePreviewClick = (event: MouseEvent) => {
      const image = (event.target as HTMLElement).closest(".image-edit-source") as HTMLImageElement | null;
      if (image?.src) setLightboxImageUrl(image.src);
    };
    document.addEventListener("click", handlePreviewClick);
    return () => document.removeEventListener("click", handlePreviewClick);
  }, []);

  async function openProject(id: number) {
    const response = await fetch(`/api/projects?id=${id}`);
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "读取书籍解说失败"); return; }
    setProject(data.project); setDraftPrompt(data.project.draftPrompt || DEFAULT_DRAFT_PROMPT); setForm(current => ({ ...current, introTemplateId: data.project.introTemplateId || current.introTemplateId, backgroundMusicId: data.project.backgroundMusicId || 0 })); setNotice(`已打开书籍解说 #${id}。`);
    setSelectedStep(2);
  }

  async function updateProjectRecord() {
    if (!editingProject?.bookTitle.trim()) { setProjectActionNotice("书籍解说名称不能为空。"); return; }
    const response = await fetch("/api/projects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metadata: editingProject }) });
    const data = await response.json();
    if (!response.ok) { setProjectActionNotice(data.error || "书籍解说更新失败。"); return; }
    setLibrary(current => current.map(item => item.id === editingProject.id ? editingProject : item));
    setEditingProject(null); setProjectActionNotice("");
  }

  async function removeProject(item: ProjectListItem) {
    const response = await fetch(`/api/projects?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) { setProjectActionNotice(data.error || "书籍解说删除失败。"); return; }
    setLibrary(current => current.filter(projectItem => projectItem.id !== item.id));
    setDeletingProject(null); setProjectActionNotice("");
  }

  async function generateBatch() {
    const count = Math.min(20, Math.max(1, Math.floor(Number(batchCount) || 0)));
    if (!form.introTemplateId) { setBatchNotice("请先在素材库设置可用的默认片头。"); return; }
    if (!selectedIntroCompatible) { setBatchNotice("当前片头时长不足，至少需要 2.3 秒。"); return; }
    if (form.backgroundMusicId && !selectedBackgroundMusic) { setBatchNotice("所选背景音乐不存在，请重新选择。"); return; }
    setBatchGenerating(true); setBatchNotice("");
    setBatchTasks(Array.from({ length: count }, (_, index) => ({ index, status: "waiting" })));
    setBatchCurrentIndex(0); setBatchStepIndex(0); setBatchStepDetail("");
    const generatedTitles: string[] = [];
    let activeIndex = 0;
    try {
      for (let index = 0; index < count; index += 1) {
        activeIndex = index;
        setBatchCurrentIndex(index);
        setBatchTasks(current => current.map(task => task.index === index ? { ...task, status: "running" } : task));
        setBatchStepIndex(0); setBatchStepDetail("整理已有书目与本批次书目"); setBatchNotice(`正在处理第 ${index + 1}/${count} 本：${BATCH_STEPS[0]}`);
        const forbiddenBooks = [...library.map(item => item.bookTitle.trim()), ...generatedTitles].filter(Boolean).join("、");
        const batchPrompt = `${promptTemplate}\n\n【批量自动选书：强制去重规则】\n你必须自行选择一本书。以下书目为不可选黑名单：${forbiddenBooks || "无"}。\n输出 JSON 前必须在内部检查：所选书目不得与黑名单相同，也不得是同一本书的简称、全称、别名、带/不带《》、带/不带副标题或不同标点写法。发现重复必须换一本，不得解释。最终 bookTitle 只输出标准主标题，不含《》或副标题。`;
        setBatchStepIndex(1); setBatchStepDetail("自动选书并生成 s0–s6 共 7 个分镜"); setBatchNotice(`正在处理第 ${index + 1}/${count} 本：${BATCH_STEPS[1]}`);
        const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookTitle: "", introTemplateId: form.introTemplateId, backgroundMusicId: form.backgroundMusicId || undefined, promptTemplate: batchPrompt }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "生成失败");
        if (!data.project?.id || !data.project?.bookTitle || !Array.isArray(data.project?.scenes) || data.project.scenes.length !== 7) throw new Error("生成结果不完整");
        let batchProject = data.project as Project;
        generatedTitles.push(batchProject.bookTitle);
        setBatchTasks(current => current.map(task => task.index === index ? { ...task, title: batchProject.bookTitle } : task));
        setLibrary(current => [{ id: batchProject.id!, bookTitle: batchProject.bookTitle, author: batchProject.author, mood: batchProject.mood, createdAt: new Date().toISOString() }, ...current.filter(item => item.id !== batchProject.id)]);

        const persistBatchAssets = async () => {
          const saveResponse = await fetch("/api/projects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: batchProject }) });
          const saveData = await saveResponse.json();
          if (!saveResponse.ok) throw new Error(saveData.error || "保存生成素材失败");
        };

        setBatchStepIndex(2); setBatchNotice(`正在处理《${batchProject.bookTitle}》：${BATCH_STEPS[2]}`);
        const imageScenes = batchProject.scenes.slice(2);
        for (const [imageIndex, scene] of imageScenes.entries()) {
          setBatchStepDetail(`正在生成 s${imageIndex + 2} 图片（${imageIndex + 1}/${imageScenes.length}）`);
          const imageResponse = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: scene.imagePrompt }) });
          const imageData = await imageResponse.json();
          if (!imageResponse.ok) throw new Error(`s${imageIndex + 2} 图片生成失败：${imageData.error || "未知错误"}`);
          batchProject = { ...batchProject, scenes: batchProject.scenes.map(item => item.id === scene.id ? { ...item, imageUrl: imageData.imageUrl, imageVersions: [...new Set([...(item.imageVersions || []), imageData.imageUrl])] } : item) };
          await persistBatchAssets();
        }

        setBatchStepIndex(3); setBatchNotice(`正在处理《${batchProject.bookTitle}》：${BATCH_STEPS[3]}`);
        for (const [voiceIndex, scene] of batchProject.scenes.entries()) {
          setBatchStepDetail(`正在生成 s${voiceIndex} 配音（${voiceIndex + 1}/${batchProject.scenes.length}）`);
          const voiceResponse = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: scene.narration, speed: scene.speed, ...(voiceIndex < 2 ? { targetDuration: scene.duration } : {}) }) });
          const voiceData = await voiceResponse.json();
          if (!voiceResponse.ok) throw new Error(`s${voiceIndex} 配音生成失败：${voiceData.error || "未知错误"}`);
          batchProject = { ...batchProject, scenes: batchProject.scenes.map(item => item.id === scene.id ? { ...item, audioUrl: voiceData.audioUrl, speed: voiceData.speed || item.speed } : item) };
          await persistBatchAssets();
        }

        setBatchStepIndex(4); setBatchStepDetail("正在上传素材并保存剪映草稿"); setBatchNotice(`正在处理《${batchProject.bookTitle}》：${BATCH_STEPS[4]}`);
        const draftResponse = await fetch("/api/projects/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: batchProject.id, draftPrompt }) });
        const draftData = await draftResponse.json();
        if (!draftResponse.ok) throw new Error(`剪映草稿生成失败：${draftData.error || "未知错误"}`);

        setBatchStepIndex(5); setBatchStepDetail("图片、配音和剪映草稿均已生成"); setBatchNotice(`《${batchProject.bookTitle}》已完成`);
        setBatchTasks(current => current.map(task => task.index === index ? { ...task, status: "completed" } : task));
      }
      setBatchNotice(`已完成：共生成 ${count} 本书籍解说。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量生成失败";
      setBatchTasks(current => current.map(task => task.index === activeIndex ? { ...task, status: "failed", error: message } : task));
      setBatchNotice(`生成失败：${message}`);
    }
    finally { setBatchGenerating(false); }
  }

  async function saveModelConfig() {
    const activeConfig = modelConfig[activeModelTab];
    const response = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capability: activeModelTab, provider: activeConfig.provider, baseUrl: activeConfig.baseUrl, model: activeConfig.model, voiceId: activeConfig.voiceId, ...(apiKey ? { apiKey } : {}) }) });
    if (!response.ok) { setNotice("模型配置保存失败。"); return; }
    const saved = await response.json();
    setModelConfig(saved);
    if (apiKey) setApiKey("");
    setNotice(`${capabilityLabels[activeModelTab]}模型配置已保存。`);
  }

  async function testModelConfig() {
    const activeConfig = modelConfig[activeModelTab];
    setTestingModel(true); setModelTestNotice("正在测试连接…");
    try {
      const response = await fetch("/api/config/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capability: activeModelTab, baseUrl: activeConfig.baseUrl, model: activeConfig.model, voiceId: activeConfig.voiceId, ...(apiKey ? { apiKey } : {}) }) });
      const data = await response.json();
      setModelTestNotice(response.ok ? `✓ ${data.message}` : `✕ ${data.error || "测试失败"}`);
    } catch { setModelTestNotice("✕ 测试请求失败"); }
    finally { setTestingModel(false); }
  }

  async function generate() {
    setLoading(true); setNotice("");
    try {
      const forbiddenBooks = library.map(item => item.bookTitle.trim()).filter(Boolean).join("、");
      const promptWithExclusions = !form.bookTitle.trim() && forbiddenBooks ? `${promptTemplate}\n\n【自动选书：强制去重规则】\n你现在必须自行选择一本书。以下“已生成书目”是不可选黑名单：${forbiddenBooks}\n\n在开始输出 JSON 前，先在内部完成以下检查：\n1. 选定的书名不得与黑名单中任何书目相同，也不得是同一本书的简称、全称、别名、带/不带《》、带/不带副标题或不同标点的写法。\n2. 一旦发现重复，必须放弃该书并重新选择另一部作品；不得解释、不得询问、不得输出重复书目。\n3. 最终 JSON 的 bookTitle 必须是该书的标准主标题，不含《》、副标题或额外说明。\n\n这是一条硬性输出约束，优先级高于“选择热门书籍”或任何默认选书偏好。` : promptTemplate;
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, promptTemplate: promptWithExclusions }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 412) {
          setConfigOpen(true);
          requestAnimationFrame(() => apiKeyInput.current?.focus());
        }
        throw new Error(data.error || "生成失败");
      }
      setProject(data.project);
      setSelectedStep(2);
      setDraftPrompt(data.project.draftPrompt || DEFAULT_DRAFT_PROMPT);
      setLibrary(current => [{ id: data.project.id, bookTitle: data.project.bookTitle, author: data.project.author, mood: data.project.mood, createdAt: new Date().toISOString() }, ...current.filter(item => item.id !== data.project.id)]);
      setNotice(`已完成真实生成，并保存为书籍解说 #${data.project.id}。`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "生成失败"); }
    finally { setLoading(false); }
  }

  function updateScene(id: string, key: keyof Scene, value: string | number) {
    setProject(current => ({ ...current, scenes: current.scenes.map(scene => scene.id === id ? { ...scene, [key]: value } : scene) }));
  }

  function persistAssets(next: Project) {
    if (!next.id) return;
    fetch("/api/projects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: next }) }).catch(() => undefined);
  }

  function selectBackgroundMusic(backgroundMusicId: number) {
    const selected = backgroundMusic.find(item => item.id === backgroundMusicId);
    const next = { ...project, backgroundMusicId: backgroundMusicId || undefined, backgroundMusicName: selected?.name, backgroundMusicDuration: selected?.duration, backgroundMusicUrl: selected?.videoUrl };
    setProject(next);
    setForm(current => ({ ...current, backgroundMusicId }));
    persistAssets(next);
    setNotice(selected ? `已选择背景音乐：${selected.name}` : "已取消背景音乐。");
  }

  async function generateJianyingDraft() {
    if (!project.id) return;
    setGeneratingDraft(true); setNotice("正在上传当前书籍解说素材并生成剪映草稿，请勿关闭页面…");
    try {
      const saveResponse = await fetch("/api/projects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project }) });
      if (!saveResponse.ok) throw new Error("背景音乐选择保存失败");
      const response = await fetch("/api/projects/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, draftPrompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "剪映草稿生成失败");
      setProject(current => ({ ...current, draftUrl: data.draftUrl, draftPrompt, draftVersions: data.draftVersions || current.draftVersions }));
      setNotice("剪映草稿已生成并保存。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "剪映草稿生成失败"); }
    finally { setGeneratingDraft(false); }
  }

  async function activateDraftVersion(versionId: number) {
    if (!project.id) return;
    try {
      const response = await fetch("/api/projects/draft", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, versionId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "切换草稿版本失败");
      setProject(current => ({ ...current, draftUrl: data.draftUrl, draftPrompt: data.draftPrompt, draftVersions: data.draftVersions }));
      setDraftPrompt(data.draftPrompt); setNotice("已切换剪映草稿版本。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "切换草稿版本失败"); }
  }

  async function removeDraftVersion(versionId: number) {
    if (!project.id || !window.confirm("确定移除此草稿版本记录吗？不会删除剪映中的原始草稿。")) return;
    try {
      const response = await fetch(`/api/projects/draft?projectId=${project.id}&versionId=${versionId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除草稿版本失败");
      const currentVersion = data.draftVersions.find((item: { draftUrl: string }) => item.draftUrl === project.draftUrl);
      setProject(current => ({ ...current, draftUrl: currentVersion ? current.draftUrl : data.draftVersions[0]?.draftUrl, draftPrompt: currentVersion ? current.draftPrompt : data.draftVersions[0]?.draftPrompt, draftVersions: data.draftVersions }));
      setNotice("草稿版本已移除。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "删除草稿版本失败"); }
  }

  async function copyDraftUrl(draftUrl: string) {
    try {
      await navigator.clipboard.writeText(draftUrl);
      setNotice("剪映草稿链接已复制。");
    } catch { setNotice("复制失败，请检查浏览器剪贴板权限。"); }
  }

  async function generateImage(scene: Scene) {
    setGeneratingImageSceneId(scene.id);
    setNotice(`正在生成「${scene.heading}」的配图…`);
    try {
      const response = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: scene.imagePrompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "配图生成失败");
      setProject(current => { const next = { ...current, scenes: current.scenes.map(item => item.id === scene.id ? { ...item, imageUrl: data.imageUrl, imageVersions: [...new Set([...(item.imageVersions || (item.imageUrl ? [item.imageUrl] : [])), data.imageUrl])] } : item) }; persistAssets(next); return next; });
      setNotice(data.safetyAdjusted ? "原提示词触发未成年人防护，已自动改为成年人物或象征性场景并生成。" : "配图已真实生成。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "配图生成失败"); }
    finally { setGeneratingImageSceneId(current => current === scene.id ? null : current); }
  }

  async function editImage() {
    const scene = project.scenes.find(item => item.id === imageEditSceneId);
    if (!scene || !imageEditPrompt.trim()) return;
    setEditingImage(true); setNotice(`正在编辑「${scene.heading}」的配图…`);
    try {
      let file: File | null = null;
      if (scene.imageUrl) {
        const blob = await fetch(scene.imageUrl).then(response => response.blob());
        file = new File([blob], "scene-image.png", { type: blob.type || "image/png" });
      }
      if (!file) throw new Error("请先上传或生成一张原图");
      const body = new FormData(); body.append("prompt", imageEditPrompt); body.append("image", file);
      const response = await fetch("/api/image/edit", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "图生图失败");
      setProject(current => { const next = { ...current, scenes: current.scenes.map(item => item.id === scene.id ? { ...item, imageUrl: data.imageUrl, imageVersions: [...new Set([...(item.imageVersions || (item.imageUrl ? [item.imageUrl] : [])), data.imageUrl])] } : item) }; persistAssets(next); return next; });
      setNotice("图片编辑已完成。"); setImageEditSceneId(null); setImageEditPrompt("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "图生图失败"); }
    finally { setEditingImage(false); }
  }

  function selectImageVersion(sceneId: string, imageUrl: string) {
    setProject(current => { const next = { ...current, scenes: current.scenes.map(item => item.id === sceneId ? { ...item, imageUrl } : item) }; persistAssets(next); return next; });
    setNotice("已切换图片版本。");
  }

  async function generateVoice(scene: Scene, index: number) {
    setGeneratingVoiceSceneId(scene.id); setNotice(`正在合成「${scene.heading}」的旁白…`);
    try {
      const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: scene.narration, speed: scene.speed, ...(index < 2 ? { targetDuration: scene.duration } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "语音生成失败");
      setProject(current => { const next = { ...current, scenes: current.scenes.map(item => item.id === scene.id ? { ...item, audioUrl: data.audioUrl, speed: data.speed || item.speed } : item) }; persistAssets(next); return next; });
      setNotice(`旁白已生成，真实时长 ${Number(data.duration).toFixed(2)} 秒。`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "语音生成失败"); }
    finally { setGeneratingVoiceSceneId(null); }
  }

  const sceneImagesReady = project.scenes.length > 0 && project.scenes.slice(2).every(scene => Boolean(scene.imageUrl));
  const sceneVoicesReady = project.scenes.length > 0 && project.scenes.every(scene => Boolean(scene.audioUrl));
  const activeStep = project.draftUrl ? 4 : sceneVoicesReady ? 4 : sceneImagesReady ? 3 : project.scenes.length ? 2 : 1;
  const imagePromptScene = project.scenes.find(scene => scene.id === imagePromptSceneId);
  const voiceEditScene = project.scenes.find(scene => scene.id === voiceEditSceneId);
  const imageEditScene = project.scenes.find(scene => scene.id === imageEditSceneId);

  if (pathname === "/") return <main className="app-shell project-index-shell">
    <aside className="side-nav">
      <div className="brand"><span className="brand-mark"><img src="/brand/book-explainer-logo.png" alt="书籍解说" /></span><strong>书籍解说</strong></div>
      <nav><a className="active" href="/"><span>▣</span>书籍解说</a><a href="/assets"><span>▱</span>素材库</a><a href="/create?model=1"><span>✦</span>模型</a></nav>
      <div className="side-spacer" />
    </aside>
    <section className="project-index">
      <div className="project-index-head"><div><div className="eyebrow">CREATORFLOW / BOOK EXPLAINERS</div><h1>书籍解说</h1><p>管理已经创建的书籍解说。</p></div><div className="book-actions"><button className="batch-generate-action" onClick={() => { setBatchOpen(true); setBatchNotice(""); setBatchTasks([]); }}>批量生成</button><a className="create-project-action" href="/create">＋ 新建书籍解说</a></div></div>
      <section className="library panel"><div className="section-title"><span>书</span><h2>书籍解说列表</h2><small className="project-count">共 {library.length} 个书籍解说</small></div>{projectActionNotice && <p className="project-action-notice">{projectActionNotice}</p>}{library.length ? <div className="library-list">{library.map(item => <div className="library-item project-row" key={item.id}><a className="project-row-main" href={`/create?project=${item.id}`}><span className="project-thumb">{item.bookTitle?.slice(0, 1) || "书"}</span><span className="project-meta"><strong>{item.bookTitle}</strong><small>{item.author || "作者待核实"} · {item.mood || "情绪待核实"}</small></span></a><time>{item.createdAt?.slice(0, 10) || ""}</time><div className="project-row-actions"><button onClick={() => { setEditingProject({ ...item }); setProjectActionNotice(""); }}>编辑</button><button className="delete" onClick={() => { setDeletingProject(item); setProjectActionNotice(""); }}>删除</button></div><a className="project-open" href={`/create?project=${item.id}`} aria-label={`打开${item.bookTitle}`}>›</a></div>)}</div> : <div className="project-empty"><span>▣</span><strong>还没有书籍解说</strong><small>点击“新建书籍解说”开始制作第一条视频</small></div>}</section>
    </section>
    {editingProject && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditingProject(null); }}><div className="project-edit-modal panel" role="dialog" aria-modal="true" aria-labelledby="project-edit-title"><button className="config-close" aria-label="关闭编辑" onClick={() => setEditingProject(null)}>×</button><div className="config-title"><span>✎</span><div><h3 id="project-edit-title">编辑书籍解说</h3><p>修改书籍解说的基本信息</p></div></div><label>书籍解说名称<input value={editingProject.bookTitle} onChange={event => setEditingProject(current => current ? { ...current, bookTitle: event.target.value } : current)} /></label><label>作者<input value={editingProject.author || ""} onChange={event => setEditingProject(current => current ? { ...current, author: event.target.value } : current)} placeholder="作者名称" /></label><label>核心情绪<input value={editingProject.mood || ""} onChange={event => setEditingProject(current => current ? { ...current, mood: event.target.value } : current)} placeholder="例如：治愈、成长" /></label>{projectActionNotice && <p className="project-action-notice">{projectActionNotice}</p>}<div className="config-actions"><button className="secondary" onClick={() => setEditingProject(null)}>取消</button><button onClick={updateProjectRecord}>保存修改</button></div></div></div>}
    {deletingProject && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDeletingProject(null); }}><div className="confirm-modal panel" role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title"><div className="confirm-icon">!</div><h3 id="delete-project-title">删除书籍解说？</h3><p>确定删除“{deletingProject.bookTitle}”吗？书籍解说的分镜、图片、音频和草稿关联数据也会被永久删除。</p>{projectActionNotice && <p className="project-action-notice">{projectActionNotice}</p>}<div className="confirm-actions"><button className="secondary" onClick={() => setDeletingProject(null)}>取消</button><button className="confirm-delete" onClick={() => removeProject(deletingProject)}>确认删除</button></div></div></div>}
    {batchOpen && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !batchGenerating) setBatchOpen(false); }}><div className={`batch-generate-modal panel ${batchTasks.length ? "has-progress" : ""}`} role="dialog" aria-modal="true" aria-labelledby="batch-generate-title"><button className="config-close" aria-label="关闭批量生成" disabled={batchGenerating} onClick={() => setBatchOpen(false)}>×</button><div className="config-title"><span>✦</span><div><h3 id="batch-generate-title">批量生成书籍解说</h3><p>{batchTasks.length ? "逐本完成脚本、图片、配音和剪映草稿。" : "模型会自动选书，并避开已生成的书籍解说。"}</p></div></div>{batchTasks.length ? <div className="batch-progress-view"><div className="batch-progress-summary"><div><strong>{batchGenerating ? `正在生成第 ${batchCurrentIndex + 1} 本` : batchTasks.some(task => task.status === "failed") ? "批量生成已中断" : "批量生成已完成"}</strong><small>{batchCompletedCount}/{batchTasks.length} 本完成</small></div><b>{batchProgress}%</b></div><div className="batch-progress-track"><i style={{ width: `${batchProgress}%` }} /></div>{batchStepDetail && <p className="batch-step-detail">{batchStepDetail}</p>}<section className="batch-current-steps"><h4>执行步骤</h4>{BATCH_STEPS.map((step, index) => { const currentTask = batchTasks[batchCurrentIndex]; const isDone = currentTask?.status === "completed" || index < batchStepIndex; const isCurrent = batchGenerating && index === batchStepIndex; const isFailed = currentTask?.status === "failed" && index === batchStepIndex; return <div className={`${isDone ? "done" : ""} ${isCurrent ? "current" : ""} ${isFailed ? "failed" : ""}`} key={step}><span>{isDone ? "✓" : isFailed ? "!" : index + 1}</span><strong>{step}</strong><small>{isDone ? "已完成" : isFailed ? "执行失败" : isCurrent ? batchStepDetail || "执行中…" : "等待中"}</small></div>; })}</section><section className="batch-task-queue"><h4>任务队列</h4><div>{batchTasks.map(task => <div className={task.status} key={task.index}><span>{task.title ? `《${task.title}》` : `第 ${task.index + 1} 本书籍解说`}</span><small>{task.status === "completed" ? "全部完成" : task.status === "failed" ? task.error || "生成失败" : task.status === "running" ? batchStepDetail || BATCH_STEPS[batchStepIndex] : "等待中"}</small></div>)}</div></section>{batchNotice && <p className={`batch-generate-notice ${batchGenerating ? "working" : batchNotice.startsWith("已完成") ? "success" : ""}`} role="status">{batchNotice}</p>}<div className="config-actions"><button className="secondary" disabled={batchGenerating} onClick={() => { setBatchTasks([]); setBatchNotice(""); setBatchStepDetail(""); }}>重新设置</button><button disabled={batchGenerating} onClick={() => setBatchOpen(false)}>{batchGenerating ? "生成中…" : "完成"}</button></div></div> : <><label>生成数量<input type="number" min="1" max="20" step="1" value={batchCount} onChange={event => setBatchCount(Number(event.target.value))} /></label><div className="batch-asset-selectors"><label>本批次片头<select value={form.introTemplateId || ""} onChange={event => setForm(current => ({ ...current, introTemplateId: Number(event.target.value) }))}><option value="" disabled>请选择片头</option>{intros.map(item => <option key={item.id} value={item.id}>{item.name} · {item.duration.toFixed(2)} 秒{item.isDefault ? " · 默认" : ""}{item.duration < 2.3 ? " · 过短" : ""}</option>)}</select></label><label>本批次背景音乐<select value={form.backgroundMusicId || ""} onChange={event => setForm(current => ({ ...current, backgroundMusicId: Number(event.target.value) }))}><option value="">不使用背景音乐</option>{backgroundMusic.map(item => <option key={item.id} value={item.id}>{item.name} · {item.duration.toFixed(2)} 秒</option>)}</select></label></div><div className="batch-media-preview">{selectedIntro && <div><small>片头试听 · {selectedIntro.name}</small><video controls preload="metadata" src={selectedIntro.videoUrl} /></div>}{selectedBackgroundMusic && <div><small>音乐试听 · {selectedBackgroundMusic.name}</small><audio controls preload="metadata" src={selectedBackgroundMusic.videoUrl} /></div>}</div><p className="batch-selection-summary">本批次统一使用：{selectedIntro?.name || "未选择片头"} + {selectedBackgroundMusic?.name || "无背景音乐"}</p><p className="batch-generate-hint">每次最多生成 20 条；每本都会完整生成脚本、5 张分镜图片、7 条配音和剪映草稿。</p>{batchNotice && <p className="batch-generate-notice">{batchNotice}</p>}<div className="config-actions"><button className="secondary" onClick={() => setBatchOpen(false)}>取消</button><button onClick={generateBatch}>开始生成</button></div></>}</div></div>}
  </main>;

  return <main className="app-shell">
    <aside className="side-nav">
      <div className="brand"><span className="brand-mark"><img src="/brand/book-explainer-logo.png" alt="书籍解说" /></span><strong>书籍解说</strong></div>
      <nav>
        <a href="/"><span>▣</span>书籍解说</a>
        <a href="/assets"><span>▱</span>素材库</a>
        <a href="#create" onClick={() => setConfigOpen(true)}><span>✦</span>模型</a>
      </nav>
      <div className="side-spacer" />
    </aside>
      {configOpen && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfigOpen(false); }}>
        <div className="model-config panel" role="dialog" aria-modal="true" aria-labelledby="model-config-title">
          <button className="config-close" aria-label="关闭模型配置" onClick={() => setConfigOpen(false)}>×</button>
          <div className="config-title"><span>✦</span><div><h3 id="model-config-title">模型配置</h3><p>每项能力使用独立的服务地址、API Key 和模型</p></div></div>
          <div className="model-tabs" role="tablist">{(Object.keys(capabilityLabels) as ModelCapability[]).map(capability => <button role="tab" aria-selected={activeModelTab === capability} className={activeModelTab === capability ? "active" : ""} key={capability} onClick={() => { setActiveModelTab(capability); setApiKey(""); setModelTestNotice(""); }}>{capabilityLabels[capability]}<i className={modelConfig[capability].apiKeyConfigured && modelConfig[capability].baseUrl && modelConfig[capability].model ? "ready" : ""} /></button>)}</div>
          <div className="model-tab-panel" role="tabpanel">
            <div className="tab-panel-heading"><div><strong>{activeModelTab === "video" ? "Seedance 视频模型" : `${capabilityLabels[activeModelTab]}模型`}</strong><small>此配置仅供{activeModelTab === "video" ? "Seedance 视频生成" : capabilityLabels[activeModelTab]}能力使用</small></div><span>{modelConfig[activeModelTab].apiKeyConfigured ? "API Key 已保存" : "API Key 未配置"}</span></div>
            <label>服务类型<select value={modelConfig[activeModelTab].provider} onChange={event => setModelConfig(current => ({ ...current, [activeModelTab]: { ...current[activeModelTab], provider: event.target.value as "custom" | "minimax" } }))}><option value="custom">OpenAI 兼容接口</option><option value="minimax">MiniMax</option></select></label>
            <label>Base URL<input value={modelConfig[activeModelTab].baseUrl} onChange={event => setModelConfig(current => ({ ...current, [activeModelTab]: { ...current[activeModelTab], baseUrl: event.target.value } }))} placeholder="https://api.example.com/v1" /></label>
            <label>API Key {modelConfig[activeModelTab].apiKeyConfigured && <em className="key-saved">已保存，留空则保持不变</em>}<input ref={apiKeyInput} type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={modelConfig[activeModelTab].apiKeyConfigured ? "输入新 Key 可替换当前配置" : "请输入此模型的 API Key"} autoComplete="off" /></label>
            <label>模型名称<input value={modelConfig[activeModelTab].model} onChange={event => setModelConfig(current => ({ ...current, [activeModelTab]: { ...current[activeModelTab], model: event.target.value } }))} placeholder={capabilityModelPlaceholders[activeModelTab]} /></label>
            {activeModelTab === "voice" && <label>发音人 ID<input value={modelConfig.voice.voiceId} onChange={event => setModelConfig(current => ({ ...current, voice: { ...current.voice, voiceId: event.target.value } }))} placeholder="male-qn-qingse" /></label>}
          </div>
          <div className="config-footer">{modelTestNotice && <p className={`model-test-notice ${modelTestNotice.startsWith("✓") ? "success" : modelTestNotice.startsWith("✕") ? "error" : ""}`} role="status">{modelTestNotice}</p>}<div className="config-actions"><button className="secondary" onClick={() => setConfigOpen(false)}>关闭</button><button className="test-model-button" onClick={testModelConfig} disabled={testingModel}>{testingModel ? "测试中…" : `测试${capabilityLabels[activeModelTab]}模型`}</button><button onClick={saveModelConfig}>保存配置</button></div></div>
        </div>
      </div>}
    <section className="workflow-steps panel" aria-label="制作进度">
      {["生成书籍解说脚本", "生成图片", "生成配音", "生成剪映草稿"].map((label, index) => <button className={`${index + 1 < activeStep ? "done" : ""} ${index + 1 === selectedStep ? "current" : ""}`} key={label} onClick={() => setSelectedStep(index + 1)}><span>{index + 1}</span><strong>{label}</strong></button>)}
    </section>
    {selectedStep === 1 && project.scenes.length === 0 && <section id="create" className="brief panel step-panel">
      <div className="section-title"><span>01</span><h2>生成书籍解说脚本</h2><button className="prompt-trigger" onClick={() => setPromptOpen(!promptOpen)}>提示词</button></div>
      <label>书名（可不填）<input value={form.bookTitle} onChange={event => setForm({ ...form, bookTitle: event.target.value })} placeholder="例如：活下去的理由；留空则由模型选书" /></label>
      <div className="intro-heading"><div><strong>选择片头</strong><small>片头时长只决定 s0、s1 的时间预算</small></div><a className="manage-intros-link" href="/assets"><span>▱</span> 管理片头 <i>›</i></a></div>
      {intros.length ? <div className="intro-choice"><select aria-label="选择片头" value={form.introTemplateId || ""} onChange={event => setForm(current => ({ ...current, introTemplateId: Number(event.target.value) }))}><option value="" disabled>请选择片头</option>{intros.map(item => <option key={item.id} value={item.id}>{item.name} · {item.duration.toFixed(2)} 秒{item.isDefault ? " · 默认" : ""}{item.duration < 2.3 ? " · 过短" : ""}</option>)}</select>{selectedIntro && <small className={selectedIntroCompatible ? "" : "incompatible"}>{selectedIntroCompatible ? `已选择：${selectedIntro.name}（${selectedIntro.duration.toFixed(2)} 秒）` : `时长不足：${selectedIntro.duration.toFixed(2)} 秒，至少需要 2.3 秒`}</small>}</div> : <p className="intro-empty">还没有片头，请通过“管理片头”上传。</p>}
      <div className="intro-heading"><div><strong>选择背景音乐</strong><small>可选；生成草稿时以 12% 音量循环铺满视频</small></div><a className="manage-intros-link" href="/assets"><span>♫</span> 管理音乐 <i>›</i></a></div>
      <div className="intro-choice"><select aria-label="选择背景音乐" value={form.backgroundMusicId || ""} onChange={event => setForm(current => ({ ...current, backgroundMusicId: Number(event.target.value) }))}><option value="">不使用背景音乐</option>{backgroundMusic.map(item => <option key={item.id} value={item.id}>{item.name} · {item.duration.toFixed(2)} 秒</option>)}</select>{selectedBackgroundMusic && <small>已选择：{selectedBackgroundMusic.name}</small>}</div>
      {selectedBackgroundMusic && <audio className="preview-audio create-music-preview" controls src={selectedBackgroundMusic.videoUrl}>当前浏览器不支持音频预览。</audio>}
      {promptOpen && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPromptOpen(false); }}><div className="prompt-modal panel" role="dialog" aria-modal="true" aria-labelledby="prompt-modal-title"><button className="config-close" aria-label="关闭提示词" onClick={() => setPromptOpen(false)}>×</button><div className="config-title"><span>✦</span><div><h3 id="prompt-modal-title">图文解说脚本提示词</h3><p>用于第一步生成解说文案、分镜和图像提示词</p></div></div><label>提示词内容<textarea value={promptTemplate} onChange={event => setPromptTemplate(event.target.value)} /></label><p className="prompt-variable-hint">使用 <code>{"{{bookTitle}}"}</code> 代表用户填写的书名。</p><div className="config-actions"><button className="secondary" onClick={() => setPromptTemplate(DEFAULT_SCRIPT_PROMPT)}>恢复默认</button><button onClick={() => setPromptOpen(false)}>完成</button></div></div></div>}
      <p className="field-hint">无需填写作者、资料或解读。模型会完成选书（如留空）、内容整理、解说文案和图像提示词。</p>
      <button onClick={generate} disabled={loading || !selectedIntroCompatible}>{loading ? "正在生成脚本…" : !form.introTemplateId ? "请先选择片头" : !selectedIntroCompatible ? "当前片头过短（至少 2.3 秒）" : form.bookTitle ? "生成书籍解说脚本" : "让模型选书并生成脚本"}</button>{notice && <p className="notice">{notice}</p>}
    </section>}
    {selectedStep === 1 && project.scenes.length > 0 && <section className="workspace step-workspace script-step"><div className="project-head"><div><div className="eyebrow">SCRIPT / EDIT</div><h2>{project.bookTitle}</h2><p>{project.hook}</p></div><div className="script-ready"><span>✓ 解说脚本已生成</span><div className="duration">{durationDisplay}<small> 秒</small></div></div></div>{project.scenes.map((scene, index) => <article className="script-scene panel" key={scene.id}><div className="scene-index">s{index}</div><div className="script-copy"><strong>{scene.heading}</strong><p>{scene.narration}</p></div>{index >= 2 && <button className="script-prompt-button" onClick={() => setImagePromptSceneId(scene.id)}><span>✦</span> 图像提示词 <i>›</i></button>}</article>)}</section>}

    {selectedStep === 2 && <section id="workspace" className="workspace step-workspace"><div className="step-content-head"><div><span>02</span><div><h2>生成图片</h2><p>根据脚本中的图像提示词逐镜生成画面。</p></div></div><button className="secondary" onClick={() => setSelectedStep(1)}>返回脚本</button></div>{notice && <p className={`step-notice ${notice.includes("失败") || notice.includes("错误") ? "error" : notice.includes("正在") ? "working" : "success"}`} role="status">{notice}</p>}{project.scenes.length ? <div className="image-scene-list">{project.scenes.slice(2).map((scene, offset) => { const isGenerating = generatingImageSceneId === scene.id; return <article className={`image-scene-row panel ${isGenerating ? "is-generating" : ""}`} key={scene.id}><div className="image-row-preview">{scene.imageUrl ? <img src={scene.imageUrl} alt={`${scene.heading} 配图`} /> : <span>s{offset + 2}</span>}</div><div className="image-row-main"><div><strong>s{offset + 2} · {scene.heading}</strong><small>{isGenerating ? "正在生成图片…" : scene.imageUrl ? "图片已生成" : "等待生成图片"}</small></div><p>{scene.imagePrompt || "尚未设置图像提示词"}</p></div><div className="image-row-actions"><button className="secondary" onClick={() => setImagePromptSceneId(scene.id)}>提示词</button><button className="generate-row-image" disabled={isGenerating} onClick={() => generateImage(scene)}>{isGenerating ? "生成中…" : scene.imageUrl ? "重新生成" : "生成图片"}</button></div></article>; })}</div> : <div className="step-empty panel"><strong>请先生成书籍解说脚本</strong><button onClick={() => setSelectedStep(1)}>前往第一步</button></div>}</section>}
    {imagePromptScene && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setImagePromptSceneId(null); }}><div className="image-prompt-modal panel" role="dialog" aria-modal="true" aria-labelledby="image-prompt-title"><button className="config-close" aria-label="关闭图像提示词" onClick={() => setImagePromptSceneId(null)}>×</button><div className="config-title"><span>✦</span><div><h3 id="image-prompt-title">{imagePromptScene.heading} · 图像提示词</h3><p>描述画面主体、环境、构图、光线和视觉风格</p></div></div><label>提示词内容<textarea value={imagePromptScene.imagePrompt} onChange={event => updateScene(imagePromptScene.id, "imagePrompt", event.target.value)} /></label><div className="config-actions"><button className="secondary" onClick={() => setImagePromptSceneId(null)}>取消</button><button onClick={() => setImagePromptSceneId(null)}>完成</button></div></div></div>}
    {imageEditScene && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !editingImage) setImageEditSceneId(null); }}><div className="image-edit-modal panel" role="dialog" aria-modal="true" aria-labelledby="image-edit-title"><button className="config-close" aria-label="关闭图生图编辑" disabled={editingImage} onClick={() => setImageEditSceneId(null)}>×</button><div className="config-title"><span>✦</span><div><h3 id="image-edit-title">{imageEditScene.heading} · 图生图编辑</h3><p>基于当前图片编辑，无需上传。</p></div></div><div className="image-edit-columns"><div><small>原图</small>{imageEditScene.imageUrl ? <img className="image-edit-source" src={imageEditScene.imageUrl} alt="当前配图" /> : <div className="image-edit-empty">暂无原图</div>}<div className="image-version-panel"><strong>图片编辑版本</strong><div>{(imageEditScene.imageVersions?.length ? imageEditScene.imageVersions : imageEditScene.imageUrl ? [imageEditScene.imageUrl] : []).map((url, index) => <button className={url === imageEditScene.imageUrl ? "selected" : ""} key={`${url}-${index}`} onClick={() => selectImageVersion(imageEditScene.id, url)}><img src={url} alt={`版本 ${index + 1}`} /><small>V{index + 1}{url === imageEditScene.imageUrl ? " · 当前" : ""}</small></button>)}</div></div></div><div><label>编辑提示词<textarea value={imageEditPrompt} onChange={event => setImageEditPrompt(event.target.value)} placeholder="例如：保留人物和构图，将背景改成海边日落" /></label><div className="config-actions"><button className="secondary" disabled={editingImage} onClick={() => setImageEditSceneId(null)}>取消</button><button disabled={editingImage || !imageEditPrompt.trim()} onClick={editImage}>{editingImage ? "编辑中…" : "生成编辑后的图片"}</button></div></div></div></div></div>}
    {lightboxImageUrl && <div className="image-lightbox" role="dialog" aria-label="查看大图" onClick={() => setLightboxImageUrl(null)}><button aria-label="关闭大图" onClick={() => setLightboxImageUrl(null)}>×</button><img src={lightboxImageUrl} alt="大图预览" /></div>}

    {selectedStep === 3 && <section className="workspace step-workspace"><div className="step-content-head"><div><span>03</span><div><h2>生成配音</h2><p>确认解说内容后，逐条生成配音。</p></div></div></div>{project.scenes.length ? project.scenes.map((scene, index) => { const isGenerating = generatingVoiceSceneId === scene.id; return <article className="voice-scene panel" key={scene.id}><div className="scene-index">s{index}</div><div className="voice-copy"><strong>{scene.heading}</strong><p>{scene.narration}</p>{scene.audioUrl && <audio className="preview-audio" controls src={scene.audioUrl}>当前浏览器不支持音频预览。</audio>}</div><div className="voice-actions"><button className="secondary" disabled={isGenerating} onClick={() => setVoiceEditSceneId(scene.id)}>修改</button><button className="generate-row-image" disabled={isGenerating} onClick={() => generateVoice(scene, index)}>{isGenerating ? "正在生成配音…" : scene.audioUrl ? "重新生成配音" : "生成配音"}</button></div></article>; }) : <div className="step-empty panel"><strong>请先生成书籍解说脚本</strong><button onClick={() => setSelectedStep(1)}>前往第一步</button></div>}</section>}
    {voiceEditScene && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setVoiceEditSceneId(null); }}><div className="voice-edit-modal panel" role="dialog" aria-modal="true" aria-labelledby="voice-edit-title"><button className="config-close" aria-label="关闭配音修改" onClick={() => setVoiceEditSceneId(null)}>×</button><div className="config-title"><span>✎</span><div><h3 id="voice-edit-title">修改配音分镜</h3><p>{voiceEditScene.heading}</p></div></div><label>解说内容<textarea value={voiceEditScene.narration} onChange={event => updateScene(voiceEditScene.id, "narration", event.target.value)} /></label><div className="voice-edit-settings"><label>时长（秒）<input type="number" min="0.3" max="30" step="0.01" value={voiceEditScene.duration} onChange={event => updateScene(voiceEditScene.id, "duration", Number(event.target.value))} /></label><label>语速<input type="number" min="0.5" max="2" step="0.05" value={voiceEditScene.speed} onChange={event => updateScene(voiceEditScene.id, "speed", Number(event.target.value))} /></label></div><div className="config-actions"><button className="secondary" onClick={() => setVoiceEditSceneId(null)}>取消</button><button onClick={() => setVoiceEditSceneId(null)}>完成</button></div></div></div>}

    {selectedStep === 4 && <section className="workspace step-workspace"><div className="step-content-head"><div><span>04</span><div><h2>生成剪映草稿</h2><p>将分镜、图片、配音、字幕和背景音乐整理为剪映草稿。</p></div></div></div>{project.id ? <><section className="draft-music panel"><div className="intro-heading"><div><strong>选择背景音乐</strong><small>音乐会循环铺满视频，并以 12% 音量放在旁白下方</small></div><a className="manage-intros-link" href="/assets"><span>♫</span> 管理音乐 <i>›</i></a></div><div className="intro-choice"><select aria-label="选择背景音乐" value={project.backgroundMusicId || ""} onChange={event => selectBackgroundMusic(Number(event.target.value))}><option value="">不使用背景音乐</option>{backgroundMusic.map(item => <option key={item.id} value={item.id}>{item.name} · {item.duration.toFixed(2)} 秒</option>)}</select>{project.backgroundMusicId && <small>已选择：{project.backgroundMusicName || backgroundMusic.find(item => item.id === project.backgroundMusicId)?.name}</small>}</div>{project.backgroundMusicUrl && <audio className="preview-audio" controls src={project.backgroundMusicUrl}>当前浏览器不支持音频预览。</audio>}</section><section className="draft-step panel"><div><div className="eyebrow">JIANYING / DRAFT</div><h2>生成剪映草稿</h2><p>s0、s1 使用片头视频，之后依次排列图像、配音和字幕。</p></div><div className="draft-actions"><div className="draft-button-row"><button className="secondary" onClick={() => setDraftPromptOpen(true)}>提示词</button><button onClick={generateJianyingDraft} disabled={generatingDraft}>{generatingDraft ? "正在生成草稿…" : "生成"}</button></div>{notice && <p className={`draft-notice ${generatingDraft ? "working" : ""}`} role="status">{notice}</p>}</div></section>{project.draftVersions?.length ? <section className="draft-versions panel"><div className="draft-versions-head"><div><strong>草稿版本</strong><small>每次生成都会保留一个版本</small></div><span>{project.draftVersions.length} 个版本</span></div><div className="draft-version-list">{project.draftVersions.map((version, index) => { const isCurrent = version.draftUrl === project.draftUrl; return <article className={`draft-version ${isCurrent ? "current" : ""}`} key={`${version.id}-${version.draftUrl}`}><div><strong>V{project.draftVersions!.length - index}</strong><small>{version.createdAt ? version.createdAt.replace("T", " ").slice(0, 16) : "早期版本"}{isCurrent ? " · 当前使用" : ""}</small></div><div className="draft-version-actions"><button className="draft-version-copy" onClick={() => copyDraftUrl(version.draftUrl)}>复制</button>{!isCurrent && version.id > 0 && <button className="secondary" onClick={() => activateDraftVersion(version.id)}>设为当前</button>}{version.id > 0 && <button className="draft-version-delete" onClick={() => removeDraftVersion(version.id)}>移除</button>}</div></article>; })}</div></section> : null}{draftPromptOpen && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDraftPromptOpen(false); }}><div className="draft-prompt-modal panel" role="dialog" aria-modal="true" aria-labelledby="draft-prompt-title"><button className="config-close" aria-label="关闭剪映草稿提示词" onClick={() => setDraftPromptOpen(false)}>×</button><div className="config-title"><span>✦</span><div><h3 id="draft-prompt-title">剪映草稿提示词</h3><p>用于生成剪映草稿。</p></div></div><label>提示词内容<textarea value={draftPrompt} onChange={event => setDraftPrompt(event.target.value)} /></label><div className="config-actions"><button className="secondary" onClick={() => setDraftPromptOpen(false)}>取消</button><button onClick={() => setDraftPromptOpen(false)}>完成</button></div></div></div>}</> : <div className="step-empty panel"><strong>请先生成书籍解说脚本</strong><button onClick={() => setSelectedStep(1)}>前往第一步</button></div>}</section>}
    <footer>第一版导出的是可审阅、可再处理的标准素材清单；接入你的剪映桌面版草稿格式后，可由适配器写入实际工程。</footer>
  </main>;
}
