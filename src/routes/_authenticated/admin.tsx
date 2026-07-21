import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings, updateAppSettings } from "@/lib/studymate.functions";
import { Shield, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: Admin,
});

const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, default)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (highest quality)" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (cheapest)" },
];
const FEATURE_KEYS = ["chat", "notes", "upload", "test", "papers"] as const;

function Admin() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateAppSettings);
  const q = useQuery({ queryKey: ["app_settings"], queryFn: () => fetchFn() });

  const [difficulty, setDifficulty] = useState("medium");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = q.data?.settings;
    if (!s) return;
    setDifficulty(s.difficulty);
    setSystemPrompt(s.system_prompt);
    setModel(s.model);
    setFeatures((s.features as Record<string, boolean>) ?? {});
  }, [q.data]);

  if (q.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!q.data?.isAdmin) {
    return (
      <div className="mx-auto max-w-md">
        <div className="glass rounded-2xl p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="mt-3 text-lg font-bold">Admin access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only workspace admins can manage app settings.
          </p>
        </div>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await updateFn({
        data: {
          difficulty: difficulty as any,
          system_prompt: systemPrompt,
          model,
          features: features as any,
        },
      });
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings updated — applied instantly to all users");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl btn-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Changes apply to every user immediately — no rebuild required.
          </p>
        </div>
      </div>

      <section className="glass rounded-2xl p-6 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold">Global difficulty</label>
          <div className="flex gap-2">
            {["easy", "medium", "hard"].map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium capitalize transition ${
                  difficulty === d ? "btn-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">AI model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-xl border border-glass-border bg-input/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">System prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-glass-border bg-input/60 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Enabled features</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {FEATURE_KEYS.map((k) => {
              const on = features[k] !== false;
              return (
                <button
                  key={k}
                  onClick={() => setFeatures({ ...features, [k]: !on })}
                  className={`rounded-xl px-3 py-2 text-sm font-medium capitalize transition ${
                    on ? "btn-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </section>
    </div>
  );
}
