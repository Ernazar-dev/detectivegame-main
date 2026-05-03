import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spin, Pagination } from "antd";
import { SearchOutlined, FireOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { useIsMobile } from "../../lib/hooks";
import api from "../../lib/api";

const PAGE_SIZE = 20;

type Entry = {
  rank: number; userId: number; name: string;
  avatar?: string | null; xp: number; level: number;
  totalScore: number; completedTasks: number;
};

// ── Avatar colors ────────────────────────────────────────────────────────────
const AV_COLORS = [
  "#6366f1","#0f6e56","#be185d","#0369a1","#854d0e",
  "#7c3aed","#15803d","#b45309","#0e7490","#9f1239",
];
const getAvColor = (id: number) => AV_COLORS[id % AV_COLORS.length];

function Avatar({ e, size = 44 }: { e: Entry; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: getAvColor(e.userId), flexShrink: 0, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
    }}>
      {e.avatar && (
        <img src={e.avatar} alt={e.name}
          style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover" }}
          onError={ev => (ev.target as HTMLImageElement).remove()}
        />
      )}
      <span style={{ color:"#fff", fontWeight:800, fontSize: size * 0.38, lineHeight:1, userSelect:"none" }}>
        {e.name[0]?.toUpperCase()}
      </span>
    </div>
  );
}

// ── SVG Medal badge (emoji o'rniga — har qanday muhitda делlaydi) ─────────────
function MedalSVG({ rank, size = 24 }: { rank: 1|2|3; size?: number }) {
  const fill = rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : "#c2793e";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill={fill} stroke="#fff" strokeWidth="1.5"/>
      <text x="12" y="17" textAnchor="middle" fontSize="10" fontWeight="900" fill="white">
        {rank}
      </text>
    </svg>
  );
}

// ── Podium config ─────────────────────────────────────────────────────────────
// desktop config
const PCFG = {
  1: {
    barH: 110, avSize: 74, ringColor: "#f59e0b",
    wrapGrad: "linear-gradient(175deg,#fef08a,#f59e0b)",
    glow: "#f59e0b40",
    platGrad: "linear-gradient(175deg,#fef08a,#f59e0b)",
    platShadow: "#f59e0b35",
    rankColor: "#92400e", subColor: "#a16207",
    xpBg: "#f59e0b20", xpBorder: "#f59e0b50", xpColor: "#92400e",
    crown: true, flex: "0 0 200px", fontSize: 15, xpSize: 11,
  },
  2: {
    barH: 80, avSize: 58, ringColor: "#94a3b8",
    wrapGrad: "linear-gradient(175deg,#e2e8f0,#94a3b8)",
    glow: "#94a3b830",
    platGrad: "linear-gradient(175deg,#e2e8f0,#cbd5e1)",
    platShadow: "#94a3b825",
    rankColor: "#475569", subColor: "#64748b",
    xpBg: "#94a3b820", xpBorder: "#94a3b840", xpColor: "#475569",
    crown: false, flex: "0 0 160px", fontSize: 13, xpSize: 10,
  },
  3: {
    barH: 60, avSize: 52, ringColor: "#c2793e",
    wrapGrad: "linear-gradient(175deg,#fed7aa,#c2793e)",
    glow: "#c2793e30",
    platGrad: "linear-gradient(175deg,#fed7aa,#c2793e)",
    platShadow: "#c2793e25",
    rankColor: "#7c2d12", subColor: "#9a3412",
    xpBg: "#c2793e20", xpBorder: "#c2793e40", xpColor: "#7c2d12",
    crown: false, flex: "0 0 160px", fontSize: 13, xpSize: 10,
  },
} as const;

