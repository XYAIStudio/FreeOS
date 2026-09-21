import { useCallback, useEffect, useState } from "react";
import { Button, Input, Tag, Typography } from "antd";
import { Bot, ExternalLink, Plus } from "lucide-react";
import type {
  OrgAgentHostSurfaces,
  OrgAgentsClient,
  OrgColleague,
  OrgColleagueStats,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { agentsLabels, lifecycleLabel } from "./labels";
import styles from "./AgentsPage.module.css";

export interface AgentsPageProps {
  client: OrgAgentsClient;
  session: OrgSession;
  locale: OrgLocale;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

const EMPTY_STATS: OrgColleagueStats = {
  total: 0,
  spawned: 0,
  by_lifecycle: {},
};

const EMPTY_LINKS: OrgAgentHostSurfaces = {
  experts: "/experts",
  personalization: "/personalization",
  employees: "/organization/employees",
  chat: "/chat",
  workbench: "/organization",
};

type CompileForm = {
  name: string;
  industry: string;
  positioning: string;
  experience: string;
  ima_url: string;
  capabilities: string[];
};

const EMPTY_FORM: CompileForm = {
  name: "",
  industry: "",
  positioning: "",
  experience: "",
  ima_url: "",
  capabilities: [],
};

export function AgentsPage({ client, session, locale }: AgentsPageProps) {
  const labels = agentsLabels(locale);
  const [colleagues, setColleagues] = useState<OrgColleague[]>([]);
  const [stats, setStats] = useState<OrgColleagueStats>(EMPTY_STATS);
  const [links, setLinks] = useState<OrgAgentHostSurfaces>(EMPTY_LINKS);
  const [form, setForm] = useState<CompileForm>(EMPTY_FORM);
  const [draftCap, setDraftCap] = useState("");
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await client.snapshot();
      setColleagues(snap.colleagues);
      setStats(snap.stats);
      if (snap.host_surfaces) setLinks(snap.host_surfaces);
    } catch {
      setColleagues([]);
      setStats(EMPTY_STATS);
      setError(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [client, labels.loadFailed]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const addCapability = (value: string) => {
    const clean = value.trim();
    if (!clean || form.capabilities.includes(clean)) return;
    setForm((prev) => ({
      ...prev,
      capabilities: [...prev.capabilities, clean].slice(0, 16),
    }));
    setDraftCap("");
  };

  const compile = async () => {
    if (!session.isAdmin) return;
    const name = form.name.trim();
    const positioning = form.positioning.trim();
    if (!name || !positioning || form.capabilities.length === 0) {
      setError(labels.required);
      return;
    }
    setCompiling(true);
    setError("");
    setMessage("");
    try {
      await client.compile({
        name,
        positioning,
        capabilities: form.capabilities,
        industry: form.industry.trim(),
        experience: form.experience.trim(),
        ima_url: form.ima_url.trim(),
      });
      setForm(EMPTY_FORM);
      setMessage(labels.compileDone);
      await fetchAll();
    } catch {
      setError(labels.compileFailed);
    } finally {
      setCompiling(false);
    }
  };

  const transition = async (slug: string, state: string) => {
    if (!session.isAdmin) return;
    setBusy(`${slug}:${state}`);
    setError("");
    setMessage("");
    try {
      await client.transition(slug, state);
      await fetchAll();
    } catch {
      setError(labels.actionFailed);
    } finally {
      setBusy("");
    }
  };

  const spawn = async (slug: string) => {
    if (!session.isAdmin) return;
    setBusy(`spawn:${slug}`);
    setError("");
    setMessage("");
    try {
      await client.spawn(slug);
      setMessage(labels.spawnDone);
      await fetchAll();
    } catch {
      setError(labels.actionFailed);
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className={styles.page} data-testid="org-ui-agents">
        <div className={styles.empty}>{labels.loading}</div>
      </div>
    );
  }

  return (
    <div className={styles.page} data-testid="org-ui-agents">
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <Bot size={20} />
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
          </div>
          <p className={styles.subtitle}>{labels.subtitle}</p>
        </div>
      </div>

      <section className={styles.callout} data-testid="org-agents-boundary">
        <p className={styles.calloutTitle}>{labels.notHereTitle}</p>
        <p className={styles.hint}>{labels.notHereBody}</p>
        <p className={styles.hint}>{labels.hostHint}</p>
        <div className={styles.links}>
          <Button
            href={links.experts}
            icon={<ExternalLink size={14} />}
            data-testid="org-agents-experts"
          >
            {labels.openExperts}
          </Button>
          <Button
            href={links.personalization}
            data-testid="org-agents-personalization"
          >
            {labels.openPersonalization}
          </Button>
          <Button href={links.employees} data-testid="org-agents-employees">
            {labels.openEmployees}
          </Button>
        </div>
      </section>

      {error ? (
        <p className={styles.error} data-testid="org-agents-error">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className={styles.status} data-testid="org-agents-notice">
          {message}
        </p>
      ) : null}

      <div className={styles.stats} data-testid="org-agents-stats">
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>{labels.total}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.spawned}</div>
          <div className={styles.statLabel}>{labels.spawned}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {stats.by_lifecycle.draft ?? 0}
          </div>
          <div className={styles.statLabel}>{labels.draft}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {stats.by_lifecycle.active ?? 0}
          </div>
          <div className={styles.statLabel}>{labels.active}</div>
        </div>
      </div>

      <section className={styles.card} data-testid="org-agents-compile">
        <h2 className={styles.cardTitle}>{labels.compileTitle}</h2>
        <p className={styles.hint}>{labels.compileHint}</p>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{labels.fieldName}</span>
          <Input
            value={form.name}
            placeholder={labels.namePlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            data-testid="org-agents-name"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{labels.fieldIndustry}</span>
          <Input
            value={form.industry}
            placeholder={labels.industryPlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, industry: event.target.value }))
            }
            data-testid="org-agents-industry"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{labels.fieldPositioning}</span>
          <Input.TextArea
            rows={4}
            value={form.positioning}
            placeholder={labels.positioningPlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                positioning: event.target.value,
              }))
            }
            data-testid="org-agents-positioning"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{labels.fieldExperience}</span>
          <Input.TextArea
            rows={3}
            value={form.experience}
            placeholder={labels.experiencePlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                experience: event.target.value,
              }))
            }
          />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{labels.fieldCapabilities}</span>
          <div className={styles.chips}>
            {labels.suggested.map((item) => (
              <Button
                key={item}
                size="small"
                disabled={!session.isAdmin}
                onClick={() => addCapability(item)}
              >
                {item}
              </Button>
            ))}
          </div>
          <Input
            value={draftCap}
            placeholder={labels.capabilityPlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) => setDraftCap(event.target.value)}
            onPressEnter={() => addCapability(draftCap)}
            suffix={
              <Button
                type="text"
                size="small"
                icon={<Plus size={14} />}
                disabled={!session.isAdmin}
                onClick={() => addCapability(draftCap)}
              />
            }
            data-testid="org-agents-capability"
          />
          <div className={styles.chips} data-testid="org-agents-caps">
            {form.capabilities.map((item) => (
              <Tag
                key={item}
                closable={session.isAdmin}
                onClose={() =>
                  setForm((prev) => ({
                    ...prev,
                    capabilities: prev.capabilities.filter(
                      (value) => value !== item,
                    ),
                  }))
                }
              >
                {item}
              </Tag>
            ))}
          </div>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{labels.fieldIma}</span>
          <Input
            value={form.ima_url}
            placeholder={labels.imaPlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, ima_url: event.target.value }))
            }
          />
        </label>
        <div className={styles.callout}>
          <p className={styles.calloutTitle}>{labels.governanceTitle}</p>
          <p className={styles.hint}>{labels.governanceBody}</p>
        </div>
        <div className={styles.actions}>
          <Button
            type="primary"
            onClick={() => void compile()}
            disabled={!session.isAdmin || compiling}
            data-testid="org-agents-compile-submit"
          >
            {compiling ? labels.compiling : labels.compile}
          </Button>
          {!session.isAdmin ? (
            <span className={styles.status}>{labels.readOnly}</span>
          ) : null}
        </div>
      </section>

      <section className={styles.card} data-testid="org-agents-list">
        <h2 className={styles.cardTitle}>{labels.colleaguesTitle}</h2>
        <p className={styles.hint}>{labels.colleaguesHint}</p>
        {colleagues.length === 0 ? (
          <div className={styles.empty} data-testid="org-agents-empty">
            <p>{labels.empty}</p>
            <p>{labels.emptyHint}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {colleagues.map((row) => (
              <article
                key={row.slug}
                className={styles.colleague}
                data-testid={`org-agent-card-${row.slug}`}
              >
                <p className={styles.colleagueName}>
                  {row.name || row.slug}{" "}
                  <Tag color={row.spawned ? "purple" : "default"}>
                    {lifecycleLabel(row.lifecycle, labels)}
                  </Tag>
                </p>
                <p className={styles.meta}>
                  {labels.slug}: <span className={styles.mono}>{row.slug}</span>
                  {row.agent_id ? ` · ${row.agent_id}` : ""}
                </p>
                {row.workspace ? (
                  <p className={styles.meta}>
                    {labels.workspace}: {row.workspace}
                  </p>
                ) : null}
                <div className={styles.actions}>
                  {(row.next || []).map((state) => (
                    <Button
                      key={state}
                      size="small"
                      disabled={!session.isAdmin || Boolean(busy)}
                      loading={busy === `${row.slug}:${state}`}
                      onClick={() => void transition(row.slug, state)}
                      data-testid={`org-agent-transition-${row.slug}-${state}`}
                    >
                      {lifecycleLabel(state, labels)}
                    </Button>
                  ))}
                  {row.spawned ? (
                    <Button
                      size="small"
                      href={links.experts}
                      data-testid={`org-agent-open-${row.slug}`}
                    >
                      {labels.openSpawned}
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      disabled={!session.isAdmin || Boolean(busy)}
                      loading={busy === `spawn:${row.slug}`}
                      onClick={() => void spawn(row.slug)}
                      data-testid={`org-agent-spawn-${row.slug}`}
                    >
                      {labels.spawn}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
