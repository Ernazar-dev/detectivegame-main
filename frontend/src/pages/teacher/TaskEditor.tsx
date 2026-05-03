import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Tabs, Form, Input, Select, Button, message, Spin, Space, Tag, Modal, Popconfirm, Image, InputNumber, Switch, Checkbox,
} from "antd";
import { motion } from "framer-motion";
import api from "../../lib/api";
import { useIsMobile } from "../../lib/hooks";
import { Task, Suspect, Scene, CharacterAsset, LocationAsset, TerminalCommand, TerminalCommandMatchType } from "../../lib/types";
import { resolveAsset } from "../../lib/assets";

export default function TaskEditor() {
  const isMobile = useIsMobile();
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const isNew = !id || id === "new";
  const qc = useQueryClient();

  const { data: chars } = useQuery({ queryKey: ["chars"], queryFn: async () => (await api.get<CharacterAsset[]>("/assets/characters")).data });
  const { data: locs } = useQuery({ queryKey: ["locs"], queryFn: async () => (await api.get<LocationAsset[]>("/assets/locations")).data });
  const { data: students } = useQuery({ queryKey: ["students"], queryFn: async () => (await api.get("/users?role=student")).data });

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: async () => (await api.get<Task>(`/tasks/${id}`)).data,
    enabled: !isNew,
  });

  const [form] = Form.useForm();
  useEffect(() => {
    if (task) form.setFieldsValue(task);
  }, [task, form]);

  const create = useMutation({
    mutationFn: (v: any) => api.post<Task>("/tasks", v),
    onSuccess: (r) => { message.success("Создано"); navigate(`/tasks/${r.data.id}`); },
  });
  const update = useMutation({
    mutationFn: (v: any) => api.patch(`/tasks/${id}`, v),
    onSuccess: () => { message.success("Сохранено"); qc.invalidateQueries({ queryKey: ["task", id] }); },
  });

  if (!isNew && isLoading) return <Spin />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="detective-card" title={isNew ? "Новое задание" : `Редактировать: ${task?.title}`} styles={{ body: { padding: isMobile ? "12px" : "24px" } }}>
        <Tabs
          items={[
            {
              key: "details",
              label: "Детали",
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{ difficulty: "medium", status: "draft", assignedToAll: true }}
                  onFinish={(v) => isNew ? create.mutate(v) : update.mutate(v)}
                >
                  <Form.Item label="Название" name="title" rules={[{ required: true }]}><Input /></Form.Item>
                  <Form.Item label="Сценарий" name="scenario" rules={[{ required: true }]}>
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Space size="large" wrap={isMobile}>
                    <Form.Item label="Сложность" name="difficulty">
                      <Select style={{ width: 160 }} options={[{ value: "easy", label: "Лёгкий" }, { value: "medium", label: "Средний" }, { value: "hard", label: "Сложный" }]} />
                    </Form.Item>
                    <Form.Item label="Время (минут)" name="timerMinutes">
                      <InputNumber min={0} />
                    </Form.Item>
                    <Form.Item label="Статус" name="status">
                      <Select style={{ width: 160 }} options={[{ value: "draft", label: "Черновик" }, { value: "published", label: "Опубликовано" }]} />
                    </Form.Item>
                  </Space>
                  <Form.Item label="Местоположение" name="locationAssetId">
                    <Select allowClear placeholder="Выберите локацию" options={locs?.map((l) => ({ value: l.imageUrl, label: l.name }))} />
                  </Form.Item>
                  <Form.Item label="Правильное Заключение (для оценки выводов ученика)" name="correctReasoning">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                  <Form.Item label="Ссылки на доказательства" name="evidenceReferences">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  {!isNew && task && task.suspects && task.suspects.length > 0 && (
                    <Form.Item label="Правильный Подозреваемый" name="correctSuspectId">
                      <Select
                        allowClear
                        options={task.suspects.map((s) => ({ value: s.id, label: s.name }))}
                      />
                    </Form.Item>
                  )}
                  <Button type="primary" htmlType="submit">{isNew ? "Создать" : "Сохранить"}</Button>
                </Form>
              ),
            },
            ...(!isNew ? [
              { key: "scenes", label: "Сцены", children: <ScenesPanel taskId={Number(id)} task={task!} chars={chars || []} locs={locs || []} /> },
              { key: "suspects", label: "Подозреваемые", children: <SuspectsPanel taskId={Number(id)} task={task!} chars={chars || []} /> },
              { key: "terminal", label: "Терминал", children: <TerminalCommandsPanel taskId={Number(id)} task={task!} /> },
              { key: "assign", label: "Назначение", children: <AssignPanel taskId={Number(id)} task={task!} students={students || []} /> },
            ] : []),
          ]}
        />
      </Card>
    </motion.div>
  );
}

