"use client";

import { useEffect, useState } from "react";
import type { IntroTemplate } from "../../lib/types";

type AssetKind = "intro" | "bgm";

export default function AssetsPage() {
  const [kind, setKind] = useState<AssetKind>("intro");
  const [items, setItems] = useState<IntroTemplate[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [deletingAsset, setDeletingAsset] = useState<IntroTemplate | null>(null);

  async function load(nextKind = kind) {
    const response = await fetch(`/api/intros?kind=${nextKind}`);
    const data = await response.json();
    setItems(data.intros || []);
  }

  useEffect(() => { load(kind).catch(() => setNotice("素材加载失败")); }, [kind]);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setNotice(`正在上传并识别${kind === "bgm" ? "音频" : "视频"}时长…`);
    const body = new FormData(); body.set("kind", kind); body.set("name", name); body.set("file", file);
    try {
      const response = await fetch("/api/intros", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "上传失败");
      setItems(data.intros || []); setName(""); setNotice(`${kind === "bgm" ? "背景音乐" : "视频素材"}已保存。`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "上传失败"); }
    finally { setBusy(false); }
  }

  async function generateWithSeedance() {
    if (!prompt.trim()) { setNotice("请输入 Seedance 视频提示词。"); return; }
    setBusy(true); setNotice("正在创建 Seedance 视频任务…");
    try {
      const response = await fetch("/api/intros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, name, prompt, duration }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Seedance 任务创建失败");
      setItems(data.intros || []); setName(""); setPrompt(""); setNotice("Seedance 任务已提交，可稍后刷新状态。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Seedance 任务创建失败"); }
    finally { setBusy(false); }
  }

  async function refresh(item: IntroTemplate) {
    setBusy(true); setNotice(`正在查询“${item.name}”…`);
    try {
      const response = await fetch("/api/intros", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, action: "refresh" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "状态查询失败");
      setItems(data.intros || []); setNotice(data.status === "succeeded" ? "视频已生成并保存到素材库。" : `当前状态：${data.status || "queued"}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "状态查询失败"); }
    finally { setBusy(false); }
  }

  async function setDefault(item: IntroTemplate) {
    const response = await fetch("/api/intros", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    const data = await response.json();
    if (response.ok) setItems(data.intros || []); else setNotice(data.error || "设置默认失败");
  }

  async function remove(item: IntroTemplate) {
    const response = await fetch(`/api/intros?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "删除失败"); return; }
    await load(); setDeletingAsset(null); setNotice("素材已删除。");
  }

  const label = kind === "intro" ? "片头" : "背景音乐";
  const isMusic = kind === "bgm";
  return <main className="app-shell assets-shell">
    <aside className="side-nav"><div className="brand"><span className="brand-mark"><img src="/brand/book-explainer-logo.png" alt="书籍解说" /></span><strong>书籍解说</strong></div><nav><a href="/"><span>▣</span>书籍解说</a><a className="active" href="/assets"><span>▱</span>素材库</a><a href="/create?model=1"><span>✦</span>模型</a></nav><div className="side-spacer" /></aside>
    <section className="assets-page">
      <div className="project-index-head"><div><div className="eyebrow">CREATORFLOW / ASSETS</div><h1>素材库</h1><p>统一管理视频片头与背景音乐。</p></div></div>
      <div className="asset-kind-tabs"><button className={kind === "intro" ? "active" : ""} onClick={() => { setKind("intro"); setNotice(""); }}>片头管理</button><button className={kind === "bgm" ? "active" : ""} onClick={() => { setKind("bgm"); setNotice(""); }}>背景音乐</button></div>
      <div className={`asset-create-grid ${isMusic ? "single" : ""}`}>
        <section className="asset-create-card panel"><div className="asset-card-title"><span>{isMusic ? "♫" : "↑"}</span><div><h2>上传{label}</h2><p>{isMusic ? "上传 MP3、M4A、WAV 等音频素材" : "上传已有 MP4、MOV 等视频素材"}</p></div></div><label>素材名称（可选）<input value={name} onChange={event => setName(event.target.value)} placeholder={`未命名${label}`} /></label><label className="asset-upload-button">{busy ? "处理中…" : `选择${label}${isMusic ? "文件" : "视频"}`}<input type="file" accept={isMusic ? "audio/*" : "video/*"} disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; upload(file); }} /></label></section>
        {!isMusic && <section className="asset-create-card seedance-card panel"><div className="asset-card-title"><span>✦</span><div><h2>Seedance 生成{label}</h2><p>使用模型配置中的 Seedance 视频能力</p></div></div><label>素材名称（可选）<input value={name} onChange={event => setName(event.target.value)} placeholder={`Seedance ${label}`} /></label><label>视频提示词<textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={`描述需要生成的${label}画面、镜头运动和视觉风格`} /></label><label>时长（2–12 秒）<input type="number" min="2" max="12" value={duration} onChange={event => setDuration(Number(event.target.value))} /></label><button className="seedance-generate" disabled={busy} onClick={generateWithSeedance}>{busy ? "处理中…" : `生成${label}`}</button></section>}
      </div>
      {notice && <p className="asset-notice" role="status">{notice}</p>}
      <section className="asset-library panel"><div className="section-title"><span>{isMusic ? "乐" : "头"}</span><h2>{label}素材</h2><small className="project-count">共 {items.length} 个</small></div>{items.length ? <div className="asset-grid">{items.map(item => <article className={`asset-item ${isMusic ? "music" : ""}`} key={item.id}><div className="asset-preview">{item.status === "ready" ? isMusic ? <audio controls preload="metadata" src={item.videoUrl} /> : <video controls preload="metadata" src={item.videoUrl} /> : <div className={`asset-task-status ${item.status || "queued"}`}><span>✦</span><strong>{item.status === "failed" ? "生成失败" : item.status === "running" ? "正在生成" : "等待生成"}</strong></div>}</div><div className="asset-item-info"><div><strong>{item.name}</strong><small>{item.source === "seedance" ? "Seedance" : "本地上传"} · {item.duration.toFixed(2)} 秒 {item.isDefault ? "· 默认" : ""}</small></div><div className="asset-item-actions">{item.source === "seedance" && item.status !== "ready" && <button onClick={() => refresh(item)} disabled={busy}>刷新状态</button>}{kind === "intro" && item.status === "ready" && !item.isDefault && <button onClick={() => setDefault(item)}>设为默认</button>}<button className="delete" onClick={() => setDeletingAsset(item)}>删除</button></div></div></article>)}</div> : <div className="project-empty"><span>{isMusic ? "♫" : "▱"}</span><strong>还没有{label}素材</strong><small>{isMusic ? "上传音频后可在这里试听和管理" : "上传视频或使用 Seedance 生成"}</small></div>}</section>
    </section>
    {deletingAsset && <div className="config-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDeletingAsset(null); }}><div className="confirm-modal panel" role="alertdialog" aria-modal="true" aria-labelledby="delete-asset-title"><div className="confirm-icon">!</div><h3 id="delete-asset-title">删除{label}素材？</h3><p>确定删除“{deletingAsset.name}”吗？删除后无法恢复。</p><div className="confirm-actions"><button className="secondary" onClick={() => setDeletingAsset(null)}>取消</button><button className="confirm-delete" onClick={() => remove(deletingAsset)}>确认删除</button></div></div></div>}
  </main>;
}
