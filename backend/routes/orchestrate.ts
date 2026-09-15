import { Router } from "express";
import { authenticate, requireAdmin, AuthRequest } from "../middleware";
import {
  createOrchestration, analyzeTask, matchAgents,
  getOrchestrationStatus, updateSubTaskStatus, getOrchestrations
} from "../services/orchestrator";

export const orchestrateRoutes = Router();
orchestrateRoutes.use(authenticate);

// 获取编排任务列表
orchestrateRoutes.get("/", (req: AuthRequest, res) => {
  try {
    const tasks = getOrchestrations(req.user!.tenant_id);
    res.json({ success: true, data: tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 创建编排任务
orchestrateRoutes.post("/", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { title, description, goal } = req.body;
    if (!title) return res.status(400).json({ success: false, error: "标题必填" });
    
    const id = createOrchestration(title, description || '', goal || '', req.user!.id, req.user!.tenant_id);
    res.json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 分析任务
orchestrateRoutes.post("/:id/analyze", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await analyzeTask(parseInt(req.params.id));
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 能力匹配
orchestrateRoutes.post("/:id/match", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const assignments = await matchAgents(parseInt(req.params.id));
    res.json({ success: true, data: assignments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取任务状态
orchestrateRoutes.get("/:id", (req: AuthRequest, res) => {
  try {
    const status = getOrchestrationStatus(parseInt(req.params.id));
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新子任务状态
orchestrateRoutes.put("/subtask/:id", requireAdmin, (req: AuthRequest, res) => {
  try {
    const { status, result } = req.body;
    updateSubTaskStatus(parseInt(req.params.id), status, result);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
