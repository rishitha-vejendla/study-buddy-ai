import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Upload,
  FlaskConical,
  FileText,
  LineChart,
  Shield,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Volume2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings } from "@/lib/studymate.functions";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { useIsSpeaking } from "@/hooks/use-voice";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Learn Mode", icon: MessageSquare },
  { to: "/notes", label: "Notes Generator", icon: Sparkles },
  { to: "/upload", label: "Upload & Analyze", icon: Upload },
  { to: "/test", label: "Test Mode", icon: FlaskConical },
  { to: "/papers", label: "Model Papers", icon: FileText },
  { to: "/progress", label: "Progress", icon: LineChart },
] as const;

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { theme, toggle: toggleTheme } = useTheme();

  const fetchSettings = useServerFn(getAppSettings);
  const settingsQ = useQuery({ queryKey: ["app_settings"], queryFn: () => fetchSettings() });
  const isAdmin = settingsQ.data?.isAdmin ?? false;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const displayName =
    (user.user_metadata as any)?.display_name || user.email?.split("@")[0] || "Student";

  return (
    <div className="relative flex min-h-screen">
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-3xl" />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform glass-strong border-r border-glass-border transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl btn-primary">
              <Brain className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold">StudyMate AI</span>
          </Link>

          <nav className="flex-1 space-y-1">
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "btn-primary shadow-glow"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={`mt-4 flex items-center gap-3 rounded-xl border border-primary/30 px-3 py-2.5 text-sm font-medium transition ${
                  pathname.startsWith("/admin")
                    ? "btn-primary"
                    : "text-primary hover:bg-primary/10"
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin Panel
              </Link>
            )}
          </nav>

          <div className="border-t border-glass-border pt-3">
            <div className="mb-2 px-2 text-xs text-muted-foreground">
              Signed in as
              <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
            </div>
            <button
              onClick={toggleTheme}
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-glass-border glass px-4 py-3 lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg btn-primary">
              <Brain className="h-4 w-4" />
            </div>
            <span className="font-display font-bold">StudyMate AI</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"
              aria-label="Toggle menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <DesktopTopBar
          displayName={displayName}
          email={user.email ?? ""}
          onSignOut={signOut}
          onToggleTheme={toggleTheme}
          theme={theme}
        />

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function DesktopTopBar({
  displayName,
  email,
  onSignOut,
  onToggleTheme,
  theme,
}: {
  displayName: string;
  email: string;
  onSignOut: () => void;
  onToggleTheme: () => void;
  theme: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const speaking = useIsSpeaking();
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-glass-border glass px-6 py-3 lg:flex">
      <div className="flex items-center gap-3">
        {speaking && (
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Volume2 className="h-3 w-3" /> Speaking…
          </span>
        )}
      </div>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-glass-border bg-white/5 py-1.5 pl-1.5 pr-3 text-sm transition hover:bg-white/10"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full btn-primary text-xs font-bold">
            {initials || "S"}
          </span>
          <span className="max-w-[140px] truncate font-medium">{displayName}</span>
          <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div
            role="menu"
            className="glass-strong absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-glass-border p-1.5 shadow-glow animate-in fade-in slide-in-from-top-2"
          >
            <div className="px-3 py-2">
              <div className="text-sm font-semibold">{displayName}</div>
              <div className="truncate text-xs text-muted-foreground">{email}</div>
            </div>
            <div className="my-1 h-px bg-glass-border" />
            <button
              role="menuitem"
              onClick={() => {
                onToggleTheme();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
