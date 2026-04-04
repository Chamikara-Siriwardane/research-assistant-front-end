import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Message, DocumentStatus } from "../types";
import AgentThoughts from "./AgentThoughts";
import ChatInput from "./ChatInput";

interface ActiveChatProps {
  readonly messages: Message[];
  readonly onSend: (text: string, file?: File) => void;
  readonly onFileUpload?: (file: File) => void;
  readonly isUploading?: boolean;
  readonly documentStatus?: DocumentStatus;
}

export default function ActiveChat({
  messages,
  onSend,
  onFileUpload,
  isUploading,
  documentStatus,
}: ActiveChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.senderType === "user" ? (
                <div className="flex justify-end">
                  <div className="flex items-start gap-2 max-w-[80%]">
                    <div className="bg-user-bubble rounded-2xl rounded-tr-sm px-4 py-3">
                      {msg.attachedFile && (
                        <div className="text-xs text-text-muted mb-1.5 flex items-center gap-1">
                          📎 {msg.attachedFile}
                        </div>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                    <div className="shrink-0 w-7 h-7 rounded-full bg-text-primary/10 flex items-center justify-center mt-1">
                      <User size={14} className="text-text-secondary" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 max-w-[80%]">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center mt-1">
                    <Bot size={14} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {(msg.thoughts.length > 0 || msg.isStreaming) && (
                      <AgentThoughts
                        thoughts={msg.thoughts}
                        isStreaming={msg.isStreaming && msg.content.length === 0}
                      />
                    )}
                    {msg.content && (
                      <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {msg.isStreaming && msg.content.length === 0 && msg.thoughts.length === 0 && (
                      <p className="text-sm text-text-muted italic">Thinking...</p>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div
                className={`mt-1 text-[10px] text-text-muted ${
                  msg.senderType === "user" ? "text-right mr-9" : "ml-9"
                }`}
              >
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input fixed at bottom */}
      <div className="border-t border-border bg-cream/80 backdrop-blur-sm px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            onSend={onSend}
            onFileUpload={onFileUpload}
            isUploading={isUploading}
            documentStatus={documentStatus}
          />
        </div>
      </div>
    </div>
  );
}
