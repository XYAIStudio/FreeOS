import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Network, Plus, X, Edit2, Trash2, UserPlus, Building2, MapPin, Search,
  MessageSquare, Bot, Download, Upload, ArrowRight, ArrowDown,
  FileImage, FileText, ZoomIn, ZoomOut, Maximize2, History, Check
} from "lucide-react";
import { authFetch } from "../api/authFetch";
import { useAuthStore } from "../stores/auth";
import Avatar from "../components/Avatar";
import { toPng, toSvg } from "html-to-image";
import jsPDF from "jspdf";
import { useLocale } from "../i18n";

interface Employee {
  id: number; name: string; role: string; description?: string; agent_type: string; employee_type: string;
  avatar_emoji: string; avatar_url?: string; skills: string; department_id: number; status: string;
  position_level_id?: number; position_sequence?: string;
  is_online?: boolean;
}

interface Department {
  id: number; name: string; parent_id: number | null; sort_order: number;
  description?: string; headcount?: number;
  department_code?: string; cost_center?: string; budget_allocation?: number;
  function_type?: string; level?: number;
  org_type?: string; region?: string; branch_level?: number; secondary_parent_id?: number;
  children: Department[]; employees: Employee[];
}

interface LayoutNode {
  x: number; y: number; width: number; height: number;
  data: Department; level: number;
  childNodes: LayoutNode[];
}

type Direction = "horizontal" | "vertical";

const LEVEL_COLORS = [
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L1" },
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L2" },
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L3" },
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L4" },
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L5" },
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L6" },
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L7" },
  { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "L8" },
];

const ORG_TYPE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }[]> = {
  functional: LEVEL_COLORS,
  regional: [
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "区域" },
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "区域" },
  ],
  branch: [
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "分支" },
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "分支" },
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "分支" },
  ],
  project: [
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "项目" },
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "项目" },
  ],
  site_lab: [
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "试验室" },
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "试验室" },
  ],
  dispatched: [
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "外派" },
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "外派" },
    { bg: "#FFFFFF", border: "#E5E7EB", text: "#1F2937", label: "外派" },
  ],
};

const CARD_W = 220;
const CARD_H_BASE = 80;
const EMP_LINE_H = 20;
const MAX_SHOW = 12;
const EMP_CARD_W = 0;
const EMP_CARD_H = 0;
const H_GAP = 50;
const V_GAP = 50;

function getCardHeight(dept: Department): number {
  const showCount = Math.min(dept.employees.length, MAX_SHOW);
  return CARD_H_BASE + showCount * EMP_LINE_H + (dept.employees.length > MAX_SHOW ? 16 : 0);
}

