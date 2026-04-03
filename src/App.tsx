import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import EmptyState from "./components/EmptyState";
import ActiveChat from "./components/ActiveChat";
import type { ChatSession, Message, AgentStep, DocumentStatus } from "./types";
import {
  fetchChats,
  createChat as apiCreateChat,
  uploadDocument as apiUploadDocument,
  checkDocumentStatus as apiCheckDocumentStatus,
} from "./services/api";

// ── Mock agent simulation ──────────────────────────────────────
const MOCK_AGENT_STEPS: Omit<AgentStep, "status">[] = [
  { agent: "Routing Agent", text: "analyzing request..." },
  { agent: "RAG Agent", text: "retrieving relevant PDFs..." },
  { agent: "Thinking", text: "synthesizing information..." },
  { agent: "Formatter", text: "formatting response..." },
];

const MOCK_RESPONSE =
  "Based on my analysis of the relevant documents, here's what I found:\n\nThe key findings suggest that transformer-based architectures continue to outperform traditional approaches in multi-document summarization tasks. Specifically, the retrieval-augmented generation (RAG) pipeline showed a 23% improvement in factual consistency when compared to vanilla generation methods.\n\nWould you like me to dive deeper into any specific aspect of this analysis?";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // ── Fetch chats on mount ────────────────────────────────────
  useEffect(() => {
    fetchChats()
      .then((apiChats) => {
        setSessions(
          apiChats.map((c) => ({
            id: String(c.chat_id),
            backendId: c.chat_id,
            title: c.title,
            messages: [],
            createdAt: new Date(c.created_at),
          }))
        );
      })
      .catch(console.error);
  }, []);

  // ── Cleanup polling on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────
  const updateSession = useCallback(
    (id: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
    },
    []
  );

  const handleNewChat = useCallback(async () => {
    try {
      const apiChat = await apiCreateChat();
      const newSession: ChatSession = {
        id: String(apiChat.chat_id),
        backendId: apiChat.chat_id,
        title: apiChat.title || "New Chat",
        messages: [],
        createdAt: new Date(apiChat.created_at),
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(String(apiChat.chat_id));
      setDocumentStatus(null);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setDocumentStatus(null);
  }, []);

  // ── PDF Upload + Polling ───────────────────────────────────────
  const handleFileUpload = useCallback(
    async (file: File) => {
      let chatId = activeSession?.backendId ?? null;

      if (chatId === null) {
        try {
          const apiChat = await apiCreateChat();
          chatId = apiChat.chat_id;
          const sid = String(apiChat.chat_id);
          const newSession: ChatSession = {
            id: sid,
            backendId: apiChat.chat_id,
            title: apiChat.title || "New Chat",
            messages: [],
            createdAt: new Date(apiChat.created_at),
          };
          setSessions((prev) => [newSession, ...prev]);
          setActiveSessionId(sid);
        } catch (err) {
          console.error("Failed to create chat before upload:", err);
          return;
        }
      }

      setIsUploading(true);
      setDocumentStatus(null);

      try {
        const doc = await apiUploadDocument(chatId, file);
        setIsUploading(false);
        setDocumentStatus("processing");

        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
          try {
            const result = await apiCheckDocumentStatus(doc.document_id);
            if (result.status === "ready") {
              clearInterval(pollingRef.current!);
              pollingRef.current = null;
              setDocumentStatus("ready");
            } else if (result.status === "failed") {
              clearInterval(pollingRef.current!);
              pollingRef.current = null;
              setDocumentStatus("failed");
            }
          } catch (e) {
            console.error("Polling error:", e);
          }
        }, 2000);
      } catch (err) {
        console.error("Upload failed:", err);
        setIsUploading(false);
        setDocumentStatus("failed");
      }
    },
    [activeSession]
  );

  // ── Send message + mock agent flow ────────────────────────────
  const handleSend = useCallback(
    async (text: string, file?: File) => {
      // Clear any running timers from previous simulation
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];

      // Create or reuse session
      let sid = activeSessionId;
      if (!sid) {
        try {
          const apiChat = await apiCreateChat();
          sid = String(apiChat.chat_id);
          const newSession: ChatSession = {
            id: sid,
            backendId: apiChat.chat_id,
            title: text.slice(0, 40) || "New Chat",
            messages: [],
            createdAt: new Date(apiChat.created_at),
          };
          setSessions((prev) => [newSession, ...prev]);
          setActiveSessionId(sid);
        } catch {
          // Fallback to local-only session if API is unavailable
          sid = uid();
          const newSession: ChatSession = {
            id: sid,
            title: text.slice(0, 40) || "Untitled",
            messages: [],
            createdAt: new Date(),
          };
          setSessions((prev) => [newSession, ...prev]);
          setActiveSessionId(sid);
        }
      }

      // Add user message
      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: new Date(),
        attachedFile: file?.name,
      };

      // Add assistant placeholder with pending steps
      const botId = uid();
      const initialSteps: AgentStep[] = MOCK_AGENT_STEPS.map((s) => ({
        ...s,
        status: "pending",
      }));
      const botMsg: Message = {
        id: botId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        agentSteps: initialSteps,
      };

      const capturedSid = sid;
      updateSession(capturedSid, (s) => ({
        ...s,
        messages: [...s.messages, userMsg, botMsg],
      }));

      // Simulate agent steps one by one
      MOCK_AGENT_STEPS.forEach((_, i) => {
        // Mark step as running
        const t1 = setTimeout(() => {
          updateSession(capturedSid, (s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === botId
                ? {
                    ...m,
                    agentSteps: m.agentSteps!.map((step, j) =>
                      j === i ? { ...step, status: "running" } : step
                    ),
                  }
                : m
            ),
          }));
        }, i * 1200 + 400);
        timerRefs.current.push(t1);

        // Mark step as done
        const t2 = setTimeout(() => {
          updateSession(capturedSid, (s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === botId
                ? {
                    ...m,
                    agentSteps: m.agentSteps!.map((step, j) =>
                      j === i ? { ...step, status: "done" } : step
                    ),
                  }
                : m
            ),
          }));
        }, (i + 1) * 1200);
        timerRefs.current.push(t2);
      });

      // Add final response text
      const tFinal = setTimeout(() => {
        updateSession(capturedSid, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === botId
              ? { ...m, content: MOCK_RESPONSE, timestamp: new Date() }
              : m
          ),
        }));
      }, MOCK_AGENT_STEPS.length * 1200 + 600);
      timerRefs.current.push(tFinal);
    },
    [activeSessionId, updateSession]
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-cream">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {activeSession && activeSession.messages.length > 0 ? (
          <ActiveChat
            messages={activeSession.messages}
            onSend={handleSend}
            onFileUpload={handleFileUpload}
            isUploading={isUploading}
            documentStatus={documentStatus}
          />
        ) : (
          <EmptyState
            onSend={handleSend}
            onFileUpload={handleFileUpload}
            isUploading={isUploading}
            documentStatus={documentStatus}
          />
        )}
      </main>
    </div>
  );
}
