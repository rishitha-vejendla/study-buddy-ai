import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateModelPaper, listPapers } from "@/lib/studymate.functions";
import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/papers")({
  component: Papers,
});

function Papers() {
  const qc = useQueryClient();
  const genFn = useServerFn(generateModelPaper);
  const listFn = useServerFn(listPapers);
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["papers"], queryFn: () => listFn() });

  async function generate() {
    if (!subject.trim() || busy) return;
    setBusy(true);
    try {
      await genFn({ data: { subject: subject.trim() } });
      setSubject("");
      qc.invalidateQueries({ queryKey: ["papers"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      toast.success("Model paper generated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Model Papers</h1>
        <p className="mt-1 text-muted-foreground">
          Instantly generate a 2-mark, 5-mark and coding paper for any subject.
        </p>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder="e.g. Data Structures, Physics 101, Organic Chemistry"
            className="flex-1 rounded-xl border border-glass-border bg-input/60 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={generate}
            disabled={busy || !subject.trim()}
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
            <FileText className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3">Generated papers will appear here.</p>
          </div>
        )}
        {q.data?.map((p) => (
          <article key={p.id} className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold gradient-text">{p.subject}</h2>
              <span className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {p.content}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
