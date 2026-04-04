const BASE_URL = "http://localhost:8000";

export interface ApiChat {
  id?: number;
  chat_id?: number;
  title: string;
  created_at: string;
  updated_at?: string;
}

export interface ApiChatSummary {
  id: number;
  title: string;
  updated_at: string;
}

export interface ApiMessageOut {
  id: number;
  chat_id: number;
  sender_type: "user" | "jarvis";
  content: string;
  timestamp: string;
}

export interface ApiDocumentOut {
  id: number;
  chat_id: number;
  file_name: string;
  s3_url: string;
  status: "processing" | "ready" | "failed";
  uploaded_at: string;
}

export interface ApiChatDetail {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ApiMessageOut[];
  documents: ApiDocumentOut[];
}

export interface ApiDocument {
  document_id: number;
  file_name: string;
  status: string;
}

export interface DocumentStatusResponse {
  document_id: number;
  status: "processing" | "ready" | "failed";
}

export interface SSEEvent {
  type: "thought" | "text" | "title_update";
  content: string;
}

export async function fetchChats(): Promise<ApiChatSummary[]> {
  const res = await fetch(`${BASE_URL}/api/chats/`);
  if (!res.ok) throw new Error(`fetchChats failed: ${res.status}`);
  return res.json() as Promise<ApiChatSummary[]>;
}

export async function fetchChat(chatId: number): Promise<ApiChatDetail> {
  const res = await fetch(`${BASE_URL}/api/chats/${chatId}`);
  if (!res.ok) throw new Error(`fetchChat failed: ${res.status}`);
  return res.json() as Promise<ApiChatDetail>;
}

export async function createChat(): Promise<ApiChat> {
  const res = await fetch(`${BASE_URL}/api/chats/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`createChat failed: ${res.status}`);
  return res.json() as Promise<ApiChat>;
}

export async function uploadDocument(
  chatId: number,
  file: File
): Promise<ApiDocument> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/chats/${chatId}/documents`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`uploadDocument failed: ${res.status}`);
  return res.json() as Promise<ApiDocument>;
}

export async function checkDocumentStatus(
  documentId: number
): Promise<DocumentStatusResponse> {
  const res = await fetch(
    `${BASE_URL}/api/documents/${documentId}/status`
  );
  if (!res.ok) throw new Error(`checkDocumentStatus failed: ${res.status}`);
  return res.json() as Promise<DocumentStatusResponse>;
}

/**
 * Parse a single SSE data line. Returns:
 * - "done" if the line is [DONE]
 * - "parsed" if a valid event was emitted via onEvent
 * - "incomplete" if the JSON couldn't be parsed (likely a partial chunk)
 * - "skip" if the line isn't a data line
 */
function parseSSELine(
  line: string,
  onEvent: (event: SSEEvent) => void,
): "done" | "parsed" | "incomplete" | "skip" {
  const trimmed = line.trim();
  if (!trimmed?.startsWith("data: ")) return "skip";

  const payload = trimmed.slice(6);
  if (payload === "[DONE]") return "done";

  try {
    const parsed: SSEEvent = JSON.parse(payload);
    onEvent(parsed);
    return "parsed";
  } catch {
    return "incomplete";
  }
}

/**
 * Read an SSE stream from a ReadableStream, calling onEvent for each parsed
 * event. Returns true if [DONE] was received.
 */
async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const result = parseSSELine(line, onEvent);
      if (result === "done") return true;
      if (result === "incomplete") {
        buffer = line.trim() + "\n" + buffer;
      }
    }
  }

  // Process any remaining buffer
  return parseSSELine(buffer, onEvent) === "done";
}

/**
 * Stream messages from the backend via SSE.
 * Calls `onEvent` for each parsed SSE event and `onDone` when the stream ends.
 * Returns an AbortController so the caller can cancel the stream.
 */
export function streamMessage(
  chatId: number,
  content: string,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/chats/${chatId}/messages/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        throw new Error(`streamMessage failed: ${res.status}`);
      }

      await readSSEStream(res.body!, onEvent);
      onDone();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}
