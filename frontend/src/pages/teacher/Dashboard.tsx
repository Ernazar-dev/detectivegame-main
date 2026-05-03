import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Spin, Tag, Button } from "antd";
import { CheckCircleOutlined, TeamOutlined, FileTextOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import api from "../../lib/api";
import { useIsMobile } from "../../lib/hooks";

const activityIcon: Record<string, string> = {
  student_joined: "👤", task_submitted: "📝", task_approved: "✅",
  task_created: "🗂️", task_assigned: "📌", default: "📋",
};
const activityColor: Record<string, string> = {
  student_joined: "#2563eb", task_submitted: "#f59e0b",
  task_approved: "#16a34a", task_created: "#7c3aed", task_assigned: "#0891b2",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  const hr  = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1)  return "только что";
  if (min < 60) return `${min} мин назад`;
  if (hr  < 24) return `${hr} ч назад`;
  return `${day} дн назад`;
}

export default function TeacherDashboard() {
  const [showAll, setShowAll] = useState(false);
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard.teacher"],
    queryFn: async () => (await api.get("/dashboard/teacher")).data,
  });
  const { data: activity } = useQuery({
    queryKey: ["dashboard.activity"],
    queryFn: async () => (await api.get("/dashboard/activity?limit=100")).data,
  });

  if (isLoading) return <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><Spin size="large" /></div>;

  const allActivity: any[] = activity || [];
  const visibleActivity = showAll ? allActivity : allActivity.slice(0, isMobile ? 5 : 10);

  const stats = [
    { title: "Всего учеников",    value: data.totalStudents,    color: "#2563eb", icon: <TeamOutlined />,        bg: "#eff6ff" },
    { title: "Активных",          value: data.activeStudents,   color: "#16a34a", icon: <CheckCircleOutlined />, bg: "#f0fdf4" },
    { title: "Заданий",           value: data.totalTasks,       color: "#7c3aed", icon: <FileTextOutlined />,    bg: "#faf5ff" },
    { title: "Ожидают проверки",  value: data.pendingApprovals, color: "#ef4444", icon: <ClockCircleOutlined />, bg: "#fef2f2" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Stats grid 2×2 on mobile, 4×1 on desktop ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: isMobile ? 10 : 14,
      }}>
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div style={{
              background: s.bg, border: `1px solid ${s.color}22`,
              borderRadius: 12, padding: isMobile ? "12px 14px" : "16px 18px",
              display: "flex", alignItems: "center", gap: isMobile ? 10 : 14,
            }}>
              <div style={{
                width: isMobile ? 36 : 44, height: isMobile ? 36 : 44,
                borderRadius: 10, flexShrink: 0,
                background: s.color + "18", border: `1px solid ${s.color}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 16 : 20, color: s.color,
              }}>
                {s.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 10 : 12, color: "#9ca3af", lineHeight: 1.3, marginBottom: 2 }}>
                  {s.title}
                </div>
                <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                  {s.value}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts: stacked on mobile, side-by-side on desktop ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: 14,
      }}>
        <Card title="Ответы за неделю" className="detective-card" styles={{ body: { padding: isMobile ? "10px 12px" : "16px 24px" } }}>
          <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
            <LineChart data={data.weeklySubmissions}>
              <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} width={24} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={{ fill: "#2563eb", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="По сложности" className="detective-card" styles={{ body: { padding: isMobile ? "10px 12px" : "16px 24px" } }}>
          <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
            <BarChart data={data.tasksByDifficulty}>
              <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} width={24} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Activity feed ── */}
      <Card
        className="detective-card"
        styles={{ body: { padding: isMobile ? "12px" : "16px 24px" } }}
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: isMobile ? 14 : 16 }}>Последняя активность</span>
            <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>{allActivity.length} событий</span>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <AnimatePresence>
            {visibleActivity.map((a: any, i: number) => (
              <motion.div key={a.id || i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: isMobile ? "9px 10px" : "10px 14px",
                  background: "#f8fafc", borderRadius: 10, border: "1px solid #f1f3f5",
                }}
              >
                <div style={{
                  width: isMobile ? 30 : 36, height: isMobile ? 30 : 36,
                  borderRadius: "50%", flexShrink: 0,
                  background: (activityColor[a.type] || "#6b7280") + "15",
                  border: `1px solid ${activityColor[a.type] || "#e5e7eb"}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isMobile ? 14 : 16,
                }}>
                  {activityIcon[a.type] || activityIcon.default}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.message}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{timeAgo(a.createdAt)}</div>
                </div>
                {!isMobile && (
                  <Tag style={{ flexShrink: 0, fontSize: 10, borderColor: (activityColor[a.type] || "#e5e7eb") + "55", color: activityColor[a.type] || "#6b7280", background: (activityColor[a.type] || "#6b7280") + "10" }}>
                    {a.type?.replace(/_/g, " ")}
                  </Tag>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {allActivity.length > (isMobile ? 5 : 10) && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Button type="dashed" onClick={() => setShowAll(!showAll)} style={{ width: "100%", borderRadius: 8 }}>
              {showAll ? "▲ Свернуть" : `▼ Показать все (${allActivity.length})`}
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
