import type { ProviderPreset, ProviderRow } from "./useProviders";

export interface PresetGroup {
  groupKey: string;
  groupName: string;
  presets: ProviderPreset[];
}

/** Preset brand card order (swap Tencent Cloud / Aliyun vs pure alphabetical). */
const PRESET_GROUP_ORDER = [
  "tencent",
  "kimi",
  "minimax",
  "opencode",
  "siliconflow",
  "aliyun",
  "volcengine",
  "zhipu",
] as const;

function comparePresetGroups(a: PresetGroup, b: PresetGroup): number {
  const ai = PRESET_GROUP_ORDER.indexOf(
    a.groupKey as (typeof PRESET_GROUP_ORDER)[number],
  );
  const bi = PRESET_GROUP_ORDER.indexOf(
    b.groupKey as (typeof PRESET_GROUP_ORDER)[number],
  );
  const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
  const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
  if (aRank !== bRank) return aRank - bRank;
  return a.groupName.localeCompare(b.groupName);
}

const VARIANT_LABELS: Record<string, string> = {
  dashscope: "DashScope",
  dashscope_intl: "Singapore",
  dashscope_us: "US",
  open_platform: "Open Platform",
  open_platform_cn: "China",
  open_platform_intl: "International",
  coding_plan: "Coding Plan",
  coding_plan_cn: "Coding (CN)",
  coding_plan_intl: "Coding (Intl)",
  token_plan: "Token Plan",
  token_plan_enterprise_cn: "Token Enterprise (CN)",
  token_plan_intl: "Token (Intl)",
  hy_token_plan: "Hy Token Plan",
  hai: "HAI",
  china: "China",
  international: "International",
  zen_compatible: "Zen · Compatible",
  zen_anthropic: "Zen · Anthropic",
  go_compatible: "Go · Compatible",
  go_anthropic: "Go · Anthropic",
};

export function presetVariantLabel(preset: ProviderPreset): string {
  if (preset.provider_variant && VARIANT_LABELS[preset.provider_variant]) {
    return VARIANT_LABELS[preset.provider_variant];
  }
  return preset.name;
}

export function presetLogoId(preset: ProviderPreset): string {
  return preset.logo_id || preset.id;
}

export function groupPresets(presets: ProviderPreset[]): {
  grouped: PresetGroup[];
  ungrouped: ProviderPreset[];
} {
  const groupMap = new Map<string, PresetGroup>();
  const ungrouped: ProviderPreset[] = [];

  for (const preset of presets) {
    if (preset.provider_group) {
      const existing = groupMap.get(preset.provider_group);
      if (existing) {
        existing.presets.push(preset);
      } else {
        groupMap.set(preset.provider_group, {
          groupKey: preset.provider_group,
          groupName: preset.provider_group_name || preset.provider_group,
          presets: [preset],
        });
      }
    } else {
      ungrouped.push(preset);
    }
  }

  const grouped: PresetGroup[] = [];
  for (const group of groupMap.values()) {
    if (group.presets.length >= 2) {
      grouped.push(group);
    } else {
      ungrouped.push(...group.presets);
    }
  }

  grouped.sort(comparePresetGroups);
  ungrouped.sort((a, b) => a.name.localeCompare(b.name));
  return { grouped, ungrouped };
}

export function isPresetProvider(
  provider: ProviderRow,
  presets: ProviderPreset[],
): boolean {
  return presets.some(
    (preset) => provider.name === preset.name || provider.name === preset.id,
  );
}

const LOCAL_PRESET_IDS = new Set(["ollama", "onnx"]);

/** Chat-capable local runtime shown first in the wizard (ONNX is embedding-only). */
export function isLocalChatPreset(preset: Pick<ProviderPreset, "id">): boolean {
  return preset.id === "ollama";
}

export function isLocalPreset(preset: Pick<ProviderPreset, "id">): boolean {
  return LOCAL_PRESET_IDS.has(preset.id);
}

