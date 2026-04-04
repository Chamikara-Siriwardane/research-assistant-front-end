import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import EmptyState from "./components/EmptyState";
import ActiveChat from "./components/ActiveChat";
import type { ChatSession, Message, DocumentStatus } from "./types";
import {
  fetchChats,
  createChat as apiCreateChat,
  uploadDocument as apiUploadDocument,
  checkDocumentStatus as apiCheckDocumentStatus,
  streamMessage,
} from "./services/api";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const updateMessage = useCallback(
    (sessionId: string, msgId: string, updater: (m: Message) => Message) => {
      updateSession(sessionId, (s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === msgId ? updater(m) : m)),
      }));
    },
    [updateSession]
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

  // ── Send message + SSE streaming ────────────────────────────
  const handleSend = useCallback(
    async (text: string, file?: File) => {
      // Cancel any in-flight stream
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      // Create or reuse session
      let sid = activeSessionId;
      let backendId = activeSession?.backendId ?? null;

      if (!sid || backendId === null) {
        try {
          const apiChat = await apiCreateChat();
          sid = String(apiChat.chat_id);
          backendId = apiChat.chat_id;
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
          console.error("Failed to create chat session");
          return;
        }
      }

      // Add user message
      const userMsg: Message = {
        id: uid(),
        senderType: "user",
        content: text,
        thoughts: [],
        isStreaming: false,
        timestamp: new Date(),
        attachedFile: file?.name,
      };

      // Add empty Jarvis message placeholder
      const botId = uid();
      const botMsg: Message = {
        id: botId,
        senderType: "jarvis",
        content: "",
        thoughts: [],
        isStreaming: true,
        timestamp: new Date(),
      };

      const capturedSid = sid;
      updateSession(capturedSid, (s) => ({
        ...s,
        messages: [...s.messages, userMsg, botMsg],
      }));

      // Start SSE stream
      abortRef.current = streamMessage(
        backendId,
        text,
        // onEvent
        (event) => {
          if (event.type === "title_update") {
            updateSession(capturedSid, (s) => ({ ...s, title: event.content }));
            return;
          }
          updateMessage(capturedSid, botId, (m) => {
            if (event.type === "thought") {
              return { ...m, thoughts: [...m.thoughts, event.content] };
            }
            if (event.type === "text") {
              return { ...m, content: m.content + event.content };
            }
            return m;
          });
        },
        // onDone
        () => {
          updateMessage(capturedSid, botId, (m) => ({
            ...m,
            isStreaming: false,
            timestamp: new Date(),
          }));
          abortRef.current = null;
        },
        // onError
        (err) => {
          console.error("Stream error:", err);
          updateMessage(capturedSid, botId, (m) => ({
            ...m,
            isStreaming: false,
            content: m.content || "Sorry, something went wrong. Please try again.",
          }));
          abortRef.current = null;
        },
      );
    },
    [activeSessionId, activeSession, updateSession, updateMessage]
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
