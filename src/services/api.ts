const BASE_URL = "http://localhost:8000";

export interface ApiChat {
  chat_id: number;
  title: string;
  created_at: string;
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

export async function fetchChats(): Promise<ApiChat[]> {
  const res = await fetch(`${BASE_URL}/api/chats/`);
  if (!res.ok) throw new Error(`fetchChats failed: ${res.status}`);
  return res.json() as Promise<ApiChat[]>;
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
