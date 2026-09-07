import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function probeMediaDuration(content: Uint8Array, filename: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "creatorflow-media-"));
  const extension = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, "") || ".mp4";
  const mediaPath = path.join(directory, `input${extension}`);
  try {
    await writeFile(mediaPath, content);
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", mediaPath]);
    const duration = Number(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("媒体文件没有可用的时长信息");
    return duration;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new Error("服务器未安装 ffprobe，无法读取视频时长");
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
