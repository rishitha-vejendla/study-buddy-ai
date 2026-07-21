import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMessages,
  sendChatMessage,
  listThreads,
  createThread,
  deleteThread,
  saveNote,
} from "@/lib/studymate.functions";
import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  Paperclip,
  X,
  Trash2,
  Loader2,
  Sparkles,
  User,
  PenLine,
  FileText,
  BookmarkPlus,
  Download,
  Copy,
  Mic,
  MicOff,
  Volume2,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { downloadTextPdf, downloadHandwrittenPdf } from "@/lib/pdf-export";
import { useSpeechRecognition, useSpeechSynthesis, useVoices, guessGender } from "@/hooks/use-voice";


export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatThread,
});

type Attachment = {
  kind: "image" | "pdf";
  name: string;
  mimeType: string;
  dataUrl: string;
};

type Marks = "1" | "2" | "5" | "10";
const MARK_OPTIONS: { v: Marks; label: string }[] = [
  { v: "1", label: "1 mark" },
  { v: "2", label: "2 marks" },
  { v: "5", label: "5 marks" },
  { v: "10", label: "10 marks" },
];

async function fileToAttachment(file: File): Promise<Attachment> {
  const isImg = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImg && !isPdf) throw new Error("Only images and PDFs are supported.");
  if (file.size > 8 * 1024 * 1024) throw new Error("File must be under 8MB.");
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return {
    kind: isImg ? "image" : "pdf",
    name: file.name,
    mimeType: file.type,
    dataUrl,
  };
}

