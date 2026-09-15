import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Plus, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Search } from "lucide-react";
import { authFetch } from "../api/authFetch";

interface CountTask {
  id: number;
  title: string;
  description: string | null;
  department_id: number | null;
  scope: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface CountResult {
  id: number;
  asset_id: number;
  asset_no: string;
  asset_name: string;
  category: string;
  expected_location: string | null;
  actual_location: string | null;
  expected_status: string;
  actual_status: string | null;
  expected_custodian_name: string | null;
  actual_custodian_name: string | null;
  result: string;
  remark: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "进行中", color: "bg-blue-100 text-blue-700" },
  completed: { label: "已完成", color: "bg-green-100 text-green-700" },
  cancelled: { label: "已取消", color: "bg-gray-200 text-gray-500" },
};

export default function AssetCountPage() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<CountTask[]>([]);
  const [loading, setLoading] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    department_id: "",
    scope: "all",
  });

  // Detail view
  const [selectedTask, setSelectedTask] = useState<CountTask | null>(null);
  const [results, setResults] = useState<CountResult[]>([]);
  const [report, setReport] = useState<any>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Scan entry
  const [showEntry, setShowEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({
    asset_search: "",
    actual_location: "",
    actual_status: "",
    actual_custodian_id: "",
    result: "match",
    remark: "",
  });
  const [matchedAsset, setMatchedAsset] = useState<any>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch("/api/assets/count-tasks");
      const d = await r.json();
      if (d.success) setTasks(d.data || []);
    } catch (err: any) {
      console.error("加载盘点任务失败:", err);
    }
    setLoading(false);
  }, []);

  const fetchResults = useCallback(async (taskId: number) => {
    setResultsLoading(true);
    try {
      const [resultsR, reportR] = await Promise.all([
        authFetch(`/api/assets/count-tasks/${taskId}/results`),
        authFetch(`/api/assets/count-tasks/${taskId}/report`),
      ]);
      const resultsD = await resultsR.json();
      const reportD = await reportR.json();
      if (resultsD.success) setResults(resultsD.data?.results || []);
      if (reportD.success) setReport(reportD.data);
    } catch (err: any) {
      console.error("加载盘点结果失败:", err);
    }
    setResultsLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!createForm.title) return;
    try {
      const body: any = { ...createForm };
      if (createForm.department_id) body.department_id = parseInt(createForm.department_id);
      else delete body.department_id;
      const r = await authFetch("/api/assets/count-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setShowCreate(false);
        setCreateForm({ title: "", description: "", department_id: "", scope: "all" });
        fetchTasks();
      } else {
        alert(d.error || "创建盘点任务失败");
      }
    } catch (err: any) {
      console.error("创建盘点任务失败:", err);
      alert("请求失败");
    }
  };

  const handleStartTask = async (taskId: number) => {
    try {
      await authFetch(`/api/assets/count-tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress", start_date: new Date().toISOString().split("T")[0] }),
      }).then(r => r.json());
      fetchTasks();
    } catch (err: any) {
      console.error("启动盘点失败:", err);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await authFetch(`/api/assets/count-tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", end_date: new Date().toISOString().split("T")[0] }),
      }).then(r => r.json());
      fetchTasks();
      if (selectedTask?.id === taskId) {
        fetchResults(taskId);
      }
    } catch (err: any) {
      console.error("完成盘点失败:", err);
    }
  };

  const handleCancelTask = async (taskId: number) => {
    try {
      await authFetch(`/api/assets/count-tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      }).then(r => r.json());
      fetchTasks();
    } catch (err: any) {
      console.error("取消盘点失败:", err);
    }
  };

  const openDetail = (task: CountTask) => {
    setSelectedTask(task);
    fetchResults(task.id);
    setShowEntry(false);
  };

  const handleAssetSearch = async () => {
    if (!entryForm.asset_search || !selectedTask) return;
    try {
      const r = await authFetch(`/api/assets?search=${encodeURIComponent(entryForm.asset_search)}&limit=10`);
      const d = await r.json();
      if (d.success && d.data.length === 1) {
        setMatchedAsset(d.data[0]);
      } else if (d.success && d.data.length > 0) {
        setMatchedAsset(d.data[0]);
      } else {
        setMatchedAsset(null);
      }
    } catch (err: any) {
      console.error("搜索资产失败:", err);
    }
  };

  const handleSaveResult = async () => {
    if (!selectedTask || !matchedAsset) return;
    try {
      const body: any = {
        asset_id: matchedAsset.id,
        actual_location: entryForm.actual_location || matchedAsset.location_detail || "",
        actual_status: entryForm.actual_status || matchedAsset.status,
        actual_custodian_id: entryForm.actual_custodian_id ? parseInt(entryForm.actual_custodian_id) : matchedAsset.custodian_id,
        result: entryForm.result,
        remark: entryForm.remark,
      };
      const r = await authFetch(`/api/assets/count-tasks/${selectedTask.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setEntryForm({ asset_search: "", actual_location: "", actual_status: "", actual_custodian_id: "", result: "match", remark: "" });
        setMatchedAsset(null);
        fetchResults(selectedTask.id);
      } else if (d.error) {
        alert(d.error);
      }
    } catch (err: any) {
      console.error("保存盘点结果失败:", err);
      alert("保存失败");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/assets")} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">资产盘点</h1>
            <p className="text-sm text-gray-500 mt-1">创建盘点任务、扫码核对资产、生成差异报告</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus size={16} /> 新建盘点
        </button>
      </div>

      {/* Detail view */}
      {selectedTask ? (
        <div className="space-y-6">
          {/* Back + Task info */}
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedTask(null)} className="text-sm text-blue-600 hover:underline">← 返回列表</button>
            <div className="flex items-center gap-3">
              {selectedTask.status === "draft" && (
                <button onClick={() => handleStartTask(selectedTask.id)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg">开始盘点</button>
              )}
              {selectedTask.status === "in_progress" && (
                <>
                  <button onClick={() => setShowEntry(true)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg">录入盘点</button>
                  <button onClick={() => handleCompleteTask(selectedTask.id)} className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg">完成盘点</button>
                </>
              )}
              {(selectedTask.status === "draft" || selectedTask.status === "in_progress") && (
                <button onClick={() => handleCancelTask(selectedTask.id)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">取消</button>
              )}
            </div>
          </div>

          {/* Report summary */}
          {report?.summary && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{report.summary.total_counted}</div>
                <div className="text-xs text-gray-500 mt-1">已盘点</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{report.summary.match_count}</div>
                <div className="text-xs text-gray-500 mt-1">匹配</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{report.summary.diff_count}</div>
                <div className="text-xs text-gray-500 mt-1">差异</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{report.summary.not_found_count}</div>
                <div className="text-xs text-gray-500 mt-1">未找到</div>
              </div>
            </div>
          )}

          {/* Entry form */}
          {showEntry && selectedTask.status === "in_progress" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
              <h3 className="text-sm font-semibold mb-4">录入盘点结果</h3>
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">扫描/搜索资产编号</label>
                  <div className="flex gap-2">
                    <input
                      value={entryForm.asset_search}
                      onChange={e => setEntryForm({ ...entryForm, asset_search: e.target.value })}
                      onKeyDown={e => { if (e.key === "Enter") handleAssetSearch(); }}
                      placeholder="输入资产编号或名称"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                    <button onClick={handleAssetSearch} className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                      <Search size={14} />
                    </button>
                  </div>
                </div>
              </div>
              {matchedAsset && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="text-sm font-medium">{matchedAsset.asset_no} - {matchedAsset.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    位置: {matchedAsset.location_detail || "N/A"} | 状态: {matchedAsset.status} | 保管人: {matchedAsset.custodian_name || "N/A"}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">实际位置</label>
                  <input value={entryForm.actual_location} onChange={e => setEntryForm({ ...entryForm, actual_location: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">盘点结果</label>
                  <select value={entryForm.result} onChange={e => setEntryForm({ ...entryForm, result: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="match">匹配</option>
                    <option value="difference">有差异</option>
                    <option value="not_found">未找到</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">备注</label>
                  <input value={entryForm.remark} onChange={e => setEntryForm({ ...entryForm, remark: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setShowEntry(false); setMatchedAsset(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                <button onClick={handleSaveResult} disabled={!matchedAsset} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">保存</button>
              </div>
            </div>
          )}

          {/* Results table */}
          {resultsLoading ? (
            <div className="text-center py-12 text-gray-400">加载盘点结果...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-400">暂无盘点记录，开始盘点后在此录入</div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">资产编号</th>
                    <th className="text-left px-4 py-3">资产名称</th>
                    <th className="text-left px-4 py-3">预期位置</th>
                    <th className="text-left px-4 py-3">实际位置</th>
                    <th className="text-left px-4 py-3">结果</th>
                    <th className="text-left px-4 py-3">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {results.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.asset_no}</td>
                      <td className="px-4 py-3 font-medium">{r.asset_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.expected_location || "-"}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.actual_location || "-"}</td>
                      <td className="px-4 py-3">
                        {r.result === "match" ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> 匹配</span>
                        ) : r.result === "difference" ? (
                          <span className="flex items-center gap-1 text-yellow-600 text-xs"><AlertTriangle size={12} /> 差异</span>
                        ) : r.result === "not_found" ? (
                          <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle size={12} /> 未找到</span>
                        ) : (
                          <span className="text-gray-400 text-xs">待盘点</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.remark || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Differences */}
          {report?.differences?.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-yellow-800 mb-3">差异报告 ({report.differences.length}项)</h4>
              <div className="space-y-2">
                {report.differences.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-yellow-800">{d.asset_no} - {d.asset_name}</span>
                    <span className="text-yellow-600 text-xs">{d.result === "not_found" ? "未找到" : "有差异"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Task list */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ClipboardCheck size={40} className="mx-auto mb-2 opacity-30" />
              暂无盘点任务，点击"新建盘点"开始
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">标题</th>
                    <th className="text-left px-4 py-3">范围</th>
                    <th className="text-left px-4 py-3">状态</th>
                    <th className="text-left px-4 py-3">开始日期</th>
                    <th className="text-left px-4 py-3">结束日期</th>
                    <th className="text-left px-4 py-3">创建时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer" onClick={() => openDetail(t)}>
                      <td className="px-4 py-3 font-medium">{t.title}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {t.scope === "all" ? "全机构" : t.scope === "department" ? "按机构" : t.scope === "category" ? "按分类" : "自定义"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[t.status]?.color}`}>
                          {STATUS_MAP[t.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{t.start_date || "-"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{t.end_date || "-"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{t.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">新建盘点任务</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">标题 *</label>
                <input value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例如：2026年Q2资产盘点" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">说明</label>
                <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="盘点说明..." />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">盘点范围</label>
                <select value={createForm.scope} onChange={e => setCreateForm({ ...createForm, scope: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="all">全机构</option>
                  <option value="department">指定机构</option>
                  <option value="category">指定分类</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
