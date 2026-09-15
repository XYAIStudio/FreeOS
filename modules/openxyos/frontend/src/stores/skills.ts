import { create } from "zustand";
import { authFetch } from "../api/authFetch";

export interface Skill {
  id: number;
  name: string;
  slug: string;
  category: string;
  icon: string;
  description: string;
  tags: string;
  author: string;
  version: string;
  install_count: number;
  rating: number;
  enabled: number;
  file_size: number;
  source: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type ViewMode = "grid" | "list" | "group";
export type ActiveTab = "installed" | "marketplace";

export const SKILL_CATEGORIES = [
  "全部", "电商与跨境", "营销与增长", "内容与创作",
  "开发与技术", "数据与金融", "法务与合规",
  "学术与教育", "沟通与协作", "AI增强与知识", "生活与健康", "其他",
];

export const CATEGORY_ICONS: Record<string, string> = {
  "全部": "🧩", "电商与跨境": "🛒", "营销与增长": "📈", "内容与创作": "🎨",
  "开发与技术": "💻", "数据与金融": "📊", "法务与合规": "⚖️", "学术与教育": "📚",
  "沟通与协作": "💬", "AI增强与知识": "🤖", "生活与健康": "🌿", "其他": "📁",
};

interface SkillsState {
  skills: Skill[];
  stats: { total: number; enabled: number; disabled: number; categories: Record<string, number>; recentInstalled: number };
  category: string;
  search: string;
  viewMode: ViewMode;
  activeTab: ActiveTab;
  selectedIds: Set<number>;
  detailSkill: Skill | null;
  expanded: string | null;
  loading: boolean;
  marketplacePage: number;
  marketplaceTotalPages: number;

  fetchSkills: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchMarketplace: (page?: number) => Promise<void>;
  setCategory: (cat: string) => void;
  setSearch: (q: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveTab: (tab: ActiveTab) => void;
  toggleSelect: (id: number) => void;
  clearSelection: () => void;
  toggleEnabled: (id: number) => Promise<void>;
  setDetailSkill: (skill: Skill | null) => void;
  setExpanded: (cat: string | null) => void;
  createSkill: (data: { name: string; category: string; description: string; tags: string; content: string }) => Promise<boolean>;
  importSkill: (content: string) => Promise<boolean>;
  deleteSkill: (id: number) => Promise<boolean>;
  batchToggle: (enabled: boolean) => Promise<void>;
  batchDelete: () => Promise<void>;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  stats: { total: 0, enabled: 0, disabled: 0, categories: {}, recentInstalled: 0 },
  category: "全部",
  search: "",
  viewMode: "grid",
  activeTab: "installed",
  selectedIds: new Set(),
  detailSkill: null,
  expanded: null,
  loading: false,
  marketplacePage: 1,
  marketplaceTotalPages: 0,

  fetchSkills: async () => {
    set({ loading: true });
    try {
      const r = await authFetch("/api/skills");
      const d = await r.json();
      if (d.success && Array.isArray(d.data)) set({ skills: d.data, loading: false });
      else set({ skills: [], loading: false });
    } catch { set({ skills: [], loading: false }); }
  },

  fetchStats: async () => {
    try {
      const r = await authFetch("/api/skills/stats");
      const d = await r.json();
      if (d.success && d.data) {
        const cats: Record<string, number> = {};
        (d.data.categories || []).forEach((c: { category: string; count: number }) => { cats[c.category] = c.count; });
        set({ stats: { total: d.data.total_skills || 0, enabled: d.data.total_skills || 0, disabled: d.data.disabled || 0, categories: cats, recentInstalled: d.data.total_learned || 0 } });
      }
    } catch { /* ignore */ }
  },

  fetchMarketplace: async (page = 1) => {
    set({ loading: true });
    try {
      const r = await authFetch(`/api/skills/marketplace?page=${page}&pageSize=12`);
      const d = await r.json();
      if (d.success) {
        set({
          skills: d.data || [],
          marketplacePage: d.pagination?.page || 1,
          marketplaceTotalPages: d.pagination?.totalPages || 0,
          loading: false,
        });
      } else set({ loading: false });
    } catch { set({ loading: false }); }
  },

  setCategory: (cat) => set({ category: cat }),
  setSearch: (q) => set({ search: q }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab, category: "全部" }),

  toggleSelect: (id) => set((s) => {
    const next = new Set(s.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedIds: next };
  }),

  clearSelection: () => set({ selectedIds: new Set() }),

  toggleEnabled: async (id) => {
    const skill = get().skills.find(s => s.id === id);
    if (!skill) return;
    try {
      await authFetch(`/api/skills/${id}/toggle`, { method: "POST" });
      const newEnabled = skill.enabled ? 0 : 1;
      set((s) => ({
        skills: s.skills.map(sk => sk.id === id ? { ...sk, enabled: newEnabled } : sk),
        detailSkill: s.detailSkill?.id === id ? { ...s.detailSkill, enabled: newEnabled } : s.detailSkill,
      }));
    } catch { /* ignore */ }
  },

  setDetailSkill: (skill) => set({ detailSkill: skill }),
  setExpanded: (cat) => set({ expanded: cat }),

  createSkill: async (data) => {
    try {
      const r = await authFetch("/api/skills", { method: "POST", body: JSON.stringify(data) });
      const d = await r.json();
      if (d.success) { await get().fetchSkills(); return true; }
      return false;
    } catch { return false; }
  },

  importSkill: async (content) => {
    try {
      const r = await authFetch("/api/skills/import", { method: "POST", body: JSON.stringify({ content }) });
      const d = await r.json();
      if (d.success) { await get().fetchSkills(); return true; }
      return false;
    } catch { return false; }
  },

  deleteSkill: async (id) => {
    try {
      const r = await authFetch(`/api/skills/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (d.success) {
        set((s) => ({ skills: s.skills.filter(sk => sk.id !== id), detailSkill: s.detailSkill?.id === id ? null : s.detailSkill }));
        return true;
      }
      return false;
    } catch { return false; }
  },

  batchToggle: async (enabled) => {
    const ids = Array.from(get().selectedIds);
    await authFetch("/api/skills/batch-toggle", { method: "POST", body: JSON.stringify({ ids, enabled }) });
    set({ selectedIds: new Set() });
    await get().fetchSkills();
  },

  batchDelete: async () => {
    const ids = Array.from(get().selectedIds);
    for (const id of ids) await authFetch(`/api/skills/${id}`, { method: "DELETE" });
    set({ selectedIds: new Set() });
    await get().fetchSkills();
  },
}));
