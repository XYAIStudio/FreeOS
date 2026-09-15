import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import Avatar from "../components/Avatar";
import { PRESET_AVATARS } from "../utils/avatar";
import { useLocale } from "../i18n";
import {
  ArrowLeft, MessageSquare, Edit2, Save, X, UserPlus, Building2,
  Network, Award, BarChart3, BookOpen, Plus, Check, Trash2, Camera, Image, UserX, AlertTriangle
} from "lucide-react";

interface Employee {
  id: number; name: string; role: string; description?: string;
  agent_type: string; employee_type: string; avatar_emoji: string;
  skills: string; department_id: number; status: string;
  position_level_id?: number; position_sequence?: string;
  is_online?: boolean; pid?: string; avatar_url?: string;
  user_id?: number;
}

interface Department {
  id: number; name: string; parent_id: number | null;
  employees: Employee[]; children?: Department[];
}

interface ReportingLine {
  id: number; employee_id: number; manager_id: number;
  line_type: string; manager_name: string; manager_role: string;
}

interface Skill {
  id: number; name: string; category: string; icon: string;
}

interface PerformanceData {
  scores: { task_completion: number; quality: number; efficiency: number; collaboration: number; overall: number };
  task_stats: { total: number; completed: number; in_progress: number; todo: number; completion_rate: number };
  chat_stats: { chat_count: number; message_count: number };
  skill_count: number;
  reflection_count: number;
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const { t } = useLocale();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [reportingLines, setReportingLines] = useState<ReportingLine[]>([]);
  const [employeeSkills, setEmployeeSkills] = useState<Skill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [offboarding, setOffboarding] = useState(false);
  const [offboardPreview, setOffboardPreview] = useState<{ holding_count: number; holding_value: number } | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<number>>(new Set());
  const [skillCategory, setSkillCategory] = useState("all");

  // 权限判断：管理员 或 本人（employee.user_id 匹配当前用户）
  const isOwnProfile = !!(user && employee && employee.user_id === user.id);
  const canEdit = isAdmin || isOwnProfile;

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState(0);
  const [departments, setDepartments] = useState<{ id: number; name: string; level: number }[]>([]);

