import { create } from "zustand";
import { authFetch } from "../api/authFetch";
import { DEFAULT_MODULE_STATE, TenantModuleKey } from "../config/modules";

export interface TenantModuleSetting {
  key: TenantModuleKey;
  label: string;
  description: string;
  enabled: boolean;
}

interface ModuleSettingsState {
  modules: Record<TenantModuleKey, boolean>;
  tenantId: number | null;
  loading: boolean;
  error: string | null;
  load: (tenantId?: number) => Promise<void>;
  applyOverrides: (disabled: string[]) => void;
  reset: () => void;
}

export const useModuleSettingsStore = create<ModuleSettingsState>((set) => ({
  modules: { ...DEFAULT_MODULE_STATE },
  tenantId: null,
  loading: false,
  error: null,
  load: async (tenantId) => {
    set({ loading: true, error: null });
    try {
      const query = tenantId ? `?tenant_id=${tenantId}` : "";
      const response = await authFetch(`/api/module-settings${query}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "模块配置加载失败");
      const modules = { ...DEFAULT_MODULE_STATE };
      for (const module of result.data.modules as TenantModuleSetting[]) modules[module.key] = module.enabled;
      set({ modules, tenantId: result.data.tenant.id, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "模块配置加载失败" });
    }
  },
  applyOverrides: (disabled) => {
    const off = new Set(disabled.filter(Boolean));
    const modules = { ...DEFAULT_MODULE_STATE };
    for (const key of Object.keys(modules) as TenantModuleKey[]) {
      if (off.has(key)) modules[key] = false;
    }
    set({ modules });
  },
  reset: () => set({ modules: { ...DEFAULT_MODULE_STATE }, tenantId: null, loading: false, error: null }),
}));