export default function OrgChart() {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [tree, setTree] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [showAddDept, setShowAddDept] = useState<{ parentId: number | null } | null>(null);
  const [showAddEmp, setShowAddEmp] = useState<{ departmentId: number } | null>(null);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [reportingLineEmp, setReportingLineEmp] = useState<Employee | null>(null);
  const [direction, setDirection] = useState<Direction>("horizontal");
  const [zoom, setZoom] = useState(1);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const fetchTree = useCallback(async () => {
    setLoading(true);
    const r = await authFetch("/api/org/tree");
    const d = await r.json();
    if (d.success) {
      const data = d.data || [];
      setTree(data);
      // Auto-collapse depth >= 3 (regionals / deep HQ centers → branches hidden)
      const s = new Set<number>();
      function walk(depts: Department[], level: number) {
        for (const dept of depts) {
          if (level >= 3 && dept.children && dept.children.length > 0) s.add(dept.id);
          if (dept.children) walk(dept.children, level + 1);
        }
      }
      walk(data, 0);
      setCollapsedNodes(s);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const toggleCollapse = useCallback((id: number) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);


  const startChat = async (emp: Employee) => {
    const r = await authFetch("/api/chats", {
      method: "POST",
      body: JSON.stringify({ title: t("与", "Chat with ") + emp.name + t("的对话", ""), type: "single", employee_ids: [emp.id] }),
    });
    const d = await r.json();
    if (d.success) { setSelectedEmp(null); navigate(`/chat?open=${d.data.id}`); }
  };

  const countEmployees = (dept: Department): number =>
    dept.employees.length + dept.children.reduce((a, c) => a + countEmployees(c), 0);
  const totalEmployees = tree.reduce((a, d) => a + countEmployees(d), 0);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await authFetch("/api/org/import", { method: "POST", body: formData });
      const d = await r.json();
      if (d.success) {
        alert(t("导入成功！解析到 ", "Import succeeded: ") + (d.dept_count || 0) + t(" 个部门，", " departments and ") + (d.emp_count || 0) + t(" 名员工", " employees"));
        fetchTree();
      } else {
        alert(t("导入失败: ", "Import failed: ") + (d.error || t("未知错误", "Unknown error")));
      }
    } catch (err: any) {
      alert(t("导入出错: ", "Import error: ") + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async (format: "png" | "svg" | "pdf") => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const el = chartRef.current;
      if (format === "png") {
        const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#F9FAFB" });
        downloadDataUrl(dataUrl, "org-chart.png");
      } else if (format === "svg") {
        const dataUrl = await toSvg(el, { backgroundColor: "#F9FAFB" });
        downloadDataUrl(dataUrl, "org-chart.svg");
      } else if (format === "pdf") {
        const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#F9FAFB" });
        const img = new Image();
        img.src = dataUrl;
        await new Promise((res) => { img.onload = res; });
        const pdf = new jsPDF({
          orientation: img.width > img.height ? "landscape" : "portrait",
          unit: "px",
          format: [img.width / 2, img.height / 2],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, img.width / 2, img.height / 2);
        pdf.save("org-chart.pdf");
      }
    } catch (err: any) {
      alert(t("导出失败: ", "Export failed: ") + err.message);
    } finally {
      setExporting(false);
    }
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <Network size={20} className="animate-spin mr-2" />{t("加载组织架构...", "Loading organization chart...")}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-3">
          <Network size={20} className="text-primary" />
          <h2 className="text-base font-bold text-text">{t("组织架构图", "Organization chart")}</h2>
          <span className="text-[11px] text-text-muted px-2.5 py-1 rounded bg-bg">
            {totalEmployees} {t("名员工", "employees")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder={t("搜索人员...", "Search people...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-bg focus:outline-none focus:border-primary w-40"
            />
          </div>

          {/* Direction toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setDirection("horizontal")}
              className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                direction === "horizontal"
                  ? "bg-primary text-white"
                  : "bg-bg text-text-muted hover:text-text"
              }`}
              title={t("横向布局", "Horizontal layout")}
            >
              <ArrowRight size={12} /> {t("横向", "Horizontal")}
            </button>
            <button
              onClick={() => setDirection("vertical")}
              className={`px-2 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                direction === "vertical"
                  ? "bg-primary text-white"
                  : "bg-bg text-text-muted hover:text-text"
              }`}
              title={t("纵向布局", "Vertical layout")}
            >
              <ArrowDown size={12} /> {t("纵向", "Vertical")}
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
              className="px-2 py-1.5 bg-bg text-text-muted hover:text-text"
            >
              <ZoomOut size={12} />
            </button>
            <span className="px-2 text-[10px] text-text-muted bg-bg">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="px-2 py-1.5 bg-bg text-text-muted hover:text-text"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1.5 bg-bg text-text-muted hover:text-text"
              title={t("重置缩放", "Reset zoom")}
            >
              <Maximize2 size={12} />
            </button>
          </div>

          {/* Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xmind,.vsdx,.json"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1 px-3 py-1.5 bg-bg border border-border text-text-muted text-xs rounded-lg hover:text-text hover:border-primary disabled:opacity-50"
          >
            <Upload size={12} />
            {importing ? t("导入中...", "Importing...") : t("导入", "Import")}
          </button>

          {/* Export */}
          <div className="relative group">
            <button
              disabled={exporting}
              className="flex items-center gap-1 px-3 py-1.5 bg-bg border border-border text-text-muted text-xs rounded-lg hover:text-text hover:border-primary disabled:opacity-50"
            >
              <Download size={12} />
              {exporting ? t("导出中...", "Exporting...") : t("导出", "Export")}
            </button>
            <div className="absolute right-0 top-full mt-1 bg-bg-card border border-border rounded-lg shadow-lg py-1 w-32 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
              <button
                onClick={() => handleExport("png")}
                className="w-full px-3 py-2 text-xs text-text hover:bg-bg flex items-center gap-2"
              >
                <FileImage size={12} /> {t("导出 PNG", "Export PNG")}
              </button>
              <button
                onClick={() => handleExport("svg")}
                className="w-full px-3 py-2 text-xs text-text hover:bg-bg flex items-center gap-2"
              >
                <FileImage size={12} /> {t("导出 SVG", "Export SVG")}
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="w-full px-3 py-2 text-xs text-text hover:bg-bg flex items-center gap-2"
              >
                <FileText size={12} /> {t("导出 PDF", "Export PDF")}
              </button>
            </div>
          </div>

          {isAdmin && (
            <>
              <button
                onClick={() => setShowVersionManager(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-bg border border-border text-text-muted text-xs rounded-md hover:text-text hover:border-primary"
              >
                <History size={12} /> {t("版本管理", "Version management")}
              </button>
              <button
                onClick={() => setShowAddDept({ parentId: null })}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs rounded-md hover:opacity-90"
              >
                <Plus size={12} /> {t("新增部门", "Add department")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-50 p-6">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          <OrgTreeRenderer
            tree={tree}
            direction={direction}
            searchQuery={searchQuery}
            onSelectEmp={setSelectedEmp}
            onEditDept={setEditDept}
            onAddDept={setShowAddDept}
            onAddEmp={setShowAddEmp}
            isAdmin={isAdmin}
            chartRef={chartRef}
            onNavigate={navigate}
            collapsedNodes={collapsedNodes}
            onToggleCollapse={toggleCollapse}
          />
        </div>
      </div>

      {/* Modals */}
      {selectedEmp && (
        <EmpDetailModal
          emp={selectedEmp}
          onClose={() => setSelectedEmp(null)}
          onStartChat={startChat}
          onSaved={fetchTree}
          departments={tree}
          onReportingLine={setReportingLineEmp}
        />
      )}
      {editDept && (
        <DeptEditModal
          dept={editDept}
          onClose={() => setEditDept(null)}
          onSaved={fetchTree}
        />
      )}
      {showAddDept && (
        <AddDeptModal
          parentId={showAddDept.parentId}
          onClose={() => setShowAddDept(null)}
          onSaved={fetchTree}
        />
      )}
      {showAddEmp && (
        <AddEmpModal
          departmentId={showAddEmp.departmentId}
          onClose={() => setShowAddEmp(null)}
          onSaved={fetchTree}
        />
      )}
      {showVersionManager && (
        <VersionManagerModal
          onClose={() => setShowVersionManager(false)}
          onSaved={fetchTree}
        />
      )}
      {reportingLineEmp && (
        <ReportingLineModal
          employee={reportingLineEmp}
          allEmployees={tree.flatMap(d => getEmployeesFlat(d))}
          onClose={() => setReportingLineEmp(null)}
          onSaved={fetchTree}
        />
      )}
    </div>
  );
}

function getEmployeesFlat(dept: Department): Employee[] {
  return [...dept.employees, ...dept.children.flatMap(d => getEmployeesFlat(d))];
}

function OrgTreeRenderer({
  tree,
  direction,
  searchQuery,
  onSelectEmp,
  onEditDept,
  onAddDept,
  onAddEmp,
  isAdmin,
  chartRef,
  onNavigate,
  collapsedNodes,
  onToggleCollapse,
}: {
  tree: Department[];
  direction: Direction;
  searchQuery: string;
  onSelectEmp: (e: Employee) => void;
  onEditDept: (d: Department) => void;
  onAddDept: (d: { parentId: number | null }) => void;
  onAddEmp: (d: { departmentId: number }) => void;
  isAdmin: boolean;
  chartRef: React.RefObject<HTMLDivElement | null>;
  onNavigate: (path: string) => void;
  collapsedNodes: Set<number>;
  onToggleCollapse: (id: number) => void;
}) {
  const { t } = useLocale();
  const isH = direction === "horizontal";

  function getCardHeight(dept: Department): number {
    const baseH = 52;
    const empCount = Math.min(dept.employees.length, 6);
    const empH = empCount > 0 ? 14 + empCount * 13 : 0;
    return baseH + empH;
  }

  // Compute layout
  const layoutNodes: LayoutNode[] = [];
  let nextX = 0;

  function measure(dept: Department, level: number): LayoutNode {
    const hasEmps = dept.employees.length > 0;
    const isCollapsed = collapsedNodes.has(dept.id);
    const hasVisibleChildren = dept.children.length > 0 && !isCollapsed;
    const cardH = getCardHeight(dept);

    if (!hasVisibleChildren && !hasEmps) {
      return { x: 0, y: 0, width: CARD_W, height: cardH, data: dept, level, childNodes: [] };
    }

    const childLayoutNodes = hasVisibleChildren
      ? dept.children.map((c) => measure(c, level + 1))
      : [];

    const node: LayoutNode = { x: 0, y: 0, width: 0, height: 0, data: dept, level, childNodes: childLayoutNodes };

    if (isH) {
      const childrenH = childLayoutNodes.reduce((a, c) => a + c.height, 0) + Math.max(0, childLayoutNodes.length - 1) * V_GAP;
      const subtreeH = Math.max(cardH, childrenH);
      let cy = 0;
      for (const child of childLayoutNodes) { child.y = cy; cy += child.height + V_GAP; }
      const totalChildH = cy - V_GAP;
      const offsetY = (subtreeH - totalChildH) / 2;
      for (const child of childLayoutNodes) { child.y += offsetY; }
      const childrenW = childLayoutNodes.reduce((a, c) => Math.max(a, c.width), 0);
      node.width = CARD_W + (childLayoutNodes.length > 0 ? H_GAP + childrenW : 0);
      node.height = subtreeH;
      return node;
    } else {
      const childrenW = childLayoutNodes.reduce((a, c) => a + c.width, 0) + Math.max(0, childLayoutNodes.length - 1) * H_GAP;
      const subtreeW = Math.max(CARD_W, childrenW);
      let cx = 0;
      for (const child of childLayoutNodes) { child.x = cx; cx += child.width + H_GAP; }
      const totalChildW = cx - H_GAP;
      const offsetX = (subtreeW - totalChildW) / 2;
      for (const child of childLayoutNodes) { child.x += offsetX; }
      const childrenH = childLayoutNodes.reduce((a, c) => Math.max(a, c.height), 0);
      node.width = subtreeW;
      node.height = cardH + (childLayoutNodes.length > 0 ? V_GAP + childrenH : 0);
      return node;
    }
  }

  // Second pass: assign absolute positions
  function assignPositions(
    node: LayoutNode,
    offsetX: number,
    offsetY: number,
    level: number
  ) {
    node.x = offsetX;
    node.y = offsetY;
    node.level = level;

    const isH = direction === "horizontal";
    const childNodes = node.childNodes;

    if (isH) {
      const childStartX = offsetX + CARD_W + H_GAP;
      for (const child of childNodes) {
        assignPositions(child, childStartX, offsetY + child.y, level + 1);
      }
    } else {
      const cardH = getCardHeight(node.data);
      const childStartY = offsetY + cardH + V_GAP;
      for (const child of childNodes) {
        assignPositions(child, offsetX + child.x, childStartY, level + 1);
      }
    }
  }

  // Build flat render list
  const allNodes: LayoutNode[] = [];
  const allEmps: { x: number; y: number; emp: Employee; deptId: number }[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  function collect(node: LayoutNode) {
    allNodes.push(node);

    // Skip collecting children if this node is collapsed
    if (collapsedNodes.has(node.data.id)) return;

    for (const child of node.childNodes) {
      if (isHorizontal) {
        const x1 = node.x + CARD_W;
        const y1 = node.y + getCardHeight(node.data) / 2;
        const x2 = child.x;
        const y2 = child.y + getCardHeight(child.data) / 2;
        const midX = (x1 + x2) / 2;
        lines.push({ x1, y1, x2: midX, y2: y1 });
        lines.push({ x1: midX, y1: y1, x2: midX, y2: y2 });
        lines.push({ x1: midX, y1: y2, x2, y2 });
      } else {
        const x1 = node.x + CARD_W / 2;
        const y1 = node.y + getCardHeight(node.data);
        const x2 = child.x + CARD_W / 2;
        const y2 = child.y;
        const midY = (y1 + y2) / 2;
        lines.push({ x1, y1, x2: x1, y2: midY });
        lines.push({ x1, y1: midY, x2, y2: midY });
        lines.push({ x1, y1: midY, x2, y2 });
      }
      collect(child);
    }
  }

  // Measure all roots
  const rootNodes = tree.map((d) => measure(d, 0));

  // Position roots sequentially
  let totalW = 0;
  let totalH = 0;
  const isHorizontal = direction === "horizontal";

  if (isHorizontal) {
    let currentY = 0;
    for (const root of rootNodes) {
      assignPositions(root, 0, currentY, 0);
      currentY += root.height + V_GAP;
      totalW = Math.max(totalW, root.width);
    }
    totalH = currentY - V_GAP;
  } else {
    let currentX = 0;
    for (const root of rootNodes) {
      assignPositions(root, currentX, 0, 0);
      currentX += root.width + H_GAP;
      totalH = Math.max(totalH, root.height);
    }
    totalW = currentX - H_GAP;
  }

  // Collect all nodes and lines
  for (const root of rootNodes) {
    collect(root);
  }

  const svgW = totalW + 40;
  const svgH = totalH + 40;
  const padX = 20;
  const padY = 20;

  return (
    <div ref={chartRef} className="inline-block" style={{ minWidth: svgW, minHeight: svgH }}>
      <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
        {/* Lines */}
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1 + padX}
            y1={line.y1 + padY}
            x2={line.x2 + padX}
            y2={line.y2 + padY}
            stroke="#94A3B8"
            strokeWidth={2}
          />
        ))}

        {/* Department cards */}
        {allNodes.map((node) => {
          const orgType = node.data.function_type || 'functional';
          const colors = ORG_TYPE_COLORS[orgType] || ORG_TYPE_COLORS.functional;
          const color = colors[node.level % colors.length];
          const typeLabel = color.label ? t(color.label, ({ 区域: 'Region', 分支: 'Branch', 项目: 'Project', 试验室: 'Lab', 外派: 'Seconded' } as Record<string, string>)[color.label] || color.label) : '';
          const isFieldUnit = orgType !== 'functional';
          const highlight =
            searchQuery &&
            (node.data.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              node.data.employees.some((e) =>
                e.name.toLowerCase().includes(searchQuery.toLowerCase())
              ));

          const cardH = getCardHeight(node.data);
          const hasCollapsibleChildren = node.data.children.length > 0 || node.childNodes.length > 0;
          const isCollapsed = hasCollapsibleChildren && collapsedNodes.has(node.data.id);
          const hiddenCount = node.data.children.length;

          return (
            <g key={`dept-${node.data.id}`}>
              <rect
                x={node.x + padX}
                y={node.y + padY}
                width={CARD_W}
                height={cardH}
                rx={8}
                fill={color.bg}
                stroke={highlight ? "#F59E0B" : color.border}
                strokeWidth={highlight ? 3 : 2}
                strokeDasharray={isFieldUnit && !highlight ? "6,3" : undefined}
                style={{ cursor: hasCollapsibleChildren ? 'pointer' : undefined }}
                onClick={hasCollapsibleChildren ? () => onToggleCollapse(node.data.id) : undefined}
              />
              <foreignObject
                x={node.x + padX + 8}
                y={node.y + padY + 6}
                width={CARD_W - 16}
                height={cardH - 12}
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isFieldUnit
                          ? <MapPin size={12} style={{ color: '#6B7280' }} />
                          : <Building2 size={12} style={{ color: '#6B7280' }} />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.data.name}
                          </span>
                          {isFieldUnit && (
                            <span style={{ fontSize: '8px', fontWeight: 600, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {typeLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasCollapsibleChildren && (
                        <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.data.id); }}
                          style={{ width: '18px', height: '18px', borderRadius: '4px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: '10px', fontWeight: 'bold', color: color.text }}
                          title={isCollapsed ? t('展开 (', 'Expand (') + hiddenCount + t('个子部门)', ' child departments)') : t('折叠', 'Collapse')}>
                          {isCollapsed ? '+' : '−'}
                        </button>
                      )}
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); onEditDept(node.data); }}
                            style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }} title={t("编辑", "Edit")}>
                            <Edit2 size={7} style={{ color: '#6B7280' }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onAddDept({ parentId: node.data.id }); }}
                            style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }} title={t("添加子部门", "Add child department")}>
                            <Plus size={7} style={{ color: '#6B7280' }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onAddEmp({ departmentId: node.data.id }); }}
                            style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }} title={t("添加员工", "Add employee")}>
                            <UserPlus size={7} style={{ color: '#6B7280' }} />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Collapsed child count indicator */}
                    {isCollapsed && hiddenCount > 0 && (
                      <div style={{ fontSize: '9px', color: color.text, opacity: 0.6, paddingLeft: '4px', marginBottom: '2px' }}>
                        {hiddenCount}{t("个子部门已折叠", " child departments collapsed")}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {node.data.employees.map((emp) => {
                      const isAi = emp.employee_type === "ai";
                      return (
                      <div key={emp.id}
                        onClick={(e) => { e.stopPropagation(); onNavigate(`/employees/${emp.id}`); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '4px', cursor: 'pointer', borderRadius: '3px', lineHeight: '20px' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F3F4F6'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        title={emp.name + ' · ' + (emp.role || '') + (isAi ? t(' · AI员工', ' · AI employee') : '') + t(emp.is_online ? ' · 在线 · 点击查看详情' : ' · 离线 · 点击查看详情', emp.is_online ? ' · Online · View details' : ' · Offline · View details')}
                      >
                        <span style={{ fontSize: '10px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Avatar id={emp.id} name={emp.name} size={14} customSrc={emp.avatar_url || undefined} /></span>
                        <span style={{ fontSize: '10px', color: color.text, fontWeight: emp.id === node.data.employees[0]?.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.name}
                        </span>
                        {isAi && (
                          <span style={{ fontSize: '7px', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '0px 3px', borderRadius: '2px', flexShrink: 0, letterSpacing: '0.5px' }}>AI</span>
                        )}
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: emp.is_online ? '#22c55e' : '#d1d5db', flexShrink: 0 }} />
                        <span style={{ fontSize: '9px', color: color.text, opacity: 0.5, whiteSpace: 'nowrap' }}>
                          {emp.role || ''}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface SkillItem {
  id: number; name: string; category: string; tags: string;
}

function EmpDetailModal({
  emp,
  onClose,
  onStartChat,
  onSaved,
  departments,
  onReportingLine,
}: {
  emp: Employee;
  onClose: () => void;
  onStartChat: (e: Employee) => void;
  onSaved: () => void;
  departments: Department[];
  onReportingLine?: (e: Employee) => void;
}) {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(emp.name);
  const [role, setRole] = useState(emp.role || "");
  const [description, setDescription] = useState(emp.description || "");
  const [departmentId, setDepartmentId] = useState(emp.department_id);
  const [agentType, setAgentType] = useState(emp.agent_type || "");
  const [avatarEmoji, setAvatarEmoji] = useState(emp.avatar_emoji || "");
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [allSkills, setAllSkills] = useState<SkillItem[]>([]);
  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const emojiOptions = ["👔", "💻", "📊", "🎯", "📢", "👥", "🎨", "⚙️", "🔍", "📚", "💼", "💡", "📎", "💰", "✅", "🚀", "📋", "🤝", "🔧", "🔐", "🗄️", "📈", "🏗️", "🔭", "💳", "🤖", "👤", "🛡️", "📞", "🔗", "🔄", "🛠️"];

  const flatDepts: { id: number; name: string; level: number }[] = [];
  function flattenDept(depts: Department[], level: number) {
    for (const d of depts) {
      flatDepts.push({ id: d.id, name: d.name, level });
      flattenDept(d.children, level + 1);
    }
  }
  flattenDept(departments, 0);

  // Load skills library
  useEffect(() => {
    if (!editing) return;
    setLoadingSkills(true);
    authFetch("/api/org/skills").then(r => r.json()).then(d => {
      if (d.success) {
        setAllSkills(d.data || []);
        const cats = [...new Set((d.data || []).map((s: SkillItem) => s.category))] as string[];
        setSkillCategories(cats);
      }
    }).finally(() => setLoadingSkills(false));

    // Load employee's current skills
    authFetch(`/api/org/employees/${emp.id}/skills`).then(r => r.json()).then(d => {
      if (d.success && d.data) {
        setSelectedSkillIds(d.data.map((s: any) => s.skill_id));
      }
    });
  }, [editing, emp.id]);

  const filteredSkills = activeCategory === "全部"
    ? allSkills
    : allSkills.filter(s => s.category === activeCategory);

  const toggleSkill = (id: number) => {
    setSelectedSkillIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update employee fields
      await authFetch(`/api/org/employees/${emp.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name, role, description, department_id: departmentId,
          agent_type: agentType || null, avatar_emoji: avatarEmoji,
        }),
      });

      // Update skills
      await authFetch(`/api/org/employees/${emp.id}/skills`, {
        method: "POST",
        body: JSON.stringify({ skill_ids: selectedSkillIds }),
      });

      onSaved();
      onClose();
    } catch (err: any) {
      alert(t("保存失败: ", "Save failed: ") + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = async () => {
    setAutoFilling(true);
    try {
      const r = await authFetch(`/api/org/employees/${emp.id}/auto-fill`, { method: "POST" });
      const d = await r.json();
      if (d.success) {
        if (d.filled.role) setRole(d.filled.role);
        if (d.filled.description) setDescription(d.filled.description);
        // Reload to get updated data
        onSaved();
        alert(t("智能补齐完成！", "AI completion finished."));
      } else {
        alert(d.error || t("补齐失败", "Completion failed"));
      }
    } catch (err: any) {
      alert(t("补齐出错: ", "Completion error: ") + err.message);
    } finally {
      setAutoFilling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar id={emp.id} name={emp.name} size={48} className="rounded-xl" customSrc={emp.avatar_url || undefined} />
              <div>
                <h3 className="text-base font-bold text-white">{emp.name}</h3>
                <p className="text-xs text-blue-100">{emp.role || t("未设置职位", "Role not set")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && !editing && (
                <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-white/20 text-white text-xs rounded-lg hover:bg-white/30">
                  {t("编辑", "Edit")}
                </button>
              )}
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!editing ? (
            /* Read-only view */
            <div className="space-y-4">
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${emp.employee_type === "ai" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {emp.employee_type === "ai" ? t("AI员工", "AI employee") : t("人类员工", "Human employee")}
                </span>
                {emp.agent_type && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">{emp.agent_type}</span>}
                {emp.position_sequence && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">{emp.position_sequence}</span>}
              </div>
              {description && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-1">{t("岗位职责", "Responsibilities")}</h5>
                  <p className="text-sm text-gray-700">{description}</p>
                </div>
              )}
              {emp.skills && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2">{t("岗位职责标签", "Responsibility tags")}</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {emp.skills.split(",").map((s, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs">{s.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">{t("关闭", "Close")}</button>
                {onReportingLine && (
                  <button onClick={() => onReportingLine(emp)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 text-sm rounded-xl hover:bg-amber-100 border border-amber-200">
                    <Network size={14} /> {t("汇报关系", "Reporting lines")}
                  </button>
                )}
                <button onClick={() => setShowSkillPicker(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 text-sm rounded-xl hover:bg-green-100 border border-green-200">
                  <Plus size={14} /> {t("技能配备", "Assign skills")}
                </button>
                <button onClick={() => onStartChat(emp)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600">
                  <MessageSquare size={14} /> {t("发起聊天", "Start chat")}
                </button>
              </div>
            </div>
          ) : (
            /* Edit form */
            <div className="space-y-4">
              {/* Avatar + Name */}
              <div className="flex gap-3">
                <div className="shrink-0">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("职业头像", "Professional avatar")}</label>
                  <Avatar id={emp.id} name={emp.name} size={40} customSrc={emp.avatar_url || undefined} />
                  <p className="text-[10px] text-gray-400 mt-1">{t("自动分配", "Automatically assigned")}</p>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("姓名 *", "Name *")}</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none" />
                  <label className="block text-xs font-medium text-gray-500 mb-1 mt-3">{t("岗位名称", "Role title")}</label>
                  <input value={role} onChange={e => setRole(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("岗位职责", "Responsibilities")}</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none resize-none" />
              </div>

              {/* Department + Agent Type */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("所属部门", "Department")}</label>
                  <select value={departmentId} onChange={e => setDepartmentId(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none">
                    {flatDepts.map(d => (
                      <option key={d.id} value={d.id}>{"　".repeat(d.level)}{d.name}</option>
                    ))}
                  </select>
                </div>
                {emp.employee_type === "ai" && (
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t("AI角色类型", "AI role type")}</label>
                    <select value={agentType} onChange={e => setAgentType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none">
                      <option value="">{t("无", "None")}</option>
                      {Object.entries(AGENT_TEMPLATES).map(([key, tpl]) => (
                        <option key={key} value={key}>{tpl.role}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Auto-fill button */}
              {emp.employee_type === "ai" && agentType && (
                <button onClick={handleAutoFill} disabled={autoFilling}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg hover:bg-amber-100 disabled:opacity-50">
                  <Bot size={14} />
                  {autoFilling ? t("补齐中...", "Completing...") : t("智能补齐（按AI角色模板自动生成）", "AI completion (from role template)")}
                </button>
              )}

              {/* Skills multi-select */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">{t("匹配技能（可多选）", "Matched skills (multiple allowed)")}</label>
                {/* Category tabs */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <button onClick={() => setActiveCategory("全部")}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${activeCategory === "全部" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {t("全部", "All")}
                  </button>
                  {skillCategories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${activeCategory === cat ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                {/* Skills grid */}
                {loadingSkills ? (
                  <div className="text-xs text-gray-400 py-4 text-center">{t("加载技能库...", "Loading skill library...")}</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-100">
                    {filteredSkills.map(skill => (
                      <button key={skill.id} onClick={() => toggleSkill(skill.id)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-all ${selectedSkillIds.includes(skill.id) ? "bg-blue-500 text-white ring-1 ring-blue-300" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-400"}`}>
                        {skill.name}
                      </button>
                    ))}
                  </div>
                )}
                {selectedSkillIds.length > 0 && (
                  <div className="mt-2 text-[10px] text-gray-400">{t("已选 ", "Selected ") + selectedSkillIds.length + t(" 项技能", " skills")}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - only in edit mode */}
        {editing && (
          <div className="shrink-0 px-5 py-3 border-t border-gray-100 flex justify-between">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{t("取消", "Cancel")}</button>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); onStartChat(emp); }} className="flex items-center gap-1 px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                <MessageSquare size={13} /> {t("发起聊天", "Start chat")}
              </button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {saving ? t("保存中...", "Saving...") : t("保存", "Save")}
              </button>
            </div>
          </div>
        )}

        {/* Skill Picker Modal */}
        {showSkillPicker && (
          <SkillPickerModal
            employeeId={emp.id}
            currentSkillIds={selectedSkillIds}
            onClose={() => setShowSkillPicker(false)}
            onSaved={() => { setShowSkillPicker(false); onSaved(); }}
          />
        )}
      </div>
    </div>
  );
}

function SkillPickerModal({ employeeId, currentSkillIds, onClose, onSaved }: {
  employeeId: number; currentSkillIds: number[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLocale();
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set(currentSkillIds));
  const [category, setCategory] = useState("全部");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/skills").then(r => r.json()).then(d => {
      if (d.success) setSkills(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = ["全部", ...new Set(skills.map(s => s.category))];
  const filtered = skills.filter(s => {
    if (category !== "全部" && s.category !== category) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggle = (id: number) => {
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const selectAll = () => setSelected(new Set(filtered.map(s => s.id)));
  const deselectAll = () => setSelected(new Set());

  const handleSave = async () => {
    setSaving(true);
    await authFetch(`/api/org/employees/${employeeId}/skills`, {
      method: "POST",
      body: JSON.stringify({ skill_ids: Array.from(selected) }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col z-[60]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">{t("技能配备", "Assign skills")}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-5 py-3 space-y-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("搜索技能...", "Search skills...")}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
            </div>
            <button onClick={selectAll} className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200">{t("全选", "Select all")}</button>
            <button onClick={deselectAll} className="px-3 py-2 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200">{t("清空", "Clear")}</button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${category === c ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-500 border-gray-200 hover:border-blue-400"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">{t("加载中...", "Loading...")}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filtered.map(skill => {
                const isSelected = selected.has(skill.id);
                return (
                  <button key={skill.id} onClick={() => toggle(skill.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isSelected ? "bg-blue-500 text-white border-blue-500 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600"}`}>
                    {isSelected && <Check size={10} className="inline mr-1" />}
                    {skill.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <span className="text-xs text-gray-500">{t("已选 ", "Selected ") + selected.size + t(" 项技能", " skills")}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{t("取消", "Cancel")}</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50">
              {saving ? t("保存中...", "Saving...") : t("确认配备", "Confirm assignment")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const AGENT_TEMPLATES: Record<string, { role: string }> = {
  chairman: { role: "董事长顾问" }, ceo: { role: "首席执行官" },
  cto: { role: "首席技术官" }, cfo: { role: "首席财务官" }, cmo: { role: "首席市场官" },
  coo: { role: "首席运营官" }, cho: { role: "首席人力官" }, cao: { role: "首席行政官" },
  cpo: { role: "首席产品官" }, cdo: { role: "首席数据官" }, cso: { role: "首席战略官" }, cco: { role: "首席客户官" },
  tech_architect: { role: "技术架构师" }, hr_manager: { role: "人力资源总监" },
  sales_manager: { role: "商务总监" }, strategy_executive: { role: "战略执行总监" },
  finance_director: { role: "财务总监" }, presales_architect: { role: "售前架构师" }, legal_advisor: { role: "法务顾问" },
  frontend_dev: { role: "前端工程师" }, backend_dev: { role: "后端工程师" }, fullstack_dev: { role: "全栈工程师" },
  mobile_dev: { role: "移动端工程师" }, miniapp_dev: { role: "小程序工程师" },
  sre_engineer: { role: "SRE工程师" }, qa_engineer: { role: "测试工程师" }, code_reviewer: { role: "代码审查员" },
  dba: { role: "数据库管理员" }, data_engineer: { role: "数据工程师" }, bi_analyst: { role: "BI分析师" },
  ai_engineer: { role: "AI工程师" }, customer_success: { role: "客户成功经理" },
  finance_manager: { role: "财务经理" }, mgmt_accountant: { role: "管理会计师" },
  ecommerce_ops: { role: "电商运营" }, crossborder_ops: { role: "跨境电商运营" },
  newmedia_ops: { role: "新媒体运营" }, ppt_designer: { role: "PPT设计师" },
  knowledge: { role: "知识管理员" }, financial_accountant: { role: "财务会计" }, cashier: { role: "出纳" },
  medical_consultant: { role: "医疗行业顾问" }, fintech_consultant: { role: "金融科技顾问" },
  manufacturing_consultant: { role: "制造业顾问" }, edu_consultant: { role: "教育行业顾问" },
  gov_consultant: { role: "政务顾问" }, ip_specialist: { role: "知识产权专员" }, investment_manager: { role: "投资经理" },
  product_manager: { role: "产品总监" },
};

function DeptEditModal({
  dept,
  onClose,
  onSaved,
}: {
  dept: Department;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState(dept.name);
  const [description, setDescription] = useState(dept.description || "");
  const [departmentCode, setDepartmentCode] = useState(dept.department_code || "");
  const [costCenter, setCostCenter] = useState(dept.cost_center || "");
  const [headcount, setHeadcount] = useState(dept.headcount || 0);
  const [budgetAllocation, setBudgetAllocation] = useState(dept.budget_allocation || 0);
  const [functionType, setFunctionType] = useState(dept.function_type || "functional");
  const [level, setLevel] = useState(dept.level || 1);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await authFetch(`/api/org/departments/${dept.id}`, {
      method: "PUT",
      body: JSON.stringify({ name, description, department_code: departmentCode, cost_center: costCenter, headcount, budget_allocation: budgetAllocation, function_type: functionType, level }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  const deleteDept = async () => {
    if (!confirm(t("确定删除部门", "Delete department ") + "\"" + dept.name + "\"?")) return;
    const r = await authFetch(`/api/org/departments/${dept.id}`, {
      method: "DELETE",
    });
    const d = await r.json();
    if (d.success) {
      onSaved();
      onClose();
    } else alert(d.error || t("删除失败", "Deletion failed"));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[440px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-800 mb-5">{t("编辑部门", "Edit department")}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("部门名称", "Department name")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("部门编码", "Department code")}</label>
              <input type="text" value={departmentCode} onChange={(e) => setDepartmentCode(e.target.value)} placeholder={t("如：TECH", "e.g. TECH")}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("成本中心", "Cost center")}</label>
              <input type="text" value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder={t("如：CC001", "e.g. CC001")}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("编制人数", "Headcount")}</label>
              <input type="number" value={headcount} onChange={(e) => setHeadcount(parseInt(e.target.value) || 0)} min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("预算额度", "Budget allocation")}</label>
              <input type="number" value={budgetAllocation} onChange={(e) => setBudgetAllocation(parseFloat(e.target.value) || 0)} min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("职能类型", "Organization type")}</label>
              <select value={functionType} onChange={(e) => setFunctionType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400">
                <option value="functional">{t("职能制", "Functional")}</option>
                <option value="divisional">{t("事业部制", "Divisional")}</option>
                <option value="matrix">{t("矩阵制", "Matrix")}</option>
                <option value="flat">{t("扁平化", "Flat")}</option>
                <option value="dispatched">{t("外派机构（二级机构）", "Seconded unit (level 2)")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("部门层级", "Department level")}</label>
              <input type="number" value={level} onChange={(e) => setLevel(parseInt(e.target.value) || 1)} min="1" max="10"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("部门职责", "Department responsibilities")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none" />
          </div>
          {(dept.headcount ?? 0) > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">{t("编制状态: ", "Staffing: ")}{dept.employees.length}/{dept.headcount}
                {dept.employees.length > (dept.headcount ?? 0) ? t(' (超编)', ' (overstaffed)') : dept.employees.length < (dept.headcount ?? 0) ? t(' (缺编)', ' (understaffed)') : t(' (满编)', ' (fully staffed)')}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={deleteDept}
            className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={12} /> {t("删除", "Delete")}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl"
            >
              {t("取消", "Cancel")}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? t("保存中...", "Saving...") : t("保存", "Save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddDeptModal({
  parentId,
  onClose,
  onSaved,
}: {
  parentId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [headcount, setHeadcount] = useState(0);
  const [functionType, setFunctionType] = useState("functional");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await authFetch("/api/org/departments", {
      method: "POST",
      body: JSON.stringify({ name, parent_id: parentId, description, department_code: departmentCode || undefined, headcount: headcount || undefined, function_type: functionType }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[440px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-800 mb-5">{t("新增部门", "Add department")}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("部门名称", "Department name")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("请输入部门名称", "Enter department name")} autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("部门编码", "Department code")}</label>
              <input type="text" value={departmentCode} onChange={(e) => setDepartmentCode(e.target.value)} placeholder={t("如：TECH", "e.g. TECH")}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("编制人数", "Headcount")}</label>
              <input type="number" value={headcount} onChange={(e) => setHeadcount(parseInt(e.target.value) || 0)} min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("机构类型", "Organization type")}</label>
            <select value={functionType} onChange={(e) => setFunctionType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400">
              <option value="functional">{t("职能制", "Functional")}</option>
              <option value="divisional">{t("事业部制", "Divisional")}</option>
              <option value="matrix">{t("矩阵制", "Matrix")}</option>
              <option value="flat">{t("扁平化", "Flat")}</option>
              <option value="dispatched">{t("外派机构（二级机构）", "Seconded unit (level 2)")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("部门职责", "Department responsibilities")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl"
          >
            {t("取消", "Cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="px-5 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t("创建中...", "Creating...") : t("创建", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddEmpModal({
  departmentId,
  onClose,
  onSaved,
}: {
  departmentId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [employeeType, setEmployeeType] = useState<"ai" | "human">("ai");
  const [agentType, setAgentType] = useState("");
  const [saving, setSaving] = useState(false);

  const agentTypes = [
    { value: "", label: t("无", "None") },
    { value: "ceo", label: "CEO" },
    { value: "cto", label: "CTO" },
    { value: "cfo", label: "CFO" },
    { value: "product_manager", label: t("产品总监", "Product director") },
    { value: "cmo", label: t("市场总监", "Marketing director") },
    { value: "hr", label: t("HR总监", "HR director") },
    { value: "frontend_dev", label: t("前端工程师", "Frontend engineer") },
    { value: "backend_dev", label: t("后端工程师", "Backend engineer") },
    { value: "qa", label: t("测试工程师", "QA engineer") },
    { value: "knowledge", label: t("知识管理员", "Knowledge manager") },
  ];

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await authFetch("/api/org/employees", {
      method: "POST",
      body: JSON.stringify({
        name,
        role,
        department_id: departmentId,
        employee_type: employeeType,
        agent_type: agentType || null,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[440px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-800 mb-5">{t("添加员工", "Add employee")}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t("姓名 *", "Name *")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t("职位", "Role")}
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t("员工类型", "Employee type")}
            </label>
            <select
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value as any)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
            >
              <option value="ai">{t("AI员工", "AI employee")}</option>
              <option value="human">{t("人类员工", "Human employee")}</option>
            </select>
          </div>
          {employeeType === "ai" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("AI角色", "AI role")}
              </label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
              >
                {agentTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl"
          >
            {t("取消", "Cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="px-5 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t("创建中...", "Creating...") : t("创建", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionManagerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, locale } = useLocale();
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [versionNumber, setVersionNumber] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    authFetch("/api/org/versions").then(r => r.json()).then(d => {
      if (d.success) setVersions(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!versionNumber.trim()) return;
    setCreating(true);
    await authFetch("/api/org/versions", { method: "POST", body: JSON.stringify({ version_number: versionNumber, description }) });
    setCreating(false);
    setShowCreate(false); setVersionNumber(""); setDescription("");
    const r = await authFetch("/api/org/versions"); const d = await r.json();
    if (d.success) setVersions(d.data || []);
  };

  const handleStatus = async (id: number, status: string) => {
    await authFetch(`/api/org/versions/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    const r = await authFetch("/api/org/versions"); const d = await r.json();
    if (d.success) setVersions(d.data || []);
  };

  const sc: Record<string, string> = { draft: "bg-gray-100 text-gray-600", pending: "bg-amber-100 text-amber-700", approved: "bg-green-100 text-green-700", archived: "bg-blue-100 text-blue-700" };
  const sl: Record<string, string> = { draft: "草稿", pending: "待审批", approved: "已批准", archived: "已归档" };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col z-50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><History size={18} /> {t("组织架构版本管理", "Organization version management")}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? <div className="text-center py-8 text-gray-400 text-sm">{t("加载中...", "Loading...")}</div> : versions.length === 0 && !showCreate ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-sm mb-4">{t("暂无版本记录", "No version records")}</div>
              <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">{t("创建第一个版本", "Create first version")}</button>
            </div>
          ) : (
            <div className="space-y-3">
              {showCreate && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <input value={versionNumber} onChange={e => setVersionNumber(e.target.value)} placeholder={t("版本号，如 v1.0", "Version number, e.g. v1.0")} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t("版本描述（可选）", "Version description (optional)")} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{t("取消", "Cancel")}</button>
                    <button onClick={handleCreate} disabled={creating || !versionNumber.trim()} className="px-4 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50">{creating ? t("创建中...", "Creating...") : t("创建", "Create")}</button>
                  </div>
                </div>
              )}
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{v.version_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sc[v.status] || ""}`}>{sl[v.status] || v.status}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">{v.description || t("无描述", "No description")} · {new Date(v.created_at).toLocaleDateString(locale)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.status === "draft" && <button onClick={() => handleStatus(v.id, "approved")} className="px-3 py-1 text-[11px] bg-green-500 text-white rounded-md hover:bg-green-600">{t("批准", "Approve")}</button>}
                    {v.status === "approved" && <button onClick={() => handleStatus(v.id, "archived")} className="px-3 py-1 text-[11px] bg-gray-400 text-white rounded-md hover:bg-gray-500">{t("归档", "Archive")}</button>}
                  </div>
                </div>
              ))}
              {!showCreate && (
                <button onClick={() => setShowCreate(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                  <Plus size={14} /> {t("新建版本", "New version")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReportingLineModal({ employee, allEmployees, onClose, onSaved }: {
  employee: Employee; allEmployees: Employee[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLocale();
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerId, setManagerId] = useState("");
  const [lineType, setLineType] = useState("solid");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch(`/api/org/employees/${employee.id}/reporting-lines`).then(r => r.json()).then(d => {
      if (d.success) setLines(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [employee.id]);

  const handleAdd = async () => {
    if (!managerId) return;
    setSaving(true);
    await authFetch("/api/org/reporting-lines", { method: "POST", body: JSON.stringify({ employee_id: employee.id, manager_id: parseInt(managerId), line_type: lineType }) });
    setSaving(false); setManagerId("");
    const r = await authFetch(`/api/org/employees/${employee.id}/reporting-lines`);
    const d = await r.json();
    if (d.success) setLines(d.data || []);
    onSaved();
  };

  const handleDelete = async (id: number) => {
    await authFetch(`/api/org/reporting-lines/${id}`, { method: "DELETE" });
    setLines(prev => prev.filter(l => l.id !== id));
    onSaved();
  };

  const others = allEmployees.filter(e => e.id !== employee.id);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col z-50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{t("汇报关系", "Reporting lines") + " - " + employee.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("当前汇报关系", "Current reporting lines")}</h3>
            {loading ? <div className="text-xs text-gray-400">{t("加载中...", "Loading...")}</div> : lines.length === 0 ? (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-4 text-center">{t("暂无汇报关系", "No reporting lines")}</div>
            ) : (
              <div className="space-y-2">
                {lines.map(line => (
                  <div key={line.id} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${line.line_type === "solid" ? "bg-blue-500" : "bg-amber-400"}`} />
                      <span className="text-sm text-gray-700">{line.manager_name}</span>
                      <span className="text-[10px] text-gray-400">({line.line_type === "solid" ? t("实线", "Solid") : t("虚线", "Dotted")})</span>
                    </div>
                    <button onClick={() => handleDelete(line.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("添加汇报关系", "Add reporting line")}</h3>
            <div className="flex gap-2">
              <select value={managerId} onChange={e => setManagerId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400">
                <option value="">{t("选择上级...", "Select manager...")}</option>
                {others.map(e => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
              </select>
              <select value={lineType} onChange={e => setLineType(e.target.value)} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400">
                <option value="solid">{t("实线", "Solid")}</option>
                <option value="dotted">{t("虚线", "Dotted")}</option>
              </select>
              <button onClick={handleAdd} disabled={!managerId || saving} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50">{saving ? "..." : t("添加", "Add")}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
