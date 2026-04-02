import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import type { Message } from "../types";
import AgentThoughts from "./AgentThoughts";
import ChatInput from "./ChatInput";

interface ActiveChatProps {
  messages: Message[];
  onSend: (text: string, file?: File) => void;
}

export default function ActiveChat({ messages, onSend }: ActiveChatProps) {
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
              {msg.role === "user" ? (
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
                    {msg.agentSteps && msg.agentSteps.length > 0 && (
                      <AgentThoughts
                        steps={msg.agentSteps}
                        isComplete={msg.agentSteps.every(
                          (s) => s.status === "done"
                        )}
                      />
                    )}
                    {msg.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div
                className={`mt-1 text-[10px] text-text-muted ${
                  msg.role === "user" ? "text-right mr-9" : "ml-9"
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
          <ChatInput onSend={onSend} />
        </div>
      </div>
    </div>
  );
}
