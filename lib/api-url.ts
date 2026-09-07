const knownEndpoints = [
  "/chat/completions",
  "/images/generations",
  "/images/edits",
  "/image_generation",
  "/audio/speech",
  "/t2a_v2",
  "/videos/generations",
  "/videos",
  "/contents/generations/tasks",
  "/models",
];

export function apiRoot(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const endpoint = knownEndpoints.find(item => trimmed.endsWith(item));
  return endpoint ? trimmed.slice(0, -endpoint.length) : trimmed;
}

export function apiUrl(baseUrl: string, endpoint: string) {
  return `${apiRoot(baseUrl)}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}
