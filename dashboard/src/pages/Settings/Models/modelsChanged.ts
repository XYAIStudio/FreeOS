export const MODELS_CHANGED_EVENT = "octop:models-changed";

export function notifyModelsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MODELS_CHANGED_EVENT));
}
