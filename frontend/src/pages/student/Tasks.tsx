import { useQuery } from "@tanstack/react-query";
import { Empty, Spin, Button } from "antd";
import { motion } from "framer-motion";
import { Link } from "wouter";
import api from "../../lib/api";
import { Task, Submission } from "../../lib/types";
import { resolveAsset } from "../../lib/assets";
import { useIsMobile } from "../../lib/hooks";

const diffMeta: Record<string, { color: string; bg: string; label: string }> = {
  easy:   { color: "#16a34a", bg: "#dcfce7", label: "НОВИЧОК"  },
  medium: { color: "#eab308", bg: "#fef9c3", label: "ДЕТЕКТИВ" },
  hard:   { color: "#dc2626", bg: "#fee2e2", label: "ЭКСПЕРТ"  },
};

const statusLabel: Record<string, { text: string; color: string }> = {
  submitted:        { text: "Отправлено",        color: "#2563eb" },
  checking:         { text: "Проверяется",        color: "#7c3aed" },
  pending_approval: { text: "Ожидает проверки",   color: "#d97706" },
  approved:         { text: "Подтверждено ✓",     color: "#16a34a" },
};

export default function StudentTasks() {
  // ── ALL HOOKS FIRST — before any early return ──────────────────────────────
  const isMobile = useIsMobile();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await api.get<Task[]>("/tasks")).data,
  });
  const { data: submissions } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => (await api.get<Submission[]>("/submissions")).data,
  });

  // ── Early returns AFTER all hooks ─────────────────────────────────────────
  if (isLoading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!tasks || tasks.length === 0) return <Empty description="Заданий пока нет." />;

  const subMap = new Map<number, Submission>();
  (submissions || []).forEach((s) => subMap.set(s.taskId, s));

  const cols = isMobile ? "1fr" : "repeat(3, 1fr)";
  const imgH  = isMobile ? 150 : 192;

  return (
    <div>
      <div className="mb-6">
        <div className="case-tape">НАЗНАЧЕННЫЕ ДЕЛА</div>
        <h1 className="font-display text-ink mt-2 mb-1" style={{ fontSize: isMobile ? 22 : 30 }}>
          📂 Активные расследования
        </h1>
        <p className="text-muted m-0">Выберите дело для расследования.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: cols, gap: isMobile ? 12 : 20 }}>
        {tasks.map((t, idx) => {
          const meta = diffMeta[t.difficulty] || diffMeta.medium;
          const sub  = subMap.get(t.id);
          const sl   = sub ? statusLabel[sub.status] : null;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -6 }}
              className="case-card overflow-hidden flex flex-col"
            >
              {/* Image */}
              <div className="relative bg-ink" style={{ height: imgH }}>
                {t.locationAssetId && (
                  <img
                    src={resolveAsset(t.locationAssetId) || ""}
                    className="w-full h-full object-cover opacity-90"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute top-3 left-3 case-tape">
                  ДЕЛО №{t.id.toString().padStart(4, "0")}
                </div>
                <div
                  className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-xs font-display tracking-wider"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.label}
                </div>
                {sl && (
                  <div
                    className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ background: sl.color + "22", color: sl.color, border: `1px solid ${sl.color}44` }}
                  >
                    {sl.text}
                  </div>
                )}
                {!sl && (
                  <div className="absolute bottom-3 left-3">
                    <h3 className="font-display text-lg text-white m-0 leading-tight">{t.title}</h3>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col">
                {sl && (
                  <h3 className="font-display text-base text-ink m-0 mb-1 leading-tight">{t.title}</h3>
                )}
                <p className="text-sm text-ink/80 line-clamp-3 m-0 flex-1">{t.scenario}</p>
                <div className="flex items-center justify-between mt-3">
                  {t.timerMinutes
                    ? <span className="text-xs text-muted">⏱ {t.timerMinutes} мин</span>
                    : <span />}
                  {sub ? (
                    <Link href={`/submissions/${sub.id}`}>
                      <Button size="small" className="font-display tracking-wider">
                        ПОСМОТРЕТЬ ОТВЕТ →
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/play/${t.id}`}>
                      <Button type="primary" className="font-display tracking-wider">
                        ОТКРЫТЬ ДЕЛО →
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}