// mobile config — scaled down
const PCFG_M = {
  1: {
    barH: 70, avSize: 52, ringColor: "#f59e0b",
    wrapGrad: "linear-gradient(175deg,#fef08a,#f59e0b)",
    glow: "#f59e0b40",
    platGrad: "linear-gradient(175deg,#fef08a,#f59e0b)",
    platShadow: "#f59e0b35",
    rankColor: "#92400e", subColor: "#a16207",
    xpBg: "#f59e0b20", xpBorder: "#f59e0b50", xpColor: "#92400e",
    crown: true, flex: "1 1 0", fontSize: 12, xpSize: 10,
  },
  2: {
    barH: 50, avSize: 42, ringColor: "#94a3b8",
    wrapGrad: "linear-gradient(175deg,#e2e8f0,#94a3b8)",
    glow: "#94a3b830",
    platGrad: "linear-gradient(175deg,#e2e8f0,#cbd5e1)",
    platShadow: "#94a3b825",
    rankColor: "#475569", subColor: "#64748b",
    xpBg: "#94a3b820", xpBorder: "#94a3b840", xpColor: "#475569",
    crown: false, flex: "1 1 0", fontSize: 11, xpSize: 9,
  },
  3: {
    barH: 36, avSize: 38, ringColor: "#c2793e",
    wrapGrad: "linear-gradient(175deg,#fed7aa,#c2793e)",
    glow: "#c2793e30",
    platGrad: "linear-gradient(175deg,#fed7aa,#c2793e)",
    platShadow: "#c2793e25",
    rankColor: "#7c2d12", subColor: "#9a3412",
    xpBg: "#c2793e20", xpBorder: "#c2793e40", xpColor: "#7c2d12",
    crown: false, flex: "1 1 0", fontSize: 11, xpSize: 9,
  },
} as const;

function PodiumCard({ entry, rank, isMobile = false }: { entry: Entry; rank: 1|2|3; isMobile?: boolean }) {
  const c = (isMobile ? PCFG_M : PCFG)[rank];
  const isFirst = rank === 1;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex: c.flex }}>
      {/* Crown space */}
      <div style={{ height: isMobile ? 22 : 34, display:"flex", alignItems:"flex-end", justifyContent:"center", marginBottom: isMobile ? 2 : 4 }}>
        {c.crown && (
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: isMobile ? 18 : 26, lineHeight: 1 }}
          >👑</motion.span>
        )}
      </div>

      {/* Avatar */}
      <div style={{ position:"relative", marginBottom: 10 }}>
        <div style={{
          padding: isFirst ? 4 : 3, borderRadius:"50%",
          background: c.wrapGrad,
          boxShadow: `0 0 0 2px #fff, 0 6px 20px ${c.glow}`,
        }}>
          <div style={{
            width: c.avSize, height: c.avSize, borderRadius:"50%",
            background: getAvColor(entry.userId), overflow:"hidden",
            border: `3px solid ${c.ringColor}`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {entry.avatar
              ? <img src={entry.avatar} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
              : <span style={{ color:"#fff", fontWeight:800, fontSize: c.avSize * 0.38 }}>
                  {entry.name[0]?.toUpperCase()}
                </span>
            }
          </div>
        </div>
        {/* SVG medal badge */}
        <div style={{
          position:"absolute", bottom: -3, right: -3,
          background: c.wrapGrad,
          borderRadius:"50%", border:"2.5px solid #fff",
          boxShadow: `0 2px 8px ${c.glow}`,
        }}>
          <MedalSVG rank={rank} size={isFirst ? 30 : 24} />
        </div>
      </div>

      {/* Name + XP */}
      <div style={{ textAlign:"center", marginBottom: 10, paddingInline: 8 }}>
        <div style={{
          fontWeight:700, color:"#0f172a",
          fontSize: c.fontSize,
          maxWidth: isMobile ? "100%" : (isFirst ? 180 : 140),
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        }}>{entry.name}</div>
        <div style={{
          display:"inline-flex", alignItems:"center",
          marginTop:5, padding:"3px 10px", borderRadius:20,
          background: c.xpBg, border: `1px solid ${c.xpBorder}`,
        }}>
          <span style={{ fontSize: c.xpSize, fontWeight:800, color: c.xpColor }}>
            {entry.xp.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* Platform */}
      <motion.div
        initial={{ height:0, opacity:0 }}
        animate={{ height: c.barH, opacity:1 }}
        transition={{ delay: rank===1 ? 0.1 : rank===2 ? 0.2 : 0.3, duration:0.55, ease:"easeOut" }}
        style={{
          width:"100%", borderRadius:"14px 14px 0 0",
          background: c.platGrad,
          boxShadow: `0 -4px 20px ${c.platShadow}`,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"flex-start",
          paddingTop: 14, gap: 4, flexShrink:0, overflow:"hidden",
        }}
      >
        <MedalSVG rank={rank} size={isFirst ? 26 : 20} />
        <span style={{ fontSize:9, fontWeight:700, color: c.rankColor, textTransform:"uppercase", letterSpacing:0.5 }}>
          {rank}--е место
        </span>
        <span style={{ fontSize:10, color: c.subColor }}>
          {entry.completedTasks} дел
        </span>
      </motion.div>
    </div>
  );
}

