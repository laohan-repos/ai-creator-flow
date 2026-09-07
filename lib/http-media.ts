export function mediaResponse(request: Request, content: Uint8Array, mimeType: string, filename?: string) {
  const range = request.headers.get("range");
  const total = content.length;
  const common: Record<string, string> = {
    "Content-Type": mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ...(filename ? { "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}` } : {}),
  };
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = Math.min(match[2] ? Number(match[2]) : total - 1, total - 1);
      if (start <= end && start < total) {
        const chunk = content.slice(start, end + 1);
        return new Response(chunk, { status: 206, headers: { ...common, "Content-Length": String(chunk.length), "Content-Range": `bytes ${start}-${end}/${total}` } });
      }
    }
    return new Response(null, { status: 416, headers: { ...common, "Content-Range": `bytes */${total}` } });
  }
  return new Response(content, { headers: { ...common, "Content-Length": String(total) } });
}