function ChatThread() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendChatMessage);
  const threadsFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const saveNoteFn = useServerFn(saveNote);

  const msgsQ = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listFn({ data: { threadId } }),
  });
  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => threadsFn() });

  const [input, setInput] = useState("");
  const [marks, setMarks] = useState<Marks>("5");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [autoRead, setAutoRead] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sm_autoRead") === "1";
  });
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastSpokenRef = useRef<string | null>(null);

  const voice = useSpeechRecognition({
    onFinal: (text) => {
      const finalText = (input ? input + " " : "") + text;
      setInput(finalText.trim());
      // Auto-send after voice input finishes
      setTimeout(() => {
        if (finalText.trim()) sendWith(finalText.trim());
      }, 100);
    },
  });
  const ttsAuto = useSpeechSynthesis();
  const { voices, selectedURI, setVoice } = useVoices();

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sm_autoRead", autoRead ? "1" : "0");
    }
  }, [autoRead]);

  // Auto-read latest assistant message when enabled (uses picked voice)
  useEffect(() => {
    if (!autoRead || !msgsQ.data) return;
    const last = [...msgsQ.data].reverse().find((m: any) => m.role === "assistant");
    if (!last || last.id === lastSpokenRef.current) return;
    lastSpokenRef.current = last.id;
    ttsAuto.speak(String(last.content));
  }, [msgsQ.data, autoRead, ttsAuto]);


  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [msgsQ.data, pendingUser, sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  async function sendWith(text: string) {
    if (!text || sending) return;
    setSending(true);
    setPendingUser(text);
    setInput("");
    const toSend = attachments;
    setAttachments([]);
    try {
      await sendFn({ data: { threadId, content: text, attachments: toSend, marks } });
      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      await qc.invalidateQueries({ queryKey: ["threads"] });
      await qc.invalidateQueries({ queryKey: ["progress"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
      setInput(text);
      setAttachments(toSend);
    } finally {
      setPendingUser(null);
      setSending(false);
      inputRef.current?.focus();
    }
  }
  async function send() {
    await sendWith(input.trim());
  }


  async function newChat() {
    const t = await createFn({ data: {} });
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    try {
      const arr: Attachment[] = [];
      for (const f of Array.from(files).slice(0, 2)) arr.push(await fileToAttachment(f));
      setAttachments((prev) => [...prev, ...arr].slice(0, 3));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      e.target.value = "";
    }
  }

  async function onSaveNote(content: string) {
    try {
      const title = prompt("Title for this note?", content.slice(0, 60)) ?? "";
      if (!title.trim()) return;
      await saveNoteFn({ data: { topic: title.trim(), content } });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      toast.success("Saved to Notes");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save note");
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-6xl gap-4 lg:h-[calc(100vh-4rem)]">
      {/* Thread list */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="glass flex h-full flex-col rounded-2xl p-3">
          <button onClick={newChat} className="btn-primary mb-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New chat
          </button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {threadsQ.data?.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1 rounded-lg pr-1 ${
                  t.id === threadId ? "bg-primary/20" : "hover:bg-white/5"
                }`}
              >
                <button
                  onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: t.id } })}
                  className="flex flex-1 items-center gap-2 truncate px-3 py-2 text-left text-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Delete?")) return;
                    await deleteFn({ data: { id: t.id } });
                    qc.invalidateQueries({ queryKey: ["threads"] });
                    if (t.id === threadId) navigate({ to: "/chat" });
                  }}
                  className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl glass">
        <div ref={scrollerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {msgsQ.data?.length === 0 && !pendingUser && (
            <div className="mx-auto max-w-md py-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl btn-primary animate-pulse-glow">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-bold">Ask me anything</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick a mark weight below, then ask a question. Upload an image or PDF to analyze it too.
              </p>
            </div>
          )}
          {msgsQ.data?.map((m: any) => (
            <Bubble
              key={m.id}
              role={m.role}
              content={m.content}
              onSaveNote={m.role === "assistant" ? () => onSaveNote(m.content) : undefined}
            />
          ))}
          {pendingUser && <Bubble role="user" content={pendingUser} />}
          {sending && (
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="glass rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-glass-border p-3 sm:p-4">
          {/* Mark selector + voice toggle */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Answer type:</span>
            {MARK_OPTIONS.map((o) => (
              <button
                key={o.v}
                onClick={() => setMarks(o.v)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  marks === o.v
                    ? "btn-primary shadow-glow"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => setAutoRead((v) => !v)}
              title="Auto-read AI responses"
              className={`ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                autoRead
                  ? "btn-primary shadow-glow"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              <Volume2 className="h-3 w-3" /> Auto-read {autoRead ? "on" : "off"}
            </button>
            {voices.length > 0 && (
              <select
                value={selectedURI ?? ""}
                onChange={(e) => setVoice(e.target.value || null)}
                title="Voice"
                className="max-w-[160px] truncate rounded-lg border border-glass-border bg-white/5 px-2 py-1 text-xs text-muted-foreground outline-none hover:text-foreground focus:border-primary"
              >
                <option value="">Default voice</option>
                {voices.map((v) => {
                  const g = guessGender(v);
                  const label =
                    g === "female" ? "♀" : g === "male" ? "♂" : "•";
                  return (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {label} {v.name} ({v.lang})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {voice.listening && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="font-medium">Listening…</span>
              <span className="flex-1 truncate italic opacity-90">{voice.transcript || "Speak now"}</span>
              <button onClick={voice.cancel} className="rounded p-1 hover:bg-primary/20">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {voice.error && !voice.listening && (
            <div className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {voice.error}
            </div>
          )}


          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <button
                    onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground">
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={onFile}
              />
            </label>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              className="min-h-[40px] max-h-40 flex-1 resize-none rounded-xl border border-glass-border bg-input/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            {voice.supported && (
              <button
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                disabled={sending}
                title={voice.listening ? "Stop recording" : "Speak your question"}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
                  voice.listening
                    ? "bg-destructive/20 text-destructive animate-pulse-glow ring-2 ring-destructive/50"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`}
              >
                {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="btn-primary grid h-10 w-10 place-items-center rounded-xl disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  onSaveNote,
}: {
  role: string;
  content: string;
  onSaveNote?: () => void;
}) {
  const isUser = role === "user";
  const [hw, setHw] = useState(false);
  const hwRef = useRef<HTMLDivElement>(null);
  const tts = useSpeechSynthesis();


  async function hwPdf() {
    if (!hwRef.current) return;
    try {
      await downloadHandwrittenPdf(hwRef.current, content.slice(0, 40));
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    }
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          isUser ? "btn-primary" : "bg-primary/20 text-primary"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? "" : "space-y-2"}`}>
        {hw && !isUser ? (
          <div ref={hwRef} className="handwritten whitespace-pre-wrap">
            {content.replace(/^#{1,6}\s*/gm, "").replace(/^\s*[-*]\s+/gm, "• ")}
          </div>
        ) : (
          <div
            className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser ? "btn-primary" : "glass"
            }`}
          >
            {content}
          </div>
        )}
        {!isUser && onSaveNote && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {tts.supported && (
              <button
                onClick={() => {
                  if (tts.isActive && tts.state === "speaking") tts.pause();
                  else if (tts.isActive && tts.state === "paused") tts.resume();
                  else tts.speak(content);
                }}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                  tts.isActive ? "bg-primary/20 text-primary" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {tts.isActive && tts.state === "speaking" ? (
                  <><Pause className="h-3 w-3" /> Pause</>
                ) : tts.isActive && tts.state === "paused" ? (
                  <><Play className="h-3 w-3" /> Resume</>
                ) : (
                  <><Volume2 className="h-3 w-3" /> Listen</>
                )}
              </button>
            )}
            {tts.isActive && (
              <button
                onClick={tts.stop}
                className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 hover:bg-white/10"
              >
                <Square className="h-3 w-3" /> Stop
              </button>
            )}
            <button
              onClick={onSaveNote}
              className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 hover:bg-white/10"
            >
              <BookmarkPlus className="h-3 w-3" /> Save note
            </button>

            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(content);
                  toast.success("Copied");
                } catch {
                  toast.error("Copy failed");
                }
              }}
              className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 hover:bg-white/10"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <button
              onClick={() => setHw((v) => !v)}
              className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 hover:bg-white/10"
            >
              <PenLine className="h-3 w-3" /> {hw ? "Normal" : "Handwritten"}
            </button>
            <button
              onClick={() => downloadTextPdf("StudyMate answer", content)}
              className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 hover:bg-white/10"
            >
              <FileText className="h-3 w-3" /> PDF
            </button>
            {hw && (
              <button
                onClick={hwPdf}
                className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-primary hover:bg-primary/30"
              >
                <Download className="h-3 w-3" /> Handwritten PDF
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
