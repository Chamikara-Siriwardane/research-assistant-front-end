import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Plus, ArrowUp, FileText, X, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { DocumentStatus } from "../types";

interface ChatInputProps {
  onSend: (text: string, file?: File) => void;
  onFileUpload?: (file: File) => void;
  isUploading?: boolean;
  documentStatus?: DocumentStatus;
}

function statusColorClass(status: DocumentStatus): string {
  if (status === "ready") return "bg-green-50 text-green-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  return "bg-user-bubble text-text-secondary";
}

function statusLabel(uploading: boolean, status: DocumentStatus): string {
  if (uploading) return "Uploading PDF...";
  if (status === "processing") return "Processing document...";
  if (status === "ready") return "Document ready";
  return "Processing failed";
}

export default function ChatInput({
  onSend,
  onFileUpload,
  isUploading = false,
  documentStatus = null,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !attachedFile) return;
    onSend(trimmed, attachedFile ?? undefined);
    setText("");
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
      onFileUpload?.(file);
    }
    e.target.value = "";
  };

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Document status indicator */}
      {(isUploading || documentStatus) && (
        <div className="px-4 pt-3 pb-1">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusColorClass(documentStatus)
            }`}
          >
            {(isUploading || documentStatus === "processing") && (
              <Loader2 size={14} className="animate-spin shrink-0" />
            )}
            {documentStatus === "ready" && (
              <>
                <FileText size={14} className="shrink-0" />
                <CheckCircle2 size={14} className="shrink-0 text-green-600" />
              </>
            )}
            {documentStatus === "failed" && (
              <XCircle size={14} className="shrink-0" />
            )}
            <span>{statusLabel(isUploading, documentStatus)}</span>
          </div>
        </div>
      )}

      {/* Attached file preview */}
      {attachedFile && (
        <div className="px-4 pt-3 pb-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-user-bubble rounded-lg text-sm text-text-secondary">
            <FileText size={14} />
            <span className="truncate max-w-[200px]">
              {attachedFile.name}
            </span>
            <button
              onClick={() => setAttachedFile(null)}
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-1.5 rounded-lg hover:bg-sidebar transition-colors text-text-muted hover:text-text-secondary cursor-pointer"
          aria-label="Attach file"
        >
          <Plus size={20} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Jarvis or upload a PDF..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none leading-relaxed py-1"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() && !attachedFile}
          className={`shrink-0 p-2 rounded-xl transition-colors cursor-pointer ${
            text.trim() || attachedFile
              ? "bg-text-primary text-white hover:bg-text-primary/90"
              : "bg-sidebar text-text-muted"
          }`}
          aria-label="Send message"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}
