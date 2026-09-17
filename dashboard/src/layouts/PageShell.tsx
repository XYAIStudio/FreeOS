import type { ReactNode } from "react";
import { Typography } from "antd";
import AgentSelector from "../components/AgentSelector";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  titleRowEndPadding,
  DESKTOP_DRAG_REGION_CLASS,
  DESKTOP_NO_DRAG_CLASS,
} from "../utils/desktopChrome";
import styles from "./PageShell.module.less";

const { Title, Text } = Typography;

/** One option for URL-synced path tabs (Workbench / Personalization). */
export interface PathTabOption {
  value: string;
  label: string;
  icon: ReactNode;
}

export interface PathTabsConfig {
  value: string;
  options: PathTabOption[];
  onChange: (value: string | number) => void;
}

interface PageShellProps {
  title: string;
  subtitle?: string;
  /** Right-aligned action buttons shown alongside the title. */
  actions?: React.ReactNode;
  /**
   * Path tabs shared by Workbench / Personalization:
   * desktop → title-row actions (wraps); mobile → full-width bar above content.
   * Use `pathTabsPlacement="below-title"` for a two-row strip under the title.
   */
  pathTabs?: PathTabsConfig;
  /**
   * `title-row` (default): desktop chips sit in the title actions slot and wrap.
   * `below-title`: two equal rows directly under the title, on the page background.
   */
  pathTabsPlacement?: "title-row" | "below-title";
  /** Render agent picker below the title row, outside the scrollable content card. */
  agentScoped?: boolean;
  /** When true, the content area does not scroll; children fill remaining height. */
  fill?: boolean;
  children: React.ReactNode;
}

function splitPathTabRows(options: PathTabOption[]): PathTabOption[][] {
  if (options.length <= 1) return [options];
  const mid = Math.ceil(options.length / 2);
  return [options.slice(0, mid), options.slice(mid)];
}

