import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { Button, Input, Modal, Select, Space, Tag, Typography } from "antd";
import { ListTodo, Plus, RefreshCw, Search } from "lucide-react";
import type { OrgTask, OrgTasksClient } from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { taskLabels } from "./labels";
import styles from "./TasksPage.module.css";

export interface TasksPageProps {
  client: OrgTasksClient;
  session: OrgSession;
  locale: OrgLocale;
  onOpenTask?: (id: number) => void;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

const EMPTY_STATS = {
  total: 0,
  todo: 0,
  in_progress: 0,
  review: 0,
  done: 0,
};

function nextStatus(status: string): string | null {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "review";
  if (status === "review") return "done";
  return null;
}

export function TasksPage({
  client,
  session: _session,
  locale,
  onOpenTask,
}: TasksPageProps) {
  const labels = taskLabels(locale);
  const [items, setItems] = useState<OrgTask[]>([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [error, setError] = useState("");

  const statusLabel = (status: string) =>
    ({
      todo: labels.todo,
      in_progress: labels.inProgress,
      review: labels.review,
      done: labels.done,
    })[status] || status;

  const priorityLabel = (value: string) =>
    ({
      low: labels.priorityLow,
      medium: labels.priorityMedium,
      high: labels.priorityHigh,
      critical: labels.priorityCritical,
    })[value] || value;

  const nextLabel = (status: string) =>
    ({
      todo: labels.start,
      in_progress: labels.submit,
      review: labels.approve,
    })[status] || "";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, nextStats] = await Promise.all([
        client.list({
          status: filterStatus,
          priority: filterPriority || undefined,
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
  }, [client, filterPriority, filterStatus]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      query
        ? items.filter((row) => {
            const hay = `${row.title} ${row.description || ""}`.toLowerCase();
            return hay.includes(query);
          })
        : items,
    [items, query],
  );

  const openCreate = () => {
    setError("");
    setTitle("");
    setDescription("");
    setPriority("medium");
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!title.trim()) {
      setError(labels.required);
      return;
    }
    try {
      const created = await client.create({
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      setShowCreate(false);
      await fetchAll();
      onOpenTask?.(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const transition = async (task: OrgTask, event: MouseEvent) => {
    event.stopPropagation();
    const to = nextStatus(task.status);
    if (!to) return;
    try {
      await client.transition(task.id, to);
      await fetchAll();
    } catch {
      setError(labels.required);
    }
  };

  return (
    <div className={styles.page} data-testid="org-ui-tasks">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <ListTodo size={20} />
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
            data-testid="org-tasks-refresh"
          >
            {labels.refresh}
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={openCreate}
            data-testid="org-tasks-create"
          >
            {labels.create}
          </Button>
        </Space>
      </div>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
      <p className={styles.hint}>{labels.hostHint}</p>

      <div className={styles.stats} data-testid="org-tasks-stats">
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>{labels.total}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.todo}</div>
          <div className={styles.statLabel}>{labels.todo}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.in_progress}</div>
          <div className={styles.statLabel}>{labels.inProgress}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.done}</div>
          <div className={styles.statLabel}>{labels.done}</div>
        </div>
      </div>

      <div className={styles.filters}>
        <Input
          prefix={<Search size={14} />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={labels.search}
          allowClear
          data-testid="org-tasks-search"
        />
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ minWidth: 140 }}
          options={[
            { value: "all", label: labels.all },
            { value: "todo", label: labels.todo },
            { value: "in_progress", label: labels.inProgress },
            { value: "review", label: labels.review },
            { value: "done", label: labels.done },
          ]}
          data-testid="org-tasks-status"
        />
        <Select
          value={filterPriority}
          onChange={setFilterPriority}
          style={{ minWidth: 140 }}
          options={[
            { value: "", label: labels.all },
            { value: "critical", label: labels.priorityCritical },
            { value: "high", label: labels.priorityHigh },
            { value: "medium", label: labels.priorityMedium },
            { value: "low", label: labels.priorityLow },
          ]}
          data-testid="org-tasks-priority"
        />
      </div>

      {loading ? (
        <p className={styles.empty}>{labels.loading}</p>
      ) : visible.length === 0 ? (
        <div className={styles.empty} data-testid="org-tasks-empty">
          <p>{items.length === 0 ? labels.empty : labels.noMatch}</p>
          <p>{labels.emptyHint}</p>
        </div>
      ) : (
        <div className={styles.list} data-testid="org-tasks-list">
          {visible.map((task) => (
            <button
              key={task.id}
              type="button"
              className={styles.row}
              onClick={() => onOpenTask?.(task.id)}
              data-testid={`org-task-row-${task.id}`}
            >
              <Tag>{statusLabel(task.status)}</Tag>
              <Tag>{priorityLabel(task.priority)}</Tag>
              <div className={styles.rowBody}>
                <p className={styles.rowTitle}>{task.title}</p>
                <p className={styles.rowMeta}>
                  {(task.subtask_count ?? 0) > 0
                    ? `${task.subtask_done}/${task.subtask_count} · `
                    : ""}
                  {(task.comment_count ?? 0) > 0
                    ? `${task.comment_count} ${labels.comments}`
                    : task.assignee_name || labels.unassigned}
                </p>
              </div>
              {nextStatus(task.status) ? (
                <Button
                  size="small"
                  onClick={(event) => void transition(task, event)}
                  data-testid={`org-task-next-${task.id}`}
                >
                  {nextLabel(task.status)}
                </Button>
              ) : null}
            </button>
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
              data-testid="org-tasks-submit"
            >
              {labels.create}
            </Button>
            <Button onClick={() => setShowCreate(false)}>
              {labels.cancel}
            </Button>
          </Space>
        }
      >
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.fieldTitle}</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            data-testid="org-tasks-title"
          />
        </div>
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.fieldDescription}</span>
          <Input.TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            data-testid="org-tasks-description"
          />
        </div>
        <div className={styles.rowLine}>
          <span className={styles.muted}>{labels.fieldPriority}</span>
          <Select
            value={priority}
            onChange={setPriority}
            style={{ width: "100%" }}
            options={[
              { value: "low", label: labels.priorityLow },
              { value: "medium", label: labels.priorityMedium },
              { value: "high", label: labels.priorityHigh },
              { value: "critical", label: labels.priorityCritical },
            ]}
            data-testid="org-tasks-create-priority"
          />
        </div>
      </Modal>
    </div>
  );
}
