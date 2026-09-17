import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Empty } from "antd";
import {
  Blocks,
  Bot,
  Brain,
  HardDrive,
  Monitor,
  Notebook,
  Package,
  PanelsTopLeft,
  Plug,
  Puzzle,
  Settings2,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Users,
  Waypoints,
  Wrench,
} from "lucide-react";
import PageShell, { pageShellStyles } from "../../../layouts/PageShell";
import PageLoading from "../../../components/PageLoading";
import { useAgent } from "../../../context/AgentContext";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { usePathTabs } from "../../../hooks/usePathTabs";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { useServerCapabilities } from "../../../hooks/useServerCapabilities";
import SkillsTabs from "../Skills/components/SkillsTabs";
import ToolsPanel from "../Tools/ToolsPanel";
import SubagentManager from "../../Experts/components/SubagentManager";
import MBTISelector from "./components/MBTISelector";
import AgentPluginsPanel from "./components/AgentPluginsPanel";
import HostAppDiscoverPanel from "./components/HostAppDiscoverPanel";
import MemoryPanel from "../Memory/MemoryPanel";
import ChannelsPanel from "../Channels/ChannelsPanel";
import {
  PERSONALIZATION_TABS,
  allowedPersonalizationTabs,
  type PersonalizationTab,
} from "./tabs";
import styles from "./index.module.less";

export type { PersonalizationTab };

const ConnectorsPage = lazy(() => import("../Connectors"));
const SkillPackagesPage = lazy(() => import("../../SkillPackages"));
const ACPPage = lazy(() => import("../ACP"));
const AgentConfigPage = lazy(() => import("../Config"));
const AdminUsersPage = lazy(() => import("../../Admin/Users"));
const AdminStoragePage = lazy(() => import("../../Admin/Storage"));
const AdminPluginsPage = lazy(() => import("../../Admin/Plugins"));
const AdminSecurityPage = lazy(() => import("../../Settings/Security"));
const AdvancedSettingsPage = lazy(
  () => import("../../Settings/AdvancedSettings"),
);
const WorkbenchPage = lazy(() => import("../../Control/Workbench"));
const RemoteDesktopPage = lazy(() => import("../../Control/RemoteDesktop"));

const TAB_ICONS: Record<PersonalizationTab, typeof Sparkles> = {
  skills: Sparkles,
  channels: Waypoints,
  connectors: Plug,
  "skill-packages": Package,
  tools: Wrench,
  plugins: Puzzle,
  subagents: Bot,
  mbti: Brain,
  memory: Notebook,
  workbench: PanelsTopLeft,
  "remote-desktop": Monitor,
  acp: Share2,
  users: Users,
  storage: HardDrive,
  "host-plugins": Blocks,
  security: Shield,
  advanced: SlidersHorizontal,
  "agent-config": Settings2,
};

