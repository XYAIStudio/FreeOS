import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Space, Switch, Tag } from "antd";
import {
  ArrowDownUp,
  Building2,
  ExternalLink,
  Maximize2,
  Minimize2,
  Package,
  Play,
  RefreshCw,
  Shield,
  Users,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import PageShell from "../../layouts/PageShell";
import {
  orgModuleApi,
  type OrgAssembleResult,
  type OrgLoopProof,
  type OrgOverview,
  type OrgPackResult,
} from "../../api/modules/orgModule";
import { formatServerIsoDateTime } from "../../utils/formatMessageTime";
import { useServerTimezone } from "../../hooks/useServerTimezone";
import { message } from "../../utils/antdMessage";
import styles from "./Organization.module.less";

type ActionKey = "assemble" | "pack" | "loop" | "sidecar" | null;

function metric(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

export default function OrganizationPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.toLowerCase().startsWith("zh") ?? false;
  const timeZone = useServerTimezone();
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<ActionKey>(null);
  const [loopProof, setLoopProof] = useState<OrgLoopProof | null>(null);
  const [lastActionNotes, setLastActionNotes] = useState<string[]>([]);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);

  const applyOverview = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const next = await orgModuleApi.overview();
        setOverview(next);
        return next;
      } catch (err) {
        if (!quiet) {
          message.error(
            err instanceof Error ? err.message : t("organization.loadFailed"),
          );
        }
        return null;
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [t],
  );

  const load = useCallback(async () => {
    await applyOverview(false);
  }, [applyOverview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (overview?.sidecar_reachable) return;
    const id = window.setInterval(() => {
      void applyOverview(true);
    }, 4000);
    return () => window.clearInterval(id);
  }, [applyOverview, overview?.sidecar_reachable]);

  useEffect(() => {
    if (!previewFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewFullscreen]);

  const sidecarUp = Boolean(overview?.sidecar_reachable);
  const firstRun = useMemo(() => {
    if (!overview) return false;
    return (
      overview.freeos.employees === 0 &&
      overview.freeos.spawned_colleagues === 0 &&
      !overview.last_loop
    );
  }, [overview]);

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await orgModuleApi.setEnabled(enabled);
      message.success(
        enabled ? t("organization.enabled") : t("organization.disabled"),
      );
      await applyOverview(false);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("organization.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const waitForSidecar = async () => {
    for (let i = 0; i < 30; i += 1) {
      const next = await applyOverview(true);
      if (next?.sidecar_reachable) return next;
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    return applyOverview(true);
  };

  const runAction = async (
    key: Exclude<ActionKey, null>,
    fn: () => Promise<void>,
  ) => {
    setBusy(key);
    try {
      await fn();
      if (key !== "sidecar") {
        await applyOverview(false);
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("organization.actionFailed"),
      );
    } finally {
      setBusy(null);
    }
  };

  const startSidecar = () =>
    runAction("sidecar", async () => {
      setPreviewPending(true);
      try {
        const result = await orgModuleApi.startSidecar();
        setLastActionNotes([result.detail, result.command].filter(Boolean));
        const next = result.reachable
          ? await applyOverview(true)
          : await waitForSidecar();
        message.success(
          next?.sidecar_reachable
            ? t("organization.sidecarStarted")
            : t("organization.sidecarStartPending"),
        );
      } finally {
        setPreviewPending(false);
      }
    });

  const assemble = () =>
    runAction("assemble", async () => {
      const result: OrgAssembleResult = await orgModuleApi.assemble();
      setLastActionNotes(result.notes);
      message.success(
        t("organization.assembleDone", { count: result.spawned.length }),
      );
    });

  const packBack = () =>
    runAction("pack", async () => {
      const result: OrgPackResult = await orgModuleApi.pack();
      setLastActionNotes([
        ...result.pack.notes,
        ...result.applied.notes,
        result.applied.remote_applied
          ? t("organization.packRemoteYes")
          : t("organization.packRemoteNo"),
      ]);
      message.success(t("organization.packDone"));
    });

  const runLoop = () =>
    runAction("loop", async () => {
      const proof = await orgModuleApi.runLoop();
      setLoopProof(proof);
      setLastActionNotes(proof.notes);
      message.success(
        proof.ok ? t("organization.loopOk") : t("organization.loopPartial"),
      );
    });

  const lastLoop = (loopProof ?? overview?.last_loop) as OrgLoopProof | null;
  const lastSync = overview?.last_sync
    ? formatServerIsoDateTime(overview.last_sync, timeZone)
    : t("organization.neverSynced");
  const catalog = overview?.catalog ?? [];
  const previewUrl = overview?.sidecar_url
    ? `${overview.sidecar_url.replace(/\/$/, "")}/`
    : "";
  const showFrame = Boolean(sidecarUp && previewUrl);

  return (
    <PageShell
      title={t("organization.title")}
      subtitle={t("organization.subtitle")}
      actions={
        <Space>
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>
            {t("common.refresh")}
          </Button>
        </Space>
      }
    >
      <div className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.heroTitle}>{t("organization.heroTitle")}</p>
          <p className={styles.heroStory}>{t("organization.heroStory")}</p>
          <div className={styles.heroMeta}>
            <span className={styles.chip}>
              {overview?.enabled ? t("organization.on") : t("organization.off")}
            </span>
            <span className={styles.chip}>
              {sidecarUp
                ? t("organization.sidecarUp")
                : t("organization.sidecarDown")}
            </span>
            <span className={styles.chip}>
              {t("organization.lastSync")}: {lastSync}
            </span>
          </div>
        </section>

        <div className={styles.workspace}>
          <div className={styles.column}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Building2 size={18} />
              <span>{t("organization.toggleLabel")}</span>
              <Switch
                checked={Boolean(overview?.enabled)}
                loading={saving || loading}
                onChange={(checked) => void toggle(checked)}
              />
            </div>

            {!sidecarUp && (
              <section className={styles.recover}>
                <p className={styles.recoverTitle}>
                  {t("organization.startSidecarTitle")}
                </p>
                <p className={styles.recoverBody}>
                  {t("organization.startSidecarBody")}
                </p>
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<Play size={14} />}
                    loading={busy === "sidecar"}
                    disabled={!overview?.start_available && !overview}
                    onClick={() => void startSidecar()}
                  >
                    {t("organization.startSidecarAction")}
                  </Button>
                  {overview?.start_command && (
                    <code>{overview.start_command}</code>
                  )}
                </Space>
              </section>
            )}

            {firstRun && (
              <section className={styles.empty}>
                <p className={styles.emptyTitle}>
                  {t("organization.emptyTitle")}
                </p>
                <p>{t("organization.emptyBody")}</p>
              </section>
            )}

            <section className={styles.dual}>
              <article className={styles.plane}>
                <div className={styles.planeHead}>
                  <div>
                    <p className={styles.planeLabel}>
                      {t("organization.dataPlane")}
                    </p>
                    <h2 className={styles.planeTitle}>FreeOS</h2>
                  </div>
                  <Users size={22} />
                </div>
                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {metric(overview?.freeos.employees)}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricEmployees")}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {metric(overview?.freeos.org_skills)}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricSkills")}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {metric(overview?.freeos.mcp)}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricMcp")}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {metric(overview?.freeos.tasks)}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricTasks")}
                    </span>
                  </div>
                </div>
              </article>

              <div className={styles.flow} aria-hidden="true">
                <div className={styles.flowArrow}>
                  <ArrowDownUp size={16} />
                  {t("organization.flowUp")}
                </div>
                <div className={styles.orbit}>
                  <div className={styles.orbitCore} />
                </div>
                <div className={styles.flowArrow}>
                  {t("organization.flowDown")}
                  <Workflow size={16} />
                </div>
              </div>

              <article className={styles.plane}>
                <div className={styles.planeHead}>
                  <div>
                    <p className={styles.planeLabel}>
                      {t("organization.controlPlane")}
                    </p>
                    <h2 className={styles.planeTitle}>openXYOS</h2>
                  </div>
                  <Shield size={22} />
                </div>
                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {metric(overview?.openxyos.modules)}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricModules")}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {overview?.openxyos.governance
                        ? t("organization.on")
                        : t("organization.off")}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricGovernance")}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {sidecarUp ? t("organization.sidecarUp") : "—"}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricHealth")}
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricValue}>
                      {overview?.openxyos.tenant_id || "—"}
                    </span>
                    <span className={styles.metricLabel}>
                      {t("organization.metricTenant")}
                    </span>
                  </div>
                </div>
              </article>
            </section>

            <section className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                disabled={busy !== null}
                onClick={() => void assemble()}
              >
                <Users size={18} />
                <p className={styles.actionTitle}>
                  {t("organization.assembleTitle")}
                </p>
                <p className={styles.actionBody}>
                  {t("organization.assembleBody")}
                </p>
                <Button type="primary" loading={busy === "assemble"}>
                  {t("organization.assembleAction")}
                </Button>
              </button>
              <button
                type="button"
                className={styles.action}
                disabled={busy !== null}
                onClick={() => void packBack()}
              >
                <Package size={18} />
                <p className={styles.actionTitle}>
                  {t("organization.packTitle")}
                </p>
                <p className={styles.actionBody}>
                  {t("organization.packBody")}
                </p>
                <Button loading={busy === "pack"}>
                  {t("organization.packAction")}
                </Button>
              </button>
              <button
                type="button"
                className={styles.action}
                disabled={busy !== null}
                onClick={() => void runLoop()}
              >
                <Play size={18} />
                <p className={styles.actionTitle}>
                  {t("organization.loopTitle")}
                </p>
                <p className={styles.actionBody}>
                  {t("organization.loopBody")}
                </p>
                <Button loading={busy === "loop"}>
                  {t("organization.loopAction")}
                </Button>
              </button>
            </section>

            <section className={styles.timeline}>
              <p className={styles.timelineTitle}>
                {t("organization.timelineTitle")}
              </p>
              {lastLoop ? (
                <ol className={styles.timelineList}>
                  <li>
                    {t("organization.timelineOk")}: {String(lastLoop.ok)}
                  </li>
                  {lastLoop.employees?.length ? (
                    <li>
                      {t("organization.timelineEmployees")}:{" "}
                      {lastLoop.employees.join(", ")}
                    </li>
                  ) : null}
                  {lastLoop.skills?.length ? (
                    <li>
                      {t("organization.timelineSkills")}:{" "}
                      {lastLoop.skills.length}
                    </li>
                  ) : null}
                  <li>
                    {t("organization.timelineRemote")}:{" "}
                    {String(Boolean(lastLoop.remote_applied))}
                  </li>
                  <li>
                    {t("organization.timelineGovernance")}:{" "}
                    {String(Boolean(lastLoop.governance_blocked))}
                  </li>
                  {(lastLoop.notes ?? []).slice(0, 6).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ol>
              ) : (
                <p>{t("organization.timelineEmpty")}</p>
              )}
              {lastActionNotes.length > 0 && (
                <ol className={styles.timelineList} style={{ marginTop: 12 }}>
                  {lastActionNotes.slice(0, 8).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ol>
              )}
            </section>

            <section className={styles.timeline}>
              <p className={styles.timelineTitle}>
                {t("organization.catalogTitle")}
              </p>
              <div className={styles.catalog}>
                {catalog.map((row) => (
                  <article key={row.key} className={styles.catalogItem}>
                    <p className={styles.catalogName}>
                      {isZh ? row.label_zh : row.label}{" "}
                      <Tag>
                        {row.locked
                          ? t("organization.locked")
                          : t("organization.optional")}
                      </Tag>
                    </p>
                    <p className={styles.catalogDesc}>
                      {isZh ? row.description_zh : row.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside
            className={`${styles.preview} ${
              previewFullscreen ? styles.previewFullscreen : ""
            }`}
          >
            <div className={styles.previewHeader}>
              <p className={styles.previewTitle}>
                {t("organization.previewTitle")}
              </p>
              <Space>
                {showFrame && (
                  <Button
                    type="link"
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    icon={<ExternalLink size={14} />}
                  >
                    {t("organization.openSidecar")}
                  </Button>
                )}
                <Button
                  icon={
                    previewFullscreen ? (
                      <Minimize2 size={14} />
                    ) : (
                      <Maximize2 size={14} />
                    )
                  }
                  onClick={() => setPreviewFullscreen((on) => !on)}
                >
                  {previewFullscreen
                    ? t("organization.exitFullscreen")
                    : t("organization.fullscreen")}
                </Button>
              </Space>
            </div>
            <div className={styles.previewBody}>
              {showFrame ? (
                <iframe
                  title={t("organization.previewTitle")}
                  src={previewUrl}
                  className={styles.embed}
                  allow="clipboard-read; clipboard-write"
                />
              ) : (
                <div className={styles.previewEmpty}>
                  <p className={styles.recoverTitle}>
                    {previewPending
                      ? t("organization.previewLoading")
                      : t("organization.startSidecarTitle")}
                  </p>
                  <p className={styles.recoverBody}>
                    {t("organization.previewOffline")}
                  </p>
                  <Space wrap>
                    <Button
                      type="primary"
                      icon={<Play size={14} />}
                      loading={busy === "sidecar" || previewPending}
                      onClick={() => void startSidecar()}
                    >
                      {t("organization.startSidecarAction")}
                    </Button>
                    {overview?.start_command && (
                      <code>{overview.start_command}</code>
                    )}
                  </Space>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
