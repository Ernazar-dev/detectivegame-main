import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

// Kali Linux Catppuccin Mocha theme
const KALI_THEME = {
  background:          "#0c0c0c",
  foreground:          "#cdd6f4",
  cursor:              "#367bf0",
  cursorAccent:        "#0c0c0c",
  selectionBackground: "rgba(54,123,240,0.25)",
  black:   "#45475a", red:     "#f38ba8",
  green:   "#a6e3a1", yellow:  "#f9e2af",
  blue:    "#89b4fa", magenta: "#f5c2e7",
  cyan:    "#94e2d5", white:   "#bac2de",
  brightBlack:   "#585b70", brightRed:     "#f38ba8",
  brightGreen:   "#a6e3a1", brightYellow:  "#f9e2af",
  brightBlue:    "#89b4fa", brightMagenta: "#f5c2e7",
  brightCyan:    "#94e2d5", brightWhite:   "#a6adc8",
};

function buildWsUrl(): string {
  const token   = localStorage.getItem("auth_token") || "";
  const apiUrl  = (import.meta.env.VITE_API_URL as string) || "";
  if (apiUrl) {
    // https://... → wss://...  |  http://... → ws://...
    return apiUrl.replace(/^http/, "ws") + "/api/ws/pty?token=" + token;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api/ws/pty?token=${token}`;
}

export default function KaliRealTerminal({ open, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef  = useRef<Terminal | null>(null);
  const wsRef    = useRef<WebSocket | null>(null);
  const fitRef   = useRef<FitAddon | null>(null);
  const roRef    = useRef<ResizeObserver | null>(null);
  const [isMax, setIsMax] = useState(false);
  const [status, setStatus] = useState<"connecting" | "connected" | "closed">("connecting");

  // Terminal yaratish va WebSocket ulash
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,monospace",
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 5000,
      theme: KALI_THEME,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);

    // Biroz kutamiz — konteyner o'lchamini olish uchun
    setTimeout(() => fit.fit(), 50);

    termRef.current = term;
    fitRef.current  = fit;

    // ── WebSocket ──────────────────────────────────────────────────────────
    const ws = new WebSocket(buildWsUrl());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      // Boshlang'ich o'lchamni yuboramiz
      const d = fit.proposeDimensions();
      if (d) ws.send(JSON.stringify({ type: "resize", cols: d.cols, rows: d.rows }));
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(e.data));
      } else {
        term.write(e.data as string);
      }
    };

    ws.onerror = () => {
      term.write("\r\n\x1b[1;31m[WebSocket error — check backend connection]\x1b[0m\r\n");
      setStatus("closed");
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[90m[session closed]\x1b[0m\r\n");
      setStatus("closed");
    };

    // Foydalanuvchi kiritishi → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    // ── Resize observer ────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        const d = fit.proposeDimensions();
        if (d) ws.send(JSON.stringify({ type: "resize", cols: d.cols, rows: d.rows }));
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    roRef.current = ro;

    // Esc → yopish
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      ws.close();
      term.dispose();
      termRef.current = null;
      wsRef.current   = null;
      fitRef.current  = null;
      roRef.current   = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Maximize o'zgarishi bo'lganda resize qilish
  useEffect(() => {
    setTimeout(() => {
      fitRef.current?.fit();
      const ws = wsRef.current;
      const fit = fitRef.current;
      if (ws?.readyState === WebSocket.OPEN && fit) {
        const d = fit.proposeDimensions();
        if (d) ws.send(JSON.stringify({ type: "resize", cols: d.cols, rows: d.rows }));
      }
    }, 80);
  }, [isMax]);

  const winStyle: React.CSSProperties = isMax
    ? { position: "fixed", inset: 0, borderRadius: 0 }
    : {
        position: "fixed",
        top: "3vh", left: "3vw", right: "3vw", bottom: "3vh",
        borderRadius: 8,
        boxShadow: "0 32px 90px rgba(0,0,0,0.92), 0 0 0 1px rgba(54,123,240,0.2)",
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
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Window */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              ...winStyle,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              background: "#0c0c0c",
              overflow: "hidden",
              border: "1px solid rgba(54,123,240,0.25)",
            }}
          >
            {/* ── Title bar ──────────────────────────────────────────────── */}
            <div style={{
              height: 36,
              background: "#141414",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              gap: 8,
              flexShrink: 0,
              userSelect: "none",
            }}>
              {/* Traffic lights */}
              <button onClick={onClose}                 style={dotBtn("#ff5f57")} />
              <button onClick={() => {}}                style={dotBtn("#febc2e")} />
              <button onClick={() => setIsMax(v => !v)} style={dotBtn("#28c840")} />

              {/* Title */}
              <span style={{
                flex: 1, textAlign: "center",
                color: "rgba(255,255,255,0.38)",
                fontSize: 12, letterSpacing: 0.2,
                fontFamily: "'JetBrains Mono', monospace",
                marginLeft: -70,
              }}>
                root@kali: ~/investigation
              </span>

              {/* Status dot */}
              <div style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background:
                  status === "connected"  ? "#28c840" :
                  status === "connecting" ? "#febc2e" : "#ff5f57",
                boxShadow:
                  status === "connected"  ? "0 0 6px #28c840" :
                  status === "connecting" ? "0 0 6px #febc2e" : "none",
                transition: "all 0.3s",
              }} />
              <span style={{
                color: "rgba(255,255,255,0.25)", fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                marginLeft: 4,
              }}>
                {status === "connected" ? "LIVE" : status === "connecting" ? "..." : "CLOSED"}
              </span>
            </div>

            {/* ── xterm.js container ─────────────────────────────────────── */}
            <div
              ref={containerRef}
              style={{
                flex: 1,
                overflow: "hidden",
                padding: "6px 6px 4px 6px",
                // Subtle scanline
                backgroundImage:
                  "repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(255,255,255,0.01) 19px,rgba(255,255,255,0.01) 20px)",
              }}
            />

            {/* ── Bottom accent ──────────────────────────────────────────── */}
            <div style={{
              height: 2, flexShrink: 0,
              background: "linear-gradient(90deg,transparent,#367bf0 35%,#367bf0 65%,transparent)",
              opacity: 0.55,
            }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const dotBtn = (color: string): React.CSSProperties => ({
  width: 12, height: 12,
  borderRadius: "50%",
  background: color,
  border: "none", padding: 0,
  cursor: "pointer", flexShrink: 0,
});
