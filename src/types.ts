export interface AgentStep {
  agent: string;
  text: string;
  status: "pending" | "running" | "done";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentSteps?: AgentStep[];
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
