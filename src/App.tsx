import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import EmptyState from "./components/EmptyState";
import ActiveChat from "./components/ActiveChat";
import type { ChatSession, Message, DocumentStatus } from "./types";
import {
  fetchChats,
  fetchChat,
  createChat as apiCreateChat,
  uploadDocument as apiUploadDocument,
  checkDocumentStatus as apiCheckDocumentStatus,
  streamMessage,
} from "./services/api";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getChatId(chat: { id?: number; chat_id?: number }): number | null {
  if (typeof chat.id === "number") return chat.id;
  if (typeof chat.chat_id === "number") return chat.chat_id;
  return null;
}

function getUpdatedAt(chat: { updated_at?: string; created_at: string }): Date {
  return new Date(chat.updated_at ?? chat.created_at);
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
          [...apiChats]
            .sort(
              (a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )
            .map((c) => ({
              id: String(c.id),
              backendId: c.id,
              title: c.title,
              messages: [],
              createdAt: new Date(c.updated_at),
              updatedAt: new Date(c.updated_at),
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
      const chatId = getChatId(apiChat);
      if (chatId === null) {
        throw new Error("Invalid chat payload: missing id");
      }
      const newSession: ChatSession = {
        id: String(chatId),
        backendId: chatId,
        title: apiChat.title || "New Chat",
        messages: [],
        createdAt: new Date(apiChat.created_at),
        updatedAt: getUpdatedAt(apiChat),
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(String(chatId));
      setDocumentStatus(null);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, []);

  const handleSelectSession = useCallback(
    async (id: string) => {
      setActiveSessionId(id);
      setDocumentStatus(null);

      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const selectedSession = sessions.find((s) => s.id === id);
      const backendId = selectedSession?.backendId ?? Number(id);
      if (!Number.isFinite(backendId)) return;

      try {
        const detail = await fetchChat(backendId);
        updateSession(id, (s) => ({
          ...s,
          title: detail.title,
          createdAt: new Date(detail.created_at),
          updatedAt: new Date(detail.updated_at),
          messages: detail.messages.map((m) => ({
            id: String(m.id),
            senderType: m.sender_type,
            content: m.content,
            thoughts: [],
            isStreaming: false,
            timestamp: new Date(m.timestamp),
          })),
        }));
      } catch (err) {
        console.error("Failed to fetch chat detail:", err);
      }
    },
    [sessions, updateSession]
  );

  // ── PDF Upload + Polling ───────────────────────────────────────
  const handleFileUpload = useCallback(
    async (file: File) => {
      let chatId = activeSession?.backendId ?? null;

      if (chatId === null) {
        try {
          const apiChat = await apiCreateChat();
          const createdChatId = getChatId(apiChat);
          if (createdChatId === null) {
            throw new Error("Invalid chat payload: missing id");
          }
          chatId = createdChatId;
          const sid = String(createdChatId);
          const newSession: ChatSession = {
            id: sid,
            backendId: createdChatId,
            title: apiChat.title || "New Chat",
            messages: [],
            createdAt: new Date(apiChat.created_at),
            updatedAt: getUpdatedAt(apiChat),
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
          const createdChatId = getChatId(apiChat);
          if (createdChatId === null) {
            throw new Error("Invalid chat payload: missing id");
          }
          sid = String(createdChatId);
          backendId = createdChatId;
          const newSession: ChatSession = {
            id: sid,
            backendId: createdChatId,
            title: text.slice(0, 40) || "New Chat",
            messages: [],
            createdAt: new Date(apiChat.created_at),
            updatedAt: getUpdatedAt(apiChat),
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
        updatedAt: new Date(),
        messages: [...s.messages, userMsg, botMsg],
      }));

      // Start SSE stream
      abortRef.current = streamMessage(
        backendId,
        text,
        // onEvent
        (event) => {
          if (event.type === "title_update") {
            updateSession(capturedSid, (s) => ({
              ...s,
              title: event.content,
              updatedAt: new Date(),
            }));
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
          updateSession(capturedSid, (s) => ({ ...s, updatedAt: new Date() }));
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
          updateSession(capturedSid, (s) => ({ ...s, updatedAt: new Date() }));
          abortRef.current = null;
        },
      );
    },
    [activeSessionId, activeSession, updateSession, updateMessage]
  );

  const sortedSessions = [...sessions].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-cream">
      <Sidebar
        sessions={sortedSessions}
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
