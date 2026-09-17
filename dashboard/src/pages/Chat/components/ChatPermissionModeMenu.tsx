import { useMemo, useState } from "react";
import { Popover, Tooltip } from "antd";
import { AlertTriangle, Check, ChevronDown, Hand, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { showConfirmModal } from "../../../utils/confirmModal";
import type { ChatPermissionMode } from "../utils/permissionMode";
import styles from "../index.module.less";

interface ChatPermissionModeMenuProps {
  mode: ChatPermissionMode;
  onChange: (mode: ChatPermissionMode) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

const MODE_ORDER: ChatPermissionMode[] = ["default", "auto", "full"];

export default function ChatPermissionModeMenu({
  mode,
  onChange,
  disabled,
  isMobile,
}: ChatPermissionModeMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const labels = useMemo(
    () => ({
      default: t("chat.permissionMode.default", "默认权限"),
      auto: t("chat.permissionMode.auto", "自动审批"),
      full: t("chat.permissionMode.full", "完全访问"),
    }),
    [t],
  );
  const hints = useMemo(
    () => ({
      default: t(
        "chat.permissionMode.defaultHint",
        "按当前安全策略询问或执行工具。",
      ),
      auto: t(
        "chat.permissionMode.autoHint",
        "在受保护的工作区沙箱内自动执行命令；需要越过沙箱边界的操作交给自动审查器判断，高风险操作可能被拒绝或要求确认。",
      ),
      full: t(
        "chat.permissionMode.fullHint",
        "允许更高权限的操作；高风险命令仍可能被安全策略拦截。",
      ),
    }),
    [t],
  );

  const applyMode = (next: ChatPermissionMode) => {
    if (next === mode) {
      setOpen(false);
      return;
    }
    if (next === "full") {
      setOpen(false);
      showConfirmModal(
        {
          title: t("chat.permissionMode.fullConfirmTitle", "切换到完全访问？"),
          content: t(
            "chat.permissionMode.fullConfirm",
            "完全访问会放宽本对话的工具审批。请确认你信任这次任务。",
          ),
          okText: t("common.confirm"),
          cancelText: t("common.cancel"),
          okButtonProps: { danger: true },
          onOk: () => onChange("full"),
        },
        { isMobile },
      );
      return;
    }
    onChange(next);
    setOpen(false);
  };

  const menu = (
    <div className={styles.permissionMenu} role="menu">
      {MODE_ORDER.map((item) => {
        const active = item === mode;
        const row = (
          <button
            key={item}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            className={`${styles.permissionMenuItem} ${
              active ? styles.permissionMenuItemActive : ""
            } ${item === "full" ? styles.permissionMenuItemWarn : ""}`}
            onClick={() => applyMode(item)}
          >
            <span className={styles.permissionMenuIcon} aria-hidden>
              {item === "default" ? (
                <Hand size={16} strokeWidth={1.8} />
              ) : item === "auto" ? (
                <Sparkles size={16} strokeWidth={1.8} />
              ) : (
                <AlertTriangle size={16} strokeWidth={1.8} />
              )}
            </span>
            <span className={styles.permissionMenuLabel}>{labels[item]}</span>
            {active ? <Check size={16} strokeWidth={2} /> : null}
          </button>
        );
        if (item === "auto") {
          return (
            <Tooltip
              key={item}
              title={hints.auto}
              placement="right"
              mouseEnterDelay={0.15}
            >
              {row}
            </Tooltip>
          );
        }
        return row;
      })}
    </div>
  );

  return (
    <Popover
      trigger="click"
      placement="topLeft"
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
      }}
      overlayClassName={styles.permissionPopover}
      content={menu}
    >
      <button
        type="button"
        className={`${styles.permissionTrigger} ${
          mode === "full" ? styles.permissionTriggerWarn : ""
        }`}
        disabled={disabled}
        aria-label={t("chat.permissionMode.label", "使用权限")}
        title={hints[mode]}
      >
        {mode === "default" ? (
          <Hand size={14} strokeWidth={1.8} aria-hidden />
        ) : mode === "auto" ? (
          <Sparkles size={14} strokeWidth={1.8} aria-hidden />
        ) : (
          <AlertTriangle size={14} strokeWidth={1.8} aria-hidden />
        )}
        <span>{labels[mode]}</span>
        <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
      </button>
    </Popover>
  );
}
