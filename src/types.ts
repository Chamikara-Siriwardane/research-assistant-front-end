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
  title: string;
  messages: Message[];
  createdAt: Date;
}
