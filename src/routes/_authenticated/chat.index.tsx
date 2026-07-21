import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread } from "@/lib/studymate.functions";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatList,
});

function ChatList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);

  const q = useQuery({ queryKey: ["threads"], queryFn: () => listFn() });

  async function newChat() {
    try {
      const t = await createFn({ data: {} });
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this chat?")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["threads"] });
    toast.success("Chat deleted");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Learn Mode</h1>
          <p className="mt-1 text-muted-foreground">Chat with your AI tutor.</p>
        </div>
        <button onClick={newChat} className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold">
          <Plus className="h-4 w-4" /> New chat
        </button>
      </div>

      <div className="mt-8 space-y-2">
        {q.data?.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-3 font-semibold">No conversations yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Start a new chat to ask anything.</p>
            <button onClick={newChat} className="btn-primary mt-5 rounded-xl px-5 py-2.5 font-semibold">
              Start your first chat
            </button>
          </div>
        )}
        {q.data?.map((t) => (
          <div key={t.id} className="glass flex items-center gap-3 rounded-xl p-3 pr-2 transition hover:brightness-110">
            <Link
              to="/chat/$threadId"
              params={{ threadId: t.id }}
              className="flex flex-1 items-center gap-3 min-w-0"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.updated_at).toLocaleString()}
                </div>
              </div>
            </Link>
            <button
              onClick={() => remove(t.id)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
