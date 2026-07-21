import { useCallback, useEffect, useRef, useState } from "react";

type Rec = any;

/* ------------------------------------------------------------------ */
/* Speech recognition (mic → text)                                    */
/* ------------------------------------------------------------------ */

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useSpeechRecognition(opts?: { onFinal?: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Rec | null>(null);
  const finalRef = useRef("");
  const stoppedByUserRef = useRef(false);
  const onFinalRef = useRef(opts?.onFinal);
  onFinalRef.current = opts?.onFinal;

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  const start = useCallback(async () => {
    const SR = getSR();
    if (!SR) {
      setError("Voice input isn't supported in this browser. Try Chrome, Edge, or Safari.");
      return;
    }

    // Ensure mic permission (real prompt) before starting recognition.
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch (e: any) {
        const name = e?.name || "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Microphone permission denied. Enable it in your browser settings.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("No microphone was found on this device.");
        } else {
          setError("Could not access the microphone.");
        }
        return;
      }
    }

    // Clean up any previous instance.
    try {
      recRef.current?.abort?.();
    } catch {}

    const rec: Rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";

    finalRef.current = "";
    stoppedByUserRef.current = false;
    setTranscript("");
    setError(null);

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setTranscript((finalRef.current + interim).trim());
    };

    rec.onerror = (e: any) => {
      const err = e?.error || "unknown";
      if (err === "not-allowed" || err === "service-not-allowed") {
        setError("Microphone permission denied.");
      } else if (err === "no-speech") {
        setError("I didn't catch that — try speaking again.");
      } else if (err === "audio-capture") {
        setError("No microphone was found on this device.");
      } else if (err === "network") {
        setError("Network error while transcribing. Check your connection.");
      } else if (err === "aborted") {
        // user-initiated, don't surface
      } else {
        setError(`Voice error: ${err}`);
      }
    };

    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      if (text && onFinalRef.current) onFinalRef.current(text);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // already started — ignore
    }
  }, []);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    try {
      recRef.current?.stop();
    } catch {}
  }, []);

  const cancel = useCallback(() => {
    stoppedByUserRef.current = true;
    finalRef.current = "";
    setTranscript("");
    try {
      recRef.current?.abort();
    } catch {}
    setListening(false);
  }, []);

  return { supported, listening, transcript, error, start, stop, cancel };
}

/* ------------------------------------------------------------------ */
/* Speech synthesis (text → speech) + voice picker                    */
/* ------------------------------------------------------------------ */

type SpeechState = "idle" | "speaking" | "paused";

let currentId: string | null = null;
const stateListeners = new Set<() => void>();
function notifyState() {
  stateListeners.forEach((l) => l());
}

const VOICE_KEY = "sm_tts_voice";

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function guessGender(v: SpeechSynthesisVoice): "female" | "male" | "unknown" {
  const n = `${v.name}`.toLowerCase();
  if (/(female|woman|girl|samantha|victoria|karen|zira|susan|serena|tessa|fiona|moira|kate|allison|ava|amelia|sara|anna|monica|paulina|nora)/.test(n))
    return "female";
  if (/(male|man|boy|daniel|david|mark|alex|fred|tom|george|oliver|thomas|rishi|arthur|diego|jorge|luca|matteo)/.test(n))
    return "male";
  return "unknown";
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedURI, setSelectedURI] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(loadVoices());
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    try {
      setSelectedURI(localStorage.getItem(VOICE_KEY));
    } catch {}
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);

  const setVoice = useCallback((uri: string | null) => {
    setSelectedURI(uri);
    try {
      if (uri) localStorage.setItem(VOICE_KEY, uri);
      else localStorage.removeItem(VOICE_KEY);
    } catch {}
  }, []);

  return { voices, selectedURI, setVoice };
}

function pickVoice(): SpeechSynthesisVoice | null {
  const list = loadVoices();
  if (!list.length) return null;
  let uri: string | null = null;
  try {
    uri = localStorage.getItem(VOICE_KEY);
  } catch {}
  return list.find((v) => v.voiceURI === uri) ?? null;
}

/** Subscribe to global "is anyone speaking" — for a header pulse. */
export function useIsSpeaking() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const l = () => setSpeaking(currentId !== null);
    stateListeners.add(l);
    return () => {
      stateListeners.delete(l);
    };
  }, []);
  return speaking;
}

export function useSpeechSynthesis() {
  const [id] = useState(() => Math.random().toString(36).slice(2));
  const [state, setState] = useState<SpeechState>("idle");
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    const l = () => {
      if (currentId !== id) setState("idle");
    };
    stateListeners.add(l);
    return () => {
      stateListeners.delete(l);
    };
  }, [id]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[#*_`>]/g, "")
        .replace(/\n{2,}/g, ". ");
      const u = new SpeechSynthesisUtterance(clean);
      const v = pickVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.rate = 1;
      u.pitch = 1;
      u.onend = () => {
        if (currentId === id) {
          currentId = null;
          setState("idle");
          notifyState();
        }
      };
      u.onerror = () => {
        if (currentId === id) {
          currentId = null;
          setState("idle");
          notifyState();
        }
      };
      currentId = id;
      setState("speaking");
      notifyState();
      window.speechSynthesis.speak(u);
    },
    [id, supported],
  );

  const pause = useCallback(() => {
    if (!supported || currentId !== id) return;
    window.speechSynthesis.pause();
    setState("paused");
  }, [id, supported]);

  const resume = useCallback(() => {
    if (!supported || currentId !== id) return;
    window.speechSynthesis.resume();
    setState("speaking");
  }, [id, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    if (currentId === id) currentId = null;
    setState("idle");
    notifyState();
  }, [id, supported]);

  return { supported, state, speak, pause, resume, stop, isActive: currentId === id };
}
