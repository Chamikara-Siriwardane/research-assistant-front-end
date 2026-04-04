export interface Message {
  id: string;
  senderType: "user" | "jarvis";
  content: string;
  thoughts: string[];
  isStreaming: boolean;
  timestamp: Date;
  attachedFile?: string;
}

export interface ChatSession {
  id: string;
  backendId?: number;
  title: string;
  messages: Message[];
  createdAt: Date;
}

export type DocumentStatus = "processing" | "ready" | "failed" | null;