/** Local providers that do not require a real API key. */
export function isLocalNoKeyPresetId(presetId: string): boolean {
  return presetId === "ollama" || presetId === "onnx";
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const LOCAL_SERVICE_HOSTS = new Set(["ollama", "lmstudio", "vllm"]);

/** True when the URL is a loopback or well-known local OpenAI-compatible host. */
export function isLocalBaseUrl(url?: string | null): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`);
    const host = parsed.hostname.toLowerCase();
    if (LOOPBACK_HOSTS.has(host) || LOCAL_SERVICE_HOSTS.has(host)) return true;
    return host.endsWith(".local");
  } catch {
    return /localhost|127\.0\.0\.1/.test(raw);
  }
}

export function localPlaceholderApiKey(
  url?: string | null,
  existing?: string | null,
): string {
  const key = (existing ?? "").trim();
  if (key) return key;
  return isLocalBaseUrl(url) ? "local" : "";
}

export function defaultWizardPreset(
  presets: ProviderPreset[],
): ProviderPreset | undefined {
  return (
    presets.find((p) => p.id === "ollama") ??
    presets.find((p) => isLocalChatPreset(p)) ??
    presets[0]
  );
}

export type WizardPresetDisplayItem =
  | { kind: "single"; preset: ProviderPreset }
  | { kind: "group"; group: PresetGroup };

const WIZARD_FEATURED_COUNT = 6;

/** Local chat (Ollama) first, then a few cloud brands; remaining cloud + ONNX in more. */
export function buildWizardPresetDisplay(presets: ProviderPreset[]): {
  featured: WizardPresetDisplayItem[];
  more: WizardPresetDisplayItem[];
} {
  const localChat = presets.filter((p) => isLocalChatPreset(p));
  const localEmbed = presets.filter(
    (p) => isLocalPreset(p) && !isLocalChatPreset(p),
  );
  const rest = presets.filter((p) => !isLocalPreset(p));
  const { grouped, ungrouped } = groupPresets(rest);
  const restItems: WizardPresetDisplayItem[] = [
    ...grouped.map(
      (group): WizardPresetDisplayItem => ({
        kind: "group",
        group,
      }),
    ),
    ...ungrouped.map(
      (preset): WizardPresetDisplayItem => ({
        kind: "single",
        preset,
      }),
    ),
  ];
  const localItems: WizardPresetDisplayItem[] = localChat.map((preset) => ({
    kind: "single",
    preset,
  }));
  const localEmbedItems: WizardPresetDisplayItem[] = localEmbed.map(
    (preset) => ({
      kind: "single" as const,
      preset,
    }),
  );
  const remainingSlots = Math.max(WIZARD_FEATURED_COUNT - localItems.length, 0);
  return {
    featured: [...localItems, ...restItems.slice(0, remainingSlots)],
    more: [...restItems.slice(remainingSlots), ...localEmbedItems],
  };
}

export function defaultModelsPresetTab(opts: {
  showLocal: boolean;
  showCloud: boolean;
}): "local" | "cloud" {
  if (opts.showLocal) return "local";
  return "cloud";
}

/** Stable placeholder api_key written when creating a local preset row. */
function localPresetApiKey(provider: { api_key?: string | null }): string {
  return (provider.api_key ?? "").trim().toLowerCase();
}

export function isOnnxProviderRow(provider: {
  name: string;
  api_key?: string | null;
}): boolean {
  if (localPresetApiKey(provider) === "onnx") return true;
  const n = provider.name.toLowerCase();
  return n === "onnx" || n === "onnx (local)";
}

export function isOllamaProviderRow(provider: {
  name: string;
  base_url?: string | null;
  api_key?: string | null;
}): boolean {
  if (isOnnxProviderRow(provider)) return false;
  if (localPresetApiKey(provider) === "ollama") return true;
  const n = provider.name.toLowerCase();
  return (
    n === "ollama" ||
    n === "ollama (local)" ||
    (provider.base_url?.includes("11434") ?? false) ||
    (provider.base_url?.includes("ollama") ?? false)
  );
}

export function isLocalProviderRow(provider: {
  name: string;
  base_url?: string | null;
  api_key?: string | null;
}): boolean {
  return isOnnxProviderRow(provider) || isOllamaProviderRow(provider);
}

export function findConfiguredProvider(
  preset: ProviderPreset,
  providers: ProviderRow[],
): ProviderRow | undefined {
  const exact = providers.find(
    (p) => p.name === preset.name || p.name === preset.id,
  );
  if (exact) return exact;
  if (preset.id === "ollama") {
    return providers.find((p) => isOllamaProviderRow(p));
  }
  if (preset.id === "onnx") {
    return providers.find((p) => isOnnxProviderRow(p));
  }
  return undefined;
}
