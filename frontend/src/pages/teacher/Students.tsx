import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Modal, Form, Input, message, Popconfirm, Tag, Spin } from "antd";
import { PlusOutlined, SearchOutlined, UserOutlined, DeleteOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../lib/api";
import { useIsMobile } from "../../lib/hooks";

const COLORS = ["#2563eb","#16a34a","#f59e0b","#8b5cf6","#ef4444","#0891b2","#be185d","#0d9488"];
function Av({ u, size = 40 }: { u: any; size?: number }) {
  const c = COLORS[u.id % COLORS.length];
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",flexShrink:0,background:`linear-gradient(135deg,${c},${c}cc)`,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid white",boxShadow:"0 2px 8px rgba(0,0,0,0.12)",overflow:"hidden" }}>
      {u.avatar ? <img src={u.avatar} alt={u.name} style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} /> : <span style={{ color:"white",fontWeight:700,fontSize:size*0.38 }}>{u.name?.[0]?.toUpperCase()||"?"}</span>}
    </div>
  );
}

export default function TeacherStudents() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({ queryKey: ["users","student"], queryFn: async () => (await api.get("/users?role=student")).data });
  const create = useMutation({
    mutationFn: (v: any) => api.post("/users", { ...v, role: "student" }),
    onSuccess: () => { message.success("Ученик создан"); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ["users","student"] }); },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { message.success("Ученик удалён"); qc.invalidateQueries({ queryKey: ["users","student"] }); },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((u: any) => u.name?.toLowerCase().includes(q) || u.phone?.includes(q));
  }, [data, search]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <Input prefix={<SearchOutlined style={{ color:"#9ca3af" }} />}
          placeholder="Поиск по имени или телефону..."
          value={search} onChange={e => setSearch(e.target.value)} allowClear
          style={{ flex:1 }} size={isMobile ? "middle" : "large"} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)} size={isMobile ? "middle" : "large"}>
          {isMobile ? "" : "Добавить ученика"}
        </Button>
      </div>

      {/* ── Count badge ── */}
      {data && (
        <div style={{ marginBottom:10, fontSize:12, color:"#9ca3af" }}>
          {filtered.length !== data.length ? `${filtered.length} из ${data.length}` : `${data.length} учеников`}
        </div>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div style={{ textAlign:"center", padding:60 }}><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"#9ca3af", background:"#fff", borderRadius:12, border:"1px dashed #e5e7eb" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
          {search ? `«${search}» — ничего не найдено` : "Учеников пока нет"}
        </div>
      ) : (
        <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", overflow:"hidden" }}>
          {/* Table header — desktop only */}
          {!isMobile && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px 150px 44px", padding:"9px 18px", background:"#f8fafc", borderBottom:"1px solid #f1f3f5" }}>
              {["Ученик","Уровень","XP","Телефон",""].map((h,i) => (
                <div key={i} style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.8 }}>{h}</div>
              ))}
            </div>
          )}

          <AnimatePresence>
            {filtered.map((u: any, idx: number) => (
              <motion.div key={u.id}
                initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} transition={{ delay:idx*0.025 }}
                style={{
                  display: isMobile ? "flex" : "grid",
                  gridTemplateColumns: isMobile ? undefined : "1fr 90px 80px 150px 44px",
                  alignItems:"center", padding: isMobile ? "12px 14px" : "12px 18px",
                  borderBottom:"1px solid #f9fafb", transition:"background 0.15s",
                  gap: isMobile ? 12 : 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.background="#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background="transparent")}
              >
                {/* Avatar + name */}
                <div style={{ display:"flex", alignItems:"center", gap:10, flex: isMobile ? 1 : undefined, minWidth:0 }}>
                  <Av u={u} size={isMobile ? 36 : 40} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:isMobile?13:14, color:"#0f172a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.name}</div>
                    {isMobile ? (
                      <div style={{ fontSize:11, color:"#9ca3af" }}>{u.phone} · Ур.{u.level??1} · {u.xp??0} XP</div>
                    ) : (
                      <div style={{ fontSize:11, color:"#9ca3af" }}>ID #{u.id}</div>
                    )}
                  </div>
                </div>
                {/* Desktop-only columns */}
                {!isMobile && <>
                  <Tag color="gold" style={{ fontFamily:"Special Elite,monospace", width:"fit-content" }}>Ур. {u.level??1}</Tag>
                  <div style={{ fontWeight:700, color:"#16a34a", fontFamily:"Special Elite,monospace", fontSize:14 }}>{u.xp??0} XP</div>
                  <span style={{ fontSize:12, color:"#6b7280", fontFamily:"monospace", letterSpacing:0.5 }}>{u.phone}</span>
                </>}
                {/* Delete */}
                <Popconfirm title="Удалить ученика?" description="Это действие нельзя отменить." okText="Удалить" okButtonProps={{ danger:true }} cancelText="Отмена" onConfirm={() => del.mutate(u.id)}>
                  <button style={{ width:30, height:30, borderRadius:8, border:"1px solid #fecaca", background:"#fef2f2", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#dc2626", flexShrink:0 }}>
                    <DeleteOutlined />
                  </button>
                </Popconfirm>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Modal ── */}
      <Modal title={<div style={{ display:"flex", alignItems:"center", gap:8 }}><UserOutlined style={{ color:"#2563eb" }} />Добавить ученика</div>}
        open={open} onCancel={() => { setOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="Добавить" width={isMobile ? "94vw" : 440}>
        <Form form={form} layout="vertical" onFinish={v => create.mutate(v)} style={{ marginTop:16 }}>
          <Form.Item name="name" label="Полное имя" rules={[{ required:true, message:"Введите имя" }]}>
            <Input prefix={<UserOutlined style={{ color:"#9ca3af" }} />} placeholder="Имя Фамилия" size="large" />
          </Form.Item>
          <Form.Item name="phone" label="Телефон" rules={[{ required:true, message:"Введите телефон" }]}>
            <Input placeholder="998901234567" size="large" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required:true, min:6, message:"Минимум 6 символов" }]}>
            <Input.Password placeholder="Минимум 6 символов" size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </motion.div>
  );
}
