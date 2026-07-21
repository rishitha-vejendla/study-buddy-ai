import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI, type ChatMessage } from "./ai-gateway.server";
import { z } from "zod";

async function getSettings(supabase: any) {
  const { data } = await supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
  return {
    difficulty: data?.difficulty ?? "medium",
    features: data?.features ?? {},
    system_prompt:
      data?.system_prompt ??
      "You are StudyMate AI, a friendly and clear study tutor.",
    model: data?.model ?? "google/gemini-2.5-flash",
  };
}

function difficultyLine(d: string) {
  if (d === "easy") return "Explain gently for a beginner. Use very simple language.";
  if (d === "hard") return "Assume the student is advanced. Go deep and precise.";
  return "Balance clarity with depth for an intermediate student.";
}

// ---------- Threads ----------
export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: data.title || "New chat" })
      .select("id,title,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("threads").update({ title: data.title }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id,role,content,attachments,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Chat ----------
const attachmentSchema = z.object({
  kind: z.enum(["image", "pdf"]),
  name: z.string(),
  mimeType: z.string(),
  dataUrl: z.string(), // data:...;base64,...
});

const marksSchema = z.enum(["1", "2", "5", "10"]).optional();

function marksInstruction(m?: string) {
  switch (m) {
    case "1":
      return "Answer in the style of a 1-mark question: 1 crisp sentence, 15-30 words. No headings, no lists.";
    case "2":
      return "Answer in the style of a 2-mark question: 2-3 short sentences, ~40-70 words. No headings.";
    case "5":
      return "Answer in the style of a 5-mark question: a short intro, 4-6 bullet points of key ideas, and a 1-sentence conclusion. ~150-220 words.";
    case "10":
      return "Answer in the style of a 10-mark question: Use ## headings for Introduction, Key Concepts, Detailed Explanation, Example, and Conclusion. ~350-500 words with bullet points where useful.";
    default:
      return "";
  }
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        content: z.string().max(8000),
        attachments: z.array(attachmentSchema).max(3).optional(),
        marks: marksSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const settings = await getSettings(context.supabase);

    // verify thread ownership
    const { data: thread } = await context.supabase
      .from("threads")
      .select("id,title")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");

    // Save user message
    const attachmentsMeta = data.attachments?.map((a) => ({
      kind: a.kind,
      name: a.name,
      mimeType: a.mimeType,
    })) ?? null;
    await context.supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: context.userId,
      role: "user",
      content: data.marks ? `[${data.marks} marks] ${data.content}` : data.content,
      attachments: attachmentsMeta,
    });

    // Build history
    const { data: history } = await context.supabase
      .from("messages")
      .select("role,content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(40);

    const marksLine = marksInstruction(data.marks);
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `${settings.system_prompt}\n\n${difficultyLine(settings.difficulty)}${marksLine ? "\n\n" + marksLine : ""}\n\nFormat responses with clear paragraphs, bullet points, and short headings when useful.`,
      },
      ...((history ?? []).slice(0, -1).map((m: any) => ({ role: m.role, content: m.content })) as ChatMessage[]),
    ];

    // Latest user message with attachments
    const userText = marksLine ? `${data.content}\n\n(${marksLine})` : data.content;
    const parts: any[] = [{ type: "text", text: userText }];
    for (const a of data.attachments ?? []) {
      if (a.kind === "image") {
        parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
      } else {
        parts.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
      }
    }
    messages.push({ role: "user", content: parts.length === 1 ? userText : parts });

    const reply = await callLovableAI({ model: settings.model, messages });

    await context.supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: context.userId,
      role: "assistant",
      content: reply,
    });

    // Auto-title new threads
    if (!thread.title || thread.title === "New chat") {
      const title = data.content.slice(0, 60).replace(/\s+/g, " ").trim() || "New chat";
      await context.supabase.from("threads").update({ title, updated_at: new Date().toISOString() }).eq("id", data.threadId);
    } else {
      await context.supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);
    }

    await context.supabase.from("progress_events").insert({
      user_id: context.userId,
      kind: "chat",
      topic: thread.title,
    });

    return { reply };
  });

// ---------- Notes generator ----------
export const generateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ topic: z.string().min(2).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const settings = await getSettings(context.supabase);
    const content = await callLovableAI({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: `${settings.system_prompt}\nYou write focused study notes. ${difficultyLine(settings.difficulty)}`,
        },
        {
          role: "user",
          content: `Create clean study notes on: "${data.topic}".
Structure the notes as:
## Overview
(short paragraph)
## Key Points
(bulleted essentials)
## Examples
(2-3 concrete examples)
## Exam Tips
(3-5 quick tips)
Keep it concise and student-friendly.`,
        },
      ],
    });

    const { data: note } = await context.supabase
      .from("notes")
      .insert({ user_id: context.userId, topic: data.topic, content })
      .select("id,topic,content,created_at")
      .single();

    await context.supabase.from("progress_events").insert({
      user_id: context.userId,
      kind: "notes",
      topic: data.topic,
    });
    return note;
  });

