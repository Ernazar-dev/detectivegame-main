import { useState, useRef, useEffect } from "react";
import { Form, Input, Button } from "antd";
import { MobileOutlined, LockOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useAuth } from "../lib/auth";

function digits(v: string) { return v.replace(/\D/g, ""); }
function fmtPhone(raw: string): string {
  const d = digits(raw).slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)} ${d.slice(2)}`;
  if (d.length <= 7) return `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5)}`;
  return `${d.slice(0,2)} ${d.slice(2,5)} ${d.slice(5,7)} ${d.slice(7)}`;
}

const SAVED_PHONE_KEY = "detective_last_phone";

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [shake, setShake]   = useState(false);
  const phoneRef = useRef<any>(null);

  // Restore last used phone
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_PHONE_KEY);
    if (saved) form.setFieldValue("phone", saved);
    // Auto-focus: phone if empty, else password
    setTimeout(() => {
      if (!saved) phoneRef.current?.focus();
      else form.focusField("password");
    }, 300);
  }, []);

  const onFinish = async (values: { phone: string; password: string }) => {
    setLoading(true);
    setError(null);
    const phone = "998" + digits(values.phone).slice(-9);
    try {
      const u = await login(phone, values.password);
      localStorage.setItem(SAVED_PHONE_KEY, values.phone);
      navigate("/");
      // success toast handled by layout
    } catch (e: any) {
      const msg = e.response?.data?.error || "Неверный номер телефона или пароль";
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      form.setFields([{ name: "password", errors: [] }]); // clear field error, show banner
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 bg-case-paper">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 420 }}
      >
        <motion.div
          animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.55 }}
          className="case-card !shadow-case px-8 py-8"
        >
          {/* Header */}
          <div className="text-center mb-7">
            <div className="inline-block case-tape mb-3">СЕКРЕТНО</div>
            <h1 className="font-display text-3xl text-ink m-0">ДЕТЕКТИВ</h1>
            <p className="text-muted text-sm mt-1">Учебная платформа расследований</p>
            <div className="flex justify-center gap-1.5 mt-3">
              {["bg-clue-red","bg-clue-yellow","bg-clue-green","bg-clue-blue","bg-ink"].map(c => (
                <span key={c} className={`w-2 h-2 rounded-full ${c}`} />
              ))}
            </div>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22 }}
                style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "10px 14px",
                  fontSize: 13, color: "#991b1b",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Form form={form} layout="vertical" onFinish={onFinish}
            onChange={() => error && setError(null)}>
            <Form.Item
              label="Номер телефона" name="phone"
              getValueFromEvent={(e) => fmtPhone(e.target.value)}
              rules={[
                { required: true, message: "Введите номер телефона" },
                { validator: (_, v) => digits(v||"").length >= 9 ? Promise.resolve() : Promise.reject("Введите 9 цифр") },
              ]}
            >
              <Input
                ref={phoneRef}
                size="large" maxLength={12} placeholder="90 123 45 67"
                addonBefore={
                  <span style={{ fontWeight: 600, color: "#0f172a", userSelect: "none" }}>
                    <MobileOutlined style={{ marginRight: 5 }} />+998
                  </span>
                }
              />
            </Form.Item>

            <Form.Item
              label="Пароль" name="password"
              rules={[{ required: true, message: "Введите пароль" }]}
            >
              <Input.Password
                size="large" placeholder="Введите пароль"
                prefix={<LockOutlined style={{ color: "#9ca3af" }} />}
                iconRender={v => v ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onPressEnter={() => form.submit()}
              />
            </Form.Item>

            <Button
              type="primary" htmlType="submit" block size="large"
              loading={loading}
              className="font-display tracking-wider"
              style={{ height: 46 }}
            >
              {loading ? "Вход..." : "ВОЙТИ В СИСТЕМУ"}
            </Button>
          </Form>

          <div className="text-center mt-5 text-sm text-muted">
            Нет аккаунта?{" "}
            <Link href="/register" className="text-clue-blue font-medium hover:underline">
              Зарегистрироваться
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}