import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, Spin, Tag, Statistic, Row, Col, Progress } from "antd";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Submission } from "../../lib/types";

const statusMap: Record<string, string> = {
  submitted: "Отправлено",
  checking: "Проверяется",
  pending_approval: "Ожидает проверки",
  approved: "Подтверждено",
};
const statusColor: Record<string, string> = {
  submitted: "blue", checking: "purple", pending_approval: "gold", approved: "green",
};

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { refreshUser } = useAuth();
  const wasApproved = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: async () => (await api.get<Submission>(`/submissions/${id}`)).data,
    // submitted yoki checking bo'lsa har 2 soniyada yangilanadi
    refetchInterval: (q) => {
      const s: any = q.state.data;
      return s && (s.status === "submitted" || s.status === "checking") ? 2000 : false;
    },
  });

  // Подтвержденоda sidebar XP ni yangilaymiz
  useEffect(() => {
    if (data?.status === "approved" && !wasApproved.current) {
      wasApproved.current = true;
      refreshUser();
    }
  }, [data?.status, refreshUser]);

  if (isLoading || !data) return (
    <div className="flex justify-center py-20"><Spin size="large" /></div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Asosiy ma'lumot */}
      <Card className="detective-card" title={data.task?.title}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Статус">
            <Tag color={statusColor[data.status]}>{statusMap[data.status] || data.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Выбранный подозреваемый">
            {data.suspect?.name}
          </Descriptions.Item>
          <Descriptions.Item label="Отправлено">
            {new Date(data.submittedAt).toLocaleString("ru-RU")}
          </Descriptions.Item>
          {data.approvedAt && (
            <Descriptions.Item label="Подтверждено">
              {new Date(data.approvedAt).toLocaleString("ru-RU")}
            </Descriptions.Item>
          )}
        </Descriptions>
        <div className="mt-4 p-4 bg-canvas rounded-xl border border-line">
          <div className="font-display text-xs text-muted uppercase tracking-wider mb-2">
            Ваше заключение
          </div>
          <p className="text-ink/90 text-sm whitespace-pre-line leading-relaxed m-0">
            {data.explanation}
          </p>
        </div>
      </Card>

      {/* Балл taqsimoti */}
      {data.totalScore != null && (
        <Card className="detective-card" title="Распределение баллов">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="Подозреваемый" value={data.suspectScore ?? 0} suffix="/ 30" />
            </Col>
            <Col span={6}>
              <Statistic
                title="Заключение"
                value={(data.explanationScore ?? 0).toFixed(1)}
                suffix="/ 70"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="⭐ Бонус"
                value={(data.bonusScore ?? 0).toFixed(0)}
                suffix={
                  data.keyEvidenceTotal
                    ? `(${data.keyEvidenceFound ?? 0}/${data.keyEvidenceTotal})`
                    : undefined
                }
                valueStyle={{ color: "#b45309" }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Жами"
                value={data.totalScore.toFixed(1)}
                suffix="/ 100+"
                valueStyle={{ color: "#f0b90b" }}
              />
            </Col>
          </Row>
          {(data.bonusScore ?? 0) > 0 && (
            <p className="text-ink/70 text-xs mt-3 mb-0">
              Асосий балл: {((data.suspectScore ?? 0) + (data.explanationScore ?? 0)).toFixed(1)}
              {" + Бонус: "}
              {(data.bonusScore ?? 0).toFixed(0)}
              {" = Жами: "}
              {data.totalScore.toFixed(1)}
            </p>
          )}
          <Progress
            className="mt-4"
            percent={Math.min(100, Math.round(data.totalScore))}
            strokeColor={data.totalScore >= 80 ? "#16a34a" : data.totalScore >= 50 ? "#eab308" : "#dc2626"}
          />
          {data.botFeedback && (
            <p className="text-ink/80 text-sm mt-4 p-3 bg-canvas rounded-lg border border-line">
              {data.botFeedback}
            </p>
          )}
        </Card>
      )}

      {/* Учитель izohi */}
      {data.teacherFeedback && (
        <Card className="detective-card" title="Учитель Izohi">
          <p className="text-ink/80 text-sm leading-relaxed">{data.teacherFeedback}</p>
        </Card>
      )}
    </motion.div>
  );
}