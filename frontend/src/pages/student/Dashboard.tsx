import { useQuery } from "@tanstack/react-query";
import { Spin, Progress, List, Tag, Avatar, Button } from "antd";
import { TrophyOutlined, FireOutlined, CheckCircleOutlined, HourglassOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { Link } from "wouter";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useIsMobile } from "../../lib/hooks";

// Statuslar uchun mapping
const STATUS_LABELS: Record<string, string> = {
  submitted: "Отправлено",
  checking: "Проверяется",
  pending_approval: "Ожидает проверки",
  approved: "Подтверждено",
};

const stats = [
  { key: "completedTasks", label: "Решено Задания", icon: <CheckCircleOutlined />, color: "#16a34a" },
  { key: "pendingTasks", label: "В процессе", icon: <HourglassOutlined />, color: "#2563eb" },
  { key: "averageScore", label: "Средний балл", icon: <FireOutlined />, color: "#eab308" },
  { key: "rank", label: "Рейтинг", icon: <TrophyOutlined />, color: "#dc2626" },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard.student"],
    queryFn: async () => (await api.get("/dashboard/student")).data,
  });

  const isMobile = useIsMobile();
  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  const xpInLevel = data.xp % 100;
  const xpToNext = 100 - xpInLevel;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="case-card p-6 bg-gradient-to-br from-white to-canvas relative overflow-hidden">
        <div className="absolute top-4 right-4 detective-stamp text-clue-red">СЕКРЕТНО</div>
        <div className="case-tape">ДЕТЕКТИВ ЖЕТОН</div>
        <h1 className="font-display text-ink mt-3 mb-1" style={{ fontSize: isMobile ? 20 : 30 }}>Добро пожаловать, {user?.name}</h1>
        <p className="text-muted m-0">{data.level}-го уровня агент — {data.xp} XP накоплено, до следующего уровня {xpToNext} XP осталось</p>
        <Progress percent={xpInLevel} strokeColor={{ from: "#16a34a", to: "#eab308" }} className="mt-3 max-w-xl !mb-0" />
      </motion.div>

      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 10 : 16 }}>
        {stats.map((s) => {
          const v = (data as any)[s.key];
          return (
            <motion.div key={s.key} whileHover={{ y: -3 }} className="case-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl" style={{ background: `${s.color}1a`, color: s.color }}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
                  <div className="text-2xl font-display text-ink">{s.key === "rank" ? (v ? `#${v}` : "—") : v}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 20 }}>
        <div className="case-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg m-0 text-ink">🏅 Достижения</h3>
            <Tag color="gold">{(data.badges || []).length}  получено</Tag>
          </div>
          {(data.badges || []).length === 0 ? (
            <p className="text-muted text-sm">Решайте задания, чтобы получить достижения. Первое даёт значок «Первое дело».</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data.badges.map((b: any) => (
                <div key={b.id} className="border border-line rounded-lg p-3 flex gap-3 items-center bg-canvas">
                  <Avatar size={42} className="!bg-clue-yellow !text-ink font-display">★</Avatar>
                  <div>
                    <div className="font-display text-sm text-ink">{b.name}</div>
                    <div className="text-xs text-muted">{b.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="case-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg m-0 text-ink">📋 Последние ответы</h3>
            <Link href="/submissions"><Button size="small" type="link">Все ответы →</Button></Link>
          </div>
          <List
            dataSource={data.recentSubmissions}
            locale={{ emptyText: "Ответов пока нет — откройте задание." }}
            renderItem={(s: any) => (
              <List.Item>
                <List.Item.Meta
                  title={<Link href={`/submissions/${s.id}`} className="text-ink">{s.task?.title}</Link>}
                  description={new Date(s.submittedAt).toLocaleString()}
                />
                {/* TO'G'RILANGAN QISMI SHU YERDA: */}
                <Tag color={s.status === "approved" ? "green" : s.status === "pending_approval" ? "gold" : "blue"}>
                  {STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] || s.status}
                </Tag>
              </List.Item>
            )}
          />
        </div>
      </div>
    </div>
  );
}