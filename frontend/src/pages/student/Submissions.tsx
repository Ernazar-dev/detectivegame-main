import { useQuery } from "@tanstack/react-query";
import { Card, Table, Tag } from "antd";
import { Link } from "wouter";
import { motion } from "framer-motion";
import api from "../../lib/api";
import { Submission } from "../../lib/types";

const statusColor: Record<string, string> = {
  submitted: "blue", checking: "purple", pending_approval: "gold", approved: "green",
};
const statusLabel: Record<string, string> = {
  submitted: "Отправлено", checking: "Проверяется", pending_approval: "Ожидает проверки", approved: "Подтверждено",
};

export default function StudentSubmissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => (await api.get<Submission[]>("/submissions")).data,
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="detective-card" title="Мой ответы">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          columns={[
            { title: "Работа", render: (_, r: any) => <Link href={`/submissions/${r.id}`}>{r.task?.title}</Link> },
            { title: "Подозреваемый", render: (_, r: any) => r.suspect?.name },
            { title: "Статус", dataIndex: "status", render: (v) => <Tag color={statusColor[v]}>{statusLabel[v] || v}</Tag> },
            { title: "Балл", dataIndex: "totalScore", render: (v) => v != null ? `${v.toFixed(1)} / 100` : "—" },
            { title: "Отправлено", dataIndex: "submittedAt", render: (v) => new Date(v).toLocaleString() },
          ]}
        />
      </Card>
    </motion.div>
  );
}
