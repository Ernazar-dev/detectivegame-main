import {
  useState, useEffect, useRef, useCallback,
  KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../lib/api";
import { Task, TerminalExecuteResult } from "../lib/types";

export type EvidenceItem = {
  id: string;
  evidenceId?: number;
  file: string;
  source: string;
  title: string;
  body: string;
  timestamp: string;
  mediaUrl?: string;
  mediaType?: string;
  relevance?: string;
  isKeyEvidence?: boolean;
  sent?: boolean;
  studentTag?: string | null;
  studentNote?: string;
  linkedSuspectId?: number | null;
};

// ─── Terminal history entry ───────────────────────────────────────────────────
type HistoryEntry =
  | { kind: "banner"; lines: string[] }
  | { kind: "cmd"; prompt: string; cmd: string; output: string[]; error: boolean };

// ─── Kali root palette ────────────────────────────────────────────────────────
const K = {
  bg:       "#0c0c0c",
  surface:  "#111111",
  blue:     "#367bf0",
  green:    "#98c379",
  red:      "#e06c75",
  white:    "#cdd6f4",
  muted:    "rgba(205,214,244,0.38)",
  border:   "rgba(54,123,240,0.22)",
  borderHi: "rgba(54,123,240,0.55)",
} as const;

const FONT = "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,Consolas,monospace";
const PROMPT_HOST = "root@kali";
const PROMPT_PATH = "~/investigation";
const PROMPT_CHAR = "#";

function buildPrompt() {
  return `${PROMPT_HOST}:${PROMPT_PATH}${PROMPT_CHAR}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  task: Task;
  open: boolean;
  onClose: () => void;
  collected: EvidenceItem[];
  setCollected: React.Dispatch<React.SetStateAction<EvidenceItem[]>>;
  // Faol tanlangan gumonlanuvchi ID si — per-suspect step rejimi uchun.
  // null bo'lsa eski erkin rejim ishlaydi.
  activeSuspectId?: number | null;
};

export default function EvidenceTerminal({ task, open, onClose, collected: _collected, setCollected: _setCollected, activeSuspectId }: Props) {
  // collected va setCollected - Play.tsx tomonidan beriladigan tashqi holat.
  // Hozircha foydalanilmaydi (ichki history state ishlatiladi), lekin
  // props sifatida qabul qilinib, TypeScript "unused prop" xatosini oldini olamiz.
  void _collected;
  void _setCollected;
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx]     = useState(-1);
  const [input, setInput]         = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [busy, setBusy]           = useState(false);
  const [isMax, setIsMax]         = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  const scrollBottom = () => {
    requestAnimationFrame(() => {
      if (containerRef.current)
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
    });
  };

  useEffect(scrollBottom, [history, busy]);

  // ── Focus input on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // ── Esc to close ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // ── Init: banner + session ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (history.length === 0) {
      const caseTitle = task.title.length > 44
        ? task.title.slice(0, 41) + "..."
        : task.title;

      setHistory([{
        kind: "banner",
        lines: [
          "\x1b[34m  ██╗  ██╗ █████╗ ██╗     ██╗\x1b[0m",
          "\x1b[34m  ██║ ██╔╝██╔══██╗██║     ██║\x1b[0m",
          "\x1b[34m  █████╔╝ ███████║██║     ██║\x1b[0m",
          "\x1b[34m  ██╔═██╗ ██╔══██║██║     ██║\x1b[0m",
          "\x1b[34m  ██║  ██╗██║  ██║███████╗██║\x1b[0m",
          "\x1b[34m  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝\x1b[0m",
          "",
          "  Linux kali 6.8.0-kali3-amd64 #1 SMP PREEMPT_DYNAMIC",
          "  Last login: " + new Date().toUTCString(),
          "",
          "  ┌─────────────────────────────────────────────────┐",
          `  │ CASE: ${caseTitle.padEnd(43)}│`,
          "  │ ACCESS LEVEL: ROOT · CLASSIFIED                 │",
          "  └─────────────────────────────────────────────────┘",
          "",
          "  Type \x1b[33mhelp\x1b[0m to list available commands.",
          "",
        ],
      }]);
    }

    if (sessionId == null) {
      api
        .post<{ id: number }>("/play-sessions", { taskId: task.id })
        .then((r) => setSessionId(r.data.id))
        .catch(() => {
          setHistory((h) => [...h, {
            kind: "cmd",
            prompt: buildPrompt(),
            cmd: "",
            output: ["bash: could not create session: Connection refused"],
            error: true,
          }]);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Submit command ────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (busy) return;
    const cmd = input.trim();
    setInput("");
    setHistIdx(-1);

    const prompt = buildPrompt();

    // Empty enter — just add blank prompt line to history
    if (!cmd) {
      setHistory((h) => [...h, { kind: "cmd", prompt, cmd: "", output: [], error: false }]);
      return;
    }

    setCmdHistory((h) => [...h, cmd]);

    // Local commands
    if (cmd === "clear" || cmd === "cls") {
      setHistory([]);
      return;
    }
    if (cmd === "exit" || cmd === "logout") {
      setHistory((h) => [...h, { kind: "cmd", prompt, cmd, output: ["logout"], error: false }]);
      setTimeout(onClose, 300);
      return;
    }

    // Add command to history immediately (no output yet)
    setHistory((h) => [...h, { kind: "cmd", prompt, cmd, output: [], error: false }]);
    setBusy(true);

    if (sessionId == null) {
      setHistory((h) => {
        const copy = [...h];
        const last = copy[copy.length - 1];
        if (last?.kind === "cmd") {
          copy[copy.length - 1] = {
            ...last,
            output: ["bash: session not ready — please wait"],
            error: true,
          };
        }
        return copy;
      });
      setBusy(false);
      return;
    }

    try {
      const r = await api.post<TerminalExecuteResult>(
        `/sessions/${sessionId}/terminal-execute`,
        { command: cmd, suspectId: activeSuspectId ?? null }
      );
      const data = r.data;
      const lines = data.matched
        ? (data.output || "").split("\n")
        : [`bash: ${cmd}: command not found`];
      setHistory((h) => {
        const copy = [...h];
        const last = copy[copy.length - 1];
        if (last?.kind === "cmd") {
          copy[copy.length - 1] = { ...last, output: lines, error: !data.matched };
        }
        return copy;
      });
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message;
      setHistory((h) => {
        const copy = [...h];
        const last = copy[copy.length - 1];
        if (last?.kind === "cmd") {
          copy[copy.length - 1] = { ...last, output: [`bash: ${msg}`], error: true };
        }
        return copy;
      });
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, busy, sessionId, onClose]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!cmdHistory.length) return;
      const next = histIdx < 0 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(cmdHistory[next] || "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const next = histIdx + 1;
      if (next >= cmdHistory.length) { setHistIdx(-1); setInput(""); }
      else { setHistIdx(next); setInput(cmdHistory[next] || ""); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setHistory([]);
    }
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const cmd = input || "";
      setInput("");
      setHistIdx(-1);
      setBusy(false);
      setHistory((h) => [...h, {
        kind: "cmd",
        prompt: buildPrompt(),
        cmd: cmd + "^C",
        output: [],
        error: false,
      }]);
    }
  };

  // ── Render a banner line (supports simple \x1b[...m codes) ──────────────────
  function BannerLine({ raw }: { raw: string }) {
    // Very minimal ANSI: \x1b[34m = blue, \x1b[33m = yellow, \x1b[0m = reset
    const parts: { text: string; color?: string }[] = [];
    const re = /\x1b\[(\d+)m/g;
    let last = 0;
    let cur: string | undefined;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) parts.push({ text: raw.slice(last, m.index), color: cur });
      const code = parseInt(m[1]);
      cur = code === 34 ? K.blue : code === 33 ? "#e5c07b" : code === 0 ? undefined : cur;
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push({ text: raw.slice(last), color: cur });
    return (
      <span>
        {parts.map((p, i) => (
          <span key={i} style={{ color: p.color ?? K.muted }}>{p.text}</span>
        ))}
      </span>
    );
  }

  // ── Prompt JSX ──────────────────────────────────────────────────────────────
  function PromptPrefix({ prompt }: { prompt: string }) {
    // root@kali:~#
    const atIdx   = prompt.indexOf("@");
    const colonIdx = prompt.indexOf(":");
    const hashIdx  = prompt.lastIndexOf("#");
    const user = prompt.slice(0, atIdx);          // root
    const host = prompt.slice(atIdx + 1, colonIdx); // kali
    const path = prompt.slice(colonIdx + 1, hashIdx); // ~
    return (
      <span style={{ fontFamily: FONT, fontSize: 13, userSelect: "none" }}>
        <span style={{ color: K.red, fontWeight: 700 }}>{user}</span>
        <span style={{ color: K.white }}>@</span>
        <span style={{ color: K.blue, fontWeight: 700 }}>{host}</span>
        <span style={{ color: K.white }}>:</span>
        <span style={{ color: K.blue }}>{path}</span>
        <span style={{ color: K.white }}>{PROMPT_CHAR}&nbsp;</span>
      </span>
    );
  }

  const winStyle: React.CSSProperties = isMax
    ? { position: "fixed", inset: 0, borderRadius: 0 }
    : {
        position: "fixed",
        top: "4vh", left: "4vw", right: "4vw", bottom: "4vh",
        borderRadius: 8,
        boxShadow: "0 28px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(54,123,240,0.18)",
      };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(3px)",
            }}
          />

          {/* Window */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              ...winStyle,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              fontFamily: FONT,
              background: K.bg,
              overflow: "hidden",
              border: `1px solid ${K.border}`,
            }}
          >
            {/* ── Title bar ─────────────────────────────────────────────────── */}
            <div style={{
              height: 34,
              background: "#1a1a1a",
              borderBottom: "1px solid rgba(255,255,255,0.055)",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              gap: 10,
              flexShrink: 0,
              userSelect: "none",
            }}>
              {/* Traffic lights */}
              <button onClick={onClose}            style={dot("#ff5f57")} title="Close" />
              <button onClick={() => {}}            style={dot("#febc2e")} title="Minimize" />
              <button onClick={() => setIsMax(v=>!v)} style={dot("#28c840")} title={isMax ? "Restore" : "Maximize"} />

              {/* Title */}
              <span style={{
                flex: 1, textAlign: "center",
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                letterSpacing: 0.3,
                marginLeft: -60,
              }}>
                root@kali: ~/investigation
              </span>

              {/* Clear */}
              <button
                onClick={() => setHistory([])}
                style={{
                  background: "none", border: "none",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: 11, fontFamily: FONT,
                  cursor: "pointer", letterSpacing: 1,
                  padding: "2px 6px",
                }}
              >
                CLEAR
              </button>
            </div>

            {/* ── Terminal body ──────────────────────────────────────────────── */}
            <div
              ref={containerRef}
              onClick={() => inputRef.current?.focus()}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 16px 8px",
                background: K.bg,
                cursor: "text",
                // Subtle scanlines
                backgroundImage:
                  "repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(255,255,255,0.011) 19px,rgba(255,255,255,0.011) 20px)",
              }}
            >
              {/* ── Rendered history ──────────────────────────────────────── */}
              {history.map((entry, i) => {
                if (entry.kind === "banner") {
                  return (
                    <div key={i} style={{ marginBottom: 8 }}>
                      {entry.lines.map((line, j) => (
                        <div key={j} style={{ lineHeight: "1.55", minHeight: "1em" }}>
                          <pre style={{
                            margin: 0, fontSize: 12,
                            fontFamily: FONT, whiteSpace: "pre-wrap",
                          }}>
                            <BannerLine raw={line} />
                          </pre>
                        </div>
                      ))}
                    </div>
                  );
                }

                // cmd entry
                return (
                  <div key={i} style={{ marginBottom: 0 }}>
                    {/* Prompt + command */}
                    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
                      <PromptPrefix prompt={entry.prompt} />
                      <span style={{
                        color: K.white, fontFamily: FONT, fontSize: 13,
                        whiteSpace: "pre-wrap", wordBreak: "break-all",
                      }}>
                        {entry.cmd}
                      </span>
                    </div>

                    {/* Output lines */}
                    {entry.output.map((line, j) => (
                      <div key={j} style={{ lineHeight: "1.6" }}>
                        <pre style={{
                          margin: 0,
                          fontFamily: FONT,
                          fontSize: 13,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          color: entry.error ? K.red : K.white,
                        }}>
                          {line}
                        </pre>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* ── Busy indicator ────────────────────────────────────────── */}
              {busy && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  style={{ color: K.blue, fontSize: 13, marginTop: 2 }}
                >
                  ▌
                </motion.div>
              )}

              {/* ── Live input line ───────────────────────────────────────── */}
              {!busy && (
                <div style={{ display: "flex", alignItems: "center", marginTop: 0 }}>
                  <PromptPrefix prompt={buildPrompt()} />
                  <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                    {/* Visible text mirror */}
                    <span style={{
                      color: K.white,
                      fontFamily: FONT,
                      fontSize: 13,
                      whiteSpace: "pre",
                      pointerEvents: "none",
                      visibility: "hidden",
                      position: "absolute",
                    }}>
                      {input || " "}
                    </span>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      disabled={busy}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: K.white,
                        fontFamily: FONT,
                        fontSize: 13,
                        caretColor: K.blue,
                        letterSpacing: 0.2,
                        padding: 0,
                        margin: 0,
                        lineHeight: "1.6",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Bottom padding so text isn't flush at edge */}
              <div style={{ height: 12 }} />
            </div>

            {/* ── Blue accent line ──────────────────────────────────────────── */}
            <div style={{
              height: 2,
              background: `linear-gradient(90deg, transparent, ${K.blue} 40%, ${K.blue} 60%, transparent)`,
              opacity: 0.5,
              flexShrink: 0,
            }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const dot = (color: string): React.CSSProperties => ({
  width: 12, height: 12,
  borderRadius: "50%",
  background: color,
  border: "none",
  padding: 0,
  cursor: "pointer",
  flexShrink: 0,
});