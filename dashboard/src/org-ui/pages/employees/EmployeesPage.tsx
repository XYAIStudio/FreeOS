import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select, Tag, Typography } from "antd";
import { Plus, Search, Users } from "lucide-react";
import type {
  OrgDepartment,
  OrgEmployee,
  OrgEmployeesClient,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { employeeLabels } from "./labels";
import styles from "./EmployeesPage.module.css";

export interface EmployeesPageProps {
  client: OrgEmployeesClient;
  session: OrgSession;
  locale: OrgLocale;
  onOpenEmployee?: (id: number) => void;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

type EmpForm = {
  name: string;
  role: string;
  description: string;
  employee_type: string;
  skills: string;
  avatar_emoji: string;
  department_id: number | null;
};

const EMPTY_FORM: EmpForm = {
  name: "",
  role: "",
  description: "",
  employee_type: "human",
  skills: "",
  avatar_emoji: "👤",
  department_id: null,
};

export function EmployeesPage({
  client,
  session,
  locale,
  onOpenEmployee,
}: EmployeesPageProps) {
  const labels = employeeLabels(locale);
  const [items, setItems] = useState<OrgEmployee[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<EmpForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ total: 0, ai: 0, human: 0 });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, nextStats, depts] = await Promise.all([
        client.list({
          type: filterType || undefined,
          status: "active",
        }),
        client.stats(),
        client.listDepartments(),
      ]);
      setItems(rows);
      setStats({
        total: nextStats.total,
        ai: nextStats.ai,
        human: nextStats.human,
      });
      setDepartments(depts);
    } catch {
      setItems([]);
      setStats({ total: 0, ai: 0, human: 0 });
    } finally {
      setLoading(false);
    }
  }, [client, filterType]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      query
        ? items.filter(
            (emp) =>
              emp.name.toLowerCase().includes(query) ||
              (emp.role || "").toLowerCase().includes(query) ||
              (emp.skills || "").toLowerCase().includes(query),
          )
        : items,
    [items, query],
  );

  const openCreate = () => {
    setError("");
    setForm({
      ...EMPTY_FORM,
      department_id: departments[0]?.id ?? null,
      avatar_emoji: "👤",
    });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    const name = form.name.trim();
    if (!name || form.department_id == null) {
      setError(labels.required);
      return;
    }
    try {
      const created = await client.create({
        name,
        role: form.role,
        description: form.description,
        employee_type: form.employee_type,
        skills: form.skills,
        avatar_emoji: form.avatar_emoji || "👤",
        department_id: form.department_id,
        agent_type: form.employee_type === "ai" ? form.role || null : null,
      });
      setShowCreate(false);
      await fetchAll();
      onOpenEmployee?.(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  return (
    <div className={styles.page} data-testid="org-ui-employees">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Users size={20} />
          <div>
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
            <p className={styles.subtitle}>{labels.subtitle}</p>
          </div>
        </div>
        {session.isAdmin ? (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={openCreate}
            data-testid="org-employees-create"
          >
            {labels.add}
          </Button>
        ) : null}
      </div>

      <div className={styles.stats} data-testid="org-employees-stats">
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>{labels.total}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.ai}</div>
          <div className={styles.statLabel}>{labels.typeAi}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.human}</div>
          <div className={styles.statLabel}>{labels.typeHuman}</div>
        </div>
      </div>

      <div className={styles.filters}>
        <Input
          allowClear
          prefix={<Search size={14} />}
          placeholder={labels.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 320 }}
          data-testid="org-employees-search"
        />
        <Select
          value={filterType}
          onChange={setFilterType}
          style={{ minWidth: 160 }}
          options={[
            { value: "", label: labels.allTypes },
            { value: "human", label: labels.typeHuman },
            { value: "ai", label: labels.typeAi },
          ]}
          data-testid="org-employees-type"
        />
      </div>

      {loading ? (
        <p className={styles.empty}>{labels.loading}</p>
      ) : visible.length === 0 ? (
        <div className={styles.empty} data-testid="org-employees-empty">
          <p>{departments.length === 0 ? labels.emptyHint : labels.empty}</p>
          {query ? <p>{labels.noMatch}</p> : null}
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((emp) => (
            <button
              key={emp.id}
              type="button"
              className={styles.card}
              onClick={() => onOpenEmployee?.(emp.id)}
              data-testid={`org-employee-card-${emp.id}`}
            >
              <div className={styles.cardHead}>
                <span className={styles.avatar}>
                  {emp.avatar_emoji || "👤"}
                </span>
                <div>
                  <p className={styles.cardTitle}>
                    {emp.name}{" "}
                    <Tag color={emp.employee_type === "ai" ? "purple" : "blue"}>
                      {emp.employee_type === "ai"
                        ? labels.typeAi
                        : labels.typeHuman}
                    </Tag>
                  </p>
                  <p className={styles.cardMeta}>
                    {emp.role || labels.noRole}
                    {" · "}
                    {emp.department_name || labels.noDepartment}
                  </p>
                </div>
              </div>
              {emp.skills ? (
                <div className={styles.skills}>
                  {emp.skills
                    .split(",")
                    .map((skill) => skill.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((skill) => (
                      <Tag key={skill}>{skill}</Tag>
                    ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}

      <Modal
        title={labels.add}
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        onOk={() => void submitCreate()}
        okText={labels.create}
        cancelText={labels.cancel}
        okButtonProps={{ "data-testid": "org-employees-submit" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error ? (
            <Typography.Text type="danger">{error}</Typography.Text>
          ) : null}
          <Input
            placeholder={labels.fieldName}
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            data-testid="org-employees-name"
          />
          <Input
            placeholder={labels.fieldRole}
            value={form.role}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, role: event.target.value }))
            }
          />
          <Select
            value={form.employee_type}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, employee_type: value }))
            }
            options={[
              { value: "human", label: labels.typeHuman },
              { value: "ai", label: labels.typeAi },
            ]}
          />
          <Select
            value={form.department_id ?? undefined}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, department_id: value }))
            }
            placeholder={labels.fieldDepartment}
            options={departments.map((dept) => ({
              value: dept.id,
              label: dept.name,
            }))}
            data-testid="org-employees-department"
          />
          <Input
            placeholder={labels.fieldSkillsHint}
            value={form.skills}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, skills: event.target.value }))
            }
          />
          <Input.TextArea
            rows={3}
            placeholder={labels.fieldDescription}
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </div>
      </Modal>
    </div>
  );
}