export default function PersonalizationPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const user = useCurrentUser();
  const { mobileEnabled } = useServerCapabilities();
  const { activeAgentId, agents } = useAgent();
  const activeAgent = agents.find((a) => a.agent_id === activeAgentId);
  const allowed = useMemo(
    () => allowedPersonalizationTabs(user, { mobileEnabled }),
    [user, mobileEnabled],
  );
  const allowedSet = useMemo(() => new Set(allowed), [allowed]);
  const isAllowed = useCallback(
    (tab: PersonalizationTab) => allowedSet.has(tab),
    [allowedSet],
  );

  const { activeTab, handleTabChange, isMounted } = usePathTabs({
    basePath: "/personalization",
    tabs: PERSONALIZATION_TABS,
    storageKey: "octop:personalization:tab",
    defaultTab: allowed[0] ?? "skills",
    isAllowed,
  });

  const pathTabs = useMemo(
    () => ({
      value: activeTab,
      onChange: handleTabChange,
      options: allowed.map((value) => {
        const Icon = TAB_ICONS[value];
        return {
          value,
          label: t(`personalization.tabs.${value}`),
          icon: <Icon size={14} strokeWidth={2} />,
        };
      }),
    }),
    [activeTab, handleTabChange, allowed, t],
  );

  const pageTitle = `${t("personalization.title")} / ${t(
    `personalization.tabs.${activeTab}`,
  )}`;

  const hostPanel = (tab: PersonalizationTab) =>
    isMounted(tab) && allowedSet.has(tab) ? (
      <div
        className={styles.panel}
        style={{ display: activeTab === tab ? "flex" : "none" }}
        aria-hidden={activeTab !== tab}
      >
        <div className={pageShellStyles.fillChild}>
          <Suspense fallback={<PageLoading />}>
            {tab === "workbench" ? (
              <WorkbenchPage embedded isVisible={activeTab === "workbench"} />
            ) : null}
            {tab === "remote-desktop" ? <RemoteDesktopPage embedded /> : null}
            {tab === "acp" ? <ACPPage /> : null}
            {tab === "users" ? <AdminUsersPage /> : null}
            {tab === "storage" ? <AdminStoragePage /> : null}
            {tab === "host-plugins" ? <AdminPluginsPage /> : null}
            {tab === "security" ? <AdminSecurityPage /> : null}
            {tab === "advanced" ? <AdvancedSettingsPage /> : null}
            {tab === "agent-config" ? <AgentConfigPage /> : null}
          </Suspense>
        </div>
      </div>
    ) : null;

  return (
    <PageShell
      title={pageTitle}
      agentScoped
      fill={!isMobile}
      pathTabs={pathTabs}
      pathTabsPlacement="below-title"
    >
      <div className={styles.panels}>
        {isMounted("skills") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "skills" ? "flex" : "none" }}
            aria-hidden={activeTab !== "skills"}
          >
            <div className={pageShellStyles.fillChild}>
              <HostAppDiscoverPanel kinds={["skill"]} />
              <SkillsTabs agentId={activeAgentId} />
            </div>
          </div>
        )}

        {isMounted("tools") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "tools" ? "flex" : "none" }}
            aria-hidden={activeTab !== "tools"}
          >
            <div className={pageShellStyles.fillChild}>
              <ToolsPanel agentId={activeAgentId} />
            </div>
          </div>
        )}

        {isMounted("plugins") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "plugins" ? "flex" : "none" }}
            aria-hidden={activeTab !== "plugins"}
          >
            <div className={pageShellStyles.fillChild}>
              <HostAppDiscoverPanel kinds={["plugin"]} />
              <AgentPluginsPanel agentId={activeAgentId} />
            </div>
          </div>
        )}

        {isMounted("connectors") && allowedSet.has("connectors") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "connectors" ? "flex" : "none" }}
            aria-hidden={activeTab !== "connectors"}
          >
            <div className={pageShellStyles.fillChild}>
              <HostAppDiscoverPanel kinds={["mcp"]} />
              <Suspense fallback={<PageLoading />}>
                <ConnectorsPage />
              </Suspense>
            </div>
          </div>
        )}

        {isMounted("skill-packages") && allowedSet.has("skill-packages") && (
          <div
            className={styles.panel}
            style={{
              display: activeTab === "skill-packages" ? "flex" : "none",
            }}
            aria-hidden={activeTab !== "skill-packages"}
          >
            <div className={pageShellStyles.fillChild}>
              <Suspense fallback={<PageLoading />}>
                <SkillPackagesPage />
              </Suspense>
            </div>
          </div>
        )}

        {isMounted("subagents") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "subagents" ? "flex" : "none" }}
            aria-hidden={activeTab !== "subagents"}
          >
            {!activeAgentId ? (
              <Empty
                style={{ marginTop: isMobile ? 48 : 24 }}
                description={t("subagents.pickAgent")}
              />
            ) : (
              <SubagentManager
                key={activeAgentId}
                agentId={activeAgentId}
                agentState={activeAgent?.state ?? "stopped"}
                fillHeight={isMobile}
              />
            )}
          </div>
        )}

        {isMounted("mbti") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "mbti" ? "flex" : "none" }}
            aria-hidden={activeTab !== "mbti"}
          >
            {!activeAgentId ? (
              <Empty
                style={{ marginTop: 24 }}
                description={t("mbtiPage.pickAgent")}
              />
            ) : (
              <div className={pageShellStyles.fillChild}>
                <MBTISelector
                  key={activeAgentId}
                  showHeader={false}
                  showTestAction
                />
              </div>
            )}
          </div>
        )}

        {isMounted("memory") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "memory" ? "flex" : "none" }}
            aria-hidden={activeTab !== "memory"}
          >
            {isMobile ? (
              <MemoryPanel agentId={activeAgentId} fill={false} />
            ) : (
              <div className={pageShellStyles.fillChild}>
                <MemoryPanel agentId={activeAgentId} fill />
              </div>
            )}
          </div>
        )}

        {isMounted("channels") && allowedSet.has("channels") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "channels" ? "flex" : "none" }}
            aria-hidden={activeTab !== "channels"}
          >
            <div className={pageShellStyles.fillChild}>
              <ChannelsPanel agentId={activeAgentId} />
            </div>
          </div>
        )}

        {hostPanel("workbench")}
        {hostPanel("remote-desktop")}
        {hostPanel("acp")}
        {hostPanel("users")}
        {hostPanel("storage")}
        {hostPanel("host-plugins")}
        {hostPanel("security")}
        {hostPanel("advanced")}
        {hostPanel("agent-config")}
      </div>
    </PageShell>
  );
}
