import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Modal, Form, Input, message, Popconfirm, Upload, Spin } from "antd";
import { PlusOutlined, UploadOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import api from "../../lib/api";
import { CharacterAsset } from "../../lib/types";
import { resolveAsset } from "../../lib/assets";
import { useIsMobile } from "../../lib/hooks";

export default function TeacherCharacters() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<CharacterAsset | null>(null);
  const [form]                = Form.useForm();
  const [imageUrl,   setImageUrl]   = useState("");
  const [uploading,  setUploading]  = useState(false);
  const [previewSrc, setPreviewSrc] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["chars"],
    queryFn: async () => (await api.get<CharacterAsset[]>("/assets/characters")).data,
  });

  const save = useMutation({
    mutationFn: (v: any) => editing ? api.patch(`/assets/characters/${editing.id}`, v) : api.post("/assets/characters", v),
    onSuccess: () => { message.success("Сохранено"); closeModal(); qc.invalidateQueries({ queryKey: ["chars"] }); },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/assets/characters/${id}`),
    onSuccess: () => { message.success("Удалено"); qc.invalidateQueries({ queryKey: ["chars"] }); },
  });

  const openAdd  = () => { setEditing(null); form.resetFields(); setImageUrl(""); setPreviewSrc(""); setOpen(true); };
  const openEdit = (c: CharacterAsset) => {
    setEditing(c); form.setFieldsValue({ name: c.name, role: c.roleHint });
    const r = resolveAsset(c.imageUrl) || c.imageUrl;
    setImageUrl(c.imageUrl); setPreviewSrc(r); setOpen(true);
  };
  const closeModal = () => { setOpen(false); setEditing(null); form.resetFields(); setImageUrl(""); setPreviewSrc(""); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append("image", file);
    try {
      const res = await api.post<{ url: string }>("/assets/characters/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImageUrl(res.data.url); setPreviewSrc(res.data.url);
      message.success("Загружено");
    } catch (e: any) { message.error(e.response?.data?.error || "Ошибка загрузки"); }
    finally { setUploading(false); }
    return false;
  };

  const onFinish = (values: any) => {
    if (!imageUrl) { message.warning("Изображение обязательно"); return; }
    save.mutate({ name: values.name, role: values.role, imageUrl });
  };

  const count = (data || []).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#111" }}>
            Персонажи{" "}
            <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>({count})</span>
          </div>
          {!isMobile && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Библиотека персонажей для заданий</div>}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} size={isMobile ? "middle" : "middle"}>
          {isMobile ? "Добавить" : "Новый персонаж"}
        </Button>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      ) : count === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af", fontSize: 14,
          background: "#fff", borderRadius: 12, border: "1px dashed #e5e7eb" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          Персонажей пока нет. Нажмите «Добавить».
        </div>
      ) : (
        /* 3 columns on mobile/tablet, 4 on desktop */
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
          gap: isMobile ? 10 : 14,
        }}>
          {(data || []).map((c) => (
            <motion.div key={c.id} whileHover={{ y: -4 }} style={{ borderRadius: 12, overflow: "hidden", background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>

              {/* Photo */}
              <div style={{ position: "relative", aspectRatio: "3/4", background: "#f1f5f9", overflow: "hidden" }}>
                <img
                  src={resolveAsset(c.imageUrl) || c.imageUrl}
                  alt={c.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {/* Overlay buttons on hover (desktop) */}
                {!isMobile && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", opacity: 0, transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    className="char-overlay">
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(c)} style={{ background: "white" }} />
                    <Popconfirm title="Удалить?" okText="Да" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => del.mutate(c.id)}>
                      <Button size="small" icon={<DeleteOutlined />} danger style={{ background: "white" }} />
                    </Popconfirm>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: isMobile ? "8px" : "10px 12px" }}>
                <div style={{ fontFamily: "Special Elite, monospace", fontSize: isMobile ? 11 : 13, color: "#0f172a", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </div>
                <div style={{ fontSize: isMobile ? 10 : 11, color: "#6b7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.roleHint}
                </div>
              </div>

              {/* Action buttons (always visible on mobile) */}
              {isMobile && (
                <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
                  <button onClick={() => openEdit(c)}
                    style={{ flex: 1, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                    <EditOutlined />{" "}Изм.
                  </button>
                  <div style={{ width: 1, background: "#f3f4f6" }} />
                  <Popconfirm title="Удалить?" okText="Да" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => del.mutate(c.id)}>
                    <button
                      style={{ flex: 1, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                      <DeleteOutlined />{" "}Удал.
                    </button>
                  </Popconfirm>
                </div>
              )}
              {!isMobile && (
                <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
                  <Button type="text" icon={<EditOutlined />} style={{ flex: 1, borderRadius: 0, fontSize: 12 }} onClick={() => openEdit(c)}>Редактировать</Button>
                  <div style={{ width: 1, background: "#f3f4f6" }} />
                  <Popconfirm title="Удалить этого персонажа?" okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => del.mutate(c.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} style={{ flex: 1, borderRadius: 0, fontSize: 12 }}>Удалить</Button>
                  </Popconfirm>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      <Modal
        title={editing ? `Редактировать: ${editing.name}` : "Новый персонаж"}
        open={open} onCancel={closeModal} onOk={() => form.submit()}
        okText={editing ? "Сохранить" : "Добавить"} okButtonProps={{ loading: save.isPending }}
        width={isMobile ? "94vw" : 520}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Имя" rules={[{ required: true, message: "Введите имя" }]}>
            <Input placeholder="Например: Иван Петров" size="large" />
          </Form.Item>
          <Form.Item name="role" label="Профессия / Роль" rules={[{ required: true, message: "Введите профессию" }]}>
            <Input placeholder="Например: Профессор университета" size="large" />
          </Form.Item>
          <Form.Item label="Изображение персонажа" required>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 90, height: 116, flexShrink: 0, border: "2px dashed #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {uploading ? <Spin /> : previewSrc ? <img src={previewSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: 28, color: "#d1d5db" }}>👤</span>}
              </div>
              <div style={{ flex: 1 }}>
                <Upload accept=".jpg,.jpeg,.png,.webp" showUploadList={false} beforeUpload={(file) => { handleUpload(file); return false; }}>
                  <Button icon={<UploadOutlined />} loading={uploading} size="large" style={{ width: "100%" }}>
                    {previewSrc ? "Заменить" : "Загрузить фото"}
                  </Button>
                </Upload>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>JPG, PNG или WEBP · макс. 5 МБ</div>
                {!imageUrl && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>Изображение обязательно</div>}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </motion.div>
  );
}
