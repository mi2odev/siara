import { publicRequest, API_ORIGIN } from "../requestMethodes";

export async function explainRiskPrediction(payload) {
  const response = await publicRequest.post("/predictions/explain-risk", payload);
  return response.data || null;
}

export async function explainRoute(payload, { signal } = {}) {
  const response = await publicRequest.post("/risk/route/explain", payload, {
    signal,
  });
  return response.data || null;
}

// Parse a single SSE block ("event: x\ndata: {...}") into { event, data }.
function parseSseBlock(block) {
  const lines = block.replace(/\r/g, "").split("\n");
  let event = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return { event, data: { raw: dataLines.join("\n") } };
  }
}

// Streaming counterpart of explainRoute — mirrors the driver-quiz explainer.
// Streams Ollama tokens as Server-Sent Events so the UI never blocks on a
// single response. Callbacks: onMeta(comparison+reasons), onChunk({content}),
// onDone(final). Returns the final `done` payload.
export async function explainRouteStream(
  payload,
  { signal, onMeta, onChunk, onDone } = {},
) {
  const response = await fetch(`${API_ORIGIN}/api/risk/route/explain/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
    credentials: "include",
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`route explanation stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload = null;

  const handle = (block) => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    if (parsed.event === "meta") onMeta?.(parsed.data);
    else if (parsed.event === "chunk") onChunk?.(parsed.data);
    else if (parsed.event === "done") {
      finalPayload = parsed.data;
      onDone?.(parsed.data);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      handle(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) handle(buffer);

  return finalPayload;
}