export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notes")
      .select("id,topic,content,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().min(1).max(200), content: z.string().min(1).max(20000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: note, error } = await context.supabase
      .from("notes")
      .insert({ user_id: context.userId, topic: data.topic, content: data.content })
      .select("id,topic,content,created_at")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("progress_events").insert({
      user_id: context.userId,
      kind: "notes",
      topic: data.topic,
    });
    return note;
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Upload analyze ----------
export const analyzeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ attachment: attachmentSchema, instruction: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const settings = await getSettings(context.supabase);
    const inst =
      data.instruction ||
      "Extract the text (including any handwriting), then provide a clean summary, key points and a simple explanation of the content.";

    const parts: any[] = [{ type: "text", text: inst }];
    if (data.attachment.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: data.attachment.dataUrl } });
    } else {
      parts.push({
        type: "file",
        file: { filename: data.attachment.name, file_data: data.attachment.dataUrl },
      });
    }

    const reply = await callLovableAI({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: `${settings.system_prompt}\nYou analyze uploaded study materials. ${difficultyLine(settings.difficulty)}`,
        },
        { role: "user", content: parts },
      ],
    });
    await context.supabase.from("progress_events").insert({
      user_id: context.userId,
      kind: "upload",
      topic: data.attachment.name,
    });
    return { analysis: reply };
  });

// ---------- Test mode ----------
export const startTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().min(2).max(200), count: z.number().int().min(3).max(10).default(5) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const settings = await getSettings(context.supabase);
    const raw = await callLovableAI({
      model: settings.model,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You generate short-answer test questions. ${difficultyLine(settings.difficulty)}\nReturn ONLY valid JSON of the form: {"questions":[{"q":"..."}]}. No prose.`,
        },
        { role: "user", content: `Topic: ${data.topic}\nGenerate ${data.count} short-answer questions.` },
      ],
    });
    let questions: { q: string }[] = [];
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      questions = parsed.questions ?? [];
    } catch {
      questions = raw
        .split(/\n+/)
        .filter((l) => /\?/.test(l))
        .slice(0, data.count)
        .map((l) => ({ q: l.replace(/^\d+[.)]\s*/, "").trim() }));
    }
    if (!questions.length) throw new Error("Could not generate questions. Try a different topic.");

    const { data: session, error } = await context.supabase
      .from("test_sessions")
      .insert({ user_id: context.userId, topic: data.topic, questions })
      .select("id,topic,questions")
      .single();
    if (error) throw new Error(error.message);
    return session;
  });

export const submitTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), answers: z.array(z.string().max(2000)) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const settings = await getSettings(context.supabase);
    const { data: session } = await context.supabase
      .from("test_sessions")
      .select("id,topic,questions")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Session not found");

    const pairs = (session.questions as any[]).map((q, i) => ({
      question: q.q,
      answer: data.answers[i] ?? "",
    }));
    const raw = await callLovableAI({
      model: settings.model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are a fair and encouraging grader. ${difficultyLine(settings.difficulty)}
Evaluate each answer on: correctness, completeness, and clarity.
Return ONLY JSON of this exact shape (no markdown):
{
  "overallScore": 0-100,
  "summary": "1-2 sentence overview of the student's performance",
  "strengths": ["..."],
  "mistakes": ["..."],
  "improvements": ["..."],
  "items": [
    {
      "correctness": 0-100,
      "completeness": 0-100,
      "clarity": 0-100,
      "feedback": "short paragraph",
      "strengths": ["..."],
      "mistakes": ["..."],
      "improvements": ["..."]
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Topic: ${session.topic}\nEvaluate these answers:\n${JSON.stringify(pairs, null, 2)}`,
        },
      ],
    });
    let feedback: any = { overallScore: 0, items: [] };
    try {
      feedback = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      feedback = {
        overallScore: 0,
        summary: raw.slice(0, 200),
        strengths: [],
        mistakes: [],
        improvements: [],
        items: pairs.map(() => ({ correctness: 0, feedback: raw.slice(0, 200) })),
      };
    }
    await context.supabase
      .from("test_sessions")
      .update({ answers: data.answers, feedback, score: feedback.overallScore ?? 0, completed: true })
      .eq("id", data.sessionId);
    await context.supabase.from("progress_events").insert({
      user_id: context.userId,
      kind: "test",
      topic: session.topic,
      score: feedback.overallScore ?? 0,
    });
    return feedback;
  });


// ---------- Model paper ----------
export const generateModelPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subject: z.string().min(2).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const settings = await getSettings(context.supabase);
    const content = await callLovableAI({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: `${settings.system_prompt}\nYou create model question papers. ${difficultyLine(settings.difficulty)}`,
        },
        {
          role: "user",
          content: `Create a model question paper for subject: "${data.subject}".
Include sections:
## Part A — 2 Mark Questions (10 questions)
## Part B — 5 Mark Questions (5 questions)
## Part C — Coding Questions (3 questions with expected approach hints)
Number each question and keep it exam-style.`,
        },
      ],
    });
    const { data: row } = await context.supabase
      .from("model_papers")
      .insert({ user_id: context.userId, subject: data.subject, content })
      .select("id,subject,content,created_at")
      .single();
    await context.supabase.from("progress_events").insert({
      user_id: context.userId,
      kind: "paper",
      topic: data.subject,
    });
    return row;
  });

