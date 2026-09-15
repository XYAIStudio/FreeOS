import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit2, Trash2, CheckCircle, Circle, MessageSquare, Paperclip,
  Plus, Send, Clock, User, Flag, Calendar, Bot, X
} from "lucide-react";
import { authFetch } from "../api/authFetch";
import Avatar from "../components/Avatar";
import { useLocale } from "../i18n";

interface Subtask {
  id: number; title: string; completed: number; sort_order: number;
}

interface Comment {
  id: number; content: string; user_id?: number; employee_id?: number;
  user_name?: string; employee_name?: string; employee_avatar?: string;
  comment_type: string; created_at: string;
}

interface Attachment {
  id: number; filename: string; file_size?: number; mime_type?: string;
  uploaded_by?: number; created_at: string;
}

interface TaskDetail {
  id: number; title: string; description?: string; status: string; priority: string;
  assigned_to?: number; assignee_name?: string; assignee_avatar?: string; assignee_avatar_url?: string;
  created_by?: number; creator_name?: string; created_at: string; updated_at: string;
  subtasks: Subtask[]; comments: Comment[]; attachments: Attachment[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-info/10 text-info", in_progress: "bg-warning/10 text-warning",
  review: "bg-accent/10 text-accent", done: "bg-success/10 text-success",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-danger", high: "text-warning", medium: "text-info", low: "text-text-muted",
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", priority: "" });

  const fetchTask = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await authFetch(`/api/tasks/${id}`);
      const d = await r.json();
      if (d.success) {
        setTask(d.data);
        setEditForm({
          title: d.data.title,
          description: d.data.description || "",
          priority: d.data.priority,
        });
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  const handleTransition = async (to: string) => {
    if (!id) return;
    await authFetch(`/api/tasks/${id}/transition`, {
      method: "POST",
      body: JSON.stringify({ to }),
    });
    fetchTask();
  };

  const handleAddSubtask = async () => {
    if (!id || !newSubtask.trim()) return;
    await authFetch(`/api/tasks/${id}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title: newSubtask }),
    });
    setNewSubtask("");
    fetchTask();
  };

  const handleToggleSubtask = async (subtaskId: number, completed: number) => {
    if (!id) return;
    await authFetch(`/api/tasks/${id}/subtasks/${subtaskId}`, {
      method: "PUT",
      body: JSON.stringify({ completed: completed ? 0 : 1 }),
    });
    fetchTask();
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    if (!id) return;
    await authFetch(`/api/tasks/${id}/subtasks/${subtaskId}`, { method: "DELETE" });
    fetchTask();
  };

  const handleAddComment = async () => {
    if (!id || !newComment.trim()) return;
    await authFetch(`/api/tasks/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: newComment }),
    });
    setNewComment("");
    fetchTask();
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    await authFetch(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(editForm),
    });
    setEditing(false);
    fetchTask();
  };

  const handleDelete = async () => {
    if (!id || !confirm(t("确定删除此任务？", "Delete this task?"))) return;
    await authFetch(`/api/tasks/${id}`, { method: "DELETE" });
    navigate("/tasks");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        {t("加载中...", "Loading...")}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-muted">
        <p>{t("任务不存在", "Task not found")}</p>
        <button onClick={() => navigate("/tasks")} className="mt-2 text-primary text-sm">{t("返回任务列表", "Back to tasks")}</button>
      </div>
    );
  }

  const statusLabel = (status: string) => ({ todo: t("待办", "To do"), in_progress: t("进行中", "In progress"), review: t("评审中", "In review"), done: t("已完成", "Done") }[status] || status);
  const priorityLabel = (priority: string) => ({ critical: t("紧急", "Critical"), high: t("高", "High"), medium: t("中", "Medium"), low: t("低", "Low") }[priority] || priority);

  const completedSubtasks = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-card">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/tasks")} className="p-1.5 rounded-md hover:bg-bg text-text-muted">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-text">{t("任务详情", "Task details")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="p-2 rounded-md hover:bg-bg text-text-muted"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-md hover:bg-danger/10 text-text-muted hover:text-danger"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {editing ? (
              <div className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none focus:border-primary"
                  placeholder={t("任务标题", "Task title")}
                />
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none focus:border-primary resize-none"
                  rows={4}
                  placeholder={t("任务描述", "Description")}
                />
                <select
                  value={editForm.priority}
                  onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm outline-none focus:border-primary"
                >
                  <option value="low">{t("低优先级", "Low")}</option>
                  <option value="medium">{t("中优先级", "Medium")}</option>
                  <option value="high">{t("高优先级", "High")}</option>
                  <option value="critical">{t("紧急", "Critical")}</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-text-muted">{t("取消", "Cancel")}</button>
                  <button onClick={handleSaveEdit} className="px-4 py-2 bg-primary text-white text-sm rounded-lg">{t("保存", "Save")}</button>
                </div>
              </div>
            ) : (
              <div className="bg-bg-card border border-border rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                    {statusLabel(task.status)}
                  </span>
                  <span className={`text-xs font-bold ${PRIORITY_COLORS[task.priority]}`}>
                    {priorityLabel(task.priority)}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-text mb-2">{task.title}</h2>
                {task.description && (
                  <p className="text-sm text-text-secondary leading-relaxed">{task.description}</p>
                )}
                <div className="flex items-center gap-4 mt-4 text-xs text-text-muted">
                  <div className="flex items-center gap-1">
                    <User size={12} />
                    <span>{t("创建者:", "Created by:")} {task.creator_name || t("未知", "Unknown")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{t("创建时间:", "Created:")} {task.created_at?.split("T")[0]}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <CheckCircle size={16} className="text-primary" />
                  {t("子任务", "Subtasks")} {totalSubtasks > 0 && `(${completedSubtasks}/${totalSubtasks})`}
                </h3>
              </div>

              {totalSubtasks > 0 && (
                <div className="w-full bg-bg rounded-full h-1.5 mb-4">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
                  />
                </div>
              )}

              <div className="space-y-2 mb-4">
                {task.subtasks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 group">
                    <button
                      onClick={() => handleToggleSubtask(sub.id, sub.completed)}
                      className="text-text-muted hover:text-primary"
                    >
                      {sub.completed ? (
                        <CheckCircle size={18} className="text-primary" />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${sub.completed ? "line-through text-text-muted" : "text-text"}`}>
                      {sub.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddSubtask()}
                  placeholder={t("添加子任务...", "Add a subtask...")}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleAddSubtask}
                  disabled={!newSubtask.trim()}
                  className="p-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-4">
                <MessageSquare size={16} className="text-primary" />
                {t("评论", "Comments")} ({task.comments.length})
              </h3>

              <div className="space-y-4 mb-4">
                {task.comments.map(comment => (
                  <div key={comment.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-bg flex items-center justify-center shrink-0">
                      {comment.comment_type === "ai" ? (
                        <Bot size={14} className="text-primary" />
                      ) : (
                        <span className="text-xs font-bold text-primary">
                          {comment.user_name?.[0] || "U"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-text">
                          {comment.user_name || comment.employee_name || t("未知", "Unknown")}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {comment.created_at?.replace("T", " ").substring(0, 16)}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder={t("添加评论...", "Add a comment...")}
                  rows={2}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary resize-none"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="p-2.5 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4">{t("状态流转", "Status transition")}</h3>
              <div className="space-y-2">
                {task.status === "todo" && (
                  <button
                    onClick={() => handleTransition("in_progress")}
                    className="w-full px-4 py-2.5 bg-warning/10 text-warning text-sm rounded-lg hover:opacity-80"
                  >{t("开始执行", "Start work")}</button>
                )}
                {task.status === "in_progress" && (
                  <button
                    onClick={() => handleTransition("review")}
                    className="w-full px-4 py-2.5 bg-accent/10 text-accent text-sm rounded-lg hover:opacity-80"
                  >{t("提交评审", "Submit for review")}</button>
                )}
                {task.status === "review" && (
                  <button
                    onClick={() => handleTransition("done")}
                    className="w-full px-4 py-2.5 bg-success/10 text-success text-sm rounded-lg hover:opacity-80"
                  >{t("评审通过", "Approve review")}</button>
                )}
                {task.status === "done" && (
                  <div className="text-center py-4">
                    <CheckCircle size={32} className="text-success mx-auto mb-2" />
                    <p className="text-sm text-success">{t("任务已完成", "Task completed")}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4">{t("负责人", "Assignee")}</h3>
              {task.assignee_name ? (
                <div className="flex items-center gap-3">
                  <Avatar id={task.assigned_to} name={task.assignee_name} size={40} className="bg-primary-bg" customSrc={task.assignee_avatar_url || undefined} />
                  <div>
                    <p className="text-sm font-medium text-text">{task.assignee_name}</p>
                    <p className="text-xs text-text-muted">{t("AI员工", "AI employee")}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t("待分配", "Unassigned")}</p>
              )}
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4">{t("附件", "Attachments")} ({task.attachments.length})</h3>
              {task.attachments.length > 0 ? (
                <div className="space-y-2">
                  {task.attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg">
                      <Paperclip size={14} className="text-text-muted" />
                      <span className="text-sm text-text truncate flex-1">{att.filename}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t("暂无附件", "No attachments")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
