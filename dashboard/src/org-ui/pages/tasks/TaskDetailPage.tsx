import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select, Space, Tag, Typography } from "antd";
import { ArrowLeft, ListTodo } from "lucide-react";
import type { OrgTask, OrgTasksClient } from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { taskLabels } from "./labels";
import styles from "./TasksPage.module.css";

export interface TaskDetailPageProps {
  client: OrgTasksClient;
  session: OrgSession;
  locale: OrgLocale;
  taskId: number;
  onBack?: () => void;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

function nextStatus(status: string): string | null {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "review";
  if (status === "review") return "done";
  return null;
}

export function TaskDetailPage({
  client,
  session: _session,
  locale,
  taskId,
  onBack,
}: TaskDetailPageProps) {
  const labels = taskLabels(locale);
  const [task, setTask] = useState<OrgTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
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
      todo: labels.startWork,
      in_progress: labels.submitReview,
      review: labels.approveReview,
    })[status] || "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await client.get(taskId);
      setTask(row);
      setTitle(row.title);
      setDescription(row.description || "");
      setPriority(row.priority);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [client, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!title.trim()) {
      setError(labels.required);
      return;
    }
    try {
      const row = await client.update(taskId, {
        title: title.trim(),
        description,
        priority,
      });
      setTask(row);
      setEditing(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const remove = async () => {
    if (!window.confirm(labels.confirmDelete)) return;
    try {
      await client.remove(taskId);
      onBack?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.confirmDelete);
    }
  };

  const transition = async () => {
    if (!task) return;
    const to = nextStatus(task.status);
    if (!to) return;
    try {
      setTask(await client.transition(taskId, to));
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    try {
      await client.addSubtask(taskId, newSubtask.trim());
      setNewSubtask("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const toggleSubtask = async (subtaskId: number, completed: number) => {
    try {
      await client.updateSubtask(taskId, subtaskId, {
        completed: completed ? 0 : 1,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      await client.addComment(taskId, newComment.trim());
      setNewComment("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.required);
    }
  };

  if (loading) {
    return (
      <div className={styles.page} data-testid="org-ui-task-detail">
        <p className={styles.empty}>{labels.loading}</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className={styles.page} data-testid="org-ui-task-detail">
        <p className={styles.empty} data-testid="org-task-missing">
          {labels.notFound}
        </p>
        {onBack ? (
          <Button onClick={onBack} data-testid="org-task-back">
            {labels.back}
          </Button>
        ) : null}
      </div>
    );
  }

  const done = (task.subtasks || []).filter((row) => row.completed).length;
  const total = (task.subtasks || []).length;

  return (
    <div className={styles.page} data-testid="org-ui-task-detail">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {onBack ? (
            <Button
              type="text"
              icon={<ArrowLeft size={16} />}
              onClick={onBack}
              data-testid="org-task-back"
            />
          ) : null}
          <ListTodo size={20} />
          <div>
            <Typography.Title level={3} className={styles.title}>
              {labels.basic}
            </Typography.Title>
            <p className={styles.subtitle}>{task.title}</p>
          </div>
        </div>
        <Space wrap>
          <Button
            onClick={() => setEditing(!editing)}
            data-testid="org-task-edit"
          >
            {labels.edit}
          </Button>
          <Button
            danger
            onClick={() => void remove()}
            data-testid="org-task-delete"
          >
            {labels.delete}
          </Button>
        </Space>
      </div>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
      <p className={styles.hint}>{labels.commentHint}</p>

      <div className={styles.detailGrid}>
        <div>
          <div className={styles.detailCard}>
            {editing ? (
              <>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  data-testid="org-task-title"
                />
                <Input.TextArea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  style={{ marginTop: 8 }}
                  data-testid="org-task-description"
                />
                <Select
                  value={priority}
                  onChange={setPriority}
                  style={{ width: "100%", marginTop: 8 }}
                  options={[
                    { value: "low", label: labels.priorityLow },
                    { value: "medium", label: labels.priorityMedium },
                    { value: "high", label: labels.priorityHigh },
                    { value: "critical", label: labels.priorityCritical },
                  ]}
                />
                <div className={styles.addRow}>
                  <Button
                    type="primary"
                    onClick={() => void save()}
                    data-testid="org-task-save"
                  >
                    {labels.save}
                  </Button>
                  <Button onClick={() => setEditing(false)}>
                    {labels.cancel}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Space wrap>
                  <Tag>{statusLabel(task.status)}</Tag>
                  <Tag>{priorityLabel(task.priority)}</Tag>
                </Space>
                <Typography.Title level={4} style={{ marginTop: 12 }}>
                  {task.title}
                </Typography.Title>
                {task.description ? (
                  <p className={styles.body}>{task.description}</p>
                ) : null}
                <div className={styles.rowLine}>
                  <span className={styles.muted}>{labels.createdBy}</span>
                  <span>{task.creator_name || labels.unknown}</span>
                </div>
                <div className={styles.rowLine}>
                  <span className={styles.muted}>{labels.createdAt}</span>
                  <span>{(task.created_at || "").split("T")[0] || "—"}</span>
                </div>
              </>
            )}
          </div>

          <div className={styles.detailCard} style={{ marginTop: 16 }}>
            <Typography.Title level={5}>
              {labels.subtasks}
              {total ? ` (${done}/${total})` : ""}
            </Typography.Title>
            {(task.subtasks || []).map((sub) => (
              <div key={sub.id} className={styles.subtask}>
                <Button
                  size="small"
                  type={sub.completed ? "primary" : "default"}
                  onClick={() => void toggleSubtask(sub.id, sub.completed)}
                  data-testid={`org-task-subtask-${sub.id}`}
                >
                  {sub.completed ? "✓" : "○"}
                </Button>
                <span
                  className={sub.completed ? styles.muted : undefined}
                  style={
                    sub.completed
                      ? { textDecoration: "line-through" }
                      : undefined
                  }
                >
                  {sub.title}
                </span>
              </div>
            ))}
            <div className={styles.addRow}>
              <Input
                value={newSubtask}
                onChange={(event) => setNewSubtask(event.target.value)}
                placeholder={labels.addSubtask}
                onPressEnter={() => void addSubtask()}
                data-testid="org-task-subtask-input"
              />
              <Button
                type="primary"
                onClick={() => void addSubtask()}
                data-testid="org-task-subtask-add"
              >
                {labels.save}
              </Button>
            </div>
          </div>

          <div className={styles.detailCard} style={{ marginTop: 16 }}>
            <Typography.Title level={5}>
              {labels.comments} ({(task.comments || []).length})
            </Typography.Title>
            {(task.comments || []).map((comment) => (
              <div key={comment.id} className={styles.comment}>
                <div className={styles.commentMeta}>
                  {comment.user_name || labels.unknown} ·{" "}
                  {(comment.created_at || "").replace("T", " ").slice(0, 16)}
                </div>
                <p className={styles.body}>{comment.content}</p>
              </div>
            ))}
            <div className={styles.addRow}>
              <Input.TextArea
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                placeholder={labels.addComment}
                rows={2}
                data-testid="org-task-comment-input"
              />
              <Button
                type="primary"
                onClick={() => void addComment()}
                data-testid="org-task-comment-add"
              >
                {labels.save}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.detailCard}>
            <Typography.Title level={5}>{labels.status}</Typography.Title>
            {nextStatus(task.status) ? (
              <Button
                type="primary"
                block
                onClick={() => void transition()}
                data-testid="org-task-transition"
              >
                {nextLabel(task.status)}
              </Button>
            ) : (
              <p className={styles.hint}>{labels.completed}</p>
            )}
          </div>
          <div className={styles.detailCard} style={{ marginTop: 16 }}>
            <Typography.Title level={5}>{labels.assignee}</Typography.Title>
            <p>{task.assignee_name || labels.unassigned}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