// ── Detail row config ─────────────────────────────────────────────────────────
const DCFG: Record<number, { bg:string; border:string; tagBg:string; tagColor:string }> = {
  1: { bg:"#fffbeb", border:"#fde68a", tagBg:"#fef3c7", tagColor:"#92400e" },
  2: { bg:"#f8fafc", border:"#e2e8f0", tagBg:"#f1f5f9", tagColor:"#475569" },
  3: { bg:"#fff7ed", border:"#fed7aa", tagBg:"#fff7ed", tagColor:"#9a3412" },
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StudentRankings() {
  const { user } = useAuth();
  const [search, setSearch]           = useState("");
  const isMobile = useIsMobile(); 
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [page, setPage]               = useState(1);

  const { data: raw, isLoading } = useQuery({
    queryKey: ["rankings"],
    queryFn: async () => (await api.get<Entry[]>("/rankings?limit=500")).data,
  });

  const sorted = useMemo(
    () => (raw || []).slice().sort((a, b) => a.rank - b.rank), [raw],
  );
  const filtered = useMemo(() => sorted.filter(e => {
    const s = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const l = levelFilter === "all" || e.level === Number(levelFilter);
    return s && l;
  }), [sorted, search, levelFilter]);

  const top3     = sorted.filter(e => e.rank <= 3);
  const rest     = filtered.filter(e => e.rank > 3);
  const pageData = rest.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const myEntry  = sorted.find(e => e.userId === user?.id);
  const levels   = [...new Set(sorted.map(e => e.level))].sort((a, b) => a - b);
  const maxXP    = Math.max(0, ...sorted.map(e => e.xp));
  const avgXP    = sorted.length ? Math.round(sorted.reduce((s, e) => s + e.xp, 0) / sorted.length) : 0;
  const totalTasks = sorted.reduce((s, e) => s + e.completedTasks, 0);

  if (isLoading) return (
    <div style={{ display:"flex", justifyContent:"center", paddingTop:80 }}>
      <Spin size="large" />
    </div>
  );

  // ── Styles (inline constants) ─────────────────────────────────────────────
  const card: React.CSSProperties = {
    background:"#fff", borderRadius:16, border:"1px solid #e2e8f0",
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
  };

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }}
      style={{ maxWidth:860, margin:"0 auto", display:"flex", flexDirection:"column", gap:14 }}
    >

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            width:50, height:50, borderRadius:14, flexShrink:0,
            background:"linear-gradient(135deg,#fde68a,#f59e0b)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:24, boxShadow:"0 4px 14px #f59e0b40",
          }}>🏆</div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, margin:0, color:"#0f172a", letterSpacing:-0.3 }}>
              Рейтинг агентов
            </h1>
            <p style={{ fontSize:12, color:"#94a3b8", margin:0, marginTop:2 }}>
              На основе XP · {sorted.length}  агентов
            </p>
          </div>
        </div>
        {myEntry && (
          <div style={{
            background:"#fffbeb", border:"1.5px solid #fde68a",
            borderRadius:14, padding:"10px 18px", textAlign:"right",
          }}>
            <div style={{ fontSize:9, color:"#92400e", textTransform:"uppercase", letterSpacing:1.5, fontWeight:700 }}>
              Моё место
            </div>
            <div style={{ fontSize:26, fontWeight:800, color:"#f59e0b", lineHeight:1.1 }}>
              #{myEntry.rank}
            </div>
           
          </div>
        )}
      </div>

      {/* ── Podium ── */}
      {top3.length >= 1 && (
        <div style={{ borderRadius: isMobile ? 16 : 20, overflow:"hidden", border:"1px solid #e2e8f0", boxShadow:"0 4px 24px rgba(0,0,0,0.07)" }}>
          <div style={{
            background:"linear-gradient(160deg,#f0f9ff 0%,#e8f4fd 50%,#f8faff 100%)",
            padding: isMobile ? "14px 8px 0" : "24px 28px 0",
            display:"flex", alignItems:"flex-end", justifyContent:"center",
            gap: isMobile ? 6 : 10,
            minHeight: isMobile ? 180 : 270,
          }}>
            {top3.find(e => e.rank === 2) && <PodiumCard entry={top3.find(e => e.rank === 2)!} rank={2} isMobile={isMobile} />}
            {top3.find(e => e.rank === 1) && <PodiumCard entry={top3.find(e => e.rank === 1)!} rank={1} isMobile={isMobile} />}
            {top3.find(e => e.rank === 3) && <PodiumCard entry={top3.find(e => e.rank === 3)!} rank={3} isMobile={isMobile} />}
          </div>

          {/* Detail row */}
          <div style={{ background:"#f8fafc", borderTop:"1px solid #e2e8f0", padding: isMobile ? "8px 10px" : "12px 16px", display:"flex", gap: isMobile ? 6 : 8 }}>
            {top3.map(entry => {
              const dc = DCFG[entry.rank] || DCFG[1];
              return (
                <div key={entry.userId} style={{
                  flex:1, background: dc.bg, borderRadius:12,
                  padding:"11px 12px", textAlign:"center",
                  border: `1px solid ${dc.border}`,
                }}>
                  <div style={{ display:"flex", justifyContent:"center", marginBottom:4 }}>
                    <MedalSVG rank={entry.rank as 1|2|3} size={28} />
                  </div>
                  <div style={{
                    fontWeight:700, fontSize:12, color:"#0f172a",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>{entry.name}</div>
                  <div style={{ display:"flex", gap:4, justifyContent:"center", marginTop:6, flexWrap:"wrap" }}>
                    <span style={{
                      fontSize:9, background:"#fef3c7", color:"#92400e",
                      padding:"2px 7px", borderRadius:5, fontWeight:700,
                    }}>Ур. {entry.level}</span>
                    <span style={{
                      fontSize:9, background: dc.tagBg, color: dc.tagColor,
                      padding:"2px 7px", borderRadius:5, fontWeight:700,
                    }}>{entry.completedTasks} дел</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Search + Filter ── */}
      <div style={{ ...card, padding:"12px 14px", display:"flex", gap:10, flexWrap:"wrap" }}>
        <div style={{
          flex:1, minWidth:180,
          background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:9,
          display:"flex", alignItems:"center", padding:"0 12px", gap:8,
        }}>
          <SearchOutlined style={{ color:"#94a3b8", fontSize:13 }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Поиск по имени агента..."
            style={{
              flex:1, border:"none", background:"transparent", outline:"none",
              fontSize:13, color:"#0f172a", padding:"8px 0",
            }}
          />
          {search && (
            <span onClick={() => setSearch("")}
              style={{ color:"#94a3b8", cursor:"pointer", fontSize:18, lineHeight:1 }}>×</span>
          )}
        </div>
        <select
          value={levelFilter}
          onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
          style={{
            background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:9,
            padding:"8px 12px", fontSize:13, color:"#374151", outline:"none", width:160,
          }}
        >
          <option value="all">все уровни</option>
          {levels.map(l => <option key={l} value={String(l)}>Уровень {l}</option>)}
        </select>
        {(search || levelFilter !== "all") && (
          <div style={{ display:"flex", alignItems:"center", fontSize:12, color:"#94a3b8" }}>
            {filtered.length}  результатов
          </div>
        )}
      </div>

      {/* ── List ── */}
      {pageData.length > 0 && (
        <div style={{ ...card, overflow:"hidden" }}>
          <div style={{
            display:"grid", gridTemplateColumns:"52px 1fr 90px 80px 60px",
            padding:"9px 18px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9",
          }}>
            {["#","Агент","Уровень","XP","Работа"].map((h, i) => (
              <div key={i} style={{
                fontSize:9, fontWeight:700, color:"#94a3b8",
                textTransform:"uppercase", letterSpacing:1,
                textAlign: i > 1 ? "right" : "left",
              }}>{h}</div>
            ))}
          </div>

          <AnimatePresence>
            {pageData.map((entry, idx) => {
              const isMe = entry.userId === user?.id;
              return (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity:0, x:-8 }}
                  animate={{ opacity:1, x:0 }}
                  transition={{ delay: idx * 0.025 }}
                  style={{
                    display:"grid", gridTemplateColumns:"52px 1fr 90px 80px 60px",
                    alignItems:"center", padding:"10px 18px",
                    borderBottom:"1px solid #f9fafb",
                    borderLeft: isMe ? "3px solid #6366f1" : "3px solid transparent",
                    background: isMe ? "#f5f3ff" : "transparent",
                    transition:"background 0.13s",
                  }}
                  onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ fontSize:13, fontWeight:800, color: isMe ? "#6366f1" : "#cbd5e1" }}>
                    #{entry.rank}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <Avatar e={entry} size={34} />
                    <div style={{
                      fontSize:13, fontWeight:600, color:"#0f172a",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>
                      {entry.name}
                      {isMe && (
                        <span style={{
                          marginLeft:6, fontSize:9, background:"#ede9fe",
                          color:"#6d28d9", padding:"2px 6px", borderRadius:5, fontWeight:700,
                        }}>ВЫ</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <span style={{
                      fontSize:10, fontWeight:700,
                      background:"#fef3c7", color:"#92400e",
                      padding:"2px 8px", borderRadius:6,
                    }}>Ур. {entry.level}</span>
                  </div>
                  <div style={{ textAlign:"right", fontSize:13, fontWeight:800, color:"#16a34a" }}>
                    {entry.xp.toLocaleString()}
                  </div>
                  <div style={{ textAlign:"right", fontSize:12, color:"#94a3b8" }}>
                    {entry.completedTasks}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Empty ── */}
      {pageData.length === 0 && search && (
        <div style={{ ...card, textAlign:"center", padding:"48px 24px", color:"#94a3b8" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
          <div>"{search}" — агентов не найдено</div>
        </div>
      )}

      {/* ── Pagination ── */}
      {rest.length > PAGE_SIZE && (
        <div style={{ display:"flex", justifyContent:"center" }}>
          <Pagination
            current={page} total={rest.length} pageSize={PAGE_SIZE}
            onChange={p => { setPage(p); window.scrollTo({ top:0, behavior:"smooth" }); }}
            showSizeChanger={false}
            showTotal={(total, range) => `${range[0]}–${range[1]} / ${total}  агентов`}
          />
        </div>
      )}

      {/* ── Stats ── */}
      {sorted.length > 0 && (
        <div style={{ ...card, overflow:"hidden" }}>
          <div style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"13px 18px 10px", borderBottom:"1px solid #f1f5f9",
          }}>
            <FireOutlined style={{ color:"#ef4444", fontSize:14 }} />
            <span style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>Статистика</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
            {[
              { icon:"👥", v: sorted.length,              l:"Всего агентов"     },
              { icon:"⚡", v: maxXP.toLocaleString(),     l:"Максимум XP"  },
              { icon:"📊", v: avgXP.toLocaleString(),     l:"Средний XP"    },
              { icon:"✅", v: totalTasks,                  l:"Всего решено" },
            ].map(({ icon, v, l }, i) => (
              <div key={i} style={{
                textAlign:"center", padding:"16px 8px",
                borderRight: i < 3 ? "1px solid #f1f5f9" : "none",
              }}>
                <div style={{ fontSize:18, marginBottom:5 }}>{icon}</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#0f172a" }}>{v}</div>
                <div style={{ fontSize:10, color:"#94a3b8", marginTop:3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}