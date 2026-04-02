import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Check } from "lucide-react";
import type { AgentStep } from "../types";

interface AgentThoughtsProps {
  steps: AgentStep[];
  isComplete: boolean;
}

export default function AgentThoughts({ steps, isComplete }: AgentThoughtsProps) {
  const [expanded, setExpanded] = useState(false);

  const doneCount = steps.filter((s) => s.status === "done").length;

  const summaryText = isComplete
    ? `Analyzed your request (${doneCount} step${doneCount !== 1 ? "s" : ""})`
    : `Working... (${doneCount}/${steps.length} steps)`;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer group"
      >
        {isComplete ? (
          <Check size={14} className="text-green-600" />
        ) : (
          <Loader2 size={14} className="animate-spin text-accent" />
        )}
        <span>{summaryText}</span>
        {expanded ? (
          <ChevronDown size={12} className="opacity-50" />
        ) : (
          <ChevronRight size={12} className="opacity-50" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 ml-1 pl-4 border-l-2 border-border space-y-1.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {step.status === "done" ? (
                <Check size={12} className="shrink-0 mt-0.5 text-green-600" />
              ) : step.status === "running" ? (
                <Loader2
                  size={12}
                  className="shrink-0 mt-0.5 animate-spin text-accent"
                />
              ) : (
                <div className="w-3 h-3 shrink-0 mt-0.5 rounded-full border border-border" />
              )}
              <span className="font-mono text-text-muted leading-relaxed">
                <span className="text-text-secondary font-medium">
                  [{step.agent}]
                </span>{" "}
                {step.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