export const listPapers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("model_papers")
      .select("id,subject,content,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

// ---------- Progress ----------
export const getProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: events }, { data: tests }, { data: notes }, { data: papers }] = await Promise.all([
      context.supabase
        .from("progress_events")
        .select("kind,topic,score,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
      context.supabase
        .from("test_sessions")
        .select("id,topic,score,completed,created_at")
        .eq("completed", true),
      context.supabase.from("notes").select("id"),
      context.supabase.from("model_papers").select("id"),
    ]);
    const testArr = tests ?? [];
    const avg =
      testArr.length > 0
        ? Math.round(testArr.reduce((s: number, t: any) => s + (t.score ?? 0), 0) / testArr.length)
        : 0;
    const topics = new Set((events ?? []).map((e: any) => e.topic).filter(Boolean));
    return {
      recent: events ?? [],
      totals: {
        topicsStudied: topics.size,
        testsTaken: testArr.length,
        notesGenerated: notes?.length ?? 0,
        papersGenerated: papers?.length ?? 0,
        avgScore: avg,
      },
    };
  });

// ---------- Admin ----------
export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("app_settings").select("*").eq("id", "global").maybeSingle();
    const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (role ?? []).some((r: any) => r.role === "admin");
    return { settings: data, isAdmin };
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        system_prompt: z.string().max(2000).optional(),
        model: z.string().max(80).optional(),
        features: z
          .object({
            chat: z.boolean(),
            notes: z.boolean(),
            upload: z.boolean(),
            test: z.boolean(),
            papers: z.boolean(),
          })
          .partial()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch: any = { updated_by: context.userId };
    if (data.difficulty) patch.difficulty = data.difficulty;
    if (data.system_prompt !== undefined) patch.system_prompt = data.system_prompt;
    if (data.model) patch.model = data.model;
    if (data.features) {
      const { data: cur } = await context.supabase
        .from("app_settings")
        .select("features")
        .eq("id", "global")
        .maybeSingle();
      patch.features = { ...((cur?.features as Record<string, boolean>) ?? {}), ...data.features };
    }
    const { error, data: row } = await context.supabase
      .from("app_settings")
      .update(patch)
      .eq("id", "global")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getPublicSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_settings")
      .select("difficulty,features")
      .eq("id", "global")
      .maybeSingle();
    return data ?? { difficulty: "medium", features: {} };
  });

// ---------- Smart Echo: daily learning summary ----------
export const getDailySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const settings = await getSettings(context.supabase);
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const { data: events } = await context.supabase
      .from("progress_events")
      .select("kind,topic,score,created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (!events || events.length === 0) {
      return { empty: true, summary: "", keyPoints: [] as string[], count: 0 };
    }

    const raw = await callLovableAI({
      model: settings.model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are StudyMate AI. Summarize a student's learning session in a warm, motivating tone.
Return ONLY JSON: {"summary":"2-3 sentence recap","keyPoints":["...","..."]}. 3-6 key points max.`,
        },
        {
          role: "user",
          content: `Today's activity:\n${JSON.stringify(events, null, 2)}`,
        },
      ],
    });
    let parsed: any = { summary: "", keyPoints: [] };
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { summary: raw.slice(0, 300), keyPoints: [] };
    }
    return { empty: false, count: events.length, ...parsed };
  });

// ---------- Re-Echo: revision suggestions from weak areas ----------
export const getRevisionSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const settings = await getSettings(context.supabase);

    const { data: weakTests } = await context.supabase
      .from("test_sessions")
      .select("topic,score")
      .eq("completed", true)
      .lt("score", 70)
      .order("created_at", { ascending: false })
      .limit(10);

    const topics = Array.from(new Set((weakTests ?? []).map((t: any) => t.topic))).slice(0, 5);
    if (topics.length === 0) {
      return { topics: [] as { topic: string; avgScore: number; tips: string[] }[] };
    }

    // Aggregate avg per topic
    const agg = topics.map((topic) => {
      const scores = (weakTests ?? []).filter((t: any) => t.topic === topic).map((t: any) => t.score ?? 0);
      const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      return { topic, avgScore: avg };
    });

    const raw = await callLovableAI({
      model: settings.model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are a study coach. For each weak topic, give 3 short, concrete revision tips (each < 18 words).
Return ONLY JSON: {"items":[{"topic":"...","tips":["...","...","..."]}]}`,
        },
        {
          role: "user",
          content: `Weak topics with average scores:\n${JSON.stringify(agg, null, 2)}`,
        },
      ],
    });
    let parsed: any = { items: [] };
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { items: agg.map((a) => ({ topic: a.topic, tips: [] })) };
    }
    const items = agg.map((a) => {
      const found = (parsed.items ?? []).find((i: any) => i.topic === a.topic);
      return { topic: a.topic, avgScore: a.avgScore, tips: found?.tips ?? [] };
    });
    return { topics: items };
  });

