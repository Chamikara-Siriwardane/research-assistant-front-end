import { useState, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar";
import EmptyState from "./components/EmptyState";
import ActiveChat from "./components/ActiveChat";
import type { ChatSession, Message, AgentStep } from "./types";

// ── Mock data for sidebar history ──────────────────────────────
const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: "1",
    title: "Reading recommended tests...",
    messages: [],
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: "2",
    title: "Summarize NeurIPS 2025 paper",
    messages: [],
    createdAt: new Date(Date.now() - 172800000),
  },
  {
    id: "3",
    title: "Untitled",
    messages: [],
    createdAt: new Date(Date.now() - 259200000),
  },
];

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
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // ── Helpers ────────────────────────────────────────────────────
  const updateSession = useCallback(
    (id: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
    },
    []
  );

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  // ── Send message + mock agent flow ────────────────────────────
  const handleSend = useCallback(
    (text: string, file?: File) => {
      // Clear any running timers from previous simulation
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];

      // Create or reuse session
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = uid();
        const newSession: ChatSession = {
          id: sessionId,
          title: text.slice(0, 40) || "Untitled",
          messages: [],
          createdAt: new Date(),
        };
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(sessionId);
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

      const sid = sessionId;
      updateSession(sid, (s) => ({
        ...s,
        messages: [...s.messages, userMsg, botMsg],
      }));

      // Simulate agent steps one by one
      MOCK_AGENT_STEPS.forEach((_, i) => {
        // Mark step as running
        const t1 = setTimeout(() => {
          updateSession(sid, (s) => ({
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
          updateSession(sid, (s) => ({
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
        updateSession(sid, (s) => ({
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
          <ActiveChat messages={activeSession.messages} onSend={handleSend} />
        ) : (
          <EmptyState onSend={handleSend} />
        )}
      </main>
    </div>
  );
}
