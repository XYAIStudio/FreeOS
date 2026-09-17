import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Globe,
  ListChecks,
  ScanSearch,
  Terminal,
} from "lucide-react";
import type { WorkspacePanelKind } from "../utils/workspacePanels";
import { WORKSPACE_PANEL_KINDS } from "../utils/workspacePanels";
import styles from "../index.module.less";

const ICONS: Record<WorkspacePanelKind, typeof FileText> = {
  files: FileText,
  review: ScanSearch,
  tasks: ListChecks,
  browser: Globe,
  terminal: Terminal,
};

interface ChatDockStartStateProps {
  onOpen: (kind: WorkspacePanelKind) => void;
}

export default function ChatDockStartState({ onOpen }: ChatDockStartStateProps) {
  const { t } = useTranslation();

  const title = (kind: WorkspacePanelKind) => {
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
    <div className={styles.rightRailStart} data-testid="chat-right-rail-start">
      <div className={styles.rightRailStartIntro}>
        <div className={styles.rightRailStartKicker}>
          {t("chat.rightRail.title", "右侧栏")}
        </div>
        <h2 className={styles.rightRailStartTitle}>
          {t("chat.rightRail.startTitle", "开始一个面板")}
        </h2>
        <p className={styles.rightRailStartDesc}>
          {t(
            "chat.rightRail.startDesc",
            "在右侧打开文件、审查、资源监视器、内置浏览器或终端，与左侧对话并行工作。",
          )}
        </p>
      </div>
      <div className={styles.rightRailStartList}>
        {WORKSPACE_PANEL_KINDS.map((kind) => {
          const Icon = ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              className={styles.rightRailStartItem}
              onClick={() => onOpen(kind)}
            >
              <span className={styles.rightRailStartItemIcon} aria-hidden>
                <Icon size={18} strokeWidth={1.7} />
              </span>
              <span className={styles.rightRailStartItemText}>
                <span className={styles.rightRailStartItemTitle}>
                  {title(kind)}
                </span>
                <span className={styles.rightRailStartItemHint}>{hint(kind)}</span>
              </span>
              <ChevronRight
                className={styles.rightRailStartItemChevron}
                size={16}
                strokeWidth={1.7}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
      <p className={styles.rightRailStartFooter}>
        {t("chat.rightRail.footerHint", "可通过顶部 + 按钮选择更多面板类型")}
      </p>
    </div>
  );
}