function PathTabButton({
  opt,
  active,
  compact,
  onChange,
}: {
  opt: PathTabOption;
  active: boolean;
  compact: boolean;
  onChange: (value: string | number) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${styles.pathTab} ${active ? styles.pathTabActive : ""}`}
      onClick={() => onChange(opt.value)}
    >
      {compact ? null : opt.icon}
      <span className={styles.pathTabText}>{opt.label}</span>
    </button>
  );
}

function PathTabsBar({
  pathTabs,
  compact,
  splitRows,
  flush,
}: {
  pathTabs: PathTabsConfig;
  compact: boolean;
  splitRows?: boolean;
  flush?: boolean;
}) {
  const rows = splitRows
    ? splitPathTabRows(pathTabs.options)
    : [pathTabs.options];
  return (
    <div
      className={`${styles.pathTabs} ${compact ? styles.pathTabsCompact : ""} ${
        flush ? styles.pathTabsFlush : ""
      }`}
      role="tablist"
    >
      {rows.map((row, index) => (
        <div
          key={index}
          className={styles.pathTabsRow}
          data-testid="path-tabs-row"
        >
          {row.map((opt) => (
            <PathTabButton
              key={opt.value}
              opt={opt}
              active={opt.value === pathTabs.value}
              compact={compact}
              onChange={pathTabs.onChange}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Universal page wrapper for every non-fullscreen, non-Chat page.
 *
 * Visual contract (master spec §5 / sub-project ② spec §6.2):
 *  - Title row: 20px / 600 weight, fixed (does not scroll with content)
 *  - Subtitle: 13px / secondary colour, 4px below title
 *  - Optional agent bar (`agentScoped`): below title, outside content card
 *  - Gap between title row and content: 24px (12px + agent bar when scoped)
 *  - Content: colorBgContainer background, 24px padding, 8px radius
 *  - Only the content area scrolls internally
 *  - `actions` slot: right-aligned in the title row
 *  - `pathTabs`: desktop in title row (flex-wrap); mobile full-width wrapping bar
 *  - `pathTabsPlacement="below-title"`: two rows under the title, page-bg strip
 *
 * Tabbed helpers: `PageShell.FillTabs` (Ant Tabs) and `PageShell.Tabbed`
 * (custom tab bar) pin the tab chrome and scroll only the body on desktop.
 */
function PageShell({
  title,
  subtitle,
  actions,
  pathTabs,
  pathTabsPlacement = "title-row",
  agentScoped,
  fill,
  children,
}: PageShellProps) {
  const isMobile = useIsMobile();
  const outerPad = isMobile ? 12 : 32;
  const outerPadTop = isMobile ? 12 : 24;
  const contentPad = isMobile ? 12 : 24;
  const tabsBelowTitle = Boolean(
    pathTabs && pathTabsPlacement === "below-title",
  );
  const tabsInTitleRow = Boolean(pathTabs && !tabsBelowTitle && !isMobile);
  const tabsInContent = Boolean(pathTabs && !tabsBelowTitle && isMobile);
  /** Fill layout, or mobile path-tabs that must stay pinned above the body. */
  const pinBody = Boolean(fill || tabsInContent);

  const titleActions =
    tabsInTitleRow && pathTabs ? (
      <>
        <PathTabsBar pathTabs={pathTabs} compact={false} />
        {actions}
      </>
    ) : (
      actions
    );

  return (
    <div
      className={DESKTOP_DRAG_REGION_CLASS}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: `${outerPadTop}px ${outerPad}px ${outerPad}px`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Title row — wraps so a long tab strip cannot squeeze CJK titles. */}
      <div
        className={styles.titleRow}
        style={{
          marginBottom: tabsBelowTitle ? 8 : agentScoped ? 12 : 24,
          paddingRight: titleRowEndPadding(outerPad),
        }}
      >
        <div className={styles.titleCopy}>
          <Title level={4} className={styles.titleText}>
            {title}
          </Title>
          {subtitle && (
            <Text type="secondary" className={styles.subtitleText}>
              {subtitle}
            </Text>
          )}
        </div>
        {titleActions ? (
          <div className={styles.titleActions}>{titleActions}</div>
        ) : null}
      </div>

      {tabsBelowTitle && pathTabs ? (
        <div className={styles.pathTabsBelowTitle}>
          <PathTabsBar pathTabs={pathTabs} compact={isMobile} splitRows flush />
        </div>
      ) : null}

      {agentScoped && (
        <div className={styles.agentBar}>
          <AgentSelector />
        </div>
      )}

      {/* Content — scrolls internally. Tighter side padding on mobile so
         tabbed pages get more usable horizontal space. Path tabs on mobile
         pin above the body (same chrome as Workbench / Personalization). */}
      <div
        className={DESKTOP_NO_DRAG_CLASS}
        style={{
          flex: 1,
          background: "var(--fn-bg-container, var(--fn-bg-elevated))",
          borderRadius: 8,
          padding: contentPad,
          // Mobile: never create a page-level horizontal scrollbar; wide
          // tables scroll via antd scroll.x inside their own wrapper.
          overflowX: pinBody || isMobile ? "hidden" : "auto",
          overflowY: pinBody ? "hidden" : "auto",
          minHeight: 0,
          minWidth: 0,
          display: pinBody ? "flex" : undefined,
          flexDirection: pinBody ? "column" : undefined,
        }}
      >
        {tabsInContent && pathTabs && (
          <div className={styles.pathTabsMobile}>
            <PathTabsBar pathTabs={pathTabs} compact />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

type TabbedShellProps = Omit<PageShellProps, "fill" | "children"> & {
  children: ReactNode;
};

/** Ant Design Tabs: pin nav, scroll only the active pane (desktop). */
function PageShellFillTabs({ children, ...shell }: TabbedShellProps) {
  const isMobile = useIsMobile();
  return (
    <PageShell {...shell} fill={!isMobile}>
      <div className={styles.fillTabs}>{children}</div>
    </PageShell>
  );
}

type PageShellTabbedProps = TabbedShellProps & {
  /** Custom tab bar rendered above the scrollable body. */
  tabBar: ReactNode;
};

/** Custom tab bar + scrollable body (desktop pins the bar). */
function PageShellTabbed({ tabBar, children, ...shell }: PageShellTabbedProps) {
  const isMobile = useIsMobile();
  return (
    <PageShell {...shell} fill={!isMobile}>
      <div className={styles.tabbed}>
        {tabBar}
        <div className={styles.tabbedBody}>{children}</div>
      </div>
    </PageShell>
  );
}

PageShell.FillTabs = PageShellFillTabs;
PageShell.Tabbed = PageShellTabbed;

export default PageShell;
export { styles as pageShellStyles };
export type { PageShellProps };
