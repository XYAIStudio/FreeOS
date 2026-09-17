import {
  FileText,
  Globe,
  ListChecks,
  ScanSearch,
  Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkspacePanelKind } from "../utils/workspacePanels";
import { WORKSPACE_PANEL_KINDS } from "../utils/workspacePanels";
import styles from "../index.module.less";

const ICONS: Record<
  WorkspacePanelKind,
  typeof FileText
> = {
  files: FileText,
  review: ScanSearch,
  tasks: ListChecks,
  browser: Globe,
  terminal: Terminal,
};

interface ChatPanelPickerProps {
  onSelect: (kind: WorkspacePanelKind) => void;
  disabledKinds?: ReadonlySet<WorkspacePanelKind>;
}

export default function ChatPanelPicker({
  onSelect,
  disabledKinds,
}: ChatPanelPickerProps) {
  const { t } = useTranslation();

  const label = (kind: WorkspacePanelKind) => {
    switch (kind) {
      case "files":
        return t("chat.rightRail.openFiles", "打开文件");
      case "review":
        return t("chat.rightRail.openReview", "打开审查");
      case "tasks":
        return t("chat.rightRail.openTasks", "打开后台任务");
      case "browser":
        return t("chat.rightRail.openBrowser", "打开浏览器");
      case "terminal":
        return t("chat.rightRail.openTerminal", "打开终端");
    }
  };

  const hint = (kind: WorkspacePanelKind) => {
    switch (kind) {
      case "files":
        return t("chat.rightRail.openFilesHint", "文件");
      case "review":
        return t("chat.rightRail.openReviewHint", "审查");
      case "tasks":
        return t("chat.rightRail.openTasksHint", "后台任务");
      case "browser":
        return t("chat.rightRail.openBrowserHint", "浏览器");
      case "terminal":
        return t("chat.rightRail.openTerminalHint", "终端");
    }
  };

  return (
    <div className={styles.rightRailPicker} role="menu">
      {WORKSPACE_PANEL_KINDS.map((kind) => {
        const Icon = ICONS[kind];
        const disabled = disabledKinds?.has(kind);
        return (
          <button
            key={kind}
            type="button"
            role="menuitem"
            className={styles.rightRailPickerItem}
            disabled={disabled}
            onClick={() => onSelect(kind)}
          >
            <span className={styles.rightRailPickerIcon} aria-hidden>
              <Icon size={18} strokeWidth={1.75} />
            </span>
            <span className={styles.rightRailPickerText}>
              <span className={styles.rightRailPickerLabel}>{label(kind)}</span>
              <span className={styles.rightRailPickerHint}>{hint(kind)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
