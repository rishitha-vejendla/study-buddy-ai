import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { startTest, submitTest } from "@/lib/studymate.functions";
import { useState } from "react";
import { FlaskConical, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/test")({
  component: TestMode,
});

type Session = { id: string; topic: string; questions: { q: string }[] };
type Item = { correctness: number; completeness?: number; clarity?: number; feedback: string; strengths?: string[]; mistakes?: string[]; improvements?: string[] };
type Feedback = { overallScore: number; summary?: string; strengths?: string[]; mistakes?: string[]; improvements?: string[]; items: Item[] };


function TestMode() {
  const startFn = useServerFn(startTest);
  const submitFn = useServerFn(submitTest);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function begin() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const s = await startFn({ data: { topic: topic.trim(), count } });
      setSession(s as Session);
      setAnswers(new Array((s as Session).questions.length).fill(""));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!session || busy) return;
    setBusy(true);
    try {
      const f = await submitFn({ data: { sessionId: session.id, answers } });
      setFeedback(f as Feedback);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSession(null);
    setFeedback(null);
    setAnswers([]);
    setTopic("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Test Mode</h1>
        <p className="mt-1 text-muted-foreground">AI generates questions, grades your answers, and gives feedback.</p>
      </div>

      {!session && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. World War II, Data Structures, Cell Biology"
              className="w-full rounded-xl border border-glass-border bg-input/60 px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Number of questions: {count}</label>
            <input
              type="range"
              min={3}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-[oklch(0.68_0.22_300)]"
            />
          </div>
          <button
            onClick={begin}
            disabled={!topic.trim() || busy}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Start test
          </button>
        </div>
      )}

      {session && !feedback && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Topic</div>
              <div className="font-semibold">{session.topic}</div>
            </div>
            <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
          {session.questions.map((q, i) => (
            <div key={i} className="glass rounded-2xl p-5">
              <div className="text-xs font-medium text-primary">Q{i + 1}</div>
              <p className="mt-1 font-medium">{q.q}</p>
              <textarea
                value={answers[i] ?? ""}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                rows={3}
                placeholder="Your answer…"
                className="mt-3 w-full rounded-xl border border-glass-border bg-input/60 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
          <button
            onClick={submit}
            disabled={busy}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Submit for grading
          </button>
        </div>
      )}

      {session && feedback && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-2 text-2xl font-bold">
              You scored <span className="gradient-text">{feedback.overallScore}%</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">on "{session.topic}"</p>
            {feedback.summary && <p className="mt-3 text-sm">{feedback.summary}</p>}
            <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/10">
              <div className="h-full btn-primary transition-all" style={{ width: `${feedback.overallScore}%` }} />
            </div>
          </div>
          {(feedback.strengths?.length || feedback.mistakes?.length || feedback.improvements?.length) && (
            <div className="grid gap-3 sm:grid-cols-3">
              {feedback.strengths?.length ? (
                <div className="glass rounded-2xl p-4">
                  <div className="text-xs font-semibold text-emerald-400">💪 Strengths</div>
                  <ul className="mt-2 space-y-1 text-sm">{feedback.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                </div>
              ) : null}
              {feedback.mistakes?.length ? (
                <div className="glass rounded-2xl p-4">
                  <div className="text-xs font-semibold text-rose-400">⚠️ Mistakes</div>
                  <ul className="mt-2 space-y-1 text-sm">{feedback.mistakes.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                </div>
              ) : null}
              {feedback.improvements?.length ? (
                <div className="glass rounded-2xl p-4">
                  <div className="text-xs font-semibold text-primary">✨ Improve</div>
                  <ul className="mt-2 space-y-1 text-sm">{feedback.improvements.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                </div>
              ) : null}
            </div>
          )}

          {session.questions.map((q, i) => (
            <div key={i} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary">Q{i + 1}</span>
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold">
                  {feedback.items[i]?.correctness ?? 0}%
                </span>
              </div>
              <p className="mt-1 font-medium">{q.q}</p>
              <div className="mt-2 text-xs text-muted-foreground">Your answer</div>
              <div className="rounded-lg bg-white/5 p-2 text-sm">{answers[i] || "—"}</div>
              <div className="mt-2 text-xs text-muted-foreground">Feedback</div>
              <div className="text-sm">{feedback.items[i]?.feedback ?? ""}</div>
            </div>
          ))}
          <button onClick={reset} className="btn-primary w-full rounded-xl py-3 font-semibold">
            Take another test
          </button>
        </div>
      )}
    </div>
  );
}
