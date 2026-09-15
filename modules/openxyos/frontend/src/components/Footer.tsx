import { useLocale } from "../i18n";

export default function Footer() {
  const { t } = useLocale();
  return (
    <footer className="shrink-0 py-3 px-6 border-t border-border bg-bg-card text-center text-xs text-text-muted">
      {t("openXYOS 社区版 · Apache License 2.0 · 开放共建", "openXYOS Community · Apache License 2.0 · Built in the open")}
    </footer>
  );
}