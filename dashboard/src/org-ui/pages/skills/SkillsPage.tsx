import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Space, Table, Tabs, Tag, Typography } from "antd";
import { Package, RefreshCw, Search } from "lucide-react";
import type {
  HostSkillPackage,
  OrgSkill,
  OrgSkillCatalogRow,
  OrgSkillsClient,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { skillsLabels } from "./labels";
import styles from "./SkillsPage.module.css";

export interface SkillsPageProps {
  client: OrgSkillsClient;
  session: OrgSession;
  locale: OrgLocale;
  onOpenHostSkills?: () => void;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

function catalogLabel(row: OrgSkillCatalogRow, locale: OrgLocale): string {
  return locale === "zh" ? row.label_zh || row.label : row.label;
}

function catalogDescription(
  row: OrgSkillCatalogRow,
  locale: OrgLocale,
): string {
  return locale === "zh"
    ? row.description_zh || row.description
    : row.description;
}

export function SkillsPage({
  client,
  session,
  locale,
  onOpenHostSkills,
}: SkillsPageProps) {
  const labels = skillsLabels(locale);
  const [skills, setSkills] = useState<OrgSkill[]>([]);
  const [catalog, setCatalog] = useState<OrgSkillCatalogRow[]>([]);
  const [hostPackages, setHostPackages] = useState<HostSkillPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [detail, setDetail] = useState<OrgSkill | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await client.list();
      setSkills(payload.skills);
      setCatalog(payload.catalog);
      setHostPackages(payload.host_packages);
    } catch {
      setSkills([]);
      setCatalog([]);
      setHostPackages([]);
      setError(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [client, labels.loadFailed]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const query = search.trim().toLowerCase();
  const visibleCatalog = useMemo(
    () =>
      query
        ? catalog.filter((row) => {
            const hay = `${row.key} ${row.slug} ${row.label} ${row.label_zh} ${row.description} ${row.description_zh}`.toLowerCase();
            return hay.includes(query);
          })
        : catalog,
    [catalog, query],
  );
  const visibleHost = useMemo(
    () =>
      query
        ? hostPackages.filter((row) => {
            const hay = `${row.name} ${row.description} ${row.id}`.toLowerCase();
            return hay.includes(query);
          })
        : hostPackages,
    [hostPackages, query],
  );

  const generatedCount = catalog.filter((row) => row.generated).length;
  const publishedCount = catalog.filter((row) => row.published).length;

  const generate = async (modules?: string[]) => {
    setBusy(modules?.[0] || "all");
    setError("");
    setNotice("");
    try {
      await client.generate(modules);
      setNotice(labels.generateDone);
      await fetchAll();
    } catch {
      setError(labels.generateFailed);
    } finally {
      setBusy("");
    }
  };

  const publish = async (slug: string) => {
    setBusy(`publish-${slug}`);
    setError("");
    setNotice("");
    try {
      await client.publish({ slug });
      setNotice(labels.publishDone);
      const next = await client.get(slug);
      setDetail(next);
      await fetchAll();
    } catch {
      setError(labels.publishFailed);
    } finally {
      setBusy("");
    }
  };

  const openDetail = async (row: OrgSkillCatalogRow) => {
    if (!row.generated) return;
    try {
      setDetail(await client.get(row.slug));
    } catch {
      const listed = skills.find((item) => item.slug === row.slug);
      setDetail(listed ?? null);
    }
  };

  const askGenerate = (modules?: string[]) => {
    Modal.confirm({
      title: labels.confirmGenerate,
      okText: labels.generate,
      okButtonProps: { "data-testid": "org-skills-confirm-generate" },
      onOk: () => generate(modules),
    });
  };

  const askPublish = (slug: string) => {
    Modal.confirm({
      title: labels.confirmPublish,
      okText: labels.publish,
      okButtonProps: { "data-testid": `org-skills-confirm-publish-${slug}` },
      onOk: () => publish(slug),
    });
  };

  return (
    <div className={styles.page} data-testid="org-ui-skills">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Package size={20} />
          <div>
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
            <p className={styles.subtitle}>{labels.subtitle}</p>
          </div>
        </div>
        <Space>
          {session.isAdmin ? (
            <Button
              type="primary"
              loading={busy === "all"}
              onClick={() => askGenerate()}
              data-testid="org-skills-generate"
            >
              {labels.generate}
            </Button>
          ) : null}
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => void fetchAll()}
            data-testid="org-skills-refresh"
          >
            {labels.refresh}
          </Button>
        </Space>
      </div>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
      {notice ? (
        <Typography.Text type="success">{notice}</Typography.Text>
      ) : null}

      <div className={styles.stats} data-testid="org-skills-stats">
        <div className={styles.stat}>
          <div className={styles.statValue}>{generatedCount}</div>
          <div className={styles.statLabel}>{labels.generated}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{publishedCount}</div>
          <div className={styles.statLabel}>{labels.published}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{hostPackages.length}</div>
          <div className={styles.statLabel}>{labels.hostPackages}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{catalog.length}</div>
          <div className={styles.statLabel}>{labels.catalog}</div>
        </div>
      </div>

      {session.isAdmin ? null : (
        <p className={styles.hint}>{labels.adminOnly}</p>
      )}

      <Tabs
        defaultActiveKey="org"
        items={[
          {
            key: "org",
            label: labels.orgTab,
            children: (
              <>
                <div className={styles.filters}>
                  <Input
                    prefix={<Search size={14} />}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={labels.search}
                    allowClear
                    data-testid="org-skills-search"
                  />
                </div>
                {loading ? (
                  <p className={styles.empty}>{labels.loading}</p>
                ) : visibleCatalog.length === 0 ? (
                  <div className={styles.empty} data-testid="org-skills-empty">
                    <p>{labels.emptyOrg}</p>
                    <p>{labels.emptyOrgHint}</p>
                  </div>
                ) : (
                  <div className={styles.grid} data-testid="org-skills-grid">
                    {visibleCatalog.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        className={styles.card}
                        onClick={() => void openDetail(row)}
                        data-testid={`org-skill-card-${row.slug}`}
                      >
                        <p className={styles.cardTitle}>
                          {catalogLabel(row, locale)}
                        </p>
                        <p className={styles.cardMeta}>
                          <span className={styles.mono}>{row.slug}</span>
                        </p>
                        <p className={styles.cardBody}>
                          {catalogDescription(row, locale)}
                        </p>
                        <Space size={6} wrap style={{ marginTop: 10 }}>
                          <Tag>
                            {row.published
                              ? labels.draftReady
                              : row.generated
                                ? labels.generatedOnly
                                : labels.notGenerated}
                          </Tag>
                          {session.isAdmin && !row.generated ? (
                            <Button
                              size="small"
                              loading={busy === row.key}
                              onClick={(event) => {
                                event.stopPropagation();
                                askGenerate([row.key]);
                              }}
                              data-testid={`org-skills-generate-${row.key}`}
                            >
                              {labels.generateOne}
                            </Button>
                          ) : null}
                        </Space>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ),
          },
          {
            key: "host",
            label: labels.hostTab,
            children: (
              <>
                <p className={styles.hint}>{labels.hostHint}</p>
                {onOpenHostSkills ? (
                  <Button
                    style={{ marginBottom: 12 }}
                    onClick={onOpenHostSkills}
                    data-testid="org-skills-open-host"
                  >
                    {labels.openHost}
                  </Button>
                ) : null}
                {loading ? (
                  <p className={styles.empty}>{labels.loading}</p>
                ) : visibleHost.length === 0 ? (
                  <div className={styles.empty} data-testid="org-skills-host-empty">
                    <p>{labels.emptyHost}</p>
                    <p>{labels.emptyHostHint}</p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <Table
                      rowKey="id"
                      dataSource={visibleHost}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: labels.hostPackage, dataIndex: "name" },
                        {
                          title: labels.skillCount,
                          dataIndex: "skill_count",
                        },
                        {
                          title: labels.detail,
                          dataIndex: "description",
                          render: (value: string) => value || "—",
                        },
                      ]}
                    />
                  </div>
                )}
              </>
            ),
          },
        ]}
      />

      <Modal
        title={labels.detail}
        open={detail != null}
        onCancel={() => setDetail(null)}
        footer={
          <Space>
            {session.isAdmin && detail && !detail.published ? (
              <Button
                type="primary"
                loading={busy === `publish-${detail.slug}`}
                onClick={() => askPublish(detail.slug)}
                data-testid={`org-skills-publish-${detail.slug}`}
              >
                {labels.publish}
              </Button>
            ) : null}
            <Button onClick={() => setDetail(null)}>{labels.close}</Button>
          </Space>
        }
      >
        {detail ? (
          <div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.module}</span>
              <span>{detail.module_key}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.slug}</span>
              <span className={styles.mono}>{detail.slug}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.status}</span>
              <span>
                {detail.published ? labels.draftReady : labels.generatedOnly}
              </span>
            </div>
            <pre className={styles.body} data-testid="org-skills-content">
              {detail.content || detail.description}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
