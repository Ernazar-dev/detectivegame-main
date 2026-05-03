import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Tag, Popconfirm, message, Input, Select, Table, Space, Card, Spin  } from "antd";
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, FilterOutlined } from "@ant-design/icons";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import api from "../../lib/api";
import { Task } from "../../lib/types";
import { resolveAsset } from "../../lib/assets";
import { useIsMobile } from "../../lib/hooks";

const diffColor: Record<string, string>  = { easy: "#16a34a", medium: "#d97706", hard: "#dc2626" };
const diffBg:    Record<string, string>  = { easy: "#dcfce7", medium: "#fef3c7", hard: "#fee2e2" };
const diffLabel: Record<string, string>  = { easy: "Лёгкий",  medium: "Средний", hard: "Сложный" };

export default function TeacherTasks() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const [search,       setSearch]       = useState("");
  const [diffFilter,   setDiffFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilter,   setShowFilter]   = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["tasks"], queryFn: async () => (await api.get<Task[]>("/tasks")).data });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/tasks/${id}`),
    onSuccess: () => { message.success("Задание удалено"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });

  const filtered = (data || []).filter(t =>
    (!search || t.title.toLowerCase().includes(search.toLowerCase())) &&
    (diffFilter   === "all" || t.difficulty === diffFilter) &&
    (statusFilter === "all" || t.status     === statusFilter)
  );

  const hasFilter = search || diffFilter !== "all" || statusFilter !== "all";

  // ── MOBILE: card list ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Поиск..."
              prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
              value={search} onChange={e => setSearch(e.target.value)} allowClear
              size="middle"
            />
          </div>
          <Button icon={<FilterOutlined />} onClick={() => setShowFilter(!showFilter)}
            type={hasFilter && !search ? "primary" : "default"} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/tasks/new")} />
        </div>

        {/* Filter row */}
        {showFilter && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <Select value={diffFilter} onChange={setDiffFilter} size="small" style={{ flex: 1, minWidth: 110 }}
              options={[{ value:"all",label:"Все уровни" },{ value:"easy",label:"Лёгкий" },{ value:"medium",label:"Средний" },{ value:"hard",label:"Сложный" }]} />
            <Select value={statusFilter} onChange={setStatusFilter} size="small" style={{ flex: 1, minWidth: 130 }}
              options={[{ value:"all",label:"Все статусы" },{ value:"published",label:"Опубликовано" },{ value:"draft",label:"Черновик" }]} />
            {hasFilter && (
              <Button size="small" onClick={() => { setSearch(""); setDiffFilter("all"); setStatusFilter("all"); }}>Сбросить</Button>
            )}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", background: "#fff", borderRadius: 12, border: "1px dashed #e5e7eb" }}>
            {hasFilter ? "Ничего не найдено" : "Заданий пока нет"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((t, idx) => {
              const locUrl = t.locationAssetId ? (resolveAsset(t.locationAssetId) || t.locationAssetId) : null;
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                  style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                  {/* Image strip */}
                  {locUrl && (
                    <div style={{ height: 80, overflow: "hidden", position: "relative" }}>
                      <img src={locUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5))" }} />
                    </div>
                  )}
                  {/* Body */}
                  <div style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <Link href={`/tasks/${t.id}`} style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", textDecoration: "none", flex: 1, lineHeight: 1.3 }}>
                        {t.title}
                      </Link>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <Link href={`/tasks/${t.id}`}>
                          <button style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#6b7280" }}>
                            <EditOutlined />
                          </button>
                        </Link>
                        <Popconfirm title="Удалить задание?" okText="Удалить" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => del.mutate(t.id)}>
                          <button style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#dc2626" }}>
                            <DeleteOutlined />
                          </button>
                        </Popconfirm>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: diffBg[t.difficulty], color: diffColor[t.difficulty] }}>
                        {diffLabel[t.difficulty] || t.difficulty}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: t.status === "published" ? "#dcfce7" : "#f3f4f6", color: t.status === "published" ? "#16a34a" : "#6b7280" }}>
                        {t.status === "published" ? "Опубликовано" : "Черновик"}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#eff6ff", color: "#2563eb" }}>
                        {t.assignedToAll ? "Всем" : "Выбранным"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  // ── DESKTOP: original table layout ──────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="detective-card" title={`Задания ${data ? `(${data.length})` : ""}`}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/tasks/new")}>Новое задание</Button>}>
        <Space className="mb-4" wrap>
          <Input placeholder="Поиск по названию..." prefix={<SearchOutlined className="text-muted" />}
            value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 240 }} />
          <Select value={diffFilter} onChange={setDiffFilter} style={{ width: 140 }}
            options={[{ value:"all",label:"Все уровни" },{ value:"easy",label:"Лёгкий" },{ value:"medium",label:"Средний" },{ value:"hard",label:"Сложный" }]} />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 160 }}
            options={[{ value:"all",label:"Все статусы" },{ value:"published",label:"Опубликовано" },{ value:"draft",label:"Черновик" }]} />
          {hasFilter && <Button size="small" onClick={() => { setSearch(""); setDiffFilter("all"); setStatusFilter("all"); }}>Сбросить</Button>}
        </Space>
        <Table rowKey="id" loading={isLoading} dataSource={filtered}
          locale={{ emptyText: hasFilter ? "По запросу ничего не найдено" : "Заданий пока нет" }}
          columns={[
            { title: "Название", render: (_: any, r: Task) => {
                const locUrl = r.locationAssetId ? (resolveAsset(r.locationAssetId) || r.locationAssetId) : null;
                return <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:44,height:32,borderRadius:6,overflow:"hidden",background:"#f1f5f9",flexShrink:0,border:"1px solid #e5e7eb" }}>
                    {locUrl ? <img src={locUrl} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={(e: any) => { (e.target as HTMLImageElement).style.display="none"; }} /> : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🏙️</div>}
                  </div>
                  <Link href={`/tasks/${r.id}`} className="text-ink hover:text-clue-blue font-medium">{r.title}</Link>
                </div>;
              }},
            { title:"Сложность", dataIndex:"difficulty", width:110, render:(v: string) => <Tag color={v==="easy"?"green":v==="hard"?"red":"gold"}>{diffLabel[v]||v}</Tag> },
            { title:"Статус", dataIndex:"status", width:140, render:(v: string) => <Tag color={v==="published"?"green":"default"}>{v==="published"?"Опубликовано":"Черновик"}</Tag> },
            { title:"Назначено", dataIndex:"assignedToAll", width:130, render:(v: boolean) => v?<Tag color="blue">Всем</Tag>:<Tag>Выбранным</Tag> },
            { title:"Действия", width:160, render:(_: any, r: Task) => (
                <Space>
                  <Link href={`/tasks/${r.id}`}><Button size="small">Редактировать</Button></Link>
                  <Popconfirm title="Удалить задание?" okText="Удалить" okButtonProps={{ danger:true }} cancelText="Отмена" onConfirm={() => del.mutate(r.id)}>
                    <Button size="small" danger loading={del.isPending}>Удалить</Button>
                  </Popconfirm>
                </Space>
              )},
          ]} />
      </Card>
    </motion.div>
  );
}
