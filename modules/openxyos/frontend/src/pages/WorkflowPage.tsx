import { useState, useEffect, lazy, Suspense, Component } from "react";
import { authFetch } from "../api/authFetch";
import { Workflow, Plus, Play, Pause, CheckCircle, XCircle, Clock, FileText, Users, BarChart3, RefreshCw, Eye, Trash2, ChevronRight, Zap, PenTool, Bell } from "lucide-react";
const WorkflowDesigner = lazy(() => import("../components/workflow/WorkflowDesigner"));

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
          <div className="text-red-400 text-lg">组件渲染失败</div>
          <div className="text-xs bg-red-50 border border-red-200 rounded px-4 py-2 max-w-md text-red-600 font-mono">{this.state.error}</div>
          <button onClick={() => { this.setState({ hasError: false, error: "" }); }}
            className="px-4 py-2 text-xs font-medium text-white bg-primary rounded hover:opacity-90">
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface WorkflowDef {
  id: number;
  name: string;
  description: string;
  version: number;
  status: string;
  definition: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowInstance {
  id: number;
  workflow_id: number;
  workflow_name: string;
  title: string;
  status: string;
  current_step: number;
  started_at: string;
  completed_at: string;
}

interface WorkflowTask {
  id: number;
  instance_id: number;
  step_index: number;
  title: string;
  description: string;
  type: string;
  status: string;
  assignee_id: number;
  result: string;
  comment: string;
  created_at: string;
  instance_title?: string;
  workflow_name?: string;
}

interface WorkflowStats {
  definitions: { total: number; active: number };
  instances: { total: number; running: number; completed: number };
  tasks: { pending: number };
}

const TABS = [
  { key: "overview", label: "概览", icon: BarChart3 },
  { key: "design", label: "设计中心", icon: PenTool },
  { key: "definitions", label: "流程定义", icon: FileText },
  { key: "instances", label: "流程实例", icon: Play },
  { key: "tasks", label: "我的任务", icon: Clock },
  { key: "notifications", label: "知会通知", icon: Bell },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-600",
  inactive: "bg-red-100 text-red-600",
  pending: "bg-amber-100 text-amber-600",
  running: "bg-blue-100 text-blue-600",
  completed: "bg-green-100 text-green-600",
  rejected: "bg-red-100 text-red-600",
  revising: "bg-amber-100 text-amber-600",
  cancelled: "bg-gray-100 text-gray-500",
  closed: "bg-gray-100 text-gray-500",
  returned: "bg-orange-100 text-orange-600",
  delegated: "bg-purple-100 text-purple-600",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "启用",
  inactive: "停用",
  pending: "待处理",
  running: "进行中",
  completed: "已完成",
  rejected: "已否决",
  revising: "修订中",
  cancelled: "已撤回",
  closed: "已关闭",
  returned: "已打回",
  delegated: "已转签",
};

// 预置流程模板
const PRESET_TEMPLATES = [
  {
    name: "请假审批",
    description: "员工请假→直属领导审批→HR备案",
    steps: [
      { id: "start", type: "start", title: "发起请假" },
      { id: "step1", type: "approval", title: "直属领导审批", assignee_type: "role", assignee_id: 0 },
      { id: "step2", type: "task", title: "HR备案", assignee_type: "role", assignee_id: 0 },
      { id: "end", type: "end", title: "流程结束" },
    ],
  },
  {
    name: "采购审批",
    description: "采购申请→部门经理审批→财务审批→采购执行",
    steps: [
      { id: "start", type: "start", title: "发起采购申请" },
      { id: "step1", type: "approval", title: "部门经理审批", assignee_type: "role", assignee_id: 0 },
      { id: "step2", type: "approval", title: "财务审批", assignee_type: "role", assignee_id: 0 },
      { id: "step3", type: "task", title: "采购执行", assignee_type: "role", assignee_id: 0 },
      { id: "end", type: "end", title: "流程结束" },
    ],
  },
  {
    name: "项目立项",
    description: "项目提案→技术评审→管理层审批→项目启动",
    steps: [
      { id: "start", type: "start", title: "项目提案" },
      { id: "step1", type: "approval", title: "技术评审", assignee_type: "role", assignee_id: 0 },
      { id: "step2", type: "approval", title: "管理层审批", assignee_type: "role", assignee_id: 0 },
      { id: "step3", type: "task", title: "项目启动", assignee_type: "role", assignee_id: 0 },
      { id: "end", type: "end", title: "流程结束" },
    ],
  },
];

export default function WorkflowPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [definitions, setDefinitions] = useState<WorkflowDef[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState<number | null>(null);
  const [detailModal, setDetailModal] = useState<{ type: string; data: any } | null>(null);
  const [designMode, setDesignMode] = useState<{ mode: "new" | "edit"; id?: number } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, defRes, instRes, taskRes, notifRes] = await Promise.all([
        authFetch("/api/workflows-v2/stats"),
        authFetch("/api/workflows-v2/definitions"),
        authFetch("/api/workflows-v2/instances"),
        authFetch("/api/workflows-v2/tasks"),
        authFetch("/api/workflows-v2/notifications?unread=1"),
      ]);
      const [statsJson, defJson, instJson, taskJson, notifJson] = await Promise.all([
        statsRes.json(), defRes.json(), instRes.json(), taskRes.json(), notifRes.json(),
      ]);
      if (statsJson.success) setStats(statsJson.data);
      if (defJson.success) setDefinitions(defJson.data);
      if (instJson.success) setInstances(instJson.data);
      if (taskJson.success) setTasks(taskJson.data);
      if (notifJson.success) setNotifications(notifJson.data || []);
    } catch (err) { console.error("获取流程数据失败:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateDefinition = async (params: { name: string; description: string; definition: any }) => {
    try {
      await authFetch("/api/workflows/definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      setShowCreateModal(false);
      await fetchData();
    } catch (err) { console.error("创建流程定义失败:", err); }
  };

  const handleStartInstance = async (workflowId: number, title: string) => {
    try {
      await authFetch("/api/workflows-v2/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, title }),
      });
      setShowStartModal(null);
      await fetchData();
    } catch (err) { console.error("启动流程失败:", err); }
  };

  const handleCompleteTask = async (taskId: number, action: "approve" | "reject" | "return" | "delegate" | "add-sign", extra?: { comment?: string; delegateToId?: number; newUserId?: number; reason?: string }) => {
    try {
      const actionMap: Record<string, string> = {
        approve: "approve", reject: "reject", return: "return",
        delegate: "delegate", "add-sign": "add-sign",
      };
      const body: any = { comment: extra?.comment };
      if (action === "delegate") body.delegateToId = extra?.delegateToId;
      if (action === "add-sign") { body.userId = extra?.newUserId; body.reason = extra?.reason; }

      await authFetch(`/api/workflows-v2/tasks/${taskId}/${actionMap[action]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await fetchData();
    } catch (err) { console.error("操作任务失败:", err); }
  };

  const handleDeleteDefinition = async (id: number) => {
    if (!confirm("确定删除此流程定义？")) return;
    try {
      await authFetch(`/api/workflows-v2/definitions/${id}`, { method: "DELETE" });
      await fetchData();
    } catch (err) { console.error("删除流程定义失败:", err); }
  };

  if (designMode) {
    return <div className="h-full"><Suspense fallback={<div className="flex items-center justify-center h-full text-text-muted animate-pulse">加载设计器中...</div>}><ErrorBoundary><WorkflowDesigner editId={designMode.mode === "edit" ? designMode.id : undefined} onBack={() => { setDesignMode(null); fetchData(); }} /></ErrorBoundary></Suspense></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-text-muted animate-pulse">加载中...</div></div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-2">
          <Workflow size={18} className="text-primary" />
          <h1 className="text-base font-bold text-text">企业流程管理</h1>
          <span className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary font-medium">V2</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDesignMode({ mode: "new" })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded hover:opacity-90 transition-colors">
            <PenTool size={12} />
            设计新流程
          </button>
          <button onClick={() => fetchData()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text border border-border rounded hover:bg-bg transition-colors">
            <RefreshCw size={12} />
            刷新
          </button>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="flex border-b border-border bg-bg-card">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-text-muted hover:text-text"
            }`}>
            <tab.icon size={14} />
            {tab.label}
            {tab.key === "tasks" && tasks.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">{tasks.length}</span>
            )}
            {tab.key === "notifications" && notifications.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full">{notifications.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-5">
        {activeTab === "overview" && stats && <OverviewTab stats={stats} />}
        {activeTab === "design" && (
          <DesignTab
            definitions={definitions}
            onNew={() => setDesignMode({ mode: "new" })}
            onEdit={(id) => setDesignMode({ mode: "edit", id })}
            onDelete={handleDeleteDefinition}
            onStart={setShowStartModal}
          />
        )}
        {activeTab === "definitions" && (
          <DefinitionsTab
            data={definitions}
            onStart={setShowStartModal}
            onDelete={handleDeleteDefinition}
            onEdit={(id) => setDesignMode({ mode: "edit", id })}
            onDetail={(d) => setDetailModal({ type: "definition", data: d })}
          />
        )}
        {activeTab === "instances" && (
          <InstancesTab
            data={instances}
            onDetail={(d) => setDetailModal({ type: "instance", data: d })}
          />
        )}
        {activeTab === "tasks" && (
          <TasksTabV2
            data={tasks}
            onComplete={handleCompleteTask}
            onRefresh={fetchData}
          />
        )}
        {activeTab === "notifications" && (
          <NotificationsTab data={notifications} />
        )}
      </div>

      {/* 创建流程定义弹窗 */}
      {showCreateModal && (
        <CreateDefinitionModal
          templates={PRESET_TEMPLATES}
          onSubmit={handleCreateDefinition}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* 启动流程实例弹窗 */}
      {showStartModal && (
        <StartInstanceModal
          definition={definitions.find(d => d.id === showStartModal) || undefined}
          onSubmit={(title) => handleStartInstance(showStartModal, title)}
          onClose={() => setShowStartModal(null)}
        />
      )}

      {/* 详情弹窗 */}
      {detailModal && detailModal.data && (
        <DetailModal
          type={detailModal.type}
          data={detailModal.data}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}

// 概览Tab
function OverviewTab({ stats }: { stats: WorkflowStats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
            <span className="text-xs text-text-muted">流程定义</span>
          </div>
          <div className="text-2xl font-bold text-text">{stats.definitions.total}</div>
          <div className="text-xs text-text-muted mt-1">启用 {stats.definitions.active}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
              <Play size={16} className="text-green-600" />
            </div>
            <span className="text-xs text-text-muted">流程实例</span>
          </div>
          <div className="text-2xl font-bold text-text">{stats.instances.total}</div>
          <div className="text-xs text-text-muted mt-1">进行中 {stats.instances.running}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-amber-100 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <span className="text-xs text-text-muted">待办任务</span>
          </div>
          <div className="text-2xl font-bold text-amber-500">{stats.tasks.pending}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center">
              <CheckCircle size={16} className="text-purple-600" />
            </div>
            <span className="text-xs text-text-muted">已完成</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{stats.instances.completed}</div>
        </div>
      </div>
    </div>
  );
}

// 流程定义Tab (V2版本)
function DefinitionsTab({ data, onStart, onDelete, onEdit, onDetail }: {
  data: any[];
  onStart: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
  onDetail: (d: any) => void;
}) {
  const countNodes = (def: any) => {
    try {
      const d = typeof def === "string" ? JSON.parse(def) : def;
      return d.nodes?.length || d.steps?.length || 0;
    } catch { return 0; }
  };

  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p>暂无流程定义</p>
          <p className="text-xs mt-2">点击"设计新流程"创建第一个流程</p>
        </div>
      ) : (
        data.map((def: any) => {
          const nodeCount = def.definition ? countNodes(def.definition) : 0;
          return (
            <div key={def.id} className="bg-bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{def.icon || "📋"}</span>
                    <h3 className="text-sm font-bold text-text">{def.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_COLORS[def.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[def.status] || def.status}
                    </span>
                    {def.scheme_name && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600">{def.scheme_name}</span>}
                  </div>
                  <p className="text-xs text-text-muted mb-2">{def.description || "无描述"}</p>
                  <div className="flex items-center gap-4 text-[10px] text-text-muted">
                    <span>版本: v{def.version}</span>
                    <span>节点: {nodeCount}个</span>
                    <span>更新: {def.updated_at?.slice(0, 10)}</span>
                    {def.category_id && <span className="text-primary">ID:{def.category_id}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onDetail(def)}
                    className="p-1.5 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors">
                    <Eye size={14} />
                  </button>
                  {def.status === "active" && (
                    <button onClick={() => onStart(def.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600 transition-colors">
                      <Play size={10} /> 启动
                    </button>
                  )}
                  <button onClick={() => onEdit(def.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary border border-primary/30 rounded hover:bg-primary/5 transition-colors">
                    <PenTool size={10} /> 编辑
                  </button>
                  <button onClick={() => onDelete(def.id)}
                    className="p-1.5 text-text-muted hover:text-red-500 rounded hover:bg-bg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// 流程实例Tab
function InstancesTab({ data, onDetail }: { data: WorkflowInstance[]; onDetail: (d: WorkflowInstance) => void }) {
  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Play size={48} className="mx-auto mb-4 opacity-30" />
          <p>暂无流程实例</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left py-3 px-4">ID</th>
                <th className="text-left py-3 px-4">流程名称</th>
                <th className="text-left py-3 px-4">实例标题</th>
                <th className="text-center py-3 px-4">状态</th>
                <th className="text-center py-3 px-4">当前步骤</th>
                <th className="text-left py-3 px-4">启动时间</th>
                <th className="text-center py-3 px-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((inst) => (
                <tr key={inst.id} className="border-b border-border/50 hover:bg-bg">
                  <td className="py-2 px-4 text-xs">{inst.id}</td>
                  <td className="py-2 px-4 text-xs font-medium">{inst.workflow_name}</td>
                  <td className="py-2 px-4 text-xs">{inst.title || "-"}</td>
                  <td className="py-2 px-4 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_COLORS[inst.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[inst.status] || inst.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-center text-xs">{inst.current_step}</td>
                  <td className="py-2 px-4 text-xs text-text-muted">{inst.started_at?.slice(0, 19)}</td>
                  <td className="py-2 px-4 text-center">
                    <button onClick={() => onDetail(inst)}
                      className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg transition-colors">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 我的任务Tab (V3 — 点击进入详情再审批)
function TasksTabV2({ data, onComplete, onRefresh }: {
  data: WorkflowTask[];
  onComplete: (id: number, action: "approve" | "reject" | "return" | "delegate" | "add-sign", extra?: any) => void;
  onRefresh: () => void;
}) {
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [instanceDetail, setInstanceDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (task: WorkflowTask) => {
    setSelectedTask(task);
    setDetailLoading(true);
    try {
      const res = await authFetch(`/api/workflows-v2/instances/${task.instance_id}`);
      const json = await res.json();
      if (json.success) setInstanceDetail(json.data);
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => {
    setSelectedTask(null);
    setInstanceDetail(null);
  };

  // 详情视图
  if (selectedTask) {
    return <TaskDetailView
      task={selectedTask}
      instanceDetail={instanceDetail}
      loading={detailLoading}
      onBack={closeDetail}
      onComplete={(action, extra) => {
        onComplete(selectedTask.id, action, extra);
        closeDetail();
        onRefresh();
      }}
    />;
  }

  // 列表视图
  return (
    <div className="space-y-3">
      <div className="text-xs text-text-muted mb-2">
        共 {data.length} 个待办任务，点击查看详情并处理
      </div>
      {data.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <CheckCircle size={48} className="mx-auto mb-4 opacity-30" />
          <p>暂无待办任务</p>
        </div>
      ) : (
        data.map((task) => (
          <div key={task.id}
            onClick={() => openDetail(task)}
            className="bg-bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-text group-hover:text-primary transition-colors">{task.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_COLORS[task.type] || "bg-gray-100 text-gray-600"}`}>
                    {task.type === "approval" ? "审批" : task.type === "revise" ? "修订" : task.type === "task" ? "任务" : task.type}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-text-muted">
                  <span>流程: {task.workflow_name}</span>
                  <span>实例: {task.instance_title}</span>
                  {task.created_at && <span>{task.created_at.slice(0, 16)}</span>}
                </div>
              </div>
              <ChevronRight size={16} className="text-text-muted group-hover:text-primary transition-colors mt-1" />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ======= 任务详情视图 (OA标准审批界面) =======
function TaskDetailView({ task, instanceDetail, loading, onBack, onComplete }: {
  task: WorkflowTask;
  instanceDetail: any;
  loading: boolean;
  onBack: () => void;
  onComplete: (action: "approve" | "reject" | "return" | "delegate" | "add-sign", extra?: any) => void;
}) {
  const [actionModal, setActionModal] = useState<{ action: string } | null>(null);
  const [comment, setComment] = useState("");
  const [targetId, setTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const doAction = async () => {
    if (!actionModal) return;
    setSubmitting(true);
    const extra: any = { comment };
    if (actionModal.action === "delegate") extra.delegateToId = Number(targetId);
    if (actionModal.action === "add-sign") { extra.newUserId = Number(targetId); extra.reason = comment; }
    onComplete(actionModal.action as any, extra);
    setActionModal(null); setComment(""); setTargetId("");
  };

  const d = instanceDetail;
  const timeline: any[] = d?.timeline || [];
  const flowDef = d?.flowDef;
  const formVars: Record<string, any> = d?.variables || {};
  const submitter = d?.submitter;
  const instanceStatus = d?.status;

  // 构建流程步骤结构：flowDef.nodes 中非 start/end 的节点按 edges 顺序排列
  const buildSteps = () => {
    if (!flowDef?.nodes) return [];
    const nodes = flowDef.nodes as any[];
    const edges = (flowDef.edges || []) as any[];
    // 找 start 节点
    const startNode = nodes.find((n: any) => n.type === "start");
    if (!startNode) return nodes.filter((n: any) => n.type !== "start" && n.type !== "end");
    // BFS 遍历
    const visited = new Set<string>();
    const ordered: any[] = [];
    const queue = [startNode.id];
    while (queue.length > 0) {
      const nid = queue.shift()!;
      if (visited.has(nid)) continue;
      visited.add(nid);
      const node = nodes.find((n: any) => n.id === nid);
      if (node && node.type !== "start" && node.type !== "end") ordered.push(node);
      for (const e of edges) {
        if (e.from === nid && !visited.has(e.to)) queue.push(e.to);
      }
    }
    return ordered;
  };

  const steps = buildSteps();

  // 给每个步骤找对应的 timeline 条目
  const stepStatus = (nodeId: string) => {
    const entry = timeline.find((t: any) => t.nodeId === nodeId);
    if (entry) return entry.action === "approve" ? "approved" : entry.action === "reject" ? "rejected" : entry.action;
    // 检查是否当前要处理
    const isCurrent = d?.current_node_ids && JSON.parse(d.current_node_ids || "[]").includes(nodeId);
    if (isCurrent) return "current";
    return "pending";
  };

  const stepInfo = (nodeId: string) => {
    return timeline.find((t: any) => t.nodeId === nodeId) || null;
  };

  const statusMeta: Record<string, { dot: string; line: string; label: string }> = {
    approved: { dot: "bg-green-500", line: "bg-green-300", label: "已通过" },
    rejected: { dot: "bg-red-500", line: "bg-red-300", label: "已否决" },
    returned: { dot: "bg-orange-500", line: "bg-orange-300", label: "已打回" },
    current: { dot: "bg-blue-500 ring-4 ring-blue-100", line: "bg-gray-200", label: "当前" },
    pending: { dot: "bg-gray-300", line: "bg-gray-200", label: "待处理" },
  };

  const typeLabel = (t: string) => {
    const m: Record<string, string> = { start: "开始", approval: "审批", task: "任务", condition: "条件", action: "执行", end: "结束", revise: "修订" };
    return m[t] || t;
  };

  /** 解析驳回目标节点 */
  const getRejectTarget = (node: any): { targetId: string; targetTitle: string } | null => {
    if (node.type !== "approval" && node.type !== "task") return null;
    const cfg = node.config || {};
    const strategy = cfg.rejectStrategy || "back_to_start";
    if (strategy === "to_specified" && cfg.rejectTargetNodeId) {
      const t = flowDef?.nodes?.find((n: any) => n.id === cfg.rejectTargetNodeId);
      return t ? { targetId: t.id, targetTitle: t.title } : null;
    }
    if (strategy === "back_to_start") {
      const start = flowDef?.nodes?.find((n: any) => n.type === "start");
      return start ? { targetId: start.id, targetTitle: start.title } : null;
    }
    if (strategy === "back_to_prev") {
      const incomingEdge = (flowDef?.edges || []).find((e: any) => e.to === node.id);
      if (incomingEdge) {
        const prev = flowDef?.nodes?.find((n: any) => n.id === incomingEdge.from);
        if (prev && (prev.type === "approval" || prev.type === "task")) {
          return { targetId: prev.id, targetTitle: prev.title };
        }
      }
    }
    return null;
  };

  const rejectStrategyLabel: Record<string, string> = {
    back_to_start: "退回到发起人", back_to_prev: "退回上一级", to_specified: "退回指定节点",
  };

  // 格式化变量值为人类可读
  const formatVarValue = (val: any): string => {
    if (val === null || val === undefined) return "-";
    if (typeof val === "boolean") return val ? "是" : "否";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const varLabel = (key: string): string => {
    const labels: Record<string, string> = {
      leaveType: "请假类型", startDate: "开始日期", endDate: "结束日期", days: "天数",
      reason: "事由", amount: "金额", items: "物品清单", vendor: "供应商",
      projectName: "项目名称", budget: "预算", department: "部门", urgency: "紧急程度",
      description: "描述", title: "标题", content: "内容", priority: "优先级",
    };
    return labels[key] || key;
  };

  return (
    <div className="h-full flex flex-col">
      {/* ===== 顶部：标题 + 状态 ===== */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack}
          className="p-1.5 text-text-muted hover:text-text hover:bg-bg rounded transition-colors flex-shrink-0">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-text truncate">{task.instance_title || task.title}</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium flex-shrink-0 ${STATUS_COLORS[instanceStatus] || "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[instanceStatus] || instanceStatus || "进行中"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5 flex-wrap">
            <span>流程: {task.workflow_name || d?.workflow_name}</span>
            {submitter && <span>提交人: {submitter.nickname || `#${submitter.id}`}</span>}
            {d?.started_at && <span>{d.started_at.slice(0, 16)}</span>}
          </div>
          {d?.description && <p className="text-xs text-text-muted mt-1">{d.description}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-text-muted animate-pulse">加载流程详情中...</div>
      ) : (
        <div className="flex-1 overflow-auto space-y-4">
          {/* ===== 第二块：申请表内容 ===== */}
          {Object.keys(formVars).length > 0 && (
            <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-bg flex items-center">
                <FileText size={14} className="text-text-muted mr-2" />
                <span className="text-sm font-bold text-text">申请内容</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {Object.entries(formVars).map(([key, val]) => (
                    <div key={key} className="flex flex-col">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">{varLabel(key)}</span>
                      <span className="text-sm text-text font-medium mt-0.5">{formatVarValue(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== 第三块：审批进度（流程步骤可视化） ===== */}
          <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-bg flex items-center">
              <Clock size={14} className="text-text-muted mr-2" />
              <span className="text-sm font-bold text-text">审批进度</span>
            </div>
            <div className="p-4">
              {steps.length === 0 && timeline.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">暂无需审批步骤</p>
              ) : (
                <div>
                  {/* 发起人节点 */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="w-0.5 flex-1 min-h-[24px] bg-green-300" />
                    </div>
                    <div className="pb-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text font-medium">{submitter?.nickname || `用户#${d?.started_by}`}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600">提交申请</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">{d?.started_at?.slice(0, 16)}</p>
                    </div>
                  </div>

                  {/* 审批步骤 */}
                  {steps.map((node: any, i: number) => {
                    const st = stepStatus(node.id);
                    const info = stepInfo(node.id);
                    const meta = statusMeta[st] || statusMeta.pending;
                    const isLast = i === steps.length - 1;
                    return (
                      <div key={node.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${meta.dot}`} />
                          {!isLast && <div className={`w-0.5 flex-1 min-h-[36px] ${meta.line}`} />}
                        </div>
                        <div className={`${isLast ? "" : "pb-4"} flex-1`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-text">{node.title}</span>
                            <span className="text-[10px] text-text-muted">{typeLabel(node.type)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[st === "approved" ? "completed" : st === "rejected" ? "rejected" : st === "current" ? "running" : "pending"] || "bg-gray-100 text-gray-600"}`}>
                              {meta.label}
                            </span>
                          </div>
                          {/* 驳回路径指示 */}
                          {(() => {
                            const rt = getRejectTarget(node);
                            if (!rt) return null;
                            const strategy = node.config?.rejectStrategy || "back_to_start";
                            return (
                              <div className="mt-0.5 flex items-center gap-1">
                                <span className="text-[9px] text-red-400/70">↩ 驳回：{rejectStrategyLabel[strategy] || strategy}</span>
                                <span className="text-[9px] px-1 py-0.5 bg-red-50/70 border border-red-200/50 rounded text-red-400">
                                  {rt.targetTitle}
                                </span>
                              </div>
                            );
                          })()}
                          {info && (
                            <>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-text-muted">{info.userName || `用户#${info.userId}`}</span>
                                <span className="text-[10px] text-text-muted">{info.createdAt?.slice(0, 16)}</span>
                              </div>
                              {info.comment && (
                                <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded p-2 text-xs text-text">
                                  {info.comment}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ===== 当前任务信息（如果是从任务进入） ===== */}
          {task.description && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700">{task.description}</p>
            </div>
          )}
        </div>
      )}

      {/* ===== 底部：审批操作区 ===== */}
      {!loading && (
        <div className="border-t border-border pt-4 mt-4 space-y-3">
          {/* 审批意见输入 */}
          <div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="审批意见（选填）—— 输入意见后点击审批按钮"
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary resize-none bg-bg"
            />
          </div>
          {/* 操作按钮 */}
          <div className="flex items-center gap-2 flex-wrap">
            {task.type === "approval" && (
              <>
                <button onClick={() => {
                  if (comment) onComplete("approve", { comment });
                  else onComplete("approve");
                  setComment("");
                }}
                  className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm">
                  <CheckCircle size={16} /> 同意
                </button>
                <button onClick={() => onComplete("reject", { comment })}
                  className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-sm">
                  <XCircle size={16} /> 驳回
                </button>
                <button onClick={() => setActionModal({ action: "return" })}
                  className="px-4 py-2.5 text-xs font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors">
                  打回修改
                </button>
                <button onClick={() => setActionModal({ action: "delegate" })}
                  className="px-4 py-2.5 text-xs font-medium text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors">
                  转签
                </button>
                <button onClick={() => setActionModal({ action: "add-sign" })}
                  className="px-4 py-2.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                  加签
                </button>
              </>
            )}
            {task.type === "revise" && (
              <button onClick={() => onComplete("approve", { comment })}
                className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
                重新提交
              </button>
            )}
            {task.type === "task" && (
              <button onClick={() => onComplete("approve", { comment })}
                className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm">
                完成任务
              </button>
            )}
          </div>
        </div>
      )}

      {/* 操作弹窗（打回/转签/加签） */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setActionModal(null)}>
          <div className="bg-bg-card border border-border rounded-lg w-[400px] p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-text mb-4">
              {actionModal.action === "return" ? "打回修改" : actionModal.action === "delegate" ? "转签给他人" : "加签"}
            </h3>
            {(actionModal.action === "delegate" || actionModal.action === "add-sign") && (
              <div className="mb-3">
                <label className="text-xs text-text-muted block mb-1">目标用户ID</label>
                <input type="number" value={targetId} onChange={e => setTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary"
                  placeholder="输入用户ID" />
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs text-text-muted block mb-1">
                {actionModal.action === "add-sign" ? "加签原因" : "备注"}
              </label>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary h-20 resize-none"
                placeholder={actionModal.action === "add-sign" ? "说明加签原因" : "填写原因或备注（可选）"} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionModal(null)}
                className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg hover:bg-bg transition-colors">取消</button>
              <button onClick={doAction}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90 transition-colors">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 知会通知Tab
function NotificationsTab({ data }: { data: any[] }) {
  const markRead = async (id: number) => {
    try { await authFetch(`/api/workflows-v2/notifications/${id}/read`, { method: "POST" }); } catch {}
  };
  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Bell size={48} className="mx-auto mb-4 opacity-30" />
          <p>暂无知会通知</p>
        </div>
      ) : (
        data.map((n: any) => (
          <div key={n.id} className={`bg-bg-card border rounded-lg p-4 transition-colors ${n.read_at ? "border-border" : "border-amber-200 bg-amber-50/30"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-text">{n.title}</h3>
                <p className="text-xs text-text-muted mt-1">实例: {n.instance_title} · {n.created_at?.slice(0, 19)}</p>
              </div>
              {!n.read_at && (
                <button onClick={() => markRead(n.id)}
                  className="text-[10px] text-blue-600 hover:underline">标为已读</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// 设计中心Tab
function DesignTab({ definitions, onNew, onEdit, onDelete, onStart }: {
  definitions: any[];
  onNew: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onStart: (id: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/5 to-blue-500/5 border border-primary/20 rounded-lg p-5">
        <h3 className="text-sm font-bold text-text mb-1">可视化流程设计器</h3>
        <p className="text-xs text-text-muted mb-3">使用拖拽式编辑器设计审批流程，支持条件分支、多人会签/或签、打回修改、转签加签等全功能</p>
        <button onClick={onNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90 transition-colors">
          <Plus size={14} /> 设计新流程
        </button>
      </div>

      <div>
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">已有流程模板</h4>
        {definitions.length === 0 ? (
          <div className="text-center py-8 text-text-muted bg-bg-card border border-border rounded-lg">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">点击上方按钮创建第一个流程模板</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {definitions.map((def: any) => {
              let nodeCount = 0;
              try { const d = typeof def.definition === "string" ? JSON.parse(def.definition) : def.definition; nodeCount = d?.nodes?.length || 0; } catch {}
              return (
                <div key={def.id} className="bg-bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-sm">{def.icon || "📋"}</div>
                    <div>
                      <h5 className="text-sm font-bold text-text">{def.name}</h5>
                      <p className="text-[10px] text-text-muted">{nodeCount} 个节点 · v{def.version} · {def.status === "active" ? "已启用" : "草稿"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {def.status === "active" && (
                      <button onClick={() => onStart(def.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600">启动</button>
                    )}
                    <button onClick={() => onEdit(def.id)}
                      className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded hover:bg-primary/5">编辑</button>
                    <button onClick={() => onDelete(def.id)}
                      className="p-1.5 text-text-muted hover:text-red-500 rounded hover:bg-bg"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 创建流程定义弹窗
function CreateDefinitionModal({ templates, onSubmit, onClose }: {
  templates: any[];
  onSubmit: (params: { name: string; description: string; definition: any }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [customSteps, setCustomSteps] = useState<{ title: string; type: string }[]>([
    { title: "发起申请", type: "start" },
    { title: "审批", type: "approval" },
    { title: "流程结束", type: "end" },
  ]);

  const handleSubmit = () => {
    if (!name) return alert("请输入流程名称");
    
    let definition;
    if (selectedTemplate !== null) {
      definition = templates[selectedTemplate];
    } else {
      definition = { steps: customSteps.map((s, i) => ({ id: `step${i}`, ...s })) };
    }
    
    onSubmit({ name, description, definition });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-card border border-border rounded-lg w-[600px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-text">新建流程定义</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <XCircle size={16} />
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[60vh] space-y-4">
          <div>
            <label className="text-xs text-text-muted mb-1 block">流程名称 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary"
              placeholder="请输入流程名称" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">描述</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary h-20 resize-none"
              placeholder="请输入流程描述" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-2 block">选择模板或自定义</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {templates.map((tpl, idx) => (
                <button key={idx} onClick={() => setSelectedTemplate(idx)}
                  className={`p-3 border rounded text-left transition-all ${
                    selectedTemplate === idx ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}>
                  <div className="text-xs font-medium text-text">{tpl.name}</div>
                  <div className="text-[10px] text-text-muted mt-1">{tpl.steps.length}步</div>
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedTemplate(null)}
              className={`px-3 py-1 text-xs rounded border transition-all ${
                selectedTemplate === null ? "border-primary bg-primary/5 text-primary" : "border-border text-text-muted hover:text-text"
              }`}>
              自定义流程
            </button>
          </div>
          {selectedTemplate === null && (
            <div>
              <label className="text-xs text-text-muted mb-2 block">自定义步骤</label>
              <div className="space-y-2">
                {customSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted w-6">{idx + 1}.</span>
                    <input type="text" value={step.title} onChange={(e) => {
                      const newSteps = [...customSteps];
                      newSteps[idx].title = e.target.value;
                      setCustomSteps(newSteps);
                    }}
                      className="flex-1 px-3 py-1.5 border border-border rounded text-xs outline-none focus:border-primary" />
                    <select value={step.type} onChange={(e) => {
                      const newSteps = [...customSteps];
                      newSteps[idx].type = e.target.value;
                      setCustomSteps(newSteps);
                    }}
                      className="px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary">
                      <option value="start">开始</option>
                      <option value="approval">审批</option>
                      <option value="task">任务</option>
                      <option value="end">结束</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-xs text-text-muted hover:text-text border border-border rounded hover:bg-bg">
            取消
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 text-xs font-medium text-white bg-primary rounded hover:opacity-90">
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

// 启动流程实例弹窗
function StartInstanceModal({ definition, onSubmit, onClose }: {
  definition: WorkflowDef | undefined;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");

  if (!definition) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-card border border-border rounded-lg w-[400px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-text">启动流程实例</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <XCircle size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-bg rounded p-3">
            <div className="text-xs text-text-muted">流程名称</div>
            <div className="text-sm font-medium text-text">{definition.name}</div>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">实例标题</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded text-sm outline-none focus:border-primary"
              placeholder="请输入实例标题（可选）" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-xs text-text-muted hover:text-text border border-border rounded hover:bg-bg">
            取消
          </button>
          <button onClick={() => onSubmit(title)} className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600">
            <Play size={12} />
            启动
          </button>
        </div>
      </div>
    </div>
  );
}

// 详情弹窗
function DetailModal({ type, data, onClose }: { type: string; data: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-card border border-border rounded-lg w-[500px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-text">
            {type === "definition" ? "流程定义详情" : type === "instance" ? "流程实例详情" : "任务详情"}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <XCircle size={16} />
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[60vh] space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-bg p-2 rounded"><span className="text-text-muted">ID:</span> {data.id}</div>
            <div className="bg-bg p-2 rounded"><span className="text-text-muted">状态:</span> 
              <span className={`ml-1 px-2 py-0.5 rounded ${STATUS_COLORS[data.status] || "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABELS[data.status] || data.status}
              </span>
            </div>
          </div>
          {type === "definition" && (
            <>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">名称:</span> {data.name}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">描述:</span> {data.description || "无"}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">版本:</span> v{data.version}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">定义:</span>
                <pre className="mt-1 text-text text-[10px] whitespace-pre-wrap max-h-40 overflow-auto">{data.definition}</pre>
              </div>
            </>
          )}
          {type === "instance" && (
            <>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">流程:</span> {data.workflow_name}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">标题:</span> {data.title || "无"}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">当前步骤:</span> {data.current_step}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">启动时间:</span> {data.started_at}
              </div>
              {data.completed_at && (
                <div className="bg-bg p-2 rounded text-xs">
                  <span className="text-text-muted">完成时间:</span> {data.completed_at}
                </div>
              )}
            </>
          )}
          {type === "task" && (
            <>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">标题:</span> {data.title}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">描述:</span> {data.description || "无"}
              </div>
              <div className="bg-bg p-2 rounded text-xs">
                <span className="text-text-muted">类型:</span> {data.type === "approval" ? "审批" : "任务"}
              </div>
              {data.result && (
                <div className="bg-bg p-2 rounded text-xs">
                  <span className="text-text-muted">结果:</span> 
                  <span className={`ml-1 font-bold ${data.result === "approve" ? "text-green-500" : "text-red-500"}`}>
                    {data.result === "approve" ? "通过" : "拒绝"}
                  </span>
                </div>
              )}
              {data.comment && (
                <div className="bg-bg p-2 rounded text-xs">
                  <span className="text-text-muted">备注:</span> {data.comment}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
