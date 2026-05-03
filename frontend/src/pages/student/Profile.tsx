import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Form, Input, Button, message, Progress,
  Statistic, Row, Col, Spin, Tabs, Tag,
} from "antd";
import {
  CameraOutlined, EditOutlined, CheckOutlined,
  CloseOutlined, LockOutlined, UserOutlined,
  TrophyOutlined, FireOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { useIsMobile } from "../../lib/hooks";
import api from "../../lib/api";

export default function StudentProfile() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [pwForm]   = Form.useForm();
  const [nameForm] = Form.useForm();
  const [editName, setEditName]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [activeTab, setActiveTab]   = useState("info");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: dash, isLoading } = useQuery({
    queryKey: ["dashboard.student"],
    queryFn: async () => (await api.get("/dashboard/student")).data,
  });

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatar = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg","jpeg","png","webp"].includes(ext)) {
      message.error("Только JPG, PNG или WEBPlar"); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error("Размер файла не более 5 МБ"); return;
    }
    setUploading(true);
    try {
      // 1. Rasmni yuklaymiz
      const fd = new FormData();
      fd.append("image", file);
      const { data: uploadData } = await api.post<{ url: string }>(
        "/uploads/avatar", fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      // 2. URL ni user profiliga saqlaymiz
      await api.patch(`/users/${user?.id}`, { avatar: uploadData.url });
      // 3. Auth store va queries ni yangilaymiz
      await refreshUser();
      qc.invalidateQueries({ queryKey: ["dashboard.student"] });
      message.success("Профиль изображение обновлено ✓");
    } catch (e: any) {
      message.error(e.response?.data?.error || "Загрузить изображениеda ошибка");
    } finally {
      setUploading(false);
    }
  };

  // ── Имя yangilash ─────────────────────────────────────────────────────────
  const updateName = useMutation({
    mutationFn: (v: any) => api.patch(`/users/${user?.id}`, { name: v.name }),
    onSuccess: () => {
      message.success("Имя yangilandi ✓");
      setEditName(false);
      refreshUser();
    },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });

  // ── Пароль ─────────────────────────────────────────────────────────────────
  const changePw = useMutation({
    mutationFn: (v: any) => api.patch(`/users/${user?.id}`, { password: v.newPw }),
    onSuccess: () => {
      message.success("Пароль изменён ✓");
      pwForm.resetFields();
    },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });

  const xpInLevel = (user?.xp ?? 0) % 100;
  const xpToNext  = 100 - xpInLevel;

  if (isLoading) return (
    <div className="flex justify-center py-20"><Spin size="large" /></div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 820, margin: "0 auto" }}>

      {/* ── Hero card ── */}
      <Card
        className="case-card"
        style={{ marginBottom: 20, overflow: "hidden", padding: 0 }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Gradient banner */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f2744 100%)",
          padding: "28px 28px 20px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Pattern overlay */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 10px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 16, right: 20 }}>
            <div className="case-tape" style={{ transform: "rotate(2deg)", fontSize: 9 }}>КАРТА АГЕНТА</div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 20, position: "relative" }}>
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <motion.div
                whileHover={{ scale: 1.03 }}
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 92, height: 92, borderRadius: 16, overflow: "hidden",
                  background: "linear-gradient(135deg, #1e3a5f, #0c1f3a)",
                  border: "3px solid rgba(255,255,255,0.15)",
                  cursor: "pointer", position: "relative",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
              >
                {uploading ? (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Spin style={{ color: "white" }} />
                  </div>
                ) : user?.avatar ? (
                  <img src={user.avatar} alt="avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38 }}>🕵️</div>
                )}

                {/* Hover overlay */}
                <motion.div
                  initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                  style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CameraOutlined style={{ color: "white", fontSize: 22 }} />
                </motion.div>
              </motion.div>

              {/* Camera badge */}
              <motion.div
                whileHover={{ scale: 1.15 }} onClick={() => fileRef.current?.click()}
                style={{
                  position: "absolute", bottom: -4, right: -4,
                  width: 26, height: 26, borderRadius: "50%",
                  background: "#2563eb", border: "2px solid #0f172a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <CameraOutlined style={{ color: "white", fontSize: 11 }} />
              </motion.div>

              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatar(f); e.target.value = ""; }}
              />
            </div>

            {/* Name + level */}
            <div style={{ flex: 1 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6, fontFamily: "Special Elite, monospace" }}>
                Полевой агент
              </div>

              {/* Inline name edit */}
              <AnimatePresence mode="wait">
                {editName ? (
                  <motion.div key="edit" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Form form={nameForm} onFinish={v => updateName.mutate(v)}
                      initialValues={{ name: user?.name }}
                      style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Form.Item name="name" style={{ margin: 0 }} rules={[{ required: true, min: 2 }]}>
                        <Input
                          size="large" autoFocus
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)", color: "white", fontFamily: "Special Elite, monospace", fontSize: 20, width: 260 }}
                        />
                      </Form.Item>
                      <Button htmlType="submit" loading={updateName.isPending} type="primary" icon={<CheckOutlined />} size="large" />
                      <Button onClick={() => setEditName(false)} icon={<CloseOutlined />} size="large"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }} />
                    </Form>
                  </motion.div>
                ) : (
                  <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ color: "white", fontFamily: "Special Elite, monospace", fontSize: 24, lineHeight: 1 }}>
                      {user?.name}
                    </span>
                    <motion.button whileHover={{ scale: 1.1 }} onClick={() => { setEditName(true); nameForm.setFieldsValue({ name: user?.name }); }}
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.55)", cursor: "pointer", padding: "4px 10px", fontSize: 12 }}>
                      <EditOutlined />
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Badges */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Tag color="gold" style={{ fontFamily: "Special Elite, monospace", margin: 0 }}>Уровень {user?.level ?? 1}</Tag>
                <Tag color="green" style={{ margin: 0 }}>{user?.xp ?? 0} XP</Tag>
                {dash?.rank && <Tag color="red" style={{ margin: 0 }}>#{dash.rank} -е место</Tag>}
              </div>
            </div>
          </div>

          {/* XP progress */}
          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 5 }}>
              <span>Уровень {user?.level ?? 1} → {(user?.level ?? 1) + 1}</span>
              <span>{xpToNext} XP осталось</span>
            </div>
            <Progress percent={xpInLevel} showInfo={false}
              strokeColor={{ from: "#16a34a", to: "#22c55e" }}
              trailColor="rgba(255,255,255,0.08)" />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ padding: "16px 24px", background: "#fafafa", borderTop: "1px solid #f1f3f5" }}>
          <Row gutter={0}>
            {[
              { icon: <CheckCircleOutlined style={{ color: "#16a34a" }} />, label: "Решено", value: dash?.completedTasks ?? 0, suffix: "ta" },
              { icon: <FireOutlined style={{ color: "#f59e0b" }} />,        label: "Средний балл", value: `${dash?.averageScore ?? 0}`, suffix: "/ 100" },
              { icon: <TrophyOutlined style={{ color: "#dc2626" }} />,      label: "Рейтинг место", value: dash?.rank ? `#${dash.rank}` : "—", suffix: "" },
              { icon: <UserOutlined style={{ color: "#2563eb" }} />,        label: "Всего сдано", value: (dash?.completedTasks ?? 0) + (dash?.pendingTasks ?? 0), suffix: "ta" },
            ].map((s, i) => (
              <Col span={6} key={i}>
                <div style={{ textAlign: "center", padding: "8px 4px",
                  borderRight: i < 3 ? "1px solid #e5e7eb" : "none" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{s.label}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </Card>

      {/* ── Tabs: sozlamalar ── */}
      <Card className="case-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "info",
              label: <span><UserOutlined /> Сведения</span>,
              children: (
                <div style={{ maxWidth: 480, paddingTop: 8 }}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
                      Основные данные
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "Имя", value: user?.name },
                        { label: "Роль", value: "Ученик" },
                        { label: "Уровень", value: `${user?.level ?? 1}-й уровень` },
                        { label: "Всего XP", value: `${user?.xp ?? 0} XP` },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                          <span style={{ width: 130, fontSize: 13, color: "#9ca3af" }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: "14px 16px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe", fontSize: 12, color: "#1e40af" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 Имя преобразование</div>
                    Нажмите кнопку <EditOutlined /> рядом с именем и введите новое.
                  </div>
                </div>
              ),
            },
            {
              key: "security",
              label: <span><LockOutlined /> Безопасность</span>,
              children: (
                <div style={{ maxWidth: 420, paddingTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 }}>
                    Смена пароля
                  </div>
                  <Form form={pwForm} layout="vertical" onFinish={v => changePw.mutate(v)}>
                    <Form.Item name="newPw" label="Новый пароль"
                      rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}>
                      <Input.Password size="large" placeholder="Новый пароль" prefix={<LockOutlined style={{ color: "#9ca3af" }} />} />
                    </Form.Item>
                    <Form.Item name="confirm" label="Подтверждение пароля"
                      dependencies={["newPw"]}
                      rules={[
                        { required: true },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue("newPw") === value) return Promise.resolve();
                            return Promise.reject(new Error("Пароли не совпадают"));
                          },
                        }),
                      ]}>
                      <Input.Password size="large" placeholder="Повторите пароль" prefix={<LockOutlined style={{ color: "#9ca3af" }} />} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={changePw.isPending} size="large">
                      Изменить пароль
                    </Button>
                  </Form>
                </div>
              ),
            },
          ]}
        />
      </Card>

    </motion.div>
  );
}