  // 形象照上传状态
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (file: File) => {
    if (!id) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await authFetch(`/api/org/employees/${id}/avatar`, { method: "POST", body: form });
      const data = await r.json();
      if (data.success) {
        setAvatarPreview(data.data.avatar_url);
        fetchData();
      }
    } catch {}
    setAvatarUploading(false);
  };

  const handleSelectPreset = async (avatarPath: string) => {
    if (!id) return;
    setAvatarUploading(true);
    try {
      const r = await authFetch(`/api/org/employees/${id}/avatar-preset`, {
        method: "POST",
        body: JSON.stringify({ avatar_url: avatarPath }),
      });
      const data = await r.json();
      if (data.success) {
        setAvatarPreview(data.data.avatar_url);
        setShowAvatarGallery(false);
        fetchData();
      }
    } catch {}
    setAvatarUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarUpload(file);
  };

  const emojiOptions = ["👔", "💻", "📊", "🎯", "📢", "👥", "🎨", "⚙️", "🔍", "📚", "💼", "💡", "📎", "💰", "✅", "🚀", "📋", "🤝", "🔧", "🔐", "🗄️", "📈", "🏗️", "🔭", "💳", "🤖", "👤", "🛡️", "📞", "🔗", "🔄", "🛠️"];

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch employee from tree
      const treeRes = await authFetch("/api/org/tree").then(r => r.json());
      if (treeRes.success) {
        let found: Employee | null = null;
        let dept: Department | null = null;
        const findEmp = (depts: Department[]) => {
          for (const d of depts) {
            const emp = d.employees.find((e: Employee) => e.id === Number(id));
            if (emp) { found = emp; dept = d; return; }
            if (d.children) findEmp(d.children);
          }
        };
        findEmp(treeRes.data || []);
        if (found) {
          const emp = found as Employee;
          setEmployee(emp);
          setDepartment(dept);
          setEditName(emp.name);
          setEditRole(emp.role || "");
          setEditDescription(emp.description || "");
          setEditAvatar(emp.avatar_emoji || "");
          setEditDepartmentId(emp.department_id);
        }

        // Flatten departments for edit form
        const flatDepts: { id: number; name: string; level: number }[] = [];
        const flatten = (depts: Department[], level: number) => {
          for (const d of depts) {
            flatDepts.push({ id: d.id, name: d.name, level });
            if (d.children) flatten(d.children, level + 1);
          }
        };
        flatten(treeRes.data || [], 0);
        setDepartments(flatDepts);
      }

      // Fetch reporting lines
      const rlRes = await authFetch(`/api/org/employees/${id}/reporting-lines`).then(r => r.json());
      if (rlRes.success) setReportingLines(rlRes.data || []);

      // Fetch employee skills
      const skRes = await authFetch(`/api/org/employees/${id}/skills`).then(r => r.json());
      if (skRes.success) {
        setEmployeeSkills(skRes.data || []);
        setSelectedSkillIds(new Set((skRes.data || []).map((s: any) => s.skill_id)));
      }

      // Fetch all skills
      const allSkRes = await authFetch("/api/skills").then(r => r.json());
      if (allSkRes.success) setAllSkills(allSkRes.data || []);

      // Fetch performance data
      const perfRes = await authFetch(`/api/performance/employee/${id}/summary`).then(r => r.json());
      if (perfRes.success) setPerformance(perfRes.data);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!id || !editName.trim()) return;
    setSaving(true);
    await authFetch(`/api/org/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editName, role: editRole, description: editDescription,
        avatar_emoji: editAvatar, department_id: editDepartmentId,
      }),
    });
    setSaving(false);
    setEditing(false);
    fetchData();
  };

  const handleSaveSkills = async () => {
    if (!id) return;
    await authFetch(`/api/org/employees/${id}/skills`, {
      method: "POST",
      body: JSON.stringify({ skill_ids: Array.from(selectedSkillIds) }),
    });
    setShowSkillPicker(false);
    fetchData();
  };

  // 离职清算
  const handleOffboardPreview = async () => {
    if (!id) return;
    const r = await authFetch(`/api/employees/${id}/offboard-preview`);
    const d = await r.json();
    if (d.success) setOffboardPreview(d.data);
    setOffboarding(true);
  };

  const handleOffboardConfirm = async () => {
    if (!id) return;
    const r = await authFetch(`/api/employees/${id}/offboard`, { method: "POST" });
    const d = await r.json();
    if (d.success) {
      alert(d.data.message);
      navigate("/org");
    } else {
      alert(d.error || t("操作失败", "Operation failed"));
    }
    setOffboarding(false);
    setOffboardPreview(null);
  };

  const categories = ["all", ...new Set(allSkills.map(s => s.category))];
  const filteredSkills = skillCategory === "all" ? allSkills : allSkills.filter(s => s.category === skillCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted">{t("加载中...", "Loading...")}</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-text-muted">{t("未找到员工信息", "Employee not found")}</p>
        <button onClick={() => navigate("/org")} className="px-4 py-2 bg-primary text-white rounded-lg">{t("返回组织架构", "Back to organization")}</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <ArrowLeft size={16} />
          </button>
          <Avatar id={employee.id} name={employee.name} size={56} className="rounded-xl" customSrc={employee.avatar_url || undefined} />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{employee.name}</h1>
            <p className="text-blue-100 text-sm">{employee.role || t("未设置职位", "No role set")} · {department?.name || ""}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${employee.is_online ? "bg-green-400" : "bg-gray-300"}`} />
              <span className="text-xs text-blue-100">{employee.is_online ? t("在线", "Online") : t("离线", "Offline")}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${employee.employee_type === "ai" ? "bg-green-400/20 text-green-100" : "bg-white/20 text-white"}`}>
                {employee.employee_type === "ai" ? t("AI员工", "AI employee") : t("人类员工", "Human employee")}
              </span>
              {employee.position_sequence && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-400/20 text-purple-100">{employee.position_sequence}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-white/20 text-white text-sm rounded-lg hover:bg-white/30">{t("编辑", "Edit")}</button>
            )}
            {isAdmin && employee.status === "active" && (
              <button onClick={handleOffboardPreview} className="flex items-center gap-1.5 px-4 py-2 bg-red-500/30 text-white text-sm rounded-lg hover:bg-red-500/50 font-medium">
                <UserX size={14} /> {t("离职清算", "Offboard")}
              </button>
            )}
            <button onClick={async () => {
              const r = await authFetch("/api/chats", {
                method: "POST",
                body: JSON.stringify({ title: t("与" + employee.name + "的对话", "Chat with " + employee.name), type: "single", employee_ids: [employee.id] }),
              });
              const d = await r.json();
              if (d.success) navigate(`/chat?open=${d.data.id}`);
            }} className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-600 text-sm rounded-lg hover:bg-blue-50 font-medium">
              <MessageSquare size={14} /> {t("发起聊天", "Start chat")}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2"><Building2 size={16} /> {t("基本信息", "Basic information")}</h3>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">{t("姓名", "Name")}</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">{t("岗位", "Role")}</label>
                    <input value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">{t("所属部门", "Department")}</label>
                    <select value={editDepartmentId} onChange={e => setEditDepartmentId(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary">
                      {departments.map(d => <option key={d.id} value={d.id}>{"　".repeat(d.level)}{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">{t("形象照", "Profile image")}</label>
                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-bg/50">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title={t("点击上传形象照", "Click to upload a profile image")}>
                        <Avatar
                          id={employee?.id}
                          name={employee?.name}
                          size={56}
                          className="rounded-lg"
                          customSrc={avatarPreview || employee?.avatar_url || undefined}
                        />
                        <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={16} className="text-white" />
                        </div>
                        {avatarUploading && (
                          <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-secondary">
                          {employee?.avatar_url ? t("已上传形象照，点击可更换", "Profile image uploaded. Click to replace.") : t("点击上传个人形象照", "Click to upload a profile image")}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">{t("支持 PNG / JPG / WebP / GIF / SVG，建议 1:1 方形", "PNG / JPG / WebP / GIF / SVG supported. A square 1:1 image is recommended.")}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAvatarGallery(true); }}
                        className="shrink-0 px-2.5 py-1.5 text-[11px] text-primary border border-primary/30 rounded-md hover:bg-primary/5 flex items-center gap-1"
                      >
                        <Image size={12} /> {t("备选头像", "Preset avatars")}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-text-muted hover:bg-bg rounded-lg">{t("取消", "Cancel")}</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50">{saving ? t("保存中...", "Saving...") : t("保存", "Save")}</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-text-muted">{t("姓名", "Name")}</span><span className="text-text font-medium">{employee.name}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">{t("岗位", "Role")}</span><span className="text-text">{employee.role || t("未设置", "Not set")}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">{t("部门", "Department")}</span><span className="text-text">{department?.name || t("未分配", "Unassigned")}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">{t("类型", "Type")}</span><span className="text-text">{employee.employee_type === "ai" ? t("AI员工", "AI employee") : t("人类员工", "Human employee")}</span></div>
                  {employee.agent_type && <div className="flex justify-between"><span className="text-text-muted">{t("AI角色", "AI role")}</span><span className="text-text">{employee.agent_type}</span></div>}
                  {employee.pid && <div className="flex justify-between"><span className="text-text-muted">PID</span><span className="text-text font-mono">{employee.pid}</span></div>}
                  {/* 形象照 — 查看模式下管理员或本人可更改 */}
                  {canEdit && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-3">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title={t("点击上传形象照", "Click to upload a profile image")}>
                          <Avatar
                            id={employee.id}
                            name={employee.name}
                            size={48}
                            className="rounded-lg"
                            customSrc={avatarPreview || employee.avatar_url || undefined}
                          />
                          <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={14} className="text-white" />
                          </div>
                          {avatarUploading && (
                            <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">{employee.avatar_url ? t("已上传形象照 · 点击更换", "Profile image uploaded · click to replace") : t("点击上传形象照", "Click to upload a profile image")}</p>
                          <p className="text-[10px] text-text-muted">{t("PNG / JPG / WebP / GIF，建议 1:1", "PNG / JPG / WebP / GIF · 1:1 recommended")}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowAvatarGallery(true); }}
                          className="shrink-0 px-2.5 py-1.5 text-[11px] text-primary border border-primary/30 rounded-md hover:bg-primary/5 flex items-center gap-1"
                        >
                          <Image size={12} /> {t("备选头像", "Preset avatars")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Job Description Card */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2"><BookOpen size={16} /> {t("岗位职责", "Responsibilities")}</h3>
              {editing ? (
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={6}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary resize-none" />
              ) : (
                <p className="text-sm text-text-secondary leading-relaxed">{employee.description || t("暂未设置岗位职责描述", "No responsibilities have been set")}</p>
              )}
            </div>

            {/* Skills Card */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2"><Award size={16} /> {t("技能配备", "Skills")}</h3>
                {isAdmin && (
                  <button onClick={() => setShowSkillPicker(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus size={12} /> {t("管理技能", "Manage skills")}
                  </button>
                )}
              </div>
              {employeeSkills.length === 0 ? (
                <p className="text-sm text-text-muted">{t("暂未配备技能", "No skills assigned")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {employeeSkills.map(skill => (
                    <span key={skill.id} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {skill.icon || "🛠️"} {skill.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Reporting Lines Card */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2"><Network size={16} /> {t("汇报关系", "Reporting relationships")}</h3>
              {reportingLines.length === 0 ? (
                <p className="text-sm text-text-muted">{t("暂无汇报关系", "No reporting relationships")}</p>
              ) : (
                <div className="space-y-2">
                  {reportingLines.map(line => (
                    <div key={line.id} className="flex items-center justify-between px-3 py-2 bg-bg rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${line.line_type === "solid" ? "bg-blue-500" : "bg-amber-400"}`} />
                        <span className="text-sm text-text">{line.manager_name}</span>
                        <span className="text-[10px] text-text-muted">{line.manager_role}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-bg-card border border-border">{line.line_type === "solid" ? t("实线", "Solid line") : t("虚线", "Dotted line")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Card */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2"><BarChart3 size={16} /> {t("绩效概览", "Performance overview")}</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t("任务完成", "Task completion"), value: performance?.scores?.task_completion ?? "-", suffix: "%", icon: "✅" },
                  { label: t("质量评分", "Quality score"), value: performance?.scores?.quality ?? "-", suffix: "", icon: "⭐" },
                  { label: t("执行效率", "Execution efficiency"), value: performance?.scores?.efficiency ?? "-", suffix: "%", icon: "⚡" },
                  { label: t("协作评分", "Collaboration score"), value: performance?.scores?.collaboration ?? "-", suffix: "", icon: "🤝" },
                ].map((item, i) => (
                  <div key={i} className="bg-bg rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">{item.icon}</div>
                    <div className="text-sm font-bold text-text">{typeof item.value === 'number' ? `${item.value}${item.suffix}` : item.value}</div>
                    <div className="text-[10px] text-text-muted">{item.label}</div>
                  </div>
                ))}
              </div>
              {performance?.scores?.overall != null && (
                <div className="mt-3 p-3 bg-bg rounded-lg text-center">
                  <div className="text-xs text-text-muted mb-1">{t("综合评分", "Overall score")}</div>
                  <div className={`text-2xl font-bold ${performance.scores.overall >= 80 ? 'text-success' : performance.scores.overall >= 60 ? 'text-warning' : 'text-danger'}`}>
                    {performance.scores.overall}
                  </div>
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-bg rounded-lg p-2">
                  <div className="text-sm font-bold text-text">{performance?.task_stats?.total ?? 0}</div>
                  <div className="text-[10px] text-text-muted">{t("总任务", "Total tasks")}</div>
                </div>
                <div className="bg-bg rounded-lg p-2">
                  <div className="text-sm font-bold text-success">{performance?.task_stats?.completed ?? 0}</div>
                  <div className="text-[10px] text-text-muted">{t("已完成", "Completed")}</div>
                </div>
                <div className="bg-bg rounded-lg p-2">
                  <div className="text-sm font-bold text-primary">{performance?.task_stats?.in_progress ?? 0}</div>
                  <div className="text-[10px] text-text-muted">{t("进行中", "In progress")}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="bg-bg rounded-lg p-2">
                  <div className="text-sm font-bold text-text">{performance?.chat_stats?.chat_count ?? 0}</div>
                  <div className="text-[10px] text-text-muted">{t("参与会话", "Chats")}</div>
                </div>
                <div className="bg-bg rounded-lg p-2">
                  <div className="text-sm font-bold text-text">{performance?.skill_count ?? 0}</div>
                  <div className="text-[10px] text-text-muted">{t("掌握技能", "Skills")}</div>
                </div>
                <div className="bg-bg rounded-lg p-2">
                  <div className="text-sm font-bold text-text">{performance?.reflection_count ?? 0}</div>
                  <div className="text-[10px] text-text-muted">{t("反思记录", "Reflections")}</div>
                </div>
              </div>
            </div>

            {/* Skills Tags Card */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text mb-4">{t("岗位职责标签", "Responsibility tags")}</h3>
              {employee.skills ? (
                <div className="flex flex-wrap gap-1.5">
                  {employee.skills.split(",").map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs">{s.trim()}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t("暂无标签", "No tags")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Skill Picker Modal */}
      {showSkillPicker && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowSkillPicker(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-2xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col z-50">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold text-text">{t("技能配备", "Skills")}</h3>
              <button onClick={() => setShowSkillPicker(false)} className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-text-muted hover:text-text"><X size={16} /></button>
            </div>
            <div className="px-5 py-3 border-b border-border">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {categories.map(c => (
                  <button key={c} onClick={() => setSkillCategory(c)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${skillCategory === c ? "bg-primary text-white border-primary" : "bg-bg-card text-text-muted border-border hover:border-primary"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-wrap gap-2">
                {filteredSkills.map(skill => {
                  const isSelected = selectedSkillIds.has(skill.id);
                  return (
                    <button key={skill.id} onClick={() => {
                      setSelectedSkillIds(prev => { const next = new Set(prev); if (next.has(skill.id)) next.delete(skill.id); else next.add(skill.id); return next; });
                    }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isSelected ? "bg-primary text-white border-primary" : "bg-bg-card text-text-secondary border-border hover:border-primary"}`}>
                      {isSelected && <Check size={10} className="inline mr-1" />}
                      {skill.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-text-muted">{t("已选 ", "Selected ") + selectedSkillIds.size + t(" 项", "")}</span>
              <div className="flex gap-2">
                <button onClick={() => setShowSkillPicker(false)} className="px-4 py-2 text-sm text-text-muted hover:bg-bg rounded-lg">{t("取消", "Cancel")}</button>
                <button onClick={handleSaveSkills} className="px-5 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90">{t("确认配备", "Confirm assignment")}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 系统备选头像图集 */}
      {showAvatarGallery && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowAvatarGallery(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-2xl shadow-2xl w-[420px] max-h-[80vh] flex flex-col z-50">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Image size={16} className="text-primary" /> {t("选择备选头像", "Choose a preset avatar")}
              </h3>
              <button onClick={() => setShowAvatarGallery(false)} className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-text-muted hover:text-text">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-4">
                {PRESET_AVATARS.map((avatarPath, idx) => {
                  const isSelected = avatarPreview === avatarPath || employee?.avatar_url === avatarPath;
                  const num = String(idx + 1).padStart(2, "0");
                  const label = t("头像 ", "Avatar ") + num;
                  return (
                    <button
                      key={avatarPath}
                      onClick={() => handleSelectPreset(avatarPath)}
                      disabled={avatarUploading}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all p-1 ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50 hover:shadow-md"
                      }`}
                    >
                      <img
                        src={avatarPath}
                        alt={t("备选头像 ", "Preset avatar ") + label}
                        className="w-full aspect-square object-cover rounded-lg"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <div className="text-[10px] text-text-muted text-center mt-1.5">{label}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-text-muted text-center mt-4">{t("点击头像即可应用，也可通过上传自定义形象照", "Click an avatar to apply it, or upload a custom profile image.")}</p>
            </div>
          </div>
        </>
      )}

      {/* 离职清算确认弹窗 */}
      {offboarding && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => { setOffboarding(false); setOffboardPreview(null); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-2xl shadow-2xl w-[440px] z-50">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">{t("确认离职清算", "Confirm offboarding")}</h3>
                <p className="text-xs text-text-muted">{t("此操作不可撤销", "This action cannot be undone")}</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-text">
                {t("即将为 ", "You are about to offboard ")}<span className="font-medium">{employee?.name}</span>{t(" 办理离职清算：", ".")}
              </p>
              {offboardPreview ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">{t("持有资产", "Assets held")}</span>
                    <span className="text-red-600 font-medium">{offboardPreview.holding_count} {t("项", "items")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">{t("资产总值", "Total asset value")}</span>
                    <span className="text-red-600 font-medium">¥{offboardPreview.holding_value.toLocaleString()}</span>
                  </div>
                  {offboardPreview.holding_count > 0 && (
                    <p className="text-xs text-red-500 mt-1">{t("所有持有资产将自动归还入库", "All held assets will be returned to inventory automatically")}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t("正在查询持有资产...", "Checking held assets...")}</p>
              )}
              <p className="text-xs text-text-muted">{t("员工状态将被标记为“已离职”，部门信息将被清除。", "The employee will be marked as offboarded and their department assignment will be cleared.")}</p>
            </div>
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-border">
              <button onClick={() => { setOffboarding(false); setOffboardPreview(null); }} className="px-4 py-2 text-sm text-text-muted hover:bg-bg rounded-lg">{t("取消", "Cancel")}</button>
              <button onClick={handleOffboardConfirm} className="px-5 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 font-medium">{t("确认离职清算", "Confirm offboarding")}</button>
            </div>
          </div>
        </>
      )}

      {/* 共享隐藏文件上传 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
        disabled={avatarUploading}
      />
    </div>
  );
}
