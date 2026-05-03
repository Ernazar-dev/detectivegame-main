import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { Spin, Modal, Form, Input, Select, message } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../lib/api";
import { Task, Suspect, Question } from "../../lib/types";
import { resolveAsset } from "../../lib/assets";
import { useIsMobile } from "../../lib/hooks";
import GibridTerminal, { EvidenceItem } from "../../components/GibridTerminal";

const BG_BOARD = "/bg-board.webp";

const diffMeta: Record<string, { color: string; label: string; glow: string }> =
  {
    easy: {
      color: "#22c55e",
      label: "НОВИЧОК",
      glow: "rgba(34,197,94,0.4)",
    },
    medium: {
      color: "#f59e0b",
      label: "ДЕТЕКТИВ",
      glow: "rgba(245,158,11,0.5)",
    },
    hard: {
      color: "#ef4444",
      label: "СТАРШИЙ ДЕТЕКТИВ",
      glow: "rgba(239,68,68,0.5)",
    },
  };

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function TW({
  text,
  speed = 20,
  onDone,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
}) {
  const [d, setD] = useState("");
  const [done, setDone] = useState(false);
  const i = useRef(0);
  useEffect(() => {
    i.current = 0;
    setD("");
    setDone(false);
    if (!text) return;
    const id = setInterval(() => {
      i.current++;
      setD(text.slice(0, i.current));
      if (i.current >= text.length) {
        clearInterval(id);
        setDone(true);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return (
    <span>
      {d}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ color: "#f59e0b" }}
        >
          ▋
        </motion.span>
      )}
    </span>
  );
}

function PinnedPhoto({
  suspect,
  isChosen,
  onClick,
  index,
  total,
  isMobile = false,
}: {
  suspect: Suspect;
  isChosen: boolean;
  onClick: () => void;
  index: number;
  total: number;
  isMobile?: boolean;
}) {
  const img = resolveAsset(suspect.avatar || suspect.characterAssetId) || "";

  const POSITIONS: Record<number, [number, number][]> = {
    // 1 — to'liq markaz
    1: [[50, 47]],

    // 2 — ikki tomon, markazroq
    2: [
      [30, 47],
      [70, 47],
    ],

    // 3 — uch teng, o'rtada
    3: [
      [20, 47],
      [50, 47],
      [80, 47],
    ],

    // 4 — 2×2 zig-zag: 1,3 chapga; 2,4 o'ngga siljigan
    4: [
      [24, 28],
      [68, 34], // 1-qator: chap yuqori, o'ng biroz pastroq
      [32, 65],
      [76, 59], // 2-qator: chap pastroq, o'ng biroz yuqoriroq
    ],

    // 5 — 3 yuqori + 2 markaz pastda
    5: [
      [18, 28],
      [50, 28],
      [82, 28],
      [34, 68],
      [66, 68],
    ],

    // 6 — 3×2 to'g'ri grid
    6: [
      [20, 26],
      [50, 26],
      [80, 26],
      [20, 68],
      [50, 68],
      [80, 68],
    ],

    // 7 — 3+2+2
    7: [
      [20, 20],
      [50, 20],
      [80, 20],
      [30, 52],
      [70, 52],
      [20, 78],
      [80, 78],
    ],

    // 8 — 3+3+2
    8: [
      [20, 18],
      [50, 18],
      [80, 18],
      [20, 50],
      [50, 50],
      [80, 50],
      [34, 80],
      [66, 80],
    ],

    // 9 — 3×3
    9: [
      [20, 16],
      [50, 16],
      [80, 16],
      [20, 49],
      [50, 49],
      [80, 49],
      [20, 80],
      [50, 80],
      [80, 80],
    ],
  };

  const pos = POSITIONS[Math.min(total, 9)]?.[index] ?? [50, 45];
  const [left, top] = pos;

  const rot = ((suspect.id * 11 + index * 5) % 11) - 5; // -5..+5 deg
  const szBase =
    total <= 2
      ? 130
      : total <= 4
        ? 115
        : total <= 6
          ? 100
          : total <= 9
            ? 88
            : 76;
  const sz = isMobile ? Math.round(szBase * 0.72) : szBase;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.7, rotate: rot * 2 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: rot }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 160,
        damping: 18,
      }}
      whileHover={{ scale: 1.18, rotate: 0, zIndex: 50, y: -14 }}
      onClick={onClick}
      style={{
        position: "absolute",
        left: `calc(${left}% - ${sz / 2}px)`,
        top: `calc(${top}% - ${(sz + 28) / 2}px)`,
        cursor: "pointer",
        zIndex: 5,
        filter: isChosen
          ? "drop-shadow(0 0 22px rgba(239,68,68,1))"
          : "drop-shadow(0 6px 18px rgba(0,0,0,0.9))",
        transition: "filter 0.3s",
      }}
    >
      {/* Drawing pin — CSS art */}
      <div
        style={{
          position: "absolute",
          top: -10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: isChosen
              ? "radial-gradient(circle at 35% 35%, #ff6b6b, #c0392b)"
              : "radial-gradient(circle at 35% 35%, #f0c040, #8B6914)",
            boxShadow: `0 3px 8px rgba(0,0,0,0.8), inset 0 -2px 4px rgba(0,0,0,0.3)`,
          }}
        />
        <div
          style={{
            width: 4,
            height: 8,
            background: isChosen ? "#c0392b" : "#7a5c14",
            margin: "-2px auto 0",
            borderRadius: "0 0 2px 2px",
          }}
        />
      </div>

      {/* Polaroid foto */}
      <div
        style={{
          width: sz,
          background: "#faf8f4",
          padding: "7px 7px 36px",
          borderRadius: 3,
          border: isChosen
            ? "2.5px solid #ef4444"
            : "2px solid rgba(0,0,0,0.08)",
          boxShadow: isChosen
            ? "0 8px 28px rgba(239,68,68,0.4), 0 3px 10px rgba(0,0,0,0.5)"
            : "0 6px 20px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.3)",
          transition: "border-color 0.3s, box-shadow 0.3s",
          position: "relative",
        }}
      >
        {/* Mugshot */}
        <div
          style={{
            height: sz,
            overflow: "hidden",
            background: "#1a1a2a",
            position: "relative",
          }}
        >
          {img && (
            <img
              src={img}
              alt={suspect.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                filter: "none",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          {/* Top-left corner mark */}
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              width: 10,
              height: 10,
              borderTop: "1.5px solid rgba(255,220,100,0.6)",
              borderLeft: "1.5px solid rgba(255,220,100,0.6)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 10,
              height: 10,
              borderTop: "1.5px solid rgba(255,220,100,0.6)",
              borderRight: "1.5px solid rgba(255,220,100,0.6)",
            }}
          />
          <AnimatePresence>
            {isChosen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3, rotate: 18 }}
                animate={{ opacity: 0.95, scale: 1, rotate: 12 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                style={{
                  position: "absolute",
                  top: "32%",
                  left: "50%",
                  transform: "translate(-50%,-50%) rotate(12deg)",
                  border: "2.5px solid #ef4444",
                  color: "#ef4444",
                  background: "rgba(255,255,255,0.93)",
                  fontFamily: "Special Elite, monospace",
                  fontSize: 8,
                  padding: "3px 7px",
                  borderRadius: 2,
                  letterSpacing: 2.5,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                ПОДОЗРЕВАЕМЫЙ
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Name + Рольe — kattaroq, hamisha k-е местоadi */}
        <div
          style={{
            position: "absolute",
            bottom: 3,
            left: 4,
            right: 4,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Special Elite, monospace",
              fontSize: isMobile
                ? sz >= 85
                  ? 10
                  : 9
                : sz >= 115
                  ? 12
                  : sz >= 100
                    ? 11
                    : 10,
              color: "#1a0e00",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 600,
            }}
          >
            {suspect.name}
          </div>
          <div
            style={{
              fontSize: isMobile ? 9 : sz >= 115 ? 10 : 9,
              color: "#7c3400",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {suspect.role}
          </div>
        </div>
      </div>

      {/* Ip dekor — oxirgi foto emas */}
      {index < total - 1 && (
        <svg
          style={{
            position: "absolute",
            top: 8,
            left: "100%",
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <path
            d={`M 0 4 Q 20 ${4 + (index % 3) * 6} 44 8`}
            stroke="rgba(200,120,60,0.4)"
            strokeWidth="0.8"
            fill="none"
            strokeDasharray="4 3"
          />
        </svg>
      )}
    </motion.div>
  );
}

// ── Case File Dossier (fon o'zgarmasdan ochiladi) ─────────────────────────────
function CaseDossier({
  suspect,
  onClose,
  onInterrogate,
  onAccuse,
  chosen,
}: {
  suspect: Suspect;
  onClose: () => void;
  onInterrogate: () => void;
  onAccuse: (id: number) => void;
  chosen: number | null;
}) {
  const isMobile = useIsMobile();
  const img = resolveAsset(suspect.avatar || suspect.characterAssetId) || "";
  const isChosen = chosen === suspect.id;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(3px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Manila papka — pastdan siljib chiqadi */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        style={{
          width: isMobile ? "100vw" : "min(860px, 94vw)",
          maxHeight: isMobile ? "92dvh" : "84vh",
          minHeight: isMobile ? "75dvh" : "auto",
          borderRadius: isMobile ? "20px 20px 0 0" : 16,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #f5e8cc 0%, #e8d5a0 100%)",
          boxShadow:
            "0 -20px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(120,80,20,0.35)",
          overflow: "hidden",
        }}
      >
        {/* Tab — redesigned header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1a0a00, #2d1200)",
            padding: "0 0 0",
            flexShrink: 0,
          }}
        >
          {/* Top strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 20px 8px",
              borderBottom: "1px solid rgba(255,200,80,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Blinking indicator */}
              <motion.div
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#ef4444",
                  boxShadow: "0 0 8px #ef4444",
                }}
              />
              <div>
                <div
                  style={{
                    color: "#ef4444",
                    fontFamily: "Special Elite, monospace",
                    fontSize: 9,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                  }}
                >
                  ⚠ СОВЕРШЕННО СЕКРЕТНО
                </div>
                <div
                  style={{
                    color: "#fde68a",
                    fontFamily: "Special Elite, monospace",
                    fontSize: 13,
                    letterSpacing: 2,
                    marginTop: 2,
                  }}
                >
                  ЛИЧНОЕ ДЕЛО № {String(suspect.id).padStart(3, "0")} —{" "}
                  {suspect.name.toUpperCase()}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Accusation status badge */}
              {isChosen && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    background: "rgba(239,68,68,0.2)",
                    border: "1px solid #ef4444",
                    borderRadius: 6,
                    padding: "4px 12px",
                    color: "#fca5a5",
                    fontFamily: "Special Elite, monospace",
                    fontSize: 10,
                    letterSpacing: 1.5,
                  }}
                >
                  ✓ ОБВИНЯЕМЫЙ
                </motion.div>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.5)",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 15,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          </div>
          {/* Info strip */}
          <div
            style={{
              display: "flex",
              gap: 0,
              padding: "6px 20px 8px",
              borderBottom: "1px solid rgba(120,80,20,0.3)",
            }}
          >
            {[
              { label: "ДОЛЖНОСТЬ", value: suspect.role },
              { label: "СТАТУС", value: "ПОДОЗРЕВАЕМЫЙ" },
              {
                label: "ВОПРОСОВ",
                value: String((suspect.questions || []).length),
              },
            ].map((item, i) => (
              <div key={i} style={{ flex: 1, paddingRight: 16 }}>
                <div
                  style={{
                    fontSize: 8,
                    color: "rgba(253,230,138,0.45)",
                    letterSpacing: 1.5,
                    fontFamily: "Special Elite, monospace",
                    textTransform: "uppercase",
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(253,230,138,0.85)",
                    fontFamily: "Special Elite, monospace",
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kontent */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* Chap/yuqori: mugshot */}
          <div
            style={{
              width: isMobile ? "100%" : 200,
              height: isMobile ? 200 : "auto",
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
              borderRight: isMobile ? "none" : "3px solid rgba(120,80,20,0.3)",
              borderBottom: isMobile ? "2px solid rgba(120,80,20,0.4)" : "none",
              background: "linear-gradient(to bottom, #1a1a2e, #0d0d1a)",
            }}
          >
            {img && (
              <img
                src={img}
                alt={suspect.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: isMobile ? "center 15%" : "top",
                  filter: "brightness(1) contrast(1.05)",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            {/* Gradient overlay pastda */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40%",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
              }}
            />
            {/* Foto burchak belgilari */}
            {[
              ["top:8px", "left:8px"],
              ["top:8px", "right:8px"],
              ["bottom:8px", "left:8px"],
              ["bottom:8px", "right:8px"],
            ].map((pos, j) => (
              <div
                key={j}
                style={{
                  position: "absolute",
                  width: 14,
                  height: 14,
                  ...Object.fromEntries(pos.map((p) => p.split(":"))),
                  borderTop: pos[0].startsWith("top")
                    ? "2px solid rgba(253,230,138,0.5)"
                    : "none",
                  borderBottom: pos[0].startsWith("bottom")
                    ? "2px solid rgba(253,230,138,0.5)"
                    : "none",
                  borderLeft: pos[1].startsWith("left")
                    ? "2px solid rgba(253,230,138,0.5)"
                    : "none",
                  borderRight: pos[1].startsWith("right")
                    ? "2px solid rgba(253,230,138,0.5)"
                    : "none",
                }}
              />
            ))}
            {/* ВИНОВЕН/НЕВИНОВЕН stamp — будет показан после обвинения */}
            {isChosen && (
              <motion.div
                initial={{ opacity: 0, rotate: -12, scale: 0.6 }}
                animate={{ opacity: 0.92, rotate: -12, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
                style={{
                  position: "absolute",
                  top: "28%",
                  left: "50%",
                  transform: "translateX(-50%) rotate(-12deg)",
                  border: "3px solid #ef4444",
                  color: "#ef4444",
                  background: "rgba(255,255,255,0.88)",
                  fontFamily: "Special Elite, monospace",
                  fontSize: 14,
                  padding: "5px 14px",
                  borderRadius: 3,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                ОБВИНЯЕТСЯ
              </motion.div>
            )}
            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: 0,
                right: 0,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "#fde68a",
                  fontFamily: "Special Elite, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {suspect.name}
              </div>
              <div
                style={{
                  color: "rgba(253,230,138,0.6)",
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {suspect.role}
              </div>
            </div>
          </div>

          {/* O'ng/pastki: ma'lumotlar */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isMobile ? "12px 16px" : "20px 24px",
            }}
          >
            {/* Daftar chiziqlari */}
            <div
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 27px, rgba(120,80,20,0.12) 27px, rgba(120,80,20,0.12) 28px)",
                lineHeight: "28px",
                paddingLeft: 12,
                borderLeft: "3px solid rgba(220,80,80,0.35)",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "Special Elite, monospace",
                  fontSize: 10,
                  color: "#7c3400",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  lineHeight: "normal",
                  marginBottom: 6,
                }}
              >
                Личные данные
              </div>
              {suspect.description && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#3d2000",
                    lineHeight: "28px",
                    margin: 0,
                  }}
                >
                  {suspect.description}
                </p>
              )}
            </div>

            {suspect.behaviorTraits && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(120,40,0,0.08)",
                  border: "1px solid rgba(120,80,20,0.2)",
                  borderRadius: 6,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#991b1b",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  ⚠ Поведение
                </div>
                <div
                  style={{ fontSize: 12, color: "#3d2000", lineHeight: 1.6 }}
                >
                  {suspect.behaviorTraits}
                </div>
              </div>
            )}

            <div
              style={{
                padding: "12px 16px",
                background: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(120,80,20,0.18)",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#7c3400",
                  fontFamily: "Special Elite, monospace",
                  marginBottom: 6,
                }}
              >
                📋 ПРОТОКОЛ
              </div>
              <div style={{ fontSize: 13, color: "#3d2000" }}>
                {(suspect.questions || []).length > 0
                  ? `${suspect.questions!.length}  вопросов подготовлено. Нажмите кнопку ниже для допроса.`
                  : "Вопросы ещё не добавлены."}
              </div>
            </div>
          </div>
        </div>

        {/* Нижние кнопки */}
        <div
          style={{
            padding: isMobile
              ? "12px 16px calc(12px + env(safe-area-inset-bottom,0px))"
              : "12px 20px",
            background: "rgba(0,0,0,0.12)",
            borderTop: "1px solid rgba(120,80,20,0.25)",
            display: "flex",
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            flexShrink: 0,
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid rgba(120,80,20,0.3)",
              color: "#7c5020",
              fontFamily: "Special Elite, monospace",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: 1,
              width: isMobile ? "100%" : "auto",
              textAlign: "center",
            }}
          >
            ← Закрыть
          </button>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexDirection: isMobile ? "row" : "row",
            }}
          >
            {/* Accusation button — directly from dossier */}
            <motion.button
              whileHover={{
                scale: 1.04,
                boxShadow: isChosen
                  ? "0 0 20px rgba(239,68,68,0.5)"
                  : "0 0 16px rgba(255,200,80,0.3)",
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onAccuse(suspect.id);
                onClose();
              }}
              style={{
                padding: "10px 22px",
                borderRadius: 8,
                flex: isMobile ? 1 : "none",
                background: isChosen
                  ? "linear-gradient(135deg,#b91c1c,#991b1b)"
                  : "linear-gradient(135deg,rgba(239,68,68,0.28),rgba(185,28,28,0.22))",
                border: `1px solid ${isChosen ? "#ef4444" : "rgba(239,68,68,0.75)"}`,
                color: isChosen ? "white" : "red",
                fontFamily: "Special Elite, monospace",
                fontSize: 12,
                letterSpacing: 1.5,
                cursor: "pointer",
                boxShadow: isChosen
                  ? "0 0 16px rgba(239,68,68,0.35)"
                  : "0 0 8px rgba(239,68,68,0.2), inset 0 0 12px rgba(239,68,68,0.08)",
                transition: "all 0.2s",
              }}
            >
              {isChosen ? "✓ ОБВИНЯЕМЫЙ" : "⚠ ОБВИНИТЬ"}
            </motion.button>
            {/* Interrogation button */}
            <motion.button
              whileHover={{
                scale: 1.04,
                boxShadow: "0 0 24px rgba(120,60,0,0.4)",
              }}
              whileTap={{ scale: 0.97 }}
              onClick={onInterrogate}
              style={{
                padding: "10px 22px",
                borderRadius: 8,
                flex: isMobile ? 1 : "none",
                background: "linear-gradient(135deg,#7c3400,#5c2400)",
                border: "none",
                color: "#fde68a",
                fontFamily: "Special Elite, monospace",
                fontSize: 12,
                letterSpacing: 1.5,
                cursor: "pointer",
                fontWeight: 700,
                boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
              }}
            >
              ДОПРОСИТЬ →
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Interrogation Room — O'YIN YURAGI ─────────────────────────────────────────
function InterrogationRoom({
  suspect,
  onBack,
  onChoose,
  chosen,
}: {
  suspect: Suspect;
  onBack: () => void;
  onChoose: (id: number) => void;
  chosen: number | null;
}) {
  const isMobile = useIsMobile();
  const [entered, setEntered] = useState(false);
  const [activeQ, setActiveQ] = useState<Question | null>(null);
  const [askedIds, setAskedIds] = useState<Set<number>>(new Set());
  const [typeDone, setTypeDone] = useState(false);

  const img = resolveAsset(suspect.avatar || suspect.characterAssetId) || "";
  const questions = suspect.questions || [];
  const isChosen = chosen === suspect.id;

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 600);
    return () => clearTimeout(t);
  }, []);

  const ask = (q: Question) => {
    setActiveQ(q);
    setTypeDone(false);
    setAskedIds((prev) => new Set([...prev, q.id]));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "#06080f",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── DEVOR — beton tekstura ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(170deg, #0e1018 0%, #080a12 55%, #0a0c14 100%)",
        }}
      >
        {/* Gorizontal beton chiziqlari */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${(i + 1) * 8.3}%`,
              height: 1,
              background: "rgba(255,255,255,0.018)",
            }}
          />
        ))}
        {/* Vertikal aralash chiziqlari */}
        {[15, 30, 50, 70, 85].map((x) => (
          <div
            key={x}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${x}%`,
              width: 1,
              background: "rgba(255,255,255,0.012)",
            }}
          />
        ))}
      </div>

      {/* ── LAMPOCHKA SVG ── */}
      <motion.g />
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <defs>
          <radialGradient id="lampLight" cx="50%" cy="5%" r="55%">
            <stop offset="0%" stopColor="rgba(255,215,100,0.28)" />
            <stop offset="45%" stopColor="rgba(255,175,50,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Kabel */}
        <motion.line
          x1="50%"
          y1="0"
          x2="50%"
          y2="70"
          stroke="rgba(160,140,80,0.5)"
          strokeWidth="2.5"
          animate={{ x2: ["49.5%", "50.5%", "49.5%"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Lampochka korpusi */}
        <motion.ellipse
          cx="50%"
          cy="75"
          rx="22"
          ry="14"
          fill="#1a1408"
          stroke="rgba(180,140,60,0.4)"
          strokeWidth="1.5"
          animate={{ cx: ["49.5%", "50.5%", "49.5%"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Yorug'lik bulbi */}
        <motion.ellipse
          cx="50%"
          cy="82"
          rx="14"
          ry="8"
          fill="rgba(255,235,160,0.9)"
          filter="url(#glow)"
          animate={{
            opacity: [0.85, 1, 0.85],
            cx: ["49.5%", "50.5%", "49.5%"],
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Yorug'lik konusi — tebranadi */}
        <motion.polygon
          points="50%,90 15%,100% 85%,100%"
          fill="url(#lampLight)"
          animate={{
            points: [
              "50%,90 15%,100% 85%,100%",
              "50.5%,90 15.5%,100% 85.5%,100%",
              "50%,90 15%,100% 85%,100%",
            ],
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Stol usti nuri */}
        <ellipse
          cx="50%"
          cy="100%"
          rx="38%"
          ry="12%"
          fill="rgba(255,200,80,0.06)"
        />
      </svg>

      {/* ── POL ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "24vh",
          background: "linear-gradient(to bottom, #14100a, #0a0806)",
          borderTop: "2px solid rgba(80,60,25,0.5)",
        }}
      >
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${i * 15}%`,
              height: 1,
              background: "rgba(0,0,0,0.25)",
            }}
          />
        ))}
      </div>

      {/* ── STOL — markazda horizontal ── */}
      <div
        style={{
          position: "absolute",
          bottom: "24vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "75%",
          maxWidth: 900,
          zIndex: 15,
        }}
      >
        {/* Stol yuzasi */}
        <div
          style={{
            height: 20,
            background: "linear-gradient(to bottom, #4a2e10, #2e1c08)",
            borderRadius: "8px 8px 0 0",
            boxShadow:
              "0 -6px 30px rgba(0,0,0,0.7), inset 0 3px 0 rgba(180,120,50,0.3), 0 0 60px rgba(255,180,60,0.07)",
            border: "1px solid rgba(140,90,30,0.6)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Yog'och chiziqlar */}
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: "8%",
              right: "8%",
              height: 1,
              background: "rgba(0,0,0,0.2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: "20%",
              right: "20%",
              height: 1,
              background: "rgba(255,255,255,0.03)",
            }}
          />
        </div>
        {/* Stol yon qismi */}
        <div
          style={{
            height: 10,
            background: "#1e0e04",
            borderRadius: "0 0 4px 4px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
          }}
        />
        {/* Stol oyoqlari */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 60px",
          }}
        >
          {[0, 1].map((j) => (
            <div
              key={j}
              style={{
                width: 18,
                height: 60,
                background: "linear-gradient(to bottom, #2e1c08, #14080001)",
                borderRadius: "0 0 6px 6px",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── STOL USTIDAGI BUYUMLAR ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: entered ? 1 : 0 }}
        transition={{ delay: 0.8, duration: 1 }}
        style={{
          position: "absolute",
          bottom: "calc(24vh + 22px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: "75%",
          maxWidth: 900,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        {/* Papka (chap) */}
        <div
          style={{
            position: "absolute",
            left: "8%",
            top: -55,
            width: 70,
            height: 88,
            background: "linear-gradient(145deg, #6b2800, #4a1c00)",
            transform: "rotate(-6deg)",
            borderRadius: "2px 6px 2px 2px",
            boxShadow: "2px 4px 12px rgba(0,0,0,0.6)",
            border: "1px solid rgba(180,100,30,0.3)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -4,
              left: 0,
              right: 0,
              height: 8,
              background: "#7c3400",
              borderRadius: "2px 6px 0 0",
            }}
          />
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                top: `${20 + i * 14}%`,
                height: 1,
                background: "rgba(255,200,100,0.15)",
              }}
            />
          ))}
        </div>
        {/* Qog'ozlar */}
        <div
          style={{
            position: "absolute",
            left: "13%",
            top: -40,
            width: 52,
            height: 68,
            background: "rgba(240,230,200,0.14)",
            transform: "rotate(-2deg)",
            border: "1px solid rgba(220,200,160,0.2)",
            borderRadius: 1,
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 6,
                right: 6,
                top: `${15 + i * 15}%`,
                height: 1,
                background: "rgba(100,80,40,0.2)",
              }}
            />
          ))}
        </div>
        {/* Ruchka */}
        <div
          style={{
            position: "absolute",
            right: "22%",
            top: -32,
            width: 5,
            height: 48,
            background: "linear-gradient(to right, #1a1a2e, #2a2a4e)",
            borderRadius: 3,
            transform: "rotate(12deg)",
            boxShadow: "1px 2px 4px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 10,
              background: "#c0a0a0",
              borderRadius: "3px 3px 0 0",
            }}
          />
        </div>
        {/* Stakan */}
        <div
          style={{
            position: "absolute",
            right: "12%",
            top: -44,
            width: 24,
            height: 34,
            background:
              "linear-gradient(to right, rgba(40,60,100,0.35), rgba(60,90,150,0.25))",
            borderRadius: "3px 3px 8px 8px",
            border: "1px solid rgba(100,140,200,0.3)",
            boxShadow: "inset 0 2px 6px rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 3,
              right: 3,
              height: 12,
              background: "rgba(150,200,255,0.1)",
              borderRadius: 2,
            }}
          />
        </div>
        {/* Sigaret kuldon */}
        <div
          style={{
            position: "absolute",
            left: "40%",
            top: -28,
            width: 32,
            height: 12,
            background: "linear-gradient(135deg, #2a2010, #1a1208)",
            borderRadius: 20,
            border: "1px solid rgba(100,80,40,0.4)",
          }}
        />
      </motion.div>

      {/* ── SUSPECT RASMI — CHAP TOMON (hidden on mobile) ── */}
      <motion.div
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          left: 0,
          bottom: "calc(24vh + 2px)",
          width: isMobile ? "35%" : "42%",
          maxWidth: 520,
          zIndex: 25,
          display: isMobile ? "none" : "flex",
          alignItems: "flex-end",
        }}
      >
        {img && (
          <div style={{ position: "relative", width: "100%" }}>
            {/* Lampochka nuri yuzga */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                background:
                  "radial-gradient(ellipse 70% 60% at 65% 10%, rgba(255,210,100,0.2) 0%, transparent 70%)",
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
            <motion.img
              src={img}
              alt={suspect.name}
              animate={
                entered
                  ? {
                      filter: [
                        "brightness(0.72) contrast(1.1)",
                        "brightness(0.76) contrast(1.12)",
                        "brightness(0.72) contrast(1.1)",
                      ],
                    }
                  : { filter: "brightness(0.5) contrast(1.0)" }
              }
              transition={
                entered
                  ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
                  : {}
              }
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "68vh",
                objectFit: "cover",
                objectPosition: "top center",
                display: "block",
                maskImage:
                  "linear-gradient(to right, transparent 0%, black 18%, black 90%, transparent 100%), linear-gradient(to top, transparent 0%, black 15%)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0%, black 18%, black 90%, transparent 100%), linear-gradient(to top, transparent 0%, black 15%)",
                maskComposite: "intersect",
                WebkitMaskComposite: "destination-in",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Yuz atrofida soya */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse 80% 100% at 50% 0%, transparent 40%, rgba(6,8,15,0.5) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </motion.div>

      {/* ── O'NG PANEL — DIALOG (full width on mobile) ── */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: isMobile ? "100%" : "56%",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* TOP HUD */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            padding: "16px 24px 14px",
            background:
              "linear-gradient(to bottom, rgba(6,8,15,0.97), rgba(6,8,15,0.6))",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onBack}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "Special Elite, monospace",
                letterSpacing: 1,
              }}
            >
              ← Назад
            </button>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <motion.div
                  animate={{ opacity: [1, 0.1, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#ef4444",
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    color: "#64748b",
                    fontFamily: "monospace",
                    letterSpacing: 2,
                  }}
                >
                  ИДЁТ ЗАПИСЬ
                </span>
              </div>
              <div
                style={{
                  color: "white",
                  fontFamily: "Special Elite, monospace",
                  fontSize: isMobile ? 16 : 20,
                  lineHeight: 1.1,
                }}
              >
                {suspect.name}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {suspect.role}
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              onChoose(suspect.id);
              onBack();
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              flexShrink: 0,
              border: `2px solid ${isChosen ? "#ef4444" : "rgba(255,255,255,0.14)"}`,
              background: isChosen ? "#ef4444" : "rgba(255,255,255,0.04)",
              color: isChosen ? "white" : "rgba(255,255,255,0.6)",
              fontFamily: "Special Elite, monospace",
              fontSize: 12,
              letterSpacing: 1.5,
              cursor: "pointer",
              textTransform: "uppercase",
              boxShadow: isChosen ? "0 0 20px rgba(239,68,68,0.45)" : "none",
              transition: "all 0.25s",
            }}
          >
            {isChosen ? "✓ Обвиняемый" : "Обвинять"}
          </motion.button>
        </motion.div>

        {/* MOBILE: suspect compact header */}
        {isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: entered ? 1 : 0, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              flexShrink: 0,
              background: "rgba(6,8,15,0.9)",
              borderBottom: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 52,
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(239,68,68,0.3)",
                flexShrink: 0,
                background: "#0d0d1a",
              }}
            >
              {img && (
                <img
                  src={img}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                    filter: "brightness(0.8)",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: "rgba(239,68,68,0.7)",
                  fontSize: 8,
                  letterSpacing: 2,
                  fontFamily: "Special Elite, monospace",
                  textTransform: "uppercase",
                }}
              >
                Допрос
              </div>
              <div
                style={{
                  color: "white",
                  fontFamily: "Special Elite, monospace",
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {suspect.name}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {suspect.role}
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onChoose(suspect.id);
                onBack();
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                flexShrink: 0,
                border: `1px solid ${isChosen ? "#ef4444" : "rgba(255,255,255,0.14)"}`,
                background: isChosen ? "#ef4444" : "rgba(255,255,255,0.04)",
                color: isChosen ? "white" : "rgba(255,255,255,0.6)",
                fontFamily: "Special Elite, monospace",
                fontSize: 10,
                letterSpacing: 1,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {isChosen ? "✓ Обвин." : "Обвинить"}
            </motion.button>
          </motion.div>
        )}

        {/* DIALOG MAYDONI */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: entered ? 1 : 0 }}
          transition={{ delay: 0.7 }}
          style={{
            flex: 1,
            padding: isMobile ? "12px 14px 16px" : "16px 24px 24px",
            display: "flex",
            flexDirection: "column",
            background:
              "linear-gradient(to bottom, rgba(6,8,15,0.6) 0%, rgba(6,8,15,0.95) 50%)",
            overflowY: "auto",
          }}
        >
          {/* Вопрос tanlash */}
          {!activeQ && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {questions.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 13,
                    fontStyle: "italic",
                  }}
                >
                  Для этого подозреваемого вопросы не добавлены
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.3)",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      fontFamily: "Special Elite, monospace",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />
                    Выберите вопрос
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {questions.map((q, i) => {
                      const asked = askedIds.has(q.id);
                      return (
                        <motion.button
                          key={q.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                          whileHover={{
                            x: 6,
                            background: asked
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(245,158,11,0.12)",
                          }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => ask(q)}
                          style={{
                            textAlign: "left",
                            padding: "12px 16px",
                            background: asked
                              ? "rgba(255,255,255,0.03)"
                              : "rgba(255,255,255,0.06)",
                            border: `1px solid ${asked ? "rgba(255,255,255,0.07)" : "rgba(245,158,11,0.2)"}`,
                            borderLeft: `3px solid ${asked ? "rgba(255,255,255,0.15)" : "#f59e0b"}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            color: asked
                              ? "rgba(255,255,255,0.35)"
                              : "rgba(255,255,255,0.88)",
                            fontSize: 13,
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 17, flexShrink: 0 }}>
                            {asked ? "✅" : "❓"}
                          </span>
                          <span style={{ flex: 1, lineHeight: 1.5 }}>
                            {q.question}
                          </span>
                          {asked && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.25)",
                                flexShrink: 0,
                                fontStyle: "italic",
                              }}
                            >
                              уже спрошен
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Yuzma-yuz dialog */}
          <AnimatePresence mode="wait">
            {activeQ && (
              <motion.div
                key={activeQ.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  gap: 16,
                }}
              >
                {/* Detektiv savoli — O'NG */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-end",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: isMobile ? "90%" : "72%",
                      background:
                        "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.18))",
                      border: "1px solid rgba(59,130,246,0.3)",
                      borderRadius: "18px 4px 18px 18px",
                      padding: "12px 18px",
                      boxShadow: "0 4px 20px rgba(37,99,235,0.15)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: "#60a5fa",
                        fontFamily: "Special Elite, monospace",
                        letterSpacing: 1.5,
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      Детектив
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? 13 : 14,
                        color: "rgba(255,255,255,0.9)",
                        lineHeight: 1.65,
                      }}
                    >
                      {activeQ.question}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "linear-gradient(135deg, #1e3a5f, #0c1f3a)",
                      border: "2px solid rgba(59,130,246,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                      marginTop: 4,
                    }}
                  >
                    🕵️
                  </div>
                </motion.div>

                {/* Suspect javobi — CHAP */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  {/* Mini avatar */}
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      flexShrink: 0,
                      overflow: "hidden",
                      border: "2px solid rgba(239,68,68,0.45)",
                      background: "#0d0d1a",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      marginTop: 4,
                    }}
                  >
                    {img && (
                      <img
                        src={img}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "top",
                          filter: "brightness(0.75)",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      maxWidth: isMobile ? "90%" : "72%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {/* Ответ bubble */}
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(10,12,20,0.95), rgba(15,18,30,0.9))",
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: "4px 18px 18px 18px",
                        padding: "12px 18px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: "rgba(239,68,68,0.75)",
                          fontFamily: "Special Elite, monospace",
                          letterSpacing: 1.5,
                          marginBottom: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        {suspect.name}
                      </div>
                      <div
                        style={{
                          fontSize: isMobile ? 13 : 14,
                          color: "rgba(255,255,255,0.85)",
                          lineHeight: 1.75,
                          fontStyle: "italic",
                        }}
                      >
                        "
                        <TW
                          key={activeQ.id}
                          text={activeQ.answer}
                          speed={18}
                          onDone={() => setTypeDone(true)}
                        />
                        "
                      </div>
                    </div>

                    {/* Keyingi savol */}
                    <AnimatePresence>
                      {typeDone && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <motion.button
                            whileHover={{
                              scale: 1.04,
                              background: "rgba(255,255,255,0.1)",
                            }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setActiveQ(null);
                              setTypeDone(false);
                            }}
                            style={{
                              padding: "9px 20px",
                              borderRadius: 8,
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.14)",
                              color: "rgba(255,255,255,0.55)",
                              fontFamily: "Special Elite, monospace",
                              fontSize: 12,
                              letterSpacing: 1.5,
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            ← Задать другой вопрос
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Bir tomonlama oyna */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: 0,
          width: 6,
          height: "55%",
          background:
            "linear-gradient(to right, rgba(100,150,200,0.18), rgba(100,150,200,0.04))",
          borderRight: "1px solid rgba(120,170,220,0.18)",
          zIndex: 5,
        }}
      />
    </motion.div>
  );
}

// ── Main Play ─────────────────────────────────────────────────────────────────
export default function Play() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(-1);
  const [introPhase, setIntroPhase] = useState<0 | 1>(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [dossier, setDossier] = useState<Suspect | null>(null);
  const [interrogate, setInterrogate] = useState<Suspect | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [terminalNote, setTerminalNote] = useState(""); // terminal xulosa
  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [form] = Form.useForm();

  const formatEvidenceForReport = (items: EvidenceItem[]) => {
    if (!items.length) return "";
    const suspectName = (sid?: number | null) => {
      if (sid == null) return null;
      return task?.suspects?.find((s) => s.id === sid)?.name || `id=${sid}`;
    };
    const tagLabel = (t?: string | null) =>
      t === "trusted"
        ? "✓ НАДЕЖНЫЙ"
        : t === "suspicious"
          ? "⚠ СОМНИТЕЛЬНЫЙ"
          : t === "fake"
            ? "✗ ФАЛЬШ (отклонено)"
            : null;

    // O'quvchining shaxsiy bahosi va izohini ustuvor qilamiz —
    // shunchaki dalil matnini emas, balki TAHLILNI yuboramiz.
    const fmt = (e: EvidenceItem, i: number) => {
      const tag = tagLabel(e.studentTag);
      const linked = suspectName(e.linkedSuspectId);
      const star = e.isKeyEvidence ? "⭐ " : "";
      const headerBits: string[] = [
        `[${e.source.toUpperCase()}] ${star}${e.title}`,
      ];
      if (tag) headerBits.push(tag);
      if (linked) headerBits.push(`⌬ ${linked}`);
      let block = `${i}. ${headerBits.join("  ·  ")}  (${e.file})`;
      if (e.studentNote) {
        block += `\n   ✎ ${e.studentNote}`;
      }
      // Tahlil qilingan dalil uchun matnni qisqaroq beramiz, raw bo'lmagani uchun
      const bodyLines = e.studentNote ? 3 : 6;
      block += `\n   ${e.body.split("\n").slice(0, bodyLines).join("\n   ")}`;
      return block;
    };

    const sent = items.filter((e) => e.sent);
    const trusted = items.filter((e) => !e.sent && e.studentTag === "trusted");
    const suspicious = items.filter(
      (e) => !e.sent && e.studentTag === "suspicious",
    );
    const fake = items.filter((e) => !e.sent && e.studentTag === "fake");
    const untagged = items.filter((e) => !e.sent && !e.studentTag);

    let out = "";
    if (sent.length > 0) {
      out +=
        "\n\n★ КЛЮЧЕВЫЕ УЛИКИ (переданы в штаб) ★\n" +
        sent.map((e, i) => fmt(e, i + 1)).join("\n\n");
    }
    if (trusted.length > 0) {
      out +=
        "\n\n✓ ДОКАЗАТЕЛЬСТВА, ОЦЕНЕННЫЕ КАК ДОВЕРНЫЕ (заключение агента) ✓\n" +
        trusted.map((e, i) => fmt(e, i + 1)).join("\n\n");
    }
    if (suspicious.length > 0) {
      out +=
        "\n\n⚠ СОМНИТЕЛЬНЫЕ ДОКАЗАТЕЛЬСТВА (требуют проверки) ⚠\n" +
        suspicious.map((e, i) => fmt(e, i + 1)).join("\n\n");
    }
    if (fake.length > 0) {
      out +=
        "\n\n✗ ФАЛЬШ (отклонено) ДОКАЗАТЕЛЬСТВА (отклонено агентом) ✗\n" +
        fake.map((e, i) => fmt(e, i + 1)).join("\n\n");
    }
    if (untagged.length > 0) {
      out +=
        "\n\n— ОСТАЛОСЬ ДОКАЗАТЕЛЬСТВА (не оценено) —\n" +
        untagged.map((e, i) => fmt(e, i + 1)).join("\n\n");
    }
    return out;
  };

  const isMobile = useIsMobile();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: async () => (await api.get<Task>(`/tasks/${id}`)).data,
  });

  useEffect(() => {
    if (!task?.timerMinutes || timerStarted) return;
    setSecondsLeft(task.timerMinutes * 60);
    setTimerStarted(true);
  }, [task, timerStarted]);

  const handleTimeout = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeoutOpen(true);
  }, []);

  useEffect(() => {
    if (!timerStarted || secondsLeft === null || step < 0) return;
    if (secondsLeft <= 0) {
      handleTimeout();
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(intervalRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerStarted, step < 0, handleTimeout]);

  const submit = useMutation({
    mutationFn: (v: any) => {
      // Terminal orqali topilgan dalillarning backend-ID lari — bonus ball uchun.
      const unlockedEvidenceIds = Array.from(
        new Set(
          evidence
            .map((e) => e.evidenceId)
            .filter((x): x is number => typeof x === "number"),
        ),
      );
      const terminalSection = terminalNote.trim()
        ? `\n\n--- TERMINAL TEKSHIRUVI ---\n${terminalNote.trim()}`
        : "";
      const payload = {
        taskId: Number(id),
        ...v,
        explanation:
          (v.explanation || "") +
          terminalSection +
          formatEvidenceForReport(evidence),
        unlockedEvidenceIds,
      };
      return api.post("/submissions", payload);
    },
    onSuccess: (r: any) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      message.success("Заключение отправлено в центр");
      api
        .post(`/submissions/${r.data.id}/analyze`)
        .finally(() => navigate(`/submissions/${r.data.id}`));
    },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });

  useEffect(() => {
    if (chosen) form.setFieldsValue({ selectedSuspectId: chosen });
  }, [chosen, form]);

  if (isLoading || !task)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#030508",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <span
            style={{
              color: "#f59e0b",
              fontFamily: "Special Elite, monospace",
              fontSize: 13,
              letterSpacing: 3,
            }}
          >
            ЗАГРУЗКА...
          </span>
        </motion.div>
      </div>
    );

  const scenes = task.scenes || [];
  const suspects = task.suspects || [];
  const meta = diffMeta[task.difficulty] || diffMeta.medium;
  const timerColor =
    secondsLeft === null
      ? "#475569"
      : secondsLeft <= 60
        ? "#ef4444"
        : secondsLeft <= 180
          ? "#f59e0b"
          : "#22c55e";

  return (
    <>
      {/* So'roq xonasi */}
      <AnimatePresence>
        {interrogate && (
          <InterrogationRoom
            key={interrogate.id}
            suspect={interrogate}
            onBack={() => setInterrogate(null)}
            onChoose={setChosen}
            chosen={chosen}
          />
        )}
      </AnimatePresence>

      <div
        style={{
          minHeight: "100vh",
          background: "#030508",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* INTRO */}
        {step === -1 && (
          <div
            style={{
              minHeight: "100vh",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {task.locationAssetId && (
              <motion.div
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 3, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${task.locationAssetId})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "brightness(0.22) saturate(0.7) sepia(0.3)",
                }}
              />
            )}
            {!task.locationAssetId && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#050810",
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at center, rgba(3,5,8,0.4), rgba(3,5,8,0.93))",
              }}
            />
            <AnimatePresence mode="wait">
              {introPhase === 0 && (
                <motion.div
                  key="i0"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  style={{
                    textAlign: "center",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, letterSpacing: "0.5em" }}
                    animate={{ opacity: 1, letterSpacing: "0.12em" }}
                    transition={{ duration: 1.2, delay: 0.3 }}
                    style={{
                      color: "#ef4444",
                      fontSize: 11,
                      textTransform: "uppercase",
                      fontFamily: "Special Elite, monospace",
                      marginBottom: 20,
                    }}
                  >
                    ● Файл #{String(task.id).padStart(4, "0")} —
                    Классифицированный
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    style={{
                      color: "white",
                      fontFamily: "Special Elite, monospace",
                      fontSize: isMobile ? 32 : 50,
                      margin: "0 0 8px",
                      textShadow: `0 0 50px ${meta.glow}`,
                    }}
                  >
                    {task.title}
                  </motion.h1>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1 }}
                    style={{
                      color: meta.color,
                      fontFamily: "Special Elite, monospace",
                      fontSize: 13,
                      letterSpacing: 3,
                      textTransform: "uppercase",
                      marginBottom: 44,
                    }}
                  >
                    {meta.label}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.7 }}
                  >
                    <motion.button
                      whileHover={{
                        scale: 1.05,
                        boxShadow: `0 0 32px ${meta.glow}`,
                      }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setIntroPhase(1)}
                      style={{
                        padding: "14px 44px",
                        borderRadius: 8,
                        background: "transparent",
                        border: `2px solid ${meta.color}`,
                        color: meta.color,
                        fontFamily: "Special Elite, monospace",
                        fontSize: 14,
                        letterSpacing: 2.5,
                        cursor: "pointer",
                        textTransform: "uppercase",
                      }}
                    >
                      НАЧАТЬ РАССЛЕДОВАНИЕ →
                    </motion.button>
                  </motion.div>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    onClick={() => navigate("/tasks")}
                    style={{
                      marginTop: 18,
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.2)",
                      fontSize: 12,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    ← Назад
                  </motion.button>
                </motion.div>
              )}
              {introPhase === 1 && (
                <motion.div
                  key="i1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    maxWidth: 660,
                    position: "relative",
                    zIndex: 1,
                    padding: "0 24px",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(5,8,14,0.96)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 16,
                      padding: "36px 40px",
                      boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
                    }}
                  >
                    <div
                      style={{
                        color: "#ef4444",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        fontFamily: "Special Elite, monospace",
                        marginBottom: 14,
                      }}
                    >
                      СЕКРЕТНО — СЦЕНАРИЙ ДЕЛА
                    </div>
                    <p
                      style={{
                        color: "rgba(255,255,255,0.82)",
                        fontSize: 16,
                        lineHeight: 1.9,
                        margin: "0 0 28px",
                        fontStyle: "italic",
                      }}
                    >
                      <TW text={task.scenario} speed={14} />
                    </p>
                    {task.timerMinutes && (
                      <div
                        style={{
                          color: "rgba(255,255,255,0.28)",
                          fontSize: 12,
                          marginBottom: 22,
                        }}
                      >
                        ⏱ Отведённое время:{" "}
                        <span style={{ color: "#f59e0b" }}>
                          {task.timerMinutes} минут
                        </span>
                      </div>
                    )}
                    <motion.button
                      whileHover={{
                        scale: 1.03,
                        boxShadow: `0 0 24px ${meta.glow}`,
                      }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setStep(0)}
                      style={{
                        padding: "13px 36px",
                        borderRadius: 8,
                        background: meta.color,
                        border: "none",
                        color: "#000",
                        fontFamily: "Special Elite, monospace",
                        fontSize: 14,
                        letterSpacing: 2,
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      ГОТОВ К НАЧАЛУ →
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* HUD */}
        {step >= 0 && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "sticky",
              top: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 24px",
              background: "rgba(3,5,8,0.94)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            <motion.button
              whileHover={{ scale: 1.04 }}
              onClick={() => navigate("/tasks")}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.35)",
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              ← Выйти
            </motion.button>
            <div
              style={{
                background: "linear-gradient(135deg,#fde68a,#facc15)",
                borderRadius: 4,
                padding: "2px 10px",
                fontFamily: "Special Elite, monospace",
                fontSize: 11,
                color: "#422006",
                transform: "rotate(-1deg)",
                flexShrink: 0,
              }}
            >
              #{String(task.id).padStart(4, "0")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: "white",
                  fontFamily: "Special Elite, monospace",
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.title}
              </div>
              <div
                style={{
                  color: meta.color,
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  fontFamily: "Special Elite, monospace",
                }}
              >
                {meta.label}
              </div>
            </div>
            {step < scenes.length && (
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                {scenes.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === step ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      background:
                        i === step
                          ? meta.color
                          : i < step
                            ? "rgba(255,255,255,0.22)"
                            : "rgba(255,255,255,0.07)",
                      transition: "all 0.3s",
                    }}
                  />
                ))}
              </div>
            )}
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 18px rgba(54,123,240,0.4)",
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setTerminalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 13px",
                borderRadius: 5,
                border: "1px solid rgba(54,123,240,0.55)",
                background:
                  "linear-gradient(135deg, rgba(54,123,240,0.18), rgba(54,123,240,0.06))",
                color: "#367bf0",
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', ui-monospace, Consolas, monospace",
                fontSize: 11,
                letterSpacing: 1.5,
                cursor: "pointer",
                flexShrink: 0,
                textShadow: "0 0 8px rgba(54,123,240,0.6)",
                boxShadow: "0 0 12px rgba(54,123,240,0.15)",
                transition: "box-shadow 0.2s",
              }}
              title="Открыть терминал — собирать улики"
            >
              {/* Terminal icon */}
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M3 5l4 3-4 3"
                  stroke="#367bf0"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="9"
                  y1="11"
                  x2="13"
                  y2="11"
                  stroke="#367bf0"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              ТЕРМИНАЛ
              {evidence.length > 0 && (
                <span
                  style={{
                    marginLeft: 2,
                    background: evidence.some((e) => e.sent)
                      ? "#e5c07b"
                      : "#367bf0",
                    color: evidence.some((e) => e.sent) ? "#1a1200" : "#fff",
                    borderRadius: 999,
                    padding: "0 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0,
                  }}
                >
                  {evidence.some((e) => e.sent)
                    ? `★${evidence.filter((e) => e.sent).length}`
                    : ""}
                  {evidence.length}
                </span>
              )}
            </motion.button>

            {secondsLeft !== null && (
              <motion.div
                animate={secondsLeft <= 60 ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.6, repeat: Infinity }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: `1px solid ${timerColor}44`,
                  background: `${timerColor}12`,
                  flexShrink: 0,
                }}
              >
                <span style={{ color: timerColor, fontSize: 13 }}>⏱</span>
                <span
                  style={{
                    color: timerColor,
                    fontFamily: "Special Elite, monospace",
                    fontSize: 15,
                    minWidth: 48,
                    textAlign: "center",
                  }}
                >
                  {fmt(secondsLeft)}
                </span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* SCREENS */}
        <AnimatePresence mode="wait">
          {step >= 0 &&
            step < scenes.length &&
            (() => {
              const sc = scenes[step];
              return (
                <motion.div
                  key={`s${step}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    flex: 1,
                    position: "relative",
                    minHeight: "calc(100vh - 53px)",
                    overflow: "hidden",
                  }}
                >
                  {sc.imageAsset && (
                    <motion.div
                      key={sc.imageAsset}
                      initial={{ scale: 1.08 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 7, ease: "easeOut" }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `url(${sc.imageAsset})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        filter: "brightness(0.4) saturate(0.9)",
                      }}
                    />
                  )}
                  {!sc.imageAsset && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(135deg,#0a0f1a,#030508)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.78) 100%)",
                    }}
                  />
                  {sc.characterAsset && (
                    <motion.img
                      key={sc.characterAsset}
                      src={resolveAsset(sc.characterAsset) || ""}
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -60, opacity: 0 }}
                      transition={{ duration: 0.7, delay: 0.2 }}
                      style={{
                        position: "absolute",
                        right: "8%",
                        bottom: 0,
                        height: isMobile ? "45%" : "76%",
                        objectFit: "cover",
                        opacity: isMobile ? 0.35 : 1,
                        filter: "drop-shadow(0 0 40px rgba(0,0,0,0.8))",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: isMobile ? "30px 18px 0" : "60px 48px 0",
                      background:
                        "linear-gradient(to top, rgba(3,5,8,0.98) 0%, rgba(3,5,8,0.84) 55%, transparent 100%)",
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      style={{
                        background: "linear-gradient(135deg,#fecaca,#ef4444)",
                        color: "white",
                        fontFamily: "Special Elite, monospace",
                        fontSize: 10,
                        letterSpacing: 1.5,
                        padding: "3px 10px",
                        borderRadius: 4,
                        display: "inline-block",
                        marginBottom: 12,
                      }}
                    >
                      СЦЕНА {step + 1}
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      style={{
                        color: "white",
                        fontFamily: "Special Elite, monospace",
                        fontSize: isMobile ? 20 : 26,
                        margin: "0 0 14px",
                        maxWidth: isMobile ? "100%" : "62%",
                      }}
                    >
                      {sc.title}
                    </motion.h2>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.82)",
                        fontSize: isMobile ? 14 : 15,
                        lineHeight: 1.85,
                        maxWidth: isMobile ? "100%" : "60%",
                        whiteSpace: "pre-line",
                        paddingBottom: 28,
                      }}
                    >
                      <TW key={`${step}b`} text={sc.body} speed={13} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingBottom: 32,
                      }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        disabled={step === 0}
                        onClick={() => setStep(step - 1)}
                        style={{
                          padding: "10px 24px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: "rgba(255,255,255,0.04)",
                          color:
                            step === 0
                              ? "rgba(255,255,255,0.15)"
                              : "rgba(255,255,255,0.6)",
                          fontFamily: "Special Elite, monospace",
                          fontSize: 12,
                          letterSpacing: 1.5,
                          cursor: step === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        ← НАЗАД
                      </motion.button>
                      <motion.button
                        whileHover={{
                          scale: 1.04,
                          boxShadow: `0 0 24px ${meta.glow}`,
                        }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setStep(step + 1)}
                        style={{
                          padding: "10px 28px",
                          borderRadius: 8,
                          background: meta.color,
                          border: "none",
                          color: "#000",
                          fontFamily: "Special Elite, monospace",
                          fontSize: 13,
                          letterSpacing: 2,
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        {step === scenes.length - 1
                          ? "К ПОДОЗРЕВАЕМЫМ →"
                          : "ПРОДОЛЖИТЬ →"}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

          {/* SUSPECTS BOARD */}
          {step >= scenes.length && (
            <motion.div
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                flex: 1,
                position: "relative",
                minHeight: "calc(100vh - 53px)",
                overflow: "hidden",
              }}
            >
              {/* Cork board BG — O'ZGARMAYDI */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${BG_BOARD})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "brightness(0.78)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.32)",
                }}
              />

              {/* Dossier overlay — fon ustida */}
              <AnimatePresence>
                {dossier && (
                  <CaseDossier
                    key={dossier.id}
                    suspect={dossier}
                    chosen={chosen}
                    onClose={() => setDossier(null)}
                    onAccuse={(id) =>
                      setChosen((prev) => (prev === id ? null : id))
                    }
                    onInterrogate={() => {
                      setInterrogate(dossier);
                      setDossier(null);
                    }}
                  />
                )}
              </AnimatePresence>

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "calc(100vh - 53px)",
                }}
              >
                {/* ── TOP BAR ── */}
                <div
                  style={{
                    padding: isMobile ? "12px 14px 10px" : "16px 28px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        background: "linear-gradient(135deg,#fecaca,#ef4444)",
                        color: "white",
                        fontFamily: "Special Elite, monospace",
                        fontSize: 10,
                        letterSpacing: 1.5,
                        padding: "3px 10px",
                        borderRadius: 4,
                        display: "inline-block",
                        marginBottom: 6,
                      }}
                    >
                      ДОСКА ПОДОЗРЕВАЕМЫХ
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.45)",
                        fontSize: isMobile ? 11 : 12,
                      }}
                    >
                      {isMobile
                        ? "Нажмите на фото для досье"
                        : "Нажмите на фото → досье → обвините или допросите"}
                    </div>
                  </div>
                  {!isMobile && (
                    <AnimatePresence>
                      {chosen && (
                        <motion.div
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          style={{
                            background: "rgba(239,68,68,0.18)",
                            border: "1px solid rgba(239,68,68,0.45)",
                            borderRadius: 10,
                            padding: "8px 16px",
                            textAlign: "right",
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9,
                              color: "rgba(255,255,255,0.4)",
                              textTransform: "uppercase",
                              letterSpacing: 1.2,
                            }}
                          >
                            Назначен подозреваемым
                          </div>
                          <div
                            style={{
                              color: "#fca5a5",
                              fontFamily: "Special Elite, monospace",
                              fontSize: 14,
                              marginTop: 2,
                            }}
                          >
                            {suspects.find((s) => s.id === chosen)?.name}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                  {isMobile && chosen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{
                        background: "rgba(239,68,68,0.2)",
                        border: "1px solid rgba(239,68,68,0.45)",
                        borderRadius: 8,
                        padding: "5px 10px",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.45)",
                          letterSpacing: 1,
                        }}
                      >
                        Обвиняемый
                      </div>
                      <div
                        style={{
                          color: "#fca5a5",
                          fontFamily: "Special Elite, monospace",
                          fontSize: 12,
                        }}
                      >
                        {suspects.find((s) => s.id === chosen)?.name}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ── MARKAZIY CORK BOARD PANEL ── */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    justifyContent: "center",
                    padding: isMobile ? "0 10px 80px" : "0 40px 80px",
                    overflowY: isMobile ? "auto" : "visible",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: isMobile ? "100%" : "min(1000px, 90vw)",
                      ...(isMobile
                        ? { minHeight: "min(520px, 68vh)", height: "auto" }
                        : { aspectRatio: "16/9", maxHeight: "62vh" }),

                      /* Cork board ramkasi */
                      background: "linear-gradient(145deg, #5c3310, #3d2008)",
                      borderRadius: isMobile ? 10 : 8,
                      padding: isMobile ? 12 : 18,
                      marginTop: isMobile ? 8 : 0,
                      flexShrink: 0,
                      boxShadow: [
                        "0 20px 60px rgba(0,0,0,0.85)",
                        "0 0 0 2px rgba(80,50,20,0.8)",
                        "inset 0 2px 4px rgba(255,200,100,0.15)",
                        "inset 0 -2px 6px rgba(0,0,0,0.4)",
                      ].join(", "),
                    }}
                  >
                    {/* Cork yuzasi */}
                    <div
                      style={{
                        position: "absolute",
                        inset: isMobile ? 12 : 18,
                        background: [
                          "radial-gradient(ellipse at 20% 30%, rgba(180,140,80,0.12) 0%, transparent 50%)",
                          "radial-gradient(ellipse at 80% 70%, rgba(160,120,60,0.1) 0%, transparent 50%)",
                          "linear-gradient(145deg, #b5864a 0%, #9a6e38 30%, #b08040 60%, #9a6e38 100%)",
                        ].join(", "),
                        borderRadius: 4,
                        boxShadow: "inset 0 2px 12px rgba(0,0,0,0.35)",
                      }}
                    >
                      {/* Cork tekstura noktalari */}
                      {[...Array(40)].map((_, i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            left: `${(i * 37 + 11) % 97}%`,
                            top: `${(i * 53 + 17) % 93}%`,
                            width: i % 4 === 0 ? 4 : 2,
                            height: i % 4 === 0 ? 4 : 2,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.12)",
                          }}
                        />
                      ))}
                    </div>

                    {/* Ramka vintlari (burchaklarda) */}
                    {[
                      "top:8px,left:8px",
                      "top:8px,right:8px",
                      "bottom:8px,left:8px",
                      "bottom:8px,right:8px",
                    ].map((pos) => {
                      const style: any = {
                        position: "absolute",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle at 35% 35%, #c8a050, #6b4820)",
                        boxShadow:
                          "0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2)",
                      };
                      pos.split(",").forEach((p) => {
                        const [k, v] = p.split(":");
                        style[k] = v;
                      });
                      return <div key={pos} style={style} />;
                    })}

                    {/* Cork lamp nuri */}
                    <div
                      style={{
                        position: "absolute",
                        inset: isMobile ? 12 : 18,
                        borderRadius: 4,
                        background:
                          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,220,120,0.18) 0%, transparent 70%)",
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    />

                    {/* FOTOLAR — board ichida absolute */}
                    <div
                      style={{
                        position: "absolute",
                        inset: isMobile ? 12 : 18,
                        borderRadius: 4,
                        overflow: "visible",
                      }}
                    >
                      {suspects.map((s: Suspect, idx) => (
                        <PinnedPhoto
                          key={s.id}
                          suspect={s}
                          isChosen={chosen === s.id}
                          onClick={() => setDossier(s)}
                          index={idx}
                          total={suspects.length}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>

                    {/* "Jinoyatchi kim?" sarlavha — board tepasida */}
                    <div
                      style={{
                        position: "absolute",
                        top: isMobile ? -28 : -38,
                        left: "50%",
                        transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                        zIndex: 5,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Special Elite, monospace",
                          fontSize: isMobile ? 14 : 20,
                          color: "white",
                          textShadow: "0 2px 16px rgba(0,0,0,0.9)",
                          letterSpacing: 2,
                        }}
                      >
                        Кто преступник, Детектив?
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── BOTTOM ── */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: isMobile
                      ? "12px 14px calc(12px + env(safe-area-inset-bottom,0px))"
                      : "14px 28px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.88), transparent)",
                  }}
                >
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    onClick={() =>
                      scenes.length > 0
                        ? setStep(scenes.length - 1)
                        : setStep(-1)
                    }
                    style={{
                      padding: "10px 22px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.45)",
                      color: "rgba(255,255,255,0.5)",
                      fontFamily: "Special Elite, monospace",
                      fontSize: 12,
                      letterSpacing: 1.5,
                      cursor: "pointer",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    ← К сценам
                  </motion.button>
                  <motion.button
                    whileHover={
                      chosen
                        ? {
                            scale: 1.04,
                            boxShadow: "0 0 30px rgba(239,68,68,0.6)",
                          }
                        : {}
                    }
                    whileTap={chosen ? { scale: 0.97 } : {}}
                    disabled={!chosen}
                    onClick={() => setSubmitOpen(true)}
                    style={{
                      padding: isMobile ? "10px 18px" : "12px 36px",
                      borderRadius: 8,
                      background: chosen
                        ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                        : "rgba(239,68,68,0.12)",
                      border: `1px solid ${chosen ? "#ef4444" : "rgba(239,68,68,0.25)"}`,
                      color: chosen ? "white" : "rgba(255,255,255,0.2)",
                      fontFamily: "Special Elite, monospace",
                      fontSize: 14,
                      letterSpacing: 2.5,
                      cursor: chosen ? "pointer" : "not-allowed",
                      textTransform: "uppercase",
                      boxShadow: chosen
                        ? "0 4px 20px rgba(220,38,38,0.4)"
                        : "none",
                      transition: "all 0.25s",
                    }}
                  >
                    ОТПРАВИТЬ ЗАКЛЮЧЕНИЕ →
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODALS */}
        <Modal
          title={<div className="font-display">🗂️ ОФИЦИАЛЬНОЕ ЗАКЛЮЧЕНИЕ</div>}
          open={submitOpen}
          onCancel={() => setSubmitOpen(false)}
          onOk={() => form.submit()}
          okText="Отправить в центр"
          okButtonProps={{ danger: true, loading: submit.isPending }}
          cancelText="Отмена"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={(v) => submit.mutate(v)}
            initialValues={{ selectedSuspectId: chosen }}
          >
            <Form.Item
              name="selectedSuspectId"
              label="Подозреваемый"
              rules={[{ required: true }]}
            >
              <Select
                options={suspects.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Form.Item
              name="explanation"
              label="Доказательства и заключение"
              rules={[
                { required: true, min: 20, message: "Минимум 20 символов" },
              ]}
            >
              <Input.TextArea
                rows={5}
                placeholder="Мотив, возможность, доказательства..."
              />
            </Form.Item>
            {terminalNote.trim() && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: "rgba(78,154,6,0.08)",
                  border: "1px solid rgba(78,154,6,0.35)",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: "#15803d",
                    marginBottom: 6,
                  }}
                >
                  ▌ РЕЗУЛЬТАТ ПРОВЕРКИ ТЕРМИНАЛА
                </div>
                <div
                  style={{
                    color: "#1a4731",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.55,
                  }}
                >
                  {terminalNote}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6 }}>
                  Эта сводка будет автоматически добавлена в отчет.
                </div>
              </div>
            )}
            {evidence.length > 0 && (
              <div
                style={{
                  marginTop: -8,
                  padding: "10px 12px",
                  borderRadius: 6,
                  background:
                    "linear-gradient(135deg, rgba(124,255,178,0.10), rgba(124,255,178,0.02))",
                  border: "1px solid rgba(124,255,178,0.4)",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 12,
                  color: "#0f5132",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: "#15803d",
                    marginBottom: 6,
                  }}
                >
                  ▌ К ОТЧЁТУ ПРИКРЕПЛЕНО {evidence.length} УЛИК(И)
                  {evidence.some((e) => e.sent) && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "#b45309",
                        fontWeight: 700,
                      }}
                    >
                      · ★ {evidence.filter((e) => e.sent).length} ключ. в штабе
                    </span>
                  )}
                </div>
                {/* Asosiy (terminal-driven) dalillar hisobi — bonus ball uchun. */}
                {(() => {
                  const allKey = (task.suspects || []).flatMap((s) =>
                    (s.evidence || []).filter((e) => e.isKeyEvidence),
                  );
                  if (allKey.length === 0) return null;
                  const foundIds = new Set(
                    evidence
                      .map((e) => e.evidenceId)
                      .filter((x): x is number => typeof x === "number"),
                  );
                  const found = allKey.filter((e) => foundIds.has(e.id)).length;
                  return (
                    <div
                      style={{
                        marginBottom: 8,
                        padding: "4px 8px",
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid #f59e0b",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#92400e",
                      }}
                    >
                      ⭐ Основные доказательства: {found}/{allKey.length}
                      {found < allKey.length && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontWeight: 400,
                            opacity: 0.8,
                          }}
                        >
                          - поиск через терминал (бонус: +10 баллов / основной)
                        </span>
                      )}
                    </div>
                  );
                })()}
                {/* O'quvchi baholari summasi */}
                {(() => {
                  const t = evidence.filter(
                    (e) => e.studentTag === "trusted",
                  ).length;
                  const s = evidence.filter(
                    (e) => e.studentTag === "suspicious",
                  ).length;
                  const f = evidence.filter(
                    (e) => e.studentTag === "fake",
                  ).length;
                  const u = evidence.filter((e) => !e.studentTag).length;
                  const linked = evidence.filter(
                    (e) => e.linkedSuspectId != null,
                  ).length;
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 8,
                        fontSize: 10,
                      }}
                    >
                      <span
                        style={{
                          background: "rgba(34,197,94,0.15)",
                          border: "1px solid #22c55e",
                          color: "#15803d",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontWeight: 700,
                        }}
                      >
                        ✓ Надёжный: {t}
                      </span>
                      <span
                        style={{
                          background: "rgba(245,158,11,0.15)",
                          border: "1px solid #f59e0b",
                          color: "#b45309",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontWeight: 700,
                        }}
                      >
                        ⚠ Сомнительный: {s}
                      </span>
                      <span
                        style={{
                          background: "rgba(239,68,68,0.12)",
                          border: "1px solid #ef4444",
                          color: "#b91c1c",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontWeight: 700,
                        }}
                      >
                        ✗ Фальшивый: {f}
                      </span>
                      {u > 0 && (
                        <span
                          style={{
                            background: "rgba(100,116,139,0.12)",
                            border: "1px solid #94a3b8",
                            color: "#475569",
                            padding: "1px 6px",
                            borderRadius: 3,
                          }}
                        >
                          ? Не оценено: {u}
                        </span>
                      )}
                      {linked > 0 && (
                        <span
                          style={{
                            background: "rgba(186,123,255,0.12)",
                            border: "1px solid #a855f7",
                            color: "#7e22ce",
                            padding: "1px 6px",
                            borderRadius: 3,
                          }}
                        >
                          ⌬ Подключено: {linked}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {evidence.every((e) => !e.studentTag) && (
                  <div
                    style={{
                      marginBottom: 6,
                      padding: "5px 8px",
                      fontSize: 10,
                      background: "rgba(245,158,11,0.10)",
                      border: "1px dashed #f59e0b",
                      borderRadius: 4,
                      color: "#92400e",
                    }}
                  >
                    💡 С помощью команд 'tag', 'note' и 'link' в терминале дайте
                    свою оценку фактам — результат приложение к отчету делается.
                  </div>
                )}
                {/* Show sent items first */}
                {evidence
                  .filter((e) => e.sent)
                  .map((e) => (
                    <div key={e.id} style={{ opacity: 0.9, color: "#92400e" }}>
                      ★ [{e.source.toUpperCase()}] {e.title}
                    </div>
                  ))}
                {evidence
                  .filter((e) => !e.sent)
                  .slice(0, 5)
                  .map((e) => {
                    const tagSym =
                      e.studentTag === "trusted"
                        ? "✓"
                        : e.studentTag === "suspicious"
                          ? "⚠"
                          : e.studentTag === "fake"
                            ? "✗"
                            : "•";
                    const tagColor =
                      e.studentTag === "trusted"
                        ? "#15803d"
                        : e.studentTag === "suspicious"
                          ? "#b45309"
                          : e.studentTag === "fake"
                            ? "#b91c1c"
                            : undefined;
                    return (
                      <div
                        key={e.id}
                        style={{ opacity: 0.85, color: tagColor }}
                      >
                        {tagSym} [{e.source.toUpperCase()}] {e.title}
                      </div>
                    );
                  })}
                {evidence.filter((e) => !e.sent).length > 5 && (
                  <div style={{ opacity: 0.6, marginTop: 2 }}>
                    … и ещё {evidence.filter((e) => !e.sent).length - 5}
                  </div>
                )}
              </div>
            )}
          </Form>
        </Modal>

        {/* GIBRID TERMINAL (o'yin + haqiqiy bash shell) */}
        <GibridTerminal
          task={task}
          open={terminalOpen}
          onClose={() => setTerminalOpen(false)}
          collected={evidence}
          setCollected={setEvidence}
          activeSuspectId={chosen}
          onTerminalComplete={(note) => setTerminalNote(note)}
        />

        <Modal
          open={timeoutOpen}
          closable={false}
          maskClosable={false}
          footer={null}
          width={440}
          centered
        >
          <div className="text-center py-4">
            <div className="text-5xl mb-4">⏰</div>
            <div className="case-tape mb-3" style={{ display: "inline-block" }}>
              ВРЕМЯ ВЫШЛО
            </div>
            <h2 className="font-display text-2xl text-ink mt-2 mb-2">
              Время истекло!
            </h2>
            <p className="text-muted text-sm mb-5">
              Отправьте заключение немедленно.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setTimeoutOpen(false);
                setStep(scenes.length);
                setSubmitOpen(true);
              }}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 8,
                background: "#ef4444",
                border: "none",
                color: "white",
                fontFamily: "Special Elite, monospace",
                fontSize: 14,
                letterSpacing: 2,
                cursor: "pointer",
              }}
            >
              ОТПРАВИТЬ ЗАКЛЮЧЕНИЕ →
            </motion.button>
            {!chosen && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                onClick={() => {
                  setTimeoutOpen(false);
                  setStep(scenes.length);
                }}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "11px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.05)",
                  border: "1px solid rgba(0,0,0,0.15)",
                  color: "#374151",
                  fontFamily: "Special Elite, monospace",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Выбрать подозреваемого
              </motion.button>
            )}
          </div>
        </Modal>
      </div>
    </>
  );
}