function ScenesPanel({ taskId, task, chars, locs }: { taskId: number; task: Task; chars: CharacterAsset[]; locs: LocationAsset[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Scene | null>(null);
  const [scenes, setScenes] = useState<Scene[]>(task.scenes || []);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { setScenes(task.scenes || []); }, [task.scenes]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["task", String(taskId)] });

  const create = useMutation({
    mutationFn: (v: any) => api.post(`/tasks/${taskId}/scenes`, v),
    onSuccess: () => { setOpen(false); form.resetFields(); invalidate(); },
    onError: () => message.error("Ошибка при добавлении сцены"),
  });

  const update = useMutation({
    mutationFn: (v: any) => api.patch(`/tasks/${taskId}/scenes/${editing?.id}`, v),
    onSuccess: () => { setOpen(false); setEditing(null); form.resetFields(); invalidate(); },
    onError: () => message.error("Ошибка сохранения"),
  });

  const del = useMutation({
    mutationFn: (sceneId: number) => api.delete(`/tasks/${taskId}/scenes/${sceneId}`),
    onSuccess: () => { message.success("Сцена удалена"); invalidate(); },
    onError: () => message.error("Ошибка удаления"),
  });

  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.patch(`/tasks/${taskId}/scenes/reorder`, { sceneIds: ids }),
    onSuccess: () => invalidate(),
  });

  const onAdd = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const onEdit = (s: Scene) => { setEditing(s); form.setFieldsValue(s); setOpen(true); };

  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...scenes];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setScenes(next);
    setDragIdx(idx);
  };
  const onDrop = () => {
    setDragIdx(null);
    reorder.mutate(scenes.map((s) => s.id));
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-display text-sm text-ink">{scenes.length}  сцен</span>
          {scenes.length > 1 && (
            <span className="text-xs text-muted ml-2">— перетаскивайте для изменения порядка</span>
          )}
        </div>
        <Button type="primary" onClick={onAdd} icon={<span className="mr-1">+</span>}>
          Добавить сцену
        </Button>
      </div>

      {scenes.length === 0 ? (
        <div className="text-center py-10 text-muted text-sm border border-dashed border-line rounded-xl">
          Сцен пока нет. Создайте первую.
        </div>
      ) : (
        <div className="space-y-2">
          {scenes.map((s, idx) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={onDrop}
              style={{ opacity: dragIdx === idx ? 0.5 : 1, cursor: "grab", transition: "opacity 0.15s" }}
              className="flex items-center gap-3 p-3 bg-canvas border border-line rounded-xl hover:border-clue-blue/40"
            >
              <div className="w-7 h-7 rounded-lg bg-ink/5 flex items-center justify-center flex-shrink-0">
                <span className="font-display text-xs text-muted">{idx + 1}</span>
              </div>
              {s.imageAsset ? (
                <Image width={56} height={40} src={resolveAsset(s.imageAsset)} style={{ objectFit: "cover", borderRadius: 6 }} preview={false} />
              ) : (
                <div className="w-14 h-10 bg-ink/5 rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-muted text-xs">Нет фото</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-ink truncate">{s.title}</div>
                <div className="text-xs text-muted line-clamp-1 mt-0.5">{s.body}</div>
              </div>
              {s.characterAsset && <Tag className="flex-shrink-0 !text-xs">👤 Персонаж</Tag>}
              <Space size="small" className="flex-shrink-0">
                <Button size="small" onClick={() => onEdit(s)}>Редактировать</Button>
                <Popconfirm title="Удалить эту сцену?" okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => del.mutate(s.id)}>
                  <Button size="small" danger loading={del.isPending}>Удалить</Button>
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={editing ? `Редактировать: ${editing.title}` : "Новая сцена"}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? "Сохранить" : "Добавить"}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={(v) => editing ? update.mutate(v) : create.mutate(v)}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: "Введите название" }]}>
            <Input placeholder="Название сцены" />
          </Form.Item>
          <Form.Item name="body" label="Текст истории" rules={[{ required: true, message: "Введите текст" }]}>
            <Input.TextArea rows={5} placeholder="Описание сцены, улики, события..." />
          </Form.Item>
          <Space size="large" className="w-full" style={{ display: "flex" }}>
            <Form.Item name="imageAsset" label="Изображение локации" style={{ flex: 1, marginBottom: 0 }}>
              <Select allowClear placeholder="Выберите локацию" options={locs.map((l) => ({ value: l.imageUrl, label: l.name }))} />
            </Form.Item>
            <Form.Item name="characterAsset" label="Персонаж (необязательно)" style={{ flex: 1, marginBottom: 0 }}>
              <Select allowClear placeholder="Выберите персонажа" options={chars.map((c) => ({ value: c.imageUrl, label: c.name }))} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

function SuspectsPanel({ taskId, task, chars }: { taskId: number; task: Task; chars: CharacterAsset[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Suspect | null>(null);
  const [qOpen, setQOpen] = useState<number | null>(null);
  const [evOpen, setEvOpen] = useState<number | null>(null);
  const [tsOpen, setTsOpen] = useState<number | null>(null);
  const [form] = Form.useForm();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["task", String(taskId)] });

  const create = useMutation({
    mutationFn: (v: any) => api.post(`/tasks/${taskId}/suspects`, v),
    onSuccess: () => { setOpen(false); form.resetFields(); invalidate(); },
  });
  const update = useMutation({
    mutationFn: (v: any) => api.patch(`/suspects/${editing?.id}`, v),
    onSuccess: () => { setOpen(false); setEditing(null); form.resetFields(); invalidate(); },
  });
  const del = useMutation({
    mutationFn: (sid: number) => api.delete(`/suspects/${sid}`),
    onSuccess: () => invalidate(),
  });

  const onAdd = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const onEdit = (s: Suspect) => { setEditing(s); form.setFieldsValue(s); setOpen(true); };

  const suspects = task.suspects || [];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="font-display text-sm text-ink">{suspects.length}  подозреваемых</span>
        <Button type="primary" onClick={onAdd} icon={<span className="mr-1">+</span>}>
          Подозреваемый Добавить
        </Button>
      </div>

      {suspects.length === 0 ? (
        <div className="text-center py-10 text-muted text-sm border border-dashed border-line rounded-xl">
          Подозреваемых пока нет.
        </div>
      ) : (
        <div className="space-y-2">
          {suspects.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 bg-canvas border border-line rounded-xl hover:border-clue-blue/40">
              <Image
                width={52} height={52}
                src={resolveAsset(s.avatar || s.characterAssetId) || ""}
                style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                preview={false}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ink">{s.name}</span>
                  {task.correctSuspectId === s.id && <Tag color="green" className="!text-xs">✓ Правильный ответ</Tag>}
                </div>
                <div className="text-xs text-muted mt-0.5">{s.role}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="small" onClick={() => setQOpen(s.id)}>📋 Вопросы ({(s.questions || []).length})</Button>
                <Button size="small" onClick={() => setEvOpen(s.id)}>🔍 Улики ({(s.evidence || []).length})</Button>
                <Button size="small" onClick={() => setTsOpen(s.id)}>🖥️ Шаги терминала</Button>
                <Button size="small" onClick={() => onEdit(s)}>Редактировать</Button>
                <Popconfirm title="Удалить этого подозреваемого?" okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => del.mutate(s.id)}>
                  <Button size="small" danger>Удалить</Button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={editing ? `Редактировать: ${editing.name}` : " Новый подозреваемый"}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? "Сохранить" : "Добавить"}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={(v) => editing ? update.mutate(v) : create.mutate(v)}>
          <Space size="large" className="w-full" style={{ display: "flex" }}>
            <Form.Item name="name" label="Имя" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="Подозреваемый имя" />
            </Form.Item>
            <Form.Item name="role" label="Роль" style={{ flex: 1 }}>
              <Input placeholder="Профессия, должность" />
            </Form.Item>
          </Space>
          <Form.Item name="characterAssetId" label="Изображение персонажа">
            <Select allowClear placeholder="Выберите персонажа" options={chars.map((c) => ({ value: c.imageUrl, label: c.name }))} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Информация о личности" />
          </Form.Item>
          <Form.Item name="behaviorTraits" label="Поведение">
            <Input.TextArea rows={2} placeholder="Черты характера" />
          </Form.Item>
          <Form.Item name="secretAlibi" label="Тайное алиби (только для учителя)">
            <Input.TextArea rows={2} placeholder="Реальное местонахождение во время события..." />
          </Form.Item>
        </Form>
      </Modal>

      {suspects.map((s) => (
        <QuestionsModal key={s.id} suspect={s} open={qOpen === s.id} onClose={() => setQOpen(null)} onChanged={invalidate} />
      ))}
      {suspects.map((s) => (
        <EvidenceModal key={s.id} suspect={s} taskId={taskId} open={evOpen === s.id} onClose={() => setEvOpen(null)} onChanged={invalidate} />
      ))}
      {suspects.map((s) => (
        <SuspectTerminalStepsModal key={`ts-${s.id}`} suspect={s} open={tsOpen === s.id} onClose={() => setTsOpen(null)} onChanged={invalidate} />
      ))}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   SuspectTerminalStepsModal
   ────────────────────────────────────────────────────────────────────────────── */
function SuspectTerminalStepsModal({
  suspect, open, onClose, onChanged,
}: { suspect: Suspect; open: boolean; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<TerminalCommand | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();

  const { data: cmds, isLoading, refetch } = useQuery<TerminalCommand[]>({
    queryKey: ["suspect-terminal-cmds", suspect.id],
    queryFn: async () => (await api.get(`/suspects/${suspect.id}/terminal-commands`)).data,
    enabled: open,
  });

  const reset = () => { setEditing(null); setShowForm(false); form.resetFields(); };
  const refresh = () => { refetch(); onChanged(); };

  const create = useMutation({
    mutationFn: (v: any) => api.post(`/suspects/${suspect.id}/terminal-commands`, v),
    onSuccess: () => { message.success("Шаг добавлен"); reset(); refresh(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });

  const update = useMutation({
    mutationFn: ({ id, v }: { id: number; v: any }) => api.patch(`/terminal-commands/${id}`, v),
    onSuccess: () => { message.success("Сохранено"); reset(); refresh(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/terminal-commands/${id}`),
    onSuccess: () => { message.success("Удалено"); refresh(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Ошибка"),
  });

  const uploadImg = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData();
      fd.append("image", file);
      return api.post(`/terminal-commands/${id}/image`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => { message.success("Изображение загружено"); refresh(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Не загружено"),
  });

  const onFinish = (v: any) => {
    const payload = {
      command:     (v.command || "").trim(),
      matchType:   (v.matchType || "exact") as TerminalCommandMatchType,
      output:      v.output || "",
      hint:        v.hint || "",
      order:       typeof v.order === "number" ? v.order : 0,
      isFinalStep: !!v.isFinalStep,
      isTrap:      !!v.isTrap,
    };
    if (editing) update.mutate({ id: editing.id, v: payload });
    else create.mutate(payload);
  };

  const startEdit = (c: TerminalCommand) => {
    setEditing(c);
    setShowForm(true);
    form.setFieldsValue({
      command:     c.command,
      matchType:   c.matchType,
      output:      c.output,
      hint:        c.hint,
      order:       c.order,
      isFinalStep: c.isFinalStep,
      isTrap:      (c as any).isTrap ?? false,
    });
  };

  const list = cmds || [];

  const seedDefaults = useMutation({
    mutationFn: () => api.post(`/suspects/${suspect.id}/terminal-defaults`),
    onSuccess: () => { message.success("Стандартный сценарий загружен — 4 шага добавлено"); refresh(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Не удалось загрузить"),
  });

  return (
    <Modal
      title={`🖥️ ${suspect.name} — Шаги терминала`}
      open={open}
      onCancel={() => { reset(); onClose(); }}
      footer={null}
      width={760}
    >
      <div className="text-xs text-muted mb-3">
        Студент видит только <b>сценарную задачу</b>. Команды и коды ему не показываются —
        он должен догадаться или ввести подходящее действие. Принимаемые формулировки
        задаются в поле «Принимаемая фраза» (используйте regex для нескольких вариантов:{" "}
        <code>{"(?i)(камер|cctv|видеонаблюд)"}</code>).{" "}
        <b>🪤 Xato buyruq</b> — o'yinchini chalg'itadi, progress harakatsiz qoladi.
      </div>

      {list.length === 0 && !showForm && (
        <div className="border border-dashed border-amber-400/40 rounded-xl p-4 mb-4 bg-amber-50/5 flex flex-col items-center gap-2">
          <div className="text-sm text-muted text-center">
            Для этого подозреваемого ещё нет шагов терминала.
          </div>
          <Button
            size="small"
            loading={seedDefaults.isPending}
            onClick={() => seedDefaults.mutate()}
            style={{ borderColor: "#ffd66b", color: "#ffd66b", background: "transparent" }}
          >
            ⚡ Загрузить стандартный сценарий (4 шага)
          </Button>
          <div className="text-xs text-muted text-center opacity-60">
            камера → телефон → финансы → ключевая улика
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-3">
        {list.length > 0 && (
          <Button
            size="small"
            disabled={seedDefaults.isPending}
            onClick={() => {
              if (window.confirm("Удалить существующие шаги и загрузить стандартный сценарий?")) {
                Promise.all(list.map((c) => api.delete(`/terminal-commands/${c.id}`))).then(
                  () => seedDefaults.mutate()
                );
              }
            }}
            style={{ borderColor: "#ffd66b50", color: "#ffd66b80", background: "transparent", fontSize: 11 }}
          >
            ↺ Заменить стандартным сценарием
          </Button>
        )}
        <div className="flex-1" />
        <Button
          size="small" type={showForm ? "default" : "primary"}
          onClick={() => { if (showForm) reset(); else { setShowForm(true); setEditing(null); form.resetFields(); } }}
        >
          {showForm ? "✕ Закрыть" : "+ Новый шаг"}
        </Button>
      </div>

      {showForm && (
        <div className="border border-dashed border-line rounded-xl p-3 mb-4 bg-canvas">
          <div className="text-sm font-medium mb-2">
            {editing ? `✎ Редактирование: ${editing.command}` : "🆕 Новый шаг"}
          </div>
          <Form
            form={form} layout="vertical"
            initialValues={{ matchType: "exact", order: list.length, isFinalStep: false, isTrap: false }}
            onFinish={onFinish}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Form.Item name="command" label="Принимаемая фраза/действие" rules={[{ required: true, message: "Введите принимаемую фразу" }]} className="!mb-2 md:col-span-2">
                <Input className="!font-mono" placeholder="например: проверить камеру в подъезде" />
              </Form.Item>
              <Form.Item name="matchType" label="Тип совпадения" className="!mb-2">
                <Select options={[
                  { value: "exact",  label: "exact — точное совпадение" },
                  { value: "prefix", label: "prefix — начало строки" },
                  { value: "regex",  label: "regex — несколько вариантов через |" },
                ]} />
              </Form.Item>
            </div>
            <Form.Item name="output" label="Текст-отчёт следствия" className="!mb-2">
              <Input.TextArea rows={3} className="!font-mono !text-xs"
                placeholder="что покажет терминал после правильного действия" />
            </Form.Item>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Form.Item name="hint" label="Сценарная задача (видна студенту)" className="!mb-2 md:col-span-2"
                rules={[{ required: true, message: "Введите сценарную задачу" }]}>
                <Input placeholder="например: получите доступ к видеонаблюдению подъезда" />
              </Form.Item>
              <Form.Item name="order" label="Порядок (0,1,2…)" className="!mb-2">
                <InputNumber min={0} className="!w-full" />
              </Form.Item>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <Form.Item name="isFinalStep" valuePropName="checked" className="!mb-0">
                <Checkbox>★ Это последний шаг (открывает доказательство)</Checkbox>
              </Form.Item>
              <Form.Item name="isTrap" valuePropName="checked" className="!mb-0">
                <Checkbox>
                  🪤 Xato buyruq — moslikda chiqish ko'rsatiladi,
                  progress harakatsiz qoladi, kalit panelda ko'rinmaydi
                </Checkbox>
              </Form.Item>
            </div>
            <Space>
              <Button size="small" type="primary" htmlType="submit" loading={create.isPending || update.isPending}>
                {editing ? "✓ Сохранить" : "✓ Добавить"}
              </Button>
              <Button size="small" onClick={reset}>Отмена</Button>
            </Space>
          </Form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-6"><Spin /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm border border-dashed border-line rounded-xl">
          Шагов пока нет. Нажмите «+ Новый шаг».
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c, idx) => (
            <div
              key={c.id}
              className={`border rounded-xl p-3 bg-canvas ${(c as any).isTrap ? "border-red-400/30 bg-red-50/5" : "border-line"}`}
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs text-muted">#{idx + 1}</span>
                <Tag color="blue" className="!text-xs !m-0">{c.matchType.toUpperCase()}</Tag>
                <span className="text-xs font-mono text-ink">{c.command}</span>
                {c.isFinalStep && <Tag color="gold" className="!text-xs !m-0">★ FINAL</Tag>}
                {(c as any).isTrap && <Tag color="red" className="!text-xs !m-0">🪤 TRAP</Tag>}
                {c.evidenceImageUrl && <Tag color="green" className="!text-xs !m-0">📷 image</Tag>}
              </div>
              {c.output && (
                <pre className="text-xs font-mono bg-ink/5 rounded p-2 mb-2 max-h-32 overflow-auto whitespace-pre-wrap m-0">
                  {c.output}
                </pre>
              )}
              {c.evidenceImageUrl && (
                <div className="mb-2">
                  <Image src={c.evidenceImageUrl} width={120} style={{ borderRadius: 6 }} />
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="small" onClick={() => startEdit(c)}>✏ Изменить</Button>
                <label className="ant-btn ant-btn-sm" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", margin: 0 }}>
                  📷 Загрузить фото
                  <input
                    type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImg.mutate({ id: c.id, file: f });
                      e.target.value = "";
                    }}
                  />
                </label>
                <Popconfirm title="Удалить этот шаг?" okText="Да" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => remove.mutate(c.id)}>
                  <Button size="small" danger type="text">🗑</Button>
                </Popconfirm>
                <span className="text-xs text-muted ml-auto">порядок: {c.order}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------- Вопросlar modali ----------
type QModalProps = {
  suspect: Suspect;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

function QuestionsModal({ suspect, open, onClose, onChanged }: QModalProps) {
  const [addForm] = Form.useForm();
  const [editingQ, setEditingQ] = useState<{ id: number; question: string; answer: string } | null>(null);
  const [editForm] = Form.useForm();

  const questions = suspect.questions || [];

  const addQ = useMutation({
    mutationFn: (v: any) => api.post(`/suspects/${suspect.id}/questions`, v),
    onSuccess: () => { addForm.resetFields(); onChanged(); message.success("Вопрос добавлен"); },
    onError: () => message.error("Произошла ошибка"),
  });

  const updateQ = useMutation({
    mutationFn: (v: any) => api.patch(`/questions/${editingQ?.id}`, v),
    onSuccess: () => { setEditingQ(null); editForm.resetFields(); onChanged(); message.success("Сохранено"); },
    onError: () => message.error("Произошла ошибка"),
  });

  const delQ = useMutation({
    mutationFn: (qid: number) => api.delete(`/questions/${qid}`),
    onSuccess: () => { onChanged(); message.success("Вопрос удалён"); },
    onError: () => message.error("Ошибка удаления"),
  });

  const onEditQ = (q: { id: number; question: string; answer: string }) => {
    setEditingQ(q);
    editForm.setFieldsValue({ question: q.question, answer: q.answer });
  };

  return (
    <Modal title={`📋 ${suspect.name} — Протокол допроса`} open={open} onCancel={onClose} footer={null} width={680}>
      {questions.length === 0 ? (
        <div className="text-center py-6 text-muted text-sm border border-dashed border-line rounded-xl mb-4">
          Вопросов пока нет.
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {questions.map((q) => (
            <div key={q.id}>
              {editingQ?.id === q.id ? (
                <Form form={editForm} layout="vertical" onFinish={(v) => updateQ.mutate(v)} className="bg-canvas border border-clue-blue/30 rounded-xl p-3">
                  <Form.Item name="question" label="Вопрос" rules={[{ required: true }]} className="!mb-2">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item name="answer" label="Ответ" rules={[{ required: true }]} className="!mb-3">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" size="small" loading={updateQ.isPending}>Сохранить</Button>
                    <Button size="small" onClick={() => { setEditingQ(null); editForm.resetFields(); }}>Отмена</Button>
                  </Space>
                </Form>
              ) : (
                <div className="bg-canvas border border-line rounded-xl p-3 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-clue-blue">S: {q.question}</div>
                    <div className="text-sm text-ink mt-1">J: {q.answer}</div>
                  </div>
                  <Space size="small" className="flex-shrink-0 self-start">
                    <Button size="small" onClick={() => onEditQ(q)}>Редактировать</Button>
                    <Popconfirm title="Удалить этот вопрос?" okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => delQ.mutate(q.id)}>
                      <Button size="small" danger loading={delQ.isPending}>Удалить</Button>
                    </Popconfirm>
                  </Space>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-line pt-4">
        <div className="font-display text-sm text-ink mb-3">+ Добавить новый вопрос</div>
        <Form form={addForm} layout="vertical" onFinish={(v) => addQ.mutate(v)}>
          <Form.Item name="question" label="Текст вопроса" rules={[{ required: true, message: "Вопрос добавить" }]} className="!mb-2">
            <Input.TextArea rows={2} placeholder="XP во время допроса будет начислено за вопрос" />
          </Form.Item>
          <Form.Item name="answer" label="Текст ответа" rules={[{ required: true, message: "Ответ добавить" }]} className="!mb-3">
            <Input.TextArea rows={2} placeholder="Ответ на вопрос..." />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={addQ.isPending}>Добавить вопрос</Button>
        </Form>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// EvidenceModal
// ──────────────────────────────────────────────────────────────────────────────
type EvidenceModalProps = {
  suspect: Suspect;
  taskId: number;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

const RELEVANCE_OPTIONS = [
  { value: "relevant",   label: "✓ Значимое (указывает на виновного)" },
  { value: "misleading", label: "⚠ Вводящее в заблуждение (ложный след)" },
  { value: "neutral",    label: "○ Нейтральное (фоновая информация)" },
];

const KIND_OPTIONS = [
  { value: "camera",      label: "📹 Камера (CCTV)" },
  { value: "audio",       label: "🎵 Аудиозапись" },
  { value: "phone",       label: "📞 Телефон (звонок/SMS)" },
  { value: "photo",       label: "📷 Фото" },
  { value: "message",     label: "💬 Сообщение / чат" },
  { value: "dna",         label: "🧬 ДНК" },
  { value: "fingerprint", label: "👆 Отпечаток пальца" },
  { value: "document",    label: "📄 Документ" },
  { value: "financial",   label: "💰 Финансовый" },
  { value: "vault",       label: "🔒 Секретный (с паролем)" },
];

function EvidenceModal({ suspect, taskId, open, onClose, onChanged }: EvidenceModalProps) {
  const [editingBody, setEditingBody] = useState<number | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [showCreator, setShowCreator] = useState(false);
  const [creatorForm] = Form.useForm();
  const [creatorMedia, setCreatorMedia] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const creatorMediaRef = useRef<HTMLInputElement | null>(null);

  const evidenceList = suspect.evidence || [];

  const createCustom = async (v: any) => {
    setCreating(true);
    try {
      const isVault = v.kind === "vault";
      const fileName: string = v.fileName?.trim() || `${v.kind}-${Date.now().toString(36)}${isVault ? ".enc" : ""}`;
      const r = await api.post(`/suspects/${suspect.id}/evidence`, {
        kind: v.kind, fileName, title: v.title, body: v.body || "",
        hint: v.hint || "", locked: !!v.locked, password: v.password || "",
        isKeyEvidence: !!v.isKeyEvidence, terminalOnly: !!v.terminalOnly,
      });
      const newId: number = r.data.id;
      if (v.relevance) await api.patch(`/evidence/${newId}`, { relevance: v.relevance });
      if (creatorMedia) {
        const fd = new FormData();
        fd.append("media", creatorMedia);
        await api.post(`/evidence/${newId}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      message.success("Улика создана");
      creatorForm.resetFields();
      setCreatorMedia(null);
      setShowCreator(false);
      onChanged();
    } catch (e: any) {
      message.error(e.response?.data?.error || "Не удалось создать");
    } finally {
      setCreating(false);
    }
  };

  const deleteEvidence = useMutation({
    mutationFn: (id: number) => api.delete(`/evidence/${id}`),
    onSuccess: () => { message.success("Удалено"); onChanged(); },
    onError: () => message.error("Ошибка"),
  });

  const updateRelevance = useMutation({
    mutationFn: ({ id, relevance }: { id: number; relevance: string }) => api.patch(`/evidence/${id}`, { relevance }),
    onSuccess: () => { message.success("Сохранено"); onChanged(); },
    onError: () => message.error("Ошибка"),
  });

  const updateBody = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.patch(`/evidence/${id}`, { body }),
    onSuccess: () => { setEditingBody(null); message.success("Сохранено"); onChanged(); },
    onError: () => message.error("Ошибка"),
  });

  const updateFlag = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, boolean> }) => api.patch(`/evidence/${id}`, patch),
    onSuccess: () => { onChanged(); },
    onError: () => message.error("Ошибка"),
  });

  const regenerate = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/evidence/regenerate`),
    onSuccess: () => { message.success("Улики перегенерированы"); onChanged(); },
    onError: () => message.error("Ошибка"),
  });

  const uploadMedia = async (evId: number, file: File) => {
    setUploading(evId);
    const fd = new FormData();
    fd.append("media", file);
    try {
      await api.post(`/evidence/${evId}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      message.success("Media yuklandi");
      onChanged();
    } catch {
      message.error("Media yuklanmadi");
    } finally {
      setUploading(null);
    }
  };

  const kindColor: Record<string, string> = {
    camera: "blue", audio: "purple", phone: "cyan", photo: "geekblue",
    message: "orange", dna: "green", fingerprint: "lime", document: "gold",
    financial: "red", vault: "volcano",
  };

  return (
    <Modal title={`🔍 ${suspect.name} — Управление уликами`} open={open} onCancel={onClose} footer={null} width={780}>
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <span className="text-sm text-muted">{evidenceList.length} улик</span>
        <Space size="small" wrap>
          <Button size="small" type={showCreator ? "default" : "primary"} onClick={() => setShowCreator((v) => !v)}>
            {showCreator ? "✕ Закрыть" : "+ Создать улику"}
          </Button>
          <Popconfirm title="Перегенерировать все улики? Существующие будут удалены." okText="Да, перегенерировать" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => regenerate.mutate()}>
            <Button size="small" loading={regenerate.isPending} danger>🔄 Перегенерировать</Button>
          </Popconfirm>
        </Space>
      </div>

      {showCreator && (
        <div className="border border-dashed border-line rounded-xl p-3 mb-4 bg-canvas">
          <div className="text-sm font-medium text-ink mb-2">🎬 Новая улика — полный контроль</div>
          <div className="text-xs text-muted mb-3">
            Загрузите видео/аудио/фото и напишите описание. Улика не помечается автоматически как «правильный ответ» — студенты оценивают сами.
          </div>
          <Form form={creatorForm} layout="vertical" initialValues={{ kind: "photo", relevance: "neutral", locked: false }} onFinish={createCustom}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Form.Item name="kind" label="Тип" rules={[{ required: true }]} className="!mb-2">
                <Select size="small" options={KIND_OPTIONS} />
              </Form.Item>
              <Form.Item name="relevance" label="Направление анализа (не видно студенту)" className="!mb-2">
                <Select size="small" options={RELEVANCE_OPTIONS} />
              </Form.Item>
            </div>
            <Form.Item name="title" label="Заголовок" rules={[{ required: true, min: 3 }]} className="!mb-2">
              <Input size="small" placeholder="Например: «Выход из клуба (CCTV-04)»" />
            </Form.Item>
            <Form.Item name="fileName" label="Имя файла (необязательно)" className="!mb-2">
              <Input size="small" placeholder="например: cctv-04-2347.mp4 (если пусто — автоматически)" />
            </Form.Item>
            <Form.Item name="body" label="Текст / транскрипция / метаданные" className="!mb-2">
              <Input.TextArea rows={4} className="!font-mono !text-xs" placeholder="Текстовое описание улики: кто, когда, что — или транскрипция аудио, EXIF и т.д." />
            </Form.Item>
            <Form.Item name="hint" label="Подсказка (необязательно)" className="!mb-2">
              <Input size="small" placeholder="Скрытая подсказка для студента" />
            </Form.Item>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <Form.Item name="isKeyEvidence" valuePropName="checked" className="!mb-0">
                <Checkbox><span className="text-xs">⭐ <b>Ключевая улика</b> — +10 бонусных баллов каждая</span></Checkbox>
              </Form.Item>
              <Form.Item name="terminalOnly" valuePropName="checked" className="!mb-0">
                <Checkbox><span className="text-xs">🖥️ <b>Только терминал</b> — студенту не выдаётся автоматически</span></Checkbox>
              </Form.Item>
            </div>
            <div className="mb-2">
              <div className="text-xs text-muted mb-1">Медиафайл (необязательно: фото/аудио/видео)</div>
              <input type="file" accept="image/*,audio/*,video/mp4,video/webm" style={{ display: "none" }} ref={creatorMediaRef}
                onChange={(e) => { const f = e.target.files?.[0] || null; setCreatorMedia(f); e.target.value = ""; }}
              />
              <Space size="small">
                <Button size="small" onClick={() => creatorMediaRef.current?.click()}>📎 Выбрать файл</Button>
                {creatorMedia && (
                  <>
                    <Tag color="magenta" className="!text-xs">{creatorMedia.name}</Tag>
                    <Button size="small" type="text" danger onClick={() => setCreatorMedia(null)}>✕</Button>
                  </>
                )}
              </Space>
            </div>
            <Space>
              <Button size="small" type="primary" htmlType="submit" loading={creating}>✓ Создать</Button>
              <Button size="small" onClick={() => { creatorForm.resetFields(); setCreatorMedia(null); setShowCreator(false); }}>Отмена</Button>
            </Space>
          </Form>
        </div>
      )}

      {evidenceList.length === 0 ? (
        <div className="text-center py-8 text-muted text-sm border border-dashed border-line rounded-xl">
          Улик нет. Нажмите «Перегенерировать».
        </div>
      ) : (
        <div className="space-y-3">
          {evidenceList.map((ev) => (
            <div key={ev.id} className="border border-line rounded-xl p-3 bg-canvas">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Tag color={kindColor[ev.kind] || "default"} className="!text-xs !m-0">{ev.kind.toUpperCase()}</Tag>
                <span className="text-xs font-mono text-muted">{ev.fileName}</span>
                {ev.mediaUrl && <Tag color="magenta" className="!text-xs !m-0">{ev.mediaType === "audio" ? "🎵" : ev.mediaType === "video" ? "🎥" : "📷"} MEDIA</Tag>}
                {ev.isKeyEvidence && <Tag color="gold" className="!text-xs !m-0">⭐ КЛЮЧЕВОЕ</Tag>}
                {ev.terminalOnly && <Tag color="cyan" className="!text-xs !m-0">🖥️ ТЕРМИНАЛ</Tag>}
              </div>
              <div className="text-sm font-medium text-ink mb-2">{ev.title}</div>
              {ev.mediaUrl && ev.mediaType === "image" && <img src={ev.mediaUrl} alt={ev.title} className="w-full max-h-32 object-cover rounded-lg mb-2 border border-line" />}
              {ev.mediaUrl && ev.mediaType === "audio" && <audio src={ev.mediaUrl} controls className="w-full mb-2" style={{ height: 32 }} />}
              {ev.mediaUrl && ev.mediaType === "video" && <video src={ev.mediaUrl} controls className="w-full max-h-32 rounded-lg mb-2 border border-line" />}
              {editingBody === ev.id ? (
                <div className="mb-2">
                  <Input.TextArea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} className="font-mono text-xs mb-2" />
                  <Space size="small">
                    <Button size="small" type="primary" loading={updateBody.isPending} onClick={() => updateBody.mutate({ id: ev.id, body: bodyText })}>Сохранить</Button>
                    <Button size="small" onClick={() => setEditingBody(null)}>Отмена</Button>
                  </Space>
                </div>
              ) : (
                <div className="text-xs text-muted font-mono bg-ink/5 rounded p-2 mb-2 max-h-20 overflow-hidden line-clamp-4">{ev.body || "(пусто)"}</div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Select size="small" value={ev.relevance || "neutral"} style={{ width: 260 }} options={RELEVANCE_OPTIONS} onChange={(val) => updateRelevance.mutate({ id: ev.id, relevance: val })} />
                {editingBody !== ev.id && (
                  <Button size="small" onClick={() => { setEditingBody(ev.id); setBodyText(ev.body || ""); }}>✏ Текст</Button>
                )}
                <input type="file" accept="image/*,audio/*,video/mp4,video/webm" style={{ display: "none" }} ref={(el) => { fileInputRefs.current[ev.id] = el; }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(ev.id, f); e.target.value = ""; }}
                />
                <Button size="small" loading={uploading === ev.id} onClick={() => fileInputRefs.current[ev.id]?.click()}>
                  {ev.mediaUrl ? "🔄 Заменить медиа" : "📎 Загрузить медиа"}
                </Button>
                <Popconfirm title="Удалить эту улику?" okText="Да, удалить" okButtonProps={{ danger: true }} cancelText="Отмена" onConfirm={() => deleteEvidence.mutate(ev.id)}>
                  <Button size="small" danger type="text">🗑</Button>
                </Popconfirm>
              </div>
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-line/60">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <Switch size="small" checked={!!ev.isKeyEvidence} loading={updateFlag.isPending} onChange={(checked) => updateFlag.mutate({ id: ev.id, patch: { isKeyEvidence: checked } })} />
                  <span>⭐ Ключевое (+10 бонус)</span>
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <Switch size="small" checked={!!ev.terminalOnly} loading={updateFlag.isPending} onChange={(checked) => updateFlag.mutate({ id: ev.id, patch: { terminalOnly: checked } })} />
                  <span>🖥️ Только терминал</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function AssignPanel({ taskId, task, students }: { taskId: number; task: Task; students: any[] }) {
  const qc = useQueryClient();
  const [all, setAll] = useState(task.assignedToAll);
  const [ids, setIds] = useState<number[]>(task.assignedStudentIds || []);
  const save = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/assign`, { assignAll: all, studentIds: ids }),
    onSuccess: () => { message.success("Назначено"); qc.invalidateQueries({ queryKey: ["task", String(taskId)] }); },
  });

  const canSave = all || ids.length > 0;

  return (
    <Space direction="vertical" className="w-full">
      <Select
        style={{ width: 240 }}
        value={all ? "all" : "specific"}
        onChange={(v) => { setAll(v === "all"); if (v === "all") setIds([]); }}
        options={[
          { value: "all",      label: "Всем ученикам" },
          { value: "specific", label: "Выбранным ученикам" },
        ]}
      />
      {!all && (
        <>
          <Select
            mode="multiple" className="w-full" placeholder="Выберите учеников"
            value={ids} onChange={setIds}
            options={students.map((s: any) => ({ value: s.id, label: s.name }))}
          />
          {ids.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <span>⚠️</span>
              <span>Никто не выбран — задание не будет видно ученикам.</span>
            </div>
          )}
        </>
      )}
      <Button type="primary" disabled={!canSave} onClick={() => save.mutate()} loading={save.isPending}>
        Назначение Сохранить
      </Button>
    </Space>
  );
}

/* ── TerminalCommandsPanel — drag-and-drop tartib + hint + isFinalStep + isTrap ── */
function TerminalCommandsPanel({ taskId }: { taskId: number; task: Task }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TerminalCommand | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [localCmds, setLocalCmds] = useState<TerminalCommand[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [form] = Form.useForm();

  const { data: cmds, isLoading } = useQuery<TerminalCommand[]>({
    queryKey: ["terminal-commands", taskId],
    queryFn: async () => (await api.get(`/tasks/${taskId}/terminal-commands`)).data,
  });

  useEffect(() => {
    if (cmds) setLocalCmds([...cmds].sort((a, b) => a.order - b.order));
  }, [cmds]);

  const reset = () => { setEditing(null); setShowForm(false); form.resetFields(); };
  const refetch = () => qc.invalidateQueries({ queryKey: ["terminal-commands", taskId] });

  const create = useMutation({
    mutationFn: (v: any) => api.post(`/tasks/${taskId}/terminal-commands`, v),
    onSuccess: () => { message.success("Buyruq qo'shildi"); reset(); refetch(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Xato"),
  });

  const update = useMutation({
    mutationFn: ({ id, v }: { id: number; v: any }) => api.patch(`/terminal-commands/${id}`, v),
    onSuccess: () => { message.success("Saqlandi"); reset(); refetch(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Xato"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/terminal-commands/${id}`),
    onSuccess: () => { message.success("O'chirildi"); refetch(); },
    onError: (e: any) => message.error(e.response?.data?.error || "Xato"),
  });

  const reorder = useMutation({
    mutationFn: (ordered: TerminalCommand[]) =>
      Promise.all(ordered.map((c, idx) => api.patch(`/terminal-commands/${c.id}`, { order: idx }))),
    onSuccess: () => refetch(),
    onError: () => message.error("Не удалось сохранить порядок"),
  });

  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...localCmds];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setLocalCmds(next);
    setDragIdx(idx);
  };
  const onDrop = () => { setDragIdx(null); reorder.mutate(localCmds); };

  const startEdit = (c: TerminalCommand) => {
    setEditing(c);
    setShowForm(true);
    form.setFieldsValue({
      command:     c.command,
      matchType:   c.matchType,
      output:      c.output,
      hint:        c.hint,
      isFinalStep: c.isFinalStep,
      isTrap:      (c as any).isTrap ?? false,
    });
  };

  const onFinish = (v: any) => {
    const payload = {
      command:     (v.command || "").trim(),
      matchType:   (v.matchType || "exact") as TerminalCommandMatchType,
      output:      v.output || "",
      evidenceIds: [],
      hint:        v.hint || "",
      order:       editing ? editing.order : localCmds.length,
      isFinalStep: !!v.isFinalStep,
      isTrap:      !!v.isTrap,
    };
    if (editing) update.mutate({ id: editing.id, v: payload });
    else create.mutate(payload);
  };

  return (
    <div>
      <div className="mb-4 p-3 rounded-xl border border-amber-400/25 bg-amber-50/5 text-xs text-muted leading-relaxed">
        <b className="text-amber-600">Как это работает:</b> Учитель упорядочивает команды здесь.
Команды на нижней панели терминала игрока <b>последовательно и как ключ</b> отображается —
а панель прогресса предоставляет информацию о том, какой шаг выполнен.
        <b> ★ ДОКАЗАТЕЛЬ</b> ответ на последний шаг с символом является действительным выводом.{" "}
        <b>🪤 ТРАП</b> — ошибочная команда, вводящая игрока в заблуждение: отображается выход в совпадении,
но прогресс останется без движения и не будет отображаться на переключателе.
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-medium text-ink">Команды терминала ({localCmds.length})</div>
          <div className="text-xs text-muted mt-0.5">Перетащите строки, чтобы изменить их порядок</div>
        </div>
        <Button
          size="small" type={showForm ? "default" : "primary"}
          onClick={() => { if (showForm) reset(); else { setShowForm(true); setEditing(null); form.resetFields(); } }}
        >
          {showForm ? "✕ Бесполезный" : "+ Добавить команду"}
        </Button>
      </div>

      {showForm && (
        <div className="border border-dashed border-line rounded-xl p-4 mb-4 bg-canvas">
          <div className="text-sm font-medium mb-3">
            {editing ? `✎ Изменить: ${editing.command}` : "🆕 Новая команда"}
          </div>
          <Form form={form} layout="vertical"
            initialValues={{ matchType: "exact", isFinalStep: false, isTrap: false }}
            onFinish={onFinish}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Form.Item name="command" label="Команда (записывается игроком)" rules={[{ required: true }]} className="!mb-2 md:col-span-2">
                <Input className="!font-mono" placeholder="например: check camera 1" />
              </Form.Item>
              <Form.Item name="matchType" label="Тип совпадения" className="!mb-2">
                <Select options={[
                  { value: "exact",  label: "exact — точный" },
                  { value: "prefix", label: "prefix — с самого начала" },
                  { value: "regex",  label: "regex — несколько вариантов" },
                ]} />
              </Form.Item>
            </div>
            <Form.Item name="hint" label="Текст задания (ключ отображается на панели)"
              rules={[{ required: true, message: "Добавить задачу" }]} className="!mb-2">
              <Input placeholder="например: Проверьте камеру 1" />
            </Form.Item>
            <Form.Item name="output" label="Ответ (выход на терминале)" rules={[{ required: true }]} className="!mb-2">
              <Input.TextArea rows={5} className="!font-mono !text-xs"
                placeholder={"Камера 1 — Подъезд №5\n──────────────\n08:14  Вошел Алибек.\n22:14  Алибек вышел"} />
            </Form.Item>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <Form.Item name="isFinalStep" valuePropName="checked" className="!mb-0">
                <Checkbox>★ Это последний шаг — ответ будет сохранен в качестве фактического доказательства.</Checkbox>
              </Form.Item>
              <Form.Item name="isTrap" valuePropName="checked" className="!mb-0">
                <Checkbox>
                  🪤 Неверная команда (trap) — будет показан выход в совпадении,
прогресс останется без движения и не будет отображаться на переключателе
                </Checkbox>
              </Form.Item>
            </div>
            <Space>
              <Button size="small" type="primary" htmlType="submit" loading={create.isPending || update.isPending}>
                {editing ? "✓ Сохранение" : "✓ Добавить"}
              </Button>
              <Button size="small" onClick={reset}>Bekor</Button>
            </Space>
          </Form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-6"><Spin /></div>
      ) : localCmds.length === 0 ? (
        <div className="text-center py-10 text-muted text-sm border border-dashed border-line rounded-xl">
          Приказов нет. Нажмите "+ Добавить команду."
        </div>
      ) : (
        <>
          {reorder.isPending && <div className="text-xs text-amber-500 mb-2">Сохранение порядка...</div>}
          <div className="space-y-2">
            {localCmds.map((c, idx) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={onDrop}
                style={{ opacity: dragIdx === idx ? 0.45 : 1, cursor: "grab", transition: "opacity 0.15s" }}
                className={`border rounded-xl p-3 bg-canvas hover:border-clue-blue/40 ${(c as any).isTrap ? "border-red-400/30 bg-red-50/5" : "border-line"}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                    <span className="text-muted text-xs select-none opacity-30">⠿</span>
                    <div className="w-5 h-5 rounded-md bg-ink/5 flex items-center justify-center text-xs text-muted font-display">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <code className="text-sm font-mono text-ink bg-ink/5 px-2 py-0.5 rounded">{c.command}</code>
                      <Tag className="!text-xs !m-0" color="blue">{c.matchType}</Tag>
                      {c.isFinalStep && <Tag className="!text-xs !m-0" color="gold">★ ДОКАЗАТЕЛЬ</Tag>}
                      {(c as any).isTrap && <Tag className="!text-xs !m-0" color="red">🪤 ТРАП</Tag>}
                    </div>
                    {c.hint && !((c as any).isTrap) && (
                      <div className="text-xs text-amber-600/80 mb-1">📋 {c.hint}</div>
                    )}
                    {(c as any).isTrap && (
                      <div className="text-xs text-red-400/70 mb-1">🪤 Вводящая в заблуждение команда — не видна игроку</div>
                    )}
                    {c.output && (
                      <pre className="text-xs font-mono bg-ink/5 rounded p-2 max-h-20 overflow-auto whitespace-pre-wrap m-0 text-muted">
                        {c.output}
                      </pre>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="small" onClick={() => startEdit(c)}>✏</Button>
                    <Popconfirm title="Удалить?" okText="Да" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => remove.mutate(c.id)}>
                      <Button size="small" danger type="text">🗑</Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
