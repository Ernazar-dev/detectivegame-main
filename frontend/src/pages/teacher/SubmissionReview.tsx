import { useParams, useLocation } from "wouter";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import {
    Card,
    Tag,
    Button,
    Input,
    Space,
    Spin,
    message,
    Statistic,
    Row,
    Col,
    InputNumber,
    Popconfirm,
    Divider,
  } from "antd";
  import { useState, useEffect } from "react";
  import { motion } from "framer-motion";
  import api from "../../lib/api";
  import { useIsMobile } from "../../lib/hooks";
  import { Submission } from "../../lib/types";
  import { resolveAsset } from "../../lib/assets";

  const statusMap: Record<string, { label: string; color: string }> = {
    submitted: { label: "Отправлено", color: "blue" },
    checking: { label: "Проверяется", color: "purple" },
    pending_approval: { label: "Ожидает проверки", color: "gold" },
    approved: { label: "Подтверждено", color: "green" },
  };

  export default function TeacherSubmissionReview() {
    const { id } = useParams<{ id: string }>();
    const [, navigate] = useLocation();
    const qc = useQueryClient();

    const [feedback, setFeedback] = useState("");
    const [eScore, setEScore] = useState<number>(0);
    const [scoreInited, setScoreInited] = useState(false);
    const isMobile = useIsMobile();

    const { data, isLoading } = useQuery({
      queryKey: ["submission", id],
      queryFn: async () => {
        const res = await api.get<Submission>(`/submissions/${id}`);
        return res.data;
      },
    });

    useEffect(() => {
      if (!data) return;
      if (!scoreInited && data.explanationScore != null) {
        setEScore(Math.round(data.explanationScore));
        setScoreInited(true);
      }
    }, [data?.id, data?.explanationScore]);

    const analyze = useMutation({
      mutationFn: () => api.post(`/submissions/${id}/analyze`),
      onSuccess: (res: any) => {
        message.success("Анализ выполнен");
        // Bot tavsiyasini eScore ga qo'yamiz
        const suggested = res.data?.explanationScore;
        if (suggested != null) {
          setEScore(Math.round(suggested));
          setScoreInited(true);
        }
        qc.invalidateQueries({ queryKey: ["submission", id] });
      },
      onError: () => message.error("Ошибка анализа"),
    });

    const approve = useMutation({
      mutationFn: (approved: boolean) =>
        api.post(`/submissions/${id}/approve`, {
          approved,
          explanationScore: approved ? eScore : 0,
          teacherFeedback: feedback || null,
        }),
      onSuccess: (_: any, approved: boolean) => {
        message.success(
          approved ? "Ответ подтверждён" : "Ответ отклонён",
        );
        qc.invalidateQueries({ queryKey: ["submission", id] });
        navigate("/submissions");
      },
      onError: () => message.error("Произошла ошибка"),
    });

    if (isLoading || !data)
      return (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      );

    const st = statusMap[data.status] ?? { label: data.status, color: "default" };
    const sScore = data.suspectScore ?? null;
    const total = sScore != null ? sScore + eScore : null;
    const isCorrectSuspect = sScore != null && sScore >= 30;
    const alreadyApproved = data.status === "approved";

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-5"
      >
        {/* ── Название ── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="case-tape mb-2">ПРОВЕРКА ОТВЕТА</div>
            <h2 className="font-display text-2xl text-ink m-0">
              {data.task?.title}
            </h2>
          </div>
          <Tag color={st.color} className="!text-sm !px-3 !py-1 !font-display">
            {st.label}
          </Tag>
        </div>

        {/* ── Ученик va tanlangan personaj ── */}
        <Card className="detective-card" title="Ученик данные">
          <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 14 : 20, alignItems:"flex-start" }}>
            {/* Изображение персонажа */}
            <div className="flex-shrink-0">
              <div
                style={{
                  width: isMobile ? 80 : 110,
                  height: isMobile ? 100 : 140,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#f1f5f9",
                  border: "2px solid #e2e8f0",
                }}
              >
                <img
                  src={
                    resolveAsset(
                      data.suspect?.avatar || data.suspect?.characterAssetId,
                    ) || ""
                  }
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="text-center mt-2">
                <div className="font-display text-sm text-ink">
                  {data.suspect?.name}
                </div>
                <div className="text-xs text-muted">{data.suspect?.role}</div>
                {/* To'g'ri/noto'g'ri belgisi */}
                {sScore !== null && (
                  <div className="mt-1">
                    {isCorrectSuspect ? (
                      <Tag color="green">✅ Верно</Tag>
                    ) : (
                      <Tag color="red">❌ Неверно</Tag>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ученик va xulosa */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <div className="text-xs text-muted uppercase tracking-wider">
                    Ученик
                  </div>
                  <div className="font-display text-base text-ink">
                    {data.student?.name}
                  </div>
                </div>
                <Divider type="vertical" style={{ height: 36 }} />
                <div>
                  <div className="text-xs text-muted uppercase tracking-wider">
                    Отправлено время
                  </div>
                  <div className="text-sm text-ink">
                    {new Date(data.submittedAt).toLocaleString("ru-RU")}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-canvas border border-line rounded-xl">
                <div className="text-xs text-muted uppercase tracking-wider mb-2 font-display">
                  заключительный текст учащегося
                </div>
                <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-line m-0">
                  {data.explanation}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Bot tahlili va ball ─ */}
        <Card
          className="detective-card"
          title="Результат автоматического анализа"
          extra={
            data.suspectScore == null && (
              <Button
                type="dashed"
                onClick={() => analyze.mutate()}
                loading={analyze.isPending}
              >
                Запустить анализ
              </Button>
            )
          }
        >
          {data.suspectScore == null ? (
            <p className="text-muted text-sm">
              Анализ ещё не выполнен. Нажмите кнопку выше.
            </p>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
                <div>
                  <Statistic
                    title="Балл за подозреваемого (авто)"
                    value={data.suspectScore ?? 0}
                    suffix="/ 30"
                    valueStyle={{
                      color: isCorrectSuspect ? "#16a34a" : "#dc2626",
                    }}
                  />
                  <div className="text-xs text-muted mt-1">
                    {isCorrectSuspect
                      ? "Верный подозреваемый"
                      : "Неверный подозреваемый"}
                  </div>
                </div>
                <div>
                  <Statistic
                    title="Рекомендация бота (заключение)"
                    value={(data.explanationScore ?? 0).toFixed(0)}
                    suffix="/ 70"
                    valueStyle={{ color: "#6b7280" }}
                  />
                  <div className="text-xs text-muted mt-1">
                    На основе ключевых слов
                  </div>
                </div>
                <div>
                  <Statistic
                    title="Ожидаемый итог"
                    value={total != null ? total.toFixed(0) : "—"}
                    suffix={total != null ? "/ 100" : ""}
                    valueStyle={{ color: "#f0b90b" }}
                  />
                  <div className="text-xs text-muted mt-1">
                    После оценки учителя
                  </div>
                </div>
              </div>
              {data.botFeedback && (
                <div className="p-3 bg-canvas border border-line rounded-lg text-sm text-ink/70">
                  {data.botFeedback}
                </div>
              )}
            </>
          )}
        </Card>

        {/* ── Оценка учителя ── */}
        {!alreadyApproved && data.suspectScore != null && (
          <Card className="detective-card" title="Оценка учителя">
            <div className="space-y-4">
              {/* Заключение bali inputi */}
              <div>
                <div className="text-sm font-medium text-ink mb-2">
                  Балл за заключение (0 – 70) — устанавливается учителем
                </div>
                <div className="flex items-center gap-4">
                  <InputNumber
                    min={0}
                    max={70}
                    value={eScore}
                    onChange={(v) => setEScore(v ?? 0)}
                    size="large"
                    style={{ width: 120 }}
                    addonAfter="/ 70"
                  />
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {[0, 10, 20, 30, 40, 50, 60, 70].map((v) => (
                      <Button
                        key={v}
                        size="small"
                        type={eScore === v ? "primary" : "default"}
                        onClick={() => setEScore(v)}
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
                {/* Jonli preview */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-muted">Итого:</span>
                  <span
                    className="font-display text-lg"
                    style={{ color: "#f0b90b" }}
                  >
                    {((data.suspectScore ?? 0) + eScore).toFixed(0)} / 100
                  </span>
                  <span className="text-xs text-muted ml-1">
                    ({data.suspectScore ?? 0} подозреваемый + {eScore} заключение)
                  </span>
                  <span className="text-xs text-muted ml-2">
                    → <strong>{(data.suspectScore ?? 0) + eScore} XP</strong>{" "}
                    XP будет начислено
                  </span>
                </div>
              </div>

              {/* Feedback */}
              <div>
                <div className="text-sm font-medium text-ink mb-2">
                  Учитель объяснение (произвольный)
                </div>
                <Input.TextArea
                  rows={4}
                    placeholder="Комментарий, рекомендация или пояснение для ученика..."
                    value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>

              {/* Tugmalar */}
              <Space>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => approve.mutate(true)}
                  loading={approve.isPending}
                >
                  ✅ Подтвердить и {(data.suspectScore ?? 0) + eScore} XP Начислить
                </Button>
                <Popconfirm
                  title="Отклонить ответ?"
                  description="Результаты анализа будут сброшены."
                  okText="Да, отклонить"
                  okButtonProps={{ danger: true }}
                  cancelText="Отмена"
                  onConfirm={() => approve.mutate(false)}
                >
                  <Button danger size="large" loading={approve.isPending}>
                    ↩ Отклонить
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          </Card>
        )}

        {/* ── Allaqachon tasdiqlangan ── */}
        {alreadyApproved && (
          <Card className="detective-card" title="Подтверждённый результат">
            <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(3,1fr)", gap:16 }}>
              <div>
                <Statistic
                  title="Балл за подозреваемого"
                  value={data.suspectScore ?? 0}
                  suffix="/ 30"
                />
              </div>
              <div>
                <Statistic
                  title="Балл за заключение (учитель)"
                  value={(data.explanationScore ?? 0).toFixed(0)}
                  suffix="/ 70"
                />
              </div>
              <div>
                <Statistic
                  title="Итого"
                  value={(data.totalScore ?? 0).toFixed(0)}
                  suffix="/ 100"
                  valueStyle={{ color: "#16a34a" }}
                />
              </div>
            </div>
            {data.teacherFeedback && (
              <div className="mt-4 p-3 bg-canvas border border-line rounded-lg text-sm text-ink/80">
                <div className="text-xs text-muted mb-1">Комментарий учителя:</div>
                {data.teacherFeedback}
              </div>
            )}
            <div className="mt-3 text-xs text-muted">
              Подтверждено:{" "}
              {data.approvedAt
                ? new Date(data.approvedAt).toLocaleString("ru-RU")
                : "—"}
            </div>
          </Card>
        )}
      </motion.div>
    );
  }