import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProgress, getDailySummary, getRevisionSuggestions } from "@/lib/studymate.functions";
import {
  MessageSquare,
  Sparkles,
  Upload,
  FlaskConical,
  FileText,
  LineChart,
  TrendingUp,
  Sunrise,
  Repeat,
  Loader2,
} from "lucide-react";
import { SkeletonBox } from "@/components/skeleton-box";


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const cards = [
  { to: "/chat", icon: MessageSquare, title: "Learn Mode", desc: "Chat with your AI tutor.", color: "from-fuchsia-500/30 to-purple-500/30" },
  { to: "/notes", icon: Sparkles, title: "Notes Generator", desc: "Turn topics into notes.", color: "from-indigo-500/30 to-blue-500/30" },
  { to: "/upload", icon: Upload, title: "Upload & Analyze", desc: "Image or PDF → summary.", color: "from-cyan-500/30 to-teal-500/30" },
  { to: "/test", icon: FlaskConical, title: "Test Mode", desc: "AI-graded quizzes.", color: "from-pink-500/30 to-rose-500/30" },
  { to: "/papers", icon: FileText, title: "Model Papers", desc: "2/5-mark + coding.", color: "from-amber-500/30 to-orange-500/30" },
  { to: "/progress", icon: LineChart, title: "Progress", desc: "Track your growth.", color: "from-emerald-500/30 to-lime-500/30" },
] as const;

function Dashboard() {
  const { user } = Route.useRouteContext();
  const fn = useServerFn(getProgress);
  const summaryFn = useServerFn(getDailySummary);
  const revisionFn = useServerFn(getRevisionSuggestions);
  const q = useQuery({ queryKey: ["progress"], queryFn: () => fn() });
  const summaryQ = useQuery({ queryKey: ["dailySummary"], queryFn: () => summaryFn(), staleTime: 5 * 60_000 });
  const revisionQ = useQuery({ queryKey: ["revision"], queryFn: () => revisionFn(), staleTime: 5 * 60_000 });
  const name = (user.user_metadata as any)?.display_name || user.email?.split("@")[0] || "Student";
  const t = q.data?.totals;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          Hey <span className="gradient-text">{name}</span> 👋
        </h1>
        <p className="mt-2 text-muted-foreground">What would you like to learn today?</p>
      </div>

      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBox key={i} className="h-[86px]" />
          ))}
        </div>
      ) : t ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Topics studied" value={t.topicsStudied} icon={TrendingUp} />
          <Stat label="Tests taken" value={t.testsTaken} icon={FlaskConical} />
          <Stat label="Avg. score" value={`${t.avgScore}%`} icon={LineChart} />
          <Stat label="Notes generated" value={t.notesGenerated} icon={Sparkles} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="glass relative overflow-hidden rounded-2xl p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary">
                <Sunrise className="h-4 w-4" />
              </div>
              <h3 className="font-semibold">Today's Learning Summary</h3>
            </div>
            {summaryQ.isLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Summarizing…</div>
            ) : (summaryQ.data as any)?.empty ? (
              <p className="mt-3 text-sm text-muted-foreground">No activity yet today. Start a chat or a test — I'll recap it here.</p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-relaxed">{(summaryQ.data as any)?.summary}</p>
                {(summaryQ.data as any)?.keyPoints?.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {(summaryQ.data as any).keyPoints.map((k: string, i: number) => (
                      <li key={i} className="flex gap-2"><span className="text-primary">•</span> {k}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="glass relative overflow-hidden rounded-2xl p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-rose-500/30 to-pink-500/30 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary">
                <Repeat className="h-4 w-4" />
              </div>
              <h3 className="font-semibold">Recommended Revision</h3>
            </div>
            {revisionQ.isLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding weak spots…</div>
            ) : !(revisionQ.data as any)?.topics?.length ? (
              <p className="mt-3 text-sm text-muted-foreground">No weak topics yet. Take a test to unlock personalized revision.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {(revisionQ.data as any).topics.slice(0, 3).map((t: any) => (
                  <div key={t.topic} className="rounded-xl bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.topic}</span>
                      <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs text-destructive">{t.avgScore}%</span>
                    </div>
                    {t.tips?.length ? (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {t.tips.slice(0, 3).map((tip: string, i: number) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
                <Link to="/test" className="inline-block text-xs font-semibold text-primary hover:underline">Retake a test →</Link>
              </div>
            )}
          </div>
        </div>
      </div>



      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group glass relative overflow-hidden rounded-2xl p-6 transition hover:-translate-y-1 hover:brightness-110"
          >
            <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${c.color} blur-2xl transition group-hover:scale-125`} />
            <div className="relative">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/20 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/20 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}
