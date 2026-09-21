import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Tag, Typography } from "antd";
import { LayoutDashboard } from "lucide-react";
import type {
  GovernancePause,
  OrgCapability,
  OrgWorkspaceClient,
  OrgWorkspaceOverview,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { workspaceLabels } from "./labels";
import styles from "./WorkspacePage.module.css";

export interface OrgWorkspaceLinks {
  announcements: string;
  organization: string;
  employees: string;
  skills: string;
  agents: string;
  tasks: string;
  knowledge: string;
  reflections: string;
  governance: string;
  settings: string;
  chat: string;
}

export interface WorkspacePageProps {
  client: OrgWorkspaceClient;
  session: OrgSession;
  locale: OrgLocale;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
  links?: Partial<OrgWorkspaceLinks>;
}

const DEFAULT_LINKS: OrgWorkspaceLinks = {
  announcements: "/organization/announcements",
  organization: "/organization/org",
  employees: "/organization/employees",
  skills: "/organization/skills",
  agents: "/organization/agents",
  tasks: "/organization/tasks",
  knowledge: "/organization/knowledge",
  reflections: "/organization/reflections",
  governance: "/organization/governance",
  settings: "/organization/settings",
  chat: "/chat",
};

type ModuleCard = {
  key: keyof Pick<
    OrgWorkspaceLinks,
    | "announcements"
    | "organization"
    | "employees"
    | "skills"
    | "agents"
    | "tasks"
    | "knowledge"
    | "reflections"
    | "governance"
    | "settings"
  >;
  catalogKey: string;
  adminOnly?: boolean;
  title: string;
  body: string;
};

function metric(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

export function WorkspacePage({
  client,
  session,
  locale,
  links,
}: WorkspacePageProps) {
  const labels = workspaceLabels(locale);
  const hrefs: OrgWorkspaceLinks = {
    ...DEFAULT_LINKS,
    ...links,
  };
  const [overview, setOverview] = useState<OrgWorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState("");

  const fetchAll = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError("");
      try {
        setOverview(await client.overview());
      } catch {
        setOverview(null);
        setError(labels.loadFailed);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [client, labels.loadFailed],
  );

  useEffect(() => {
    void fetchAll(false);
  }, [fetchAll]);

  const resolvePause = async (pauseId: string, approve: boolean) => {
    if (!session.isAdmin) return;
    setResolving(pauseId);
    setError("");
    try {
      await client.resolve(pauseId, approve);
      await fetchAll(true);
    } catch {
      setError(labels.pauseResolveFailed);
    } finally {
      setResolving("");
    }
  };

  const cards: ModuleCard[] = useMemo(
    () => [
      {
        key: "announcements",
        catalogKey: "announcements",
        title: labels.announcements,
        body: labels.announcementsBody,
      },
      {
        key: "organization",
        catalogKey: "organization",
        title: labels.organization,
        body: labels.organizationBody,
      },
      {
        key: "employees",
        catalogKey: "employees",
        title: labels.employees,
        body: labels.employeesBody,
      },
      {
        key: "skills",
        catalogKey: "skills",
        title: labels.skillsPage,
        body: labels.skillsBody,
      },
      {
        key: "agents",
        catalogKey: "agents",
        title: labels.agents,
        body: labels.agentsBody,
      },
      {
        key: "tasks",
        catalogKey: "tasks",
        title: labels.tasks,
        body: labels.tasksBody,
      },
      {
        key: "knowledge",
        catalogKey: "knowledge",
        title: labels.knowledge,
        body: labels.knowledgeBody,
      },
      {
        key: "reflections",
        catalogKey: "reflections",
        title: labels.reflections,
        body: labels.reflectionsBody,
      },
      {
        key: "governance",
        catalogKey: "governance",
        adminOnly: true,
        title: labels.governance,
        body: labels.governanceBody,
      },
      {
        key: "settings",
        catalogKey: "settings",
        adminOnly: true,
        title: labels.settings,
        body: labels.settingsBody,
      },
    ],
    [labels],
  );

  const capLabel = (row: OrgCapability) =>
    locale === "zh" ? row.label_zh || row.label : row.label;

  const visible = cards.filter((card) => {
    if (card.adminOnly && !session.isAdmin) return false;
    if (overview?.module_toggles?.[card.catalogKey] === false) return false;
    return true;
  });

  if (loading) {
    return (
      <div className={styles.page} data-testid="org-ui-workspace">
        <div className={styles.empty}>{labels.loading}</div>
      </div>
    );
  }

  const lastSync = overview?.last_sync || labels.neverSynced;
  const tenant = overview?.openxyos.tenant_id || "—";
  const pendingPauses =
    overview?.governance?.pending_pauses ??
    overview?.freeos.pending_pauses ??
    0;
  const pauseRows: GovernancePause[] = overview?.governance?.pauses ?? [];
  const talentCount =
    overview?.freeos.talent_available ?? overview?.org_surfaces?.talent;

  return (
    <div className={styles.page} data-testid="org-ui-workspace">
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <LayoutDashboard size={20} />
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
          </div>
          <p className={styles.subtitle}>{labels.subtitle}</p>
          <p className={styles.hint}>{labels.hostHint}</p>
          <p className={styles.hint}>{labels.roomHint}</p>
        </div>
      </div>

      <section
        className={styles.callout}
        data-testid="org-workspace-chat-boundary"
      >
        <p className={styles.calloutTitle}>{labels.notHereTitle}</p>
        <p className={styles.hint}>{labels.notHereBody}</p>
        <div className={styles.links}>
          <Button href={hrefs.chat} data-testid="org-workspace-chat">
            {labels.openChat}
          </Button>
        </div>
      </section>

      {pendingPauses > 0 ? (
        <section className={styles.callout} data-testid="org-workspace-pauses">
          <p className={styles.calloutTitle}>
            {labels.pauseBanner.replace("{count}", String(pendingPauses))}
          </p>
          {pauseRows.length ? (
            <div className={styles.pauseList}>
              {pauseRows.map((row) => (
                <div
                  key={row.pause_id}
                  className={styles.pauseRow}
                  data-testid={`org-workspace-pause-${row.pause_id}`}
                >
                  <div className={styles.pauseMeta}>
                    {labels.pauseTool}: {row.tool_name || row.action || "—"}
                    {row.reason
                      ? ` · ${labels.pauseReason}: ${row.reason}`
                      : ""}
                  </div>
                  {session.isAdmin ? (
                    <div className={styles.links}>
                      <Button
                        size="small"
                        type="primary"
                        loading={resolving === row.pause_id}
                        onClick={() => void resolvePause(row.pause_id, true)}
                        data-testid={`org-workspace-approve-${row.pause_id}`}
                      >
                        {labels.approve}
                      </Button>
                      <Button
                        size="small"
                        danger
                        loading={resolving === row.pause_id}
                        onClick={() => void resolvePause(row.pause_id, false)}
                        data-testid={`org-workspace-reject-${row.pause_id}`}
                      >
                        {labels.reject}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.links}>
            <Button
              href={hrefs.governance}
              data-testid="org-workspace-open-pauses"
            >
              {labels.pauseBannerAction}
            </Button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className={styles.error} data-testid="org-workspace-error">
          {error}
        </p>
      ) : null}

      <section className={styles.card} data-testid="org-workspace-status">
        <h2 className={styles.cardTitle}>{labels.statusTitle}</h2>
        <div className={styles.chips}>
          <Tag>{overview?.enabled ? labels.enabled : labels.disabled}</Tag>
          <Tag>{labels.inHost}</Tag>
          <Tag>
            {labels.tenant}: {tenant}
          </Tag>
          <Tag>
            {labels.lastSync}: {lastSync}
          </Tag>
        </div>
        <div className={styles.metrics} data-testid="org-workspace-metrics">
          <article className={styles.metric}>
            <span className={styles.metricValue}>
              {metric(overview?.freeos.employees)}
            </span>
            <span className={styles.metricLabel}>{labels.colleagues}</span>
          </article>
          <article className={styles.metric}>
            <span className={styles.metricValue}>
              {metric(overview?.freeos.spawned_colleagues)}
            </span>
            <span className={styles.metricLabel}>{labels.spawned}</span>
          </article>
          <article className={styles.metric}>
            <span className={styles.metricValue}>
              {metric(overview?.freeos.org_skills)}
            </span>
            <span className={styles.metricLabel}>{labels.skills}</span>
          </article>
          <article className={styles.metric}>
            <span className={styles.metricValue}>
              {metric(overview?.openxyos.modules)}
            </span>
            <span className={styles.metricLabel}>{labels.modules}</span>
          </article>
          <article className={styles.metric}>
            <span className={styles.metricValue}>{metric(talentCount)}</span>
            <span className={styles.metricLabel}>{labels.talent}</span>
          </article>
          <article className={styles.metric}>
            <span className={styles.metricValue}>{metric(pendingPauses)}</span>
            <span className={styles.metricLabel}>{labels.pauses}</span>
          </article>
        </div>
      </section>

      <section className={styles.card} data-testid="org-workspace-modules">
        <h2 className={styles.cardTitle}>{labels.modulesTitle}</h2>
        <p className={styles.hint}>{labels.modulesHint}</p>
        {visible.length ? (
          <div className={styles.grid}>
            {visible.map((card) => {
              const catalog = overview?.catalog?.find(
                (row) => row.key === card.catalogKey,
              );
              return (
                <div
                  key={card.key}
                  className={styles.module}
                  data-testid={`org-workspace-module-${card.catalogKey}`}
                >
                  <div className={styles.moduleName}>
                    {catalog ? capLabel(catalog) : card.title}
                  </div>
                  <p className={styles.moduleDesc}>{card.body}</p>
                  <Button
                    href={hrefs[card.key]}
                    data-testid={`org-workspace-open-${card.catalogKey}`}
                  >
                    {card.title}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.hint}>{labels.emptyCatalog}</p>
        )}
      </section>
    </div>
  );
}
