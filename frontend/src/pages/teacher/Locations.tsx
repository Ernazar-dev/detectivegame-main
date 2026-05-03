import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Modal, Form, Input, message, Popconfirm, Upload, Spin, Radio } from "antd";
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import api from "../../lib/api";
import { LocationAsset } from "../../lib/types";
import { resolveAsset } from "../../lib/assets";
import { useIsMobile } from "../../lib/hooks";

const typeOptions = [
  { label: "🏠 В помещении", value: "внутри" },
  { label: "🌳 На улице",    value: "снаружи" },
];

export default function TeacherLocations() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<LocationAsset | null>(null);
  const [form]                = Form.useForm();
  const [imageUrl,   setImageUrl]   = useState("");
  const [previewSrc, setPreviewSrc] = useState("");
  const [uploading,  setUploading]  = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["locs"],
    queryFn: async () => (await api.get<LocationAsset[]>("/assets/locations")).data,
  });

  const save = useMutation({
    mutationFn: (v: any) => editing ? api.patch(`/assets/locations/${editing.id}`, v) : api.post("/assets/locations", v),
    onSuccess: () => { message.success("Сохранено"); closeModal(); qc.invalidateQueries({ queryKey: ["locs"] }); },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/assets/locations/${id}`),
    onSuccess: () => { message.success("Удалено"); qc.invalidateQueries({ queryKey: ["locs"] }); },
  });

  const openAdd  = () => { setEditing(null); form.resetFields(); setImageUrl(""); setPreviewSrc(""); setOpen(true); };
  const openEdit = (l: LocationAsset) => {
    setEditing(l); form.setFieldsValue({ name: l.name, type: l.type });
    const r = resolveAsset(l.imageUrl) || l.imageUrl;
    setImageUrl(l.imageUrl); setPreviewSrc(r); setOpen(true);
  };
  const closeModal = () => { setOpen(false); setEditing(null); form.resetFields(); setImageUrl(""); setPreviewSrc(""); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append("image", file);
    try {
      const res = await api.post<{ url: string }>("/assets/locations/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImageUrl(res.data.url); setPreviewSrc(res.data.url);
      message.success("Загружено");
    } catch (e: any) { message.error(e.response?.data?.error || "Ошибка загрузки"); }
    finally { setUploading(false); }
    return false;
  };

  const onFinish = (values: any) => {
    if (!imageUrl) { message.warning("Изображение обязательно"); return; }
    save.mutate({ name: values.name, type: values.type, imageUrl });
  };

  const count = (data || []).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#111" }}>
            Локации{" "}<span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>({count})</span>
          </div>
          {!isMobile && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Библиотека мест для сцен</div>}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          {isMobile ? "Добавить" : "Новая локация"}
        </Button>
      </div>

      {/* ── Grid: 2-col mobile, 3-col desktop ── */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      ) : count === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af", fontSize: 14, background: "#fff", borderRadius: 12, border: "1px dashed #e5e7eb" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏙️</div>
          Локаций пока нет. Нажмите «Добавить».
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 10 : 14,
        }}>
          {(data || []).map((l) => (
            <motion.div key={l.id} whileHover={{ y: -4 }} style={{ borderRadius: 12, overflow: "hidden", background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>

              {/* Photo with type badge */}
              <div style={{ position: "relative", aspectRatio: "16/10", background: "#f1f5f9", overflow: "hidden" }}>
                <img
                  src={resolveAsset(l.imageUrl) || l.imageUrl}
                  alt={l.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {/* Type badge */}
                <div style={{
                  position: "absolute", top: 8, left: 8,
                  background: l.type === "снаружи" ? "rgba(22,163,74,0.85)" : "rgba(37,99,235,0.85)",
                  color: "white", fontSize: 10, fontWeight: 600,
                  padding: "3px 7px", borderRadius: 5, backdropFilter: "blur(4px)",
                }}>
                  {l.type === "снаружи" ? "🌳 На улице" : "🏠 Помещение"}
                </div>
              </div>

              {/* Name */}
              <div style={{ padding: isMobile ? "8px 10px" : "10px 12px" }}>
                <div style={{ fontFamily: "Special Elite, monospace", fontSize: isMobile ? 12 : 13, color: "#0f172a", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.name}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", borderTop: "1px solid #f3f4f6" }}>
                <button onClick={() => openEdit(l)}
                  style={{ flex: 1, padding: "9px 4px", background: "none", border: "none", cursor: "pointer", fontSize: isMobile ? 11 : 12, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <EditOutlined /> Изменить
                </button>
                <div style={{ width: 1, background: "#f3f4f6" }} />
                <Popconfirm title="Удалить эту локацию?" okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => del.mutate(l.id)}>
                  <button
                    style={{ flex: 1, padding: "9px 4px", background: "none", border: "none", cursor: "pointer", fontSize: isMobile ? 11 : 12, color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <DeleteOutlined /> Удалить
                  </button>
                </Popconfirm>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      <Modal
        title={editing ? `Редактировать: ${editing.name}` : "Новая локация"}
        open={open} onCancel={closeModal} onOk={() => form.submit()}
        okText={editing ? "Сохранить" : "Добавить"} okButtonProps={{ loading: save.isPending }}
        width={isMobile ? "94vw" : 520}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: "Введите название" }]}>
            <Input placeholder="Лаборатория, Улица, Офис..." size="large" />
          </Form.Item>
          <Form.Item name="type" label="Тип" rules={[{ required: true, message: "Выберите тип" }]}>
            <Radio.Group options={typeOptions} optionType="button" buttonStyle="solid" size="large" style={{ width: "100%", display: "flex" }} />
          </Form.Item>
          <Form.Item label="Изображение" required>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 120, height: 75, flexShrink: 0, border: "2px dashed #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {uploading ? <Spin /> : previewSrc ? <img src={previewSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: 28, color: "#d1d5db" }}>🏙️</span>}
              </div>
              <div style={{ flex: 1 }}>
                <Upload accept=".jpg,.jpeg,.png,.webp" showUploadList={false} beforeUpload={(file) => { handleUpload(file); return false; }}>
                  <Button icon={<UploadOutlined />} loading={uploading} size="large" style={{ width: "100%" }}>
                    {previewSrc ? "Заменить" : "Загрузить фото"}
                  </Button>
                </Upload>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>JPG, PNG или WEBP · макс. 8 МБ · горизонтальный формат</div>
                {!imageUrl && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>Изображение обязательно</div>}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </motion.div>
  );
}
