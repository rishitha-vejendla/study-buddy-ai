import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Sparkles, Upload, FlaskConical, FileText, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const features = [
  { icon: Brain, title: "Learn Mode", desc: "Chat with an AI tutor that explains any concept simply." },
  { icon: Sparkles, title: "Notes Generator", desc: "Turn any topic into clean, structured study notes." },
  { icon: Upload, title: "Upload & Analyze", desc: "Extract text from images & PDFs — even handwriting." },
  { icon: FlaskConical, title: "Test Mode", desc: "AI-generated quizzes with instant grading and feedback." },
  { icon: FileText, title: "Model Papers", desc: "Generate 2-mark, 5-mark and coding papers by subject." },
  { icon: LineChart, title: "Progress Tracking", desc: "See topics studied, scores and streaks at a glance." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-20 h-96 w-96 rounded-full bg-primary/30 blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-1/2 -right-32 h-[500px] w-[500px] rounded-full bg-accent/20 blur-3xl animate-float" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl btn-primary">
            <Brain className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">StudyMate AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link to="/auth" search={{ mode: "signup" }} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
            Get started
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Powered by Lovable AI
        </div>
        <h1 className="mt-6 text-5xl font-black leading-tight sm:text-7xl">
          Your personal <span className="gradient-text">AI study</span> companion
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Ask questions, generate notes, analyze handwritten pages, take AI-graded tests, and get model papers — all in one calm, focused workspace.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="btn-primary rounded-xl px-6 py-3 font-semibold animate-pulse-glow"
          >
            Start studying free
          </Link>
          <Link to="/auth" className="glass rounded-xl px-6 py-3 font-semibold hover:brightness-110">
            I already have an account
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 transition hover:-translate-y-1 hover:brightness-110">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/20 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
