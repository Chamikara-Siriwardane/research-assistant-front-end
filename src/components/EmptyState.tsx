import { Sparkles } from "lucide-react";
import ChatInput from "./ChatInput";

interface EmptyStateProps {
  onSend: (text: string, file?: File) => void;
}

export default function EmptyState({ onSend }: EmptyStateProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    return "Evening";
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles size={28} className="text-accent" />
        <h2 className="text-4xl font-serif text-text-primary">
          {getGreeting()}, Chamikara
        </h2>
      </div>

      <div className="w-full max-w-2xl">
        <ChatInput onSend={onSend} />
      </div>
    </div>
  );
}
