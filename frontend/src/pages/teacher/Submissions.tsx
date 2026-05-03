import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tag, Button, Select, Spin } from "antd";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import api from "../../lib/api";
import { Submission } from "../../lib/types";
import { useIsMobile } from "../../lib/hooks";

const sColor: Record<string,string> = { submitted:"#2563eb", checking:"#7c3aed", pending_approval:"#d97706", approved:"#16a34a" };
const sBg:    Record<string,string> = { submitted:"#eff6ff", checking:"#faf5ff",  pending_approval:"#fef3c7",  approved:"#f0fdf4" };
const sLabel: Record<string,string> = { submitted:"Отправлено", checking:"Проверяется", pending_approval:"Ожидает проверки", approved:"Подтверждено" };

export default function TeacherSubmissions() {
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({ queryKey:["submissions"], queryFn:async()=>(await api.get<Submission[]>("/submissions")).data });
  const filtered = (data||[]).filter(s => statusFilter==="all" || s.status===statusFilter);
  const pendingCount = (data||[]).filter(s => s.status==="pending_approval").length;

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:isMobile?15:18, fontWeight:700, color:"#111" }}>Ответы</span>
          {pendingCount > 0 && (
            <span style={{ background:"#fef3c7", color:"#b45309", fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, border:"1px solid #fcd34d" }}>
              {pendingCount} ожидают
            </span>
          )}
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} size={isMobile?"small":"middle"} style={{ width:isMobile?140:180 }}
          options={[{ value:"all",label:"Все" },{ value:"pending_approval",label:"Ожидают" },{ value:"submitted",label:"Отправлено" },{ value:"approved",label:"Подтверждено" }]} />
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div style={{ textAlign:"center", padding:60 }}><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"#9ca3af", background:"#fff", borderRadius:12, border:"1px dashed #e5e7eb" }}>
          Ответов пока нет
        </div>
      ) : isMobile ? (
        /* ── Mobile: card list ── */
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map((r: any, idx: number) => (
            <motion.div key={r.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:idx*0.03 }}
              style={{ background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", overflow:"hidden",
                borderLeft:`3px solid ${sColor[r.status]||"#e5e7eb"}` }}>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {r.task?.title}
                    </div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
                      {r.student?.name} · {new Date(r.submittedAt).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                  <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, background:sBg[r.status], color:sColor[r.status] }}>
                      {sLabel[r.status]||r.status}
                    </span>
                    {r.totalScore != null && <span style={{ fontSize:11, color:"#9ca3af" }}>{r.totalScore.toFixed(0)} / 100</span>}
                  </div>
                </div>
                <button onClick={() => navigate(`/submissions/${r.id}`)}
                  style={{ marginTop:10, width:"100%", padding:"8px", borderRadius:8, border:"1px solid #e5e7eb", background: r.status==="pending_approval"?"#2563eb":"#f9fafb", color:r.status==="pending_approval"?"white":"#374151", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                  {r.status==="pending_approval" ? "⚡ Проверить" : "Открыть"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* ── Desktop: clean table ── */
        <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"140px 1fr 160px 80px 140px 110px", padding:"9px 18px", background:"#f8fafc", borderBottom:"1px solid #f1f3f5" }}>
            {["Ученик","Задание","Статус","Балл","Дата","Действие"].map((h,i)=>(
              <div key={i} style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.8 }}>{h}</div>
            ))}
          </div>
          {filtered.map((r: any, idx: number) => (
            <motion.div key={r.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:idx*0.02 }}
              style={{ display:"grid", gridTemplateColumns:"140px 1fr 160px 80px 140px 110px", alignItems:"center", padding:"12px 18px", borderBottom:"1px solid #f9fafb", background: r.status==="pending_approval"?"#fffbeb":"transparent", transition:"background 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.background=r.status==="pending_approval"?"#fef3c7":"#f8fafc")}
              onMouseLeave={e=>(e.currentTarget.style.background=r.status==="pending_approval"?"#fffbeb":"transparent")}>
              <div style={{ fontWeight:600, fontSize:13, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:8 }}>{r.student?.name}</div>
              <Link href={`/submissions/${r.id}`} style={{ fontSize:13, color:"#0f172a", textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:8 }} className="hover:text-blue-600">{r.task?.title}</Link>
              <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:10, background:sBg[r.status], color:sColor[r.status], width:"fit-content" }}>{sLabel[r.status]||r.status}</span>
              <span style={{ fontSize:13, color:"#374151" }}>{r.totalScore!=null?`${r.totalScore.toFixed(0)}/100`:"—"}</span>
              <span style={{ fontSize:12, color:"#6b7280" }}>{new Date(r.submittedAt).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})}</span>
              <Button type={r.status==="pending_approval"?"primary":"default"} size="small" danger={r.status==="pending_approval"} onClick={()=>navigate(`/submissions/${r.id}`)}>
                Проверить
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
