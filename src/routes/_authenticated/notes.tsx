import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateNotes, listNotes, deleteNote } from "@/lib/studymate.functions";
import { useRef, useState } from "react";
import { Sparkles, Loader2, BookOpen, Download, PenLine, FileText, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { downloadTextPdf, downloadHandwrittenPdf } from "@/lib/pdf-export";

export const Route = createFileRoute("/_authenticated/notes")({
  component: Notes,
});

type Note = { id: string; topic: string; content: string; created_at: string };

function Notes() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotes);
  const genFn = useServerFn(generateNotes);
  const delFn = useServerFn(deleteNote);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["notes"], queryFn: () => listFn() });

  async function generate() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    try {
      await genFn({ data: { topic: topic.trim() } });
      setTopic("");
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      toast.success("Notes generated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["notes"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notes Generator</h1>
        <p className="mt-1 text-muted-foreground">Turn any topic into clean, exam-ready notes.</p>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder="e.g. Photosynthesis, Newton's Laws, Binary search trees"
            className="flex-1 rounded-xl border border-glass-border bg-input/60 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={generate}
            disabled={busy || !topic.trim()}
            className="btn-primary flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {q.data?.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3">Your generated notes will appear here.</p>
          </div>
        )}
        {q.data?.map((n) => (
          <NoteCard key={n.id} note={n} onDelete={() => remove(n.id)} />
        ))}
      </div>
    </div>
  );
}

function NoteCard({ note, onDelete }: { note: Note; onDelete: () => void }) {
  const [hw, setHw] = useState(false);
  const hwRef = useRef<HTMLDivElement>(null);
  const hwId = `handwritten-notes-${note.id}`;

  async function pdfHandwritten() {
    if (!hwRef.current) {
      toast.error("Open the handwritten view first");
      return;
    }
    try {
      await downloadHandwrittenPdf(hwRef.current, note.topic);
    } catch (e: any) {
      toast.error(e.message ?? "Could not export PDF");
    }
  }

  return (
    <article className="glass rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold gradient-text">{note.topic}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHw((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
          >
            <PenLine className="h-3.5 w-3.5" />
            {hw ? "Normal view" : "Handwritten"}
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(note.content);
                toast.success("Copied to clipboard");
              } catch {
                toast.error("Copy failed");
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={() => downloadTextPdf(note.topic, note.content)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          {hw && (
            <button
              onClick={pdfHandwritten}
              className="flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30"
            >
              <Download className="h-3.5 w-3.5" /> Handwritten PDF
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {new Date(note.created_at).toLocaleString()}
      </div>
      {hw ? (
        <div id={hwId} ref={hwRef} className="handwritten mt-4 whitespace-pre-wrap">
          {note.content.replace(/^#{1,6}\s*/gm, "").replace(/^\s*[-*]\s+/gm, "• ")}
        </div>
      ) : (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {note.content}
        </div>
      )}
    </article>
  );
}
