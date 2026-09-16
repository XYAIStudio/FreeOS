import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Segmented } from "antd";
import {
  Cpu,
  HardDrive,
  Monitor,
  PanelsTopLeft,
  Puzzle,
  Settings2,
  Share2,
  Shield,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import PageShell from "../../layouts/PageShell";
import PageLoading from "../../components/PageLoading";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePathTabs } from "../../hooks/usePathTabs";
import { useServerCapabilities } from "../../hooks/useServerCapabilities";
import {
  SYSTEM_SETTINGS_LABEL_KEY,
  SYSTEM_SETTINGS_TABS,
  allowedSystemSettingsTabs,
  systemSettingsPath,
  type SystemSettingsTab,
} from "./tabs";
import styles from "./SystemSettings.module.less";

const ACPPage = lazy(() => import("../Agent/ACP"));
const AgentConfigPage = lazy(() => import("../Agent/Config"));
const ModelsPage = lazy(() => import("../Settings/Models"));
const AdminUsersPage = lazy(() => import("../Admin/Users"));
const AdminStoragePage = lazy(() => import("../Admin/Storage"));
const AdminPluginsPage = lazy(() => import("../Admin/Plugins"));
const AdminSecurityPage = lazy(() => import("../Settings/Security"));
const AdvancedSettingsPage = lazy(() => import("../Settings/AdvancedSettings"));
const WorkbenchPage = lazy(() => import("../Control/Workbench"));
const RemoteDesktopPage = lazy(() => import("../Control/RemoteDesktop"));

const TAB_ICONS = {
  workbench: PanelsTopLeft,
  "remote-desktop": Monitor,
  acp: Share2,
  users: Users,
  models: Cpu,
  storage: HardDrive,
  plugins: Puzzle,
  security: Shield,
  advanced: SlidersHorizontal,
  "agent-config": Settings2,
} as const;

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const user = useCurrentUser();
  const { mobileEnabled } = useServerCapabilities();
  const allowed = useMemo(
    () => allowedSystemSettingsTabs(user, { mobileEnabled }),
    [user, mobileEnabled],
  );
  const allowedSet = useMemo(() => new Set(allowed), [allowed]);
  const defaultTab = allowed.includes("users")
    ? "users"
    : allowed[0] ?? "users";
  const isAllowed = useCallback(
    (tab: SystemSettingsTab) => allowedSet.has(tab),
    [allowedSet],
  );

  const { activeTab, handleTabChange, isMounted } = usePathTabs({
    basePath: "/system-settings",
    tabs: SYSTEM_SETTINGS_TABS,
    storageKey: "freeos:system-settings:tab",
    defaultTab,
    isAllowed,
  });

  const options = allowed.map((tab) => {
    const Icon = TAB_ICONS[tab];
    return {
      value: tab,
      label: t(SYSTEM_SETTINGS_LABEL_KEY[tab]),
      icon: <Icon size={14} strokeWidth={1.8} />,
    };
  });

  return (
    <PageShell
      title={t("nav.systemSettings")}
      subtitle={t("systemSettings.subtitle")}
      fill
    >
      <div className={styles.page}>
        <div className={styles.topNav} aria-label={t("nav.systemSettings")}>
          <Segmented
            size={isMobile ? "small" : "middle"}
            value={activeTab}
            onChange={(value) => handleTabChange(String(value))}
            options={options}
          />
        </div>
        <div className={styles.body}>
          <div className={styles.content}>
            <Suspense fallback={<PageLoading />}>
              {SYSTEM_SETTINGS_TABS.map((tab) =>
                isMounted(tab) && allowedSet.has(tab) ? (
                  <div
                    key={tab}
                    style={{
                      display: activeTab === tab ? "flex" : "none",
                      flex: 1,
                      minHeight: 0,
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    {tab === "workbench" ? (
                      <WorkbenchPage
                        embedded
                        isVisible={activeTab === "workbench"}
                      />
                    ) : null}
                    {tab === "remote-desktop" ? (
                      <RemoteDesktopPage embedded />
                    ) : null}
                    {tab === "acp" ? <ACPPage /> : null}
                    {tab === "users" ? <AdminUsersPage /> : null}
                    {tab === "models" ? <ModelsPage /> : null}
                    {tab === "storage" ? <AdminStoragePage /> : null}
                    {tab === "plugins" ? <AdminPluginsPage /> : null}
                    {tab === "security" ? <AdminSecurityPage /> : null}
                    {tab === "advanced" ? <AdvancedSettingsPage /> : null}
                    {tab === "agent-config" ? <AgentConfigPage /> : null}
                  </div>
                ) : null,
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export { systemSettingsPath };
