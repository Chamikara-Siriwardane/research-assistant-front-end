import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Check, BrainCircuit } from "lucide-react";

interface AgentThoughtsProps {
  readonly thoughts: string[];
  readonly isStreaming: boolean;
}

function getSummaryText(isStreaming: boolean, count: number): string {
  const plural = count === 1 ? "" : "s";
  if (isStreaming) {
    return count === 0
      ? "Agent working..."
      : `Agent working... (${count} step${plural})`;
  }
  return `Analyzed ${count} step${plural}`;
}

export default function AgentThoughts({ thoughts, isStreaming }: AgentThoughtsProps) {
  const [expanded, setExpanded] = useState(false);

  if (thoughts.length === 0 && !isStreaming) return null;

  const summaryText = getSummaryText(isStreaming, thoughts.length);

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer group"
      >
        {isStreaming ? (
          <Loader2 size={14} className="animate-spin text-accent" />
        ) : (
          <Check size={14} className="text-green-600" />
        )}
        <BrainCircuit size={14} className="opacity-60" />
        <span>{summaryText}</span>
        {expanded ? (
          <ChevronDown size={12} className="opacity-50" />
        ) : (
          <ChevronRight size={12} className="opacity-50" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 ml-1 pl-4 border-l-2 border-border space-y-1.5">
          {thoughts.map((thought, i) => (
            <div key={`thought-${i}-${thought.slice(0, 20)}`} className="text-xs font-mono text-text-muted leading-relaxed">
              {thought}
            </div>
          ))}
          {isStreaming && thoughts.length > 0 && (
            <div className="text-xs text-text-muted">
              <Loader2 size={10} className="inline animate-spin mr-1" />
              <span className="italic">processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
