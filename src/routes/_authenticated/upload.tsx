import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { analyzeUpload } from "@/lib/studymate.functions";
import { useState } from "react";
import { Upload, Loader2, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  const fn = useServerFn(analyzeUpload);
  const [file, setFile] = useState<File | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function analyze() {
    if (!file || busy) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("File must be under 8MB");
    setBusy(true);
    setResult(null);
    try {
      const isImg = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImg && !isPdf) throw new Error("Only images and PDFs supported");
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { analysis } = await fn({
        data: {
          instruction: instruction || undefined,
          attachment: {
            kind: isImg ? "image" : "pdf",
            name: file.name,
            mimeType: file.type,
            dataUrl,
          },
        },
      });
      setResult(analysis);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload & Analyze</h1>
        <p className="mt-1 text-muted-foreground">
          Upload an image or PDF — even handwritten notes — and get a clean summary.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-glass-border bg-white/5 py-10 text-center hover:border-primary hover:bg-primary/5">
          <div className="grid h-12 w-12 place-items-center rounded-xl btn-primary">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">
              {file ? file.name : "Click to upload an image or PDF"}
            </div>
            <div className="text-xs text-muted-foreground">Max 8MB · PNG, JPG, PDF</div>
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {file && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
            {file.type.startsWith("image/") ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
            <span className="truncate">{file.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </div>
        )}

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          placeholder="Optional: what should the AI do? (e.g. 'summarize', 'explain in simple terms')"
          className="mt-4 w-full rounded-xl border border-glass-border bg-input/60 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />

        <button
          onClick={analyze}
          disabled={!file || busy}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Analyze
        </button>
      </div>

      {result && (
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold gradient-text">Analysis</h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result}</div>
        </div>
      )}
    </div>
  );
}
