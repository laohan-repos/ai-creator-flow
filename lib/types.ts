export type Scene = {
  id: string;
  heading: string;
  narration: string;
  speed: number;
  imagePrompt: string;
  duration: number;
  imageUrl?: string;
  imageVersions?: string[];
  audioUrl?: string;
};

export type Project = {
  id?: number;
  introTemplateId?: number;
  introTemplateName?: string;
  introVideoUrl?: string;
  introVideoDuration?: number;
  backgroundMusicId?: number;
  backgroundMusicName?: string;
  backgroundMusicDuration?: number;
  backgroundMusicUrl?: string;
  draftUrl?: string;
  draftPrompt?: string;
  draftVersions?: DraftVersion[];
  bookTitle: string;
  author: string;
  mood: string;
  hook: string;
  summary: string;
  scenes: Scene[];
};

export type DraftVersion = {
  id: number;
  draftUrl: string;
  draftPrompt: string;
  createdAt: string;
};

export type IntroTemplate = {
  id: number;
  name: string;
  filename: string;
  mimeType: string;
  duration: number;
  isDefault: boolean;
  videoUrl: string;
  kind?: "intro" | "outro" | "bgm";
  source?: "upload" | "seedance";
  status?: "ready" | "queued" | "running" | "failed";
  taskId?: string;
  prompt?: string;
};
