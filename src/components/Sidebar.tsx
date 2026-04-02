import { useState } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Settings,
  ChevronDown,
} from "lucide-react";
import type { ChatSession } from "../types";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
}: SidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <aside className="w-[260px] min-w-[260px] h-screen bg-sidebar border-r border-border flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-lg font-bold tracking-tight text-text-primary">
          Jarvis
        </h1>
      </div>

      {/* Actions */}
      <div className="px-3 flex flex-col gap-1">
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-primary hover:bg-white/60 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          New chat
        </button>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/60 transition-colors cursor-pointer"
        >
          <Search size={16} />
          Search
        </button>
      </div>

      {/* Recents */}
      <div className="mt-4 px-3 flex-1 overflow-y-auto">
        <div className="flex items-center gap-1 px-3 py-1">
          <ChevronDown size={12} className="text-text-muted" />
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Recents
          </span>
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors cursor-pointer ${
                activeSessionId === session.id
                  ? "bg-white/80 text-text-primary font-medium"
                  : "text-text-secondary hover:bg-white/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="shrink-0 opacity-50" />
                <span className="truncate">{session.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/60 transition-colors w-full cursor-pointer">
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}
