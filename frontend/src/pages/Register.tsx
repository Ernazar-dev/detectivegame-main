import { useState } from "react";
import { Form, Input, Button } from "antd";
import {
  MobileOutlined, LockOutlined, UserOutlined,
  CheckCircleFilled, CloseCircleFilled,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import type { User } from "../lib/auth";

type RF = { name: string; phone: string; password: string; confirm: string };

function digits(v: string) { return v.replace(/\D/g, ""); }
function fmtPhone(raw: string): string {
  const d = digits(raw).slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)} ${d.slice(2)}`;
  if (d.length <= 7) return `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5)}`;
  return `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5,7)} ${d.slice(7)}`;
}

// Password strength: 0–4
function pwStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) || /[а-яА-Я]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  return Math.min(score, 4);
}
const STRENGTH_LABEL = ["", "Слабый", "Средний", "Хороший", "Надёжный"];
const STRENGTH_COLOR = ["", "#ef4444", "#f59e0b", "#3b82f6", "#16a34a"];

// Checklist rule component
function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11,
      color: ok ? "#16a34a" : "#9ca3af", transition: "color 0.2s" }}>
      {ok
        ? <CheckCircleFilled style={{ color: "#16a34a" }} />
        : <CloseCircleFilled style={{ color: "#d1d5db" }} />}
      {label}
    </div>
  );
}

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [pw, setPw]           = useState("");
  const [form] = Form.useForm<RF>();

  const strength = pwStrength(pw);

  const onFinish = async (v: RF) => {
    setLoading(true);
    setError(null);
    try {
      const phone = "998" + digits(v.phone).slice(-9);
      const { data } = await api.post<{ token: string; user: User }>(
        "/auth/register", { name: v.name, phone, password: v.password }
      );
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      useAuth.setState({ user: data.user, loading: false });
      navigate("/");
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas bg-case-paper py-6 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 440 }}
      >
        <div className="case-card !shadow-case px-8 py-7">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-block case-tape mb-2" style={{ fontSize: 10 }}>
              НОВЫЙ АГЕНТ
            </div>
            <h1 className="font-display text-2xl text-ink m-0">ПРИСОЕДИНИТЬСЯ</h1>
            <p className="text-muted text-xs mt-1">Создайте аккаунт полевого агента</p>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 14 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                style={{ background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#991b1b",
                  display: "flex", alignItems: "center", gap: 8 }}
              >
                <span>⚠</span><span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Form
            form={form} layout="vertical" onFinish={onFinish}
            onChange={() => error && setError(null)}
          >
            {/* Имя */}
            <Form.Item
              label="Полное имя" name="name"
              style={{ marginBottom: 12 }}
              rules={[
                { required: true, message: "Введите имя" },
                { min: 2, message: "Минимум 2 символа" },
                { pattern: /\S+\s+\S+/, message: "Введите имя и фамилию" },
              ]}
            >
              <Input
                size="large" placeholder="Имя Фамилия" autoFocus
                prefix={<UserOutlined style={{ color: "#9ca3af" }} />}
              />
            </Form.Item>

            {/* Телефон */}
            <Form.Item
              label="Номер телефона" name="phone"
              style={{ marginBottom: 12 }}
              getValueFromEvent={(e) => fmtPhone(e.target.value)}
              rules={[
                { required: true, message: "Введите номер телефона" },
                { validator: (_, v) => digits(v||"").length >= 9
                    ? Promise.resolve()
                    : Promise.reject("Введите 9 цифр") },
              ]}
            >
              <Input
                size="large" maxLength={12} placeholder="90 123 45 67"
                addonBefore={
                  <span style={{ fontWeight: 600, color: "#0f172a", userSelect: "none" }}>
                    <MobileOutlined style={{ marginRight: 4 }} />+998
                  </span>
                }
              />
            </Form.Item>

            {/* Пароль + strength */}
            <Form.Item
              label="Пароль" name="password"
              style={{ marginBottom: 6 }}
              rules={[
                { required: true, message: "Введите пароль" },
                { min: 6, message: "Минимум 6 символов" },
              ]}
            >
              <Input.Password
                size="large" placeholder="Минимум 6 символов"
                prefix={<LockOutlined style={{ color: "#9ca3af" }} />}
                onChange={(e) => setPw(e.target.value)}
              />
            </Form.Item>

            {/* Strength bar + checklist */}
            {pw.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ marginBottom: 12 }}
              >
                {/* Progress bar */}
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
                      background: i <= strength ? STRENGTH_COLOR[strength] : "#e5e7eb",
                      transition: "background 0.3s" }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Rule ok={pw.length >= 6}  label="6+ символов" />
                    <Rule ok={/\d/.test(pw)}   label="Цифра" />
                    <Rule ok={pw.length >= 10} label="10+ символов" />
                  </div>
                  {strength > 0 && (
                    <span style={{ fontSize: 11, color: STRENGTH_COLOR[strength], fontWeight: 600 }}>
                      {STRENGTH_LABEL[strength]}
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {/* Подтверждение */}
            <Form.Item
              label="Подтверждение пароля" name="confirm"
              style={{ marginBottom: 16 }}
              dependencies={["password"]}
              rules={[
                { required: true, message: "Подтвердите пароль" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) return Promise.resolve();
                    return Promise.reject(new Error("Пароли не совпадают"));
                  },
                }),
              ]}
            >
              <Input.Password
                size="large" placeholder="Повторите пароль"
                prefix={<LockOutlined style={{ color: "#9ca3af" }} />}
              />
            </Form.Item>

            <Button
              type="primary" htmlType="submit" block size="large"
              loading={loading}
              className="font-display tracking-wider"
              style={{ height: 46 }}
            >
              {loading ? "Создание..." : "СОЗДАТЬ АККАУНТ"}
            </Button>
          </Form>

          <div className="text-center mt-4 text-sm text-muted">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-clue-blue font-medium hover:underline">
              Войти
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}