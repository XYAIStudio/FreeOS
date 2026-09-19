import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select, Space, Tag, Typography } from "antd";
import { Brain, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import type {
  OrgReflection,
  OrgReflectionsClient,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { reflectionLabels } from "./labels";
import styles from "./ReflectionsPage.module.css";

export interface ReflectionsPageProps {
  client: OrgReflectionsClient;
  session: OrgSession;
  locale: OrgLocale;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

const EMPTY_STATS = {
  total: 0,
  task_completion: 0,
  error_learning: 0,
  knowledge_capture: 0,
  improvement: 0,
};

const TYPE_COLOR: Record<string, string> = {
  task_completion: "green",
  error_learning: "red",
  knowledge_capture: "blue",
  improvement: "gold",
};

const EMPTY_FORM = {
  employee_id: "",
  task_id: "",
  reflection_type: "task_completion",
  success_factors: "",
  failure_reasons: "",
  knowledge_gaps: "",
  improvement_plans: "",
  extracted_skills: "",
  learned_knowledge: "",
  importance_score: 50,
};

function importanceColor(score: number): string {
  if (score >= 80) return "red";
  if (score >= 60) return "gold";
  if (score >= 40) return "blue";
  return "default";
}

export function ReflectionsPage({
  client,
  session: _session,
  locale,
}: ReflectionsPageProps) {
  const labels = reflectionLabels(locale);
  const [items, setItems] = useState<OrgReflection[]>([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const typeLabel = (value: string) =>
    ({
      task_completion: labels.typeTask,
      error_learning: labels.typeError,
      knowledge_capture: labels.typeKnowledge,
      improvement: labels.typeImprovement,
    })[value] || value;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, nextStats] = await Promise.all([
        client.list({
          type: filterType === "all" ? undefined : filterType,
        }),
        client.stats(),
      ]);
      setItems(rows);
      setStats(nextStats);
    } catch {
      setItems([]);
      setStats(EMPTY_STATS);
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
        ? items.filter((row) => {
            const hay = [
              row.success_factors,
              row.failure_reasons,
              row.knowledge_gaps,
              row.improvement_plans,
              row.extracted_skills,
              row.learned_knowledge,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(query);
          })
        : items,
    [items, query],
  );

  const openCreate = () => {
    setError("");
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  const submitCreate = async () => {
    const body = {
      reflection_type: form.reflection_type,
      success_factors: form.success_factors.trim() || undefined,
      failure_reasons: form.failure_reasons.trim() || undefined,
      knowledge_gaps: form.knowledge_gaps.trim() || undefined,
      improvement_plans: form.improvement_plans.trim() || undefined,
      extracted_skills: form.extracted_skills.trim() || undefined,
      learned_knowledge: form.learned_knowledge.trim() || undefined,
      importance_score: Number(form.importance_score) || 50,
      employee_id: form.employee_id ? Number(form.employee_id) : undefined,
      task_id: form.task_id ? Number(form.task_id) : undefined,
    };
    const hasText = [
      body.success_factors,
      body.failure_reasons,
      body.knowledge_gaps,
      body.improvement_plans,
      body.extracted_skills,
      body.learned_knowledge,
    ].some(Boolean);
    if (!hasText) {
      setError(labels.required);
      return;
    }
    try {
      await client.create(body);
      setShowCreate(false);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const remove = async (id: number) => {
    Modal.confirm({
      title: labels.confirmDelete,
      okText: labels.delete,
      cancelText: labels.cancel,
      onOk: async () => {
        await client.remove(id);
        await fetchAll();
      },
    });
  };

  return (
    <div className={styles.page} data-testid="org-ui-reflections">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Brain size={20} />
          <div>
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
            <p className={styles.subtitle}>{labels.subtitle}</p>
          </div>
        </div>
        <Space wrap>
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => void fetchAll()}
            data-testid="org-reflections-refresh"
          >
            {labels.refresh}
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={openCreate}
            data-testid="org-reflections-create"
          >
            {labels.create}
          </Button>
        </Space>
      </div>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
      <p className={styles.hint}>{labels.hostHint}</p>

      <div className={styles.stats} data-testid="org-reflections-stats">
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>{labels.total}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.task_completion}</div>
          <div className={styles.statLabel}>{labels.typeTask}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.error_learning}</div>
          <div className={styles.statLabel}>{labels.typeError}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.knowledge_capture}</div>
          <div className={styles.statLabel}>{labels.typeKnowledge}</div>
        </div>
      </div>

      <div className={styles.filters}>
        <Input
          prefix={<Search size={14} />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={labels.search}
          allowClear
          data-testid="org-reflections-search"
        />
        <Select
          value={filterType}
          onChange={setFilterType}
          style={{ minWidth: 160 }}
          options={[
            { value: "all", label: labels.all },
            { value: "task_completion", label: labels.typeTask },
            { value: "error_learning", label: labels.typeError },
            { value: "knowledge_capture", label: labels.typeKnowledge },
            { value: "improvement", label: labels.typeImprovement },
          ]}
          data-testid="org-reflections-type"
        />
      </div>

      {loading ? (
        <p className={styles.empty}>{labels.loading}</p>
      ) : visible.length === 0 ? (
        <div className={styles.empty} data-testid="org-reflections-empty">
          <p>{items.length === 0 ? labels.empty : labels.noMatch}</p>
          <p>{labels.emptyHint}</p>
        </div>
      ) : (
        <div className={styles.list} data-testid="org-reflections-list">
          {visible.map((row) => (
            <article
              key={row.id}
              className={styles.card}
              data-testid={`org-reflection-row-${row.id}`}
            >
              <div className={styles.cardHead}>
                <div className={styles.cardMeta}>
                  <Tag color={TYPE_COLOR[row.reflection_type]}>
                    {typeLabel(row.reflection_type)}
                  </Tag>
                  <p className={styles.cardTitle}>
                    {row.employee_id
                      ? `${labels.employeeLabel}${row.employee_id}`
                      : labels.orgLevel}
                  </p>
                  {row.task_id ? (
                    <span className={styles.muted}>
                      {labels.taskLabel}
                      {row.task_id}
                    </span>
                  ) : null}
                </div>
                <Space>
                  <Tag color={importanceColor(row.importance_score)}>
                    {labels.importance}: {row.importance_score}
                  </Tag>
                  <Button
                    size="small"
                    type="text"
                    icon={<Trash2 size={12} />}
                    onClick={() => void remove(row.id)}
                    data-testid={`org-reflection-delete-${row.id}`}
                  />
                </Space>
              </div>
              <div className={styles.grid}>
                {row.success_factors ? (
                  <div className={styles.block}>
                    <div className={styles.blockLabel}>{labels.success}</div>
                    <div>{row.success_factors}</div>
                  </div>
                ) : null}
                {row.failure_reasons ? (
                  <div className={styles.block}>
                    <div className={styles.blockLabel}>{labels.failure}</div>
                    <div>{row.failure_reasons}</div>
                  </div>
                ) : null}
                {row.improvement_plans ? (
                  <div className={styles.block}>
                    <div className={styles.blockLabel}>{labels.plan}</div>
                    <div>{row.improvement_plans}</div>
                  </div>
                ) : null}
                {row.extracted_skills ? (
                  <div className={styles.block}>
                    <div className={styles.blockLabel}>{labels.skills}</div>
                    <div>{row.extracted_skills}</div>
                  </div>
                ) : null}
                {row.knowledge_gaps ? (
                  <div className={styles.block}>
                    <div className={styles.blockLabel}>{labels.gaps}</div>
                    <div>{row.knowledge_gaps}</div>
                  </div>
                ) : null}
                {row.learned_knowledge ? (
                  <div className={styles.block}>
                    <div className={styles.blockLabel}>{labels.knowledge}</div>
                    <div>{row.learned_knowledge}</div>
                  </div>
                ) : null}
              </div>
              <p className={styles.when}>
                {(row.created_at || "").replace("T", " ").slice(0, 16)}
              </p>
            </article>
          ))}
        </div>
      )}

      <Modal
        title={labels.createTitle}
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        footer={
          <Space>
            <Button
              type="primary"
              onClick={() => void submitCreate()}
              data-testid="org-reflections-submit"
            >
              {labels.create}
            </Button>
            <Button onClick={() => setShowCreate(false)}>
              {labels.cancel}
            </Button>
          </Space>
        }
      >
        <div className={styles.rowPair}>
          <div className={styles.rowLine}>
            <span className={styles.muted}>{labels.employee}</span>
            <Input
              type="number"
              value={form.employee_id}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  employee_id: event.target.value,
                }))
              }
              data-testid="org-reflections-employee"
            />
          </div>
          <div className={styles.rowLine}>
            <span className={styles.muted}>{labels.task}</span>
            <Input
              type="number"
              value={form.task_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, task_id: event.target.value }))
              }
              data-testid="org-reflections-task"
            />
          </div>
        </div>
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.typeTask}</span>
          <Select
            value={form.reflection_type}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, reflection_type: value }))
            }
            style={{ width: "100%" }}
            options={[
              { value: "task_completion", label: labels.typeTask },
              { value: "error_learning", label: labels.typeError },
              { value: "knowledge_capture", label: labels.typeKnowledge },
              { value: "improvement", label: labels.typeImprovement },
            ]}
            data-testid="org-reflections-create-type"
          />
        </div>
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.importance}</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.importance_score}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                importance_score: Number(event.target.value),
              }))
            }
            data-testid="org-reflections-importance"
          />
        </div>
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.success}</span>
          <Input.TextArea
            rows={2}
            value={form.success_factors}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                success_factors: event.target.value,
              }))
            }
            data-testid="org-reflections-success"
          />
        </div>
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.failure}</span>
          <Input.TextArea
            rows={2}
            value={form.failure_reasons}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                failure_reasons: event.target.value,
              }))
            }
            data-testid="org-reflections-failure"
          />
        </div>
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.plan}</span>
          <Input.TextArea
            rows={2}
            value={form.improvement_plans}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                improvement_plans: event.target.value,
              }))
            }
            data-testid="org-reflections-plan"
          />
        </div>
      </Modal>
    </div>
  );
}
