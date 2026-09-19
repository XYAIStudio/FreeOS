import { create } from "zustand";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
  init: () => void;
}

type SharedAppearance = {
  preference?: "system" | "light" | "dark";
  palette?: string;
  customColor?: string;
};

const PALETTE_COLORS: Record<string, [string, string, string, string]> = {
  freeos: ["#0033FF", "#002EE6", "#DCE5FF", "#F1F5FF"],
  rose: ["#E85D75", "#D14A62", "#FCE7EB", "#FFF5F7"],
  tech: ["#3A5FE0", "#2E4FD4", "#DFE6FF", "#F3F6FF"],
  indigo: ["#4F46E5", "#4338CA", "#E5E7FF", "#F5F5FF"],
  teal: ["#0F766E", "#115E59", "#CCFBF1", "#F0FDFA"],
  violet: ["#7C3AED", "#6D28D9", "#EDE9FE", "#F7F5FF"],
  emerald: ["#047857", "#065F46", "#D1FAE5", "#ECFDF5"],
  amber: ["#B45309", "#92400E", "#FEF3C7", "#FFFBEB"],
  slate: ["#475569", "#334155", "#E2E8F0", "#F8FAFC"],
};

function readSharedAppearance(): SharedAppearance {
  const raw = localStorage.getItem("theme");
  if (!raw) return { preference: "system", palette: "freeos" };
  if (raw === "light" || raw === "dark" || raw === "system") {
    return { preference: raw, palette: "freeos" };
  }
  try {
    const parsed = JSON.parse(raw) as SharedAppearance;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function applySharedAppearance(appearance: SharedAppearance): boolean {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark =
    appearance.preference === "dark" ||
    (appearance.preference !== "light" && prefersDark);
  const custom =
    appearance.palette === "custom"
      ? appearance.customColor?.match(/^#[0-9a-f]{6}$/i)?.[0]
      : undefined;
  const colors = custom
    ? [custom, custom, `${custom}24`, `${custom}0d`]
    : (PALETTE_COLORS[appearance.palette || "freeos"] ?? PALETTE_COLORS.freeos);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.setProperty("--primary", dark && !custom ? "#6B8CFF" : colors[0]);
  root.style.setProperty("--primary-hover", dark && !custom ? "#8AA8FF" : colors[1]);
  root.style.setProperty("--primary-light", dark ? "#172554" : colors[2]);
  root.style.setProperty("--primary-bg", dark ? "#0B1538" : colors[3]);
  root.style.setProperty("--color-primary", dark && !custom ? "#6B8CFF" : colors[0]);
  root.style.setProperty("--color-primary-hover", dark && !custom ? "#8AA8FF" : colors[1]);
  root.style.setProperty("--color-primary-light", dark ? "#172554" : colors[2]);
  root.style.setProperty("--color-primary-bg", dark ? "#0B1538" : colors[3]);
  root.style.setProperty("--accent", dark ? "#8AA8FF" : colors[0]);
  root.style.setProperty("--accent-light", dark ? "#172554" : colors[2]);
  root.style.setProperty("--color-accent", dark ? "#8AA8FF" : colors[0]);
  root.style.setProperty("--color-accent-light", dark ? "#172554" : colors[2]);
  return dark;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  dark: false,
  toggle: () => {
    const newDark = !get().dark;
    set({ dark: newDark });
    const appearance = readSharedAppearance();
    localStorage.setItem(
      "theme",
      JSON.stringify({ ...appearance, preference: newDark ? "dark" : "light" }),
    );
    applySharedAppearance({
      ...appearance,
      preference: newDark ? "dark" : "light",
    });
  },
  init: () => {
    const dark = applySharedAppearance(readSharedAppearance());
    set({ dark });
    window.addEventListener("storage", (event) => {
      if (event.key !== "theme") return;
      set({ dark: applySharedAppearance(readSharedAppearance()) });
    });
  },
}));
