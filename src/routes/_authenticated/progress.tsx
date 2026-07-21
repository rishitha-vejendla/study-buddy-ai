import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProgress } from "@/lib/studymate.functions";
import { LineChart, FlaskConical, Sparkles, MessageSquare, Upload, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  component: Progress,
});

const iconMap: Record<string, any> = {
  chat: MessageSquare,
  notes: Sparkles,
  upload: Upload,
  test: FlaskConical,
  paper: FileText,
};

function Progress() {
  const fn = useServerFn(getProgress);
  const q = useQuery({ queryKey: ["progress"], queryFn: () => fn() });
  const t = q.data?.totals;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Progress</h1>
        <p className="mt-1 text-muted-foreground">Track your learning activity and scores.</p>
      </div>

      {t && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Big label="Topics studied" value={t.topicsStudied} />
          <Big label="Tests taken" value={t.testsTaken} />
          <Big label="Avg. score" value={`${t.avgScore}%`} />
          <Big label="Notes generated" value={t.notesGenerated} />
        </div>
      )}

      <div className="glass rounded-2xl p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <LineChart className="h-4 w-4 text-primary" /> Recent activity
        </h2>
        <div className="space-y-2">
          {q.data?.recent.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet — start learning to see it here.</p>
          )}
          {q.data?.recent.map((e: any, i: number) => {
            const Icon = iconMap[e.kind] ?? Sparkles;
            return (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium capitalize">
                    {e.kind}
                    {e.topic ? ` · ${e.topic}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                {e.score != null && (
                  <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold">
                    {e.score}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Big({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-3xl font-black gradient-text">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
