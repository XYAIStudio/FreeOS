import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Drawer, Input, Space, Switch, Tag } from "antd";
import {
  ArrowDownUp,
  Building2,
  ExternalLink,
  Package,
  Play,
  Settings2,
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
  type OrgProduceResult,
} from "../../api/modules/orgModule";
import { formatServerIsoDateTime } from "../../utils/formatMessageTime";
import { useServerTimezone } from "../../hooks/useServerTimezone";
import {
  canPickDesktopFolder,
  pickDesktopFolder,
} from "../../utils/desktopFolder";
import { message } from "../../utils/antdMessage";
import { resolveOpenxyosSourceDest } from "./pickSourceDest";
import { shouldShowPreviewBlank } from "./sidecarRecover";
import styles from "./Organization.module.less";

type ActionKey = "assemble" | "pack" | "loop" | "sidecar" | "produce" | null;
type DrawerKey = "module" | "manage" | null;

type LastReceipt = {
  kind: "assemble" | "pack" | "loop";
  lines: string[];
};

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
  const [lastReceipt, setLastReceipt] = useState<LastReceipt | null>(null);
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [moduleToggles, setModuleToggles] = useState<Record<string, boolean>>(
    {},
  );
  const [sourceDest, setSourceDest] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [produceName, setProduceName] = useState("");
  const [produceIma, setProduceIma] = useState("");
  const [landed, setLanded] = useState<Record<string, unknown> | null>(null);
  const autoStartRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const applyOverview = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const next = await orgModuleApi.overview();
        setOverview(next);
        if (next.module_toggles) setModuleToggles(next.module_toggles);
        const proof = next.last_loop;
        if (proof && typeof proof === "object" && proof.landed) {
          setLanded(proof.landed as Record<string, unknown>);
        }
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

  const sidecarUp = Boolean(overview?.sidecar_reachable);
  const embedOk = overview?.sidecar_embed_ok;
  const previewBlank = shouldShowPreviewBlank({
    sidecarUp,
    embedOk,
  });
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
      try {
        const result = await orgModuleApi.startSidecar();
        setLastActionNotes([result.detail, result.command].filter(Boolean));
        const next = result.reachable
          ? await applyOverview(true)
          : await waitForSidecar();
        if (next?.sidecar_reachable) {
          return;
        }
      } catch {
        // FreeOS still embeds the local URL; no user-facing start CTA.
      }
    });

  const canSilentStart = Boolean(
    overview?.start_available || overview?.install_ready,
  );

  useEffect(() => {
    if (autoStartRef.current) return;
    if (!overview) return;
    const embedBroken =
      overview.sidecar_reachable && overview.sidecar_embed_ok === false;
    if (overview.sidecar_reachable && !embedBroken) return;
    if (!embedBroken && !canSilentStart) return;
    autoStartRef.current = true;
    void startSidecar();
  }, [
    canSilentStart,
    overview,
    overview?.sidecar_reachable,
    overview?.sidecar_embed_ok,
  ]);

  const toggleModule = async (key: string, enabled: boolean) => {
    const next = { ...moduleToggles, [key]: enabled };
    setModuleToggles(next);
    try {
      const saved = await orgModuleApi.setModules({ [key]: enabled });
      setModuleToggles(saved.updates);
    } catch (err) {
      setModuleToggles(moduleToggles);
      message.error(
        err instanceof Error ? err.message : t("organization.saveFailed"),
      );
    }
  };

  const saveSourceTo = async (dest: string) => {
    setDownloading(true);
    try {
      const result = await orgModuleApi.downloadSource(dest);
      message.success(
        t("organization.downloadSourceDone", { path: result.path }),
      );
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("organization.downloadSourceFailed"),
      );
    } finally {
      setDownloading(false);
    }
  };

  const browseSourceDest = async () => {
    setPickingFolder(true);
    try {
      const path = await pickDesktopFolder();
      if (path) {
        setSourceDest(path);
      } else if (!canPickDesktopFolder()) {
        message.info(t("organization.pickFolderFailed"));
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("organization.pickFolderFailed"),
      );
    } finally {
      setPickingFolder(false);
    }
  };

  const downloadSource = async () => {
    setPickingFolder(true);
    let dest: string | null = null;
    try {
      dest = await resolveOpenxyosSourceDest({
        canPickNative: canPickDesktopFolder(),
        pickNative: pickDesktopFolder,
        typedDest: sourceDest,
      });
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("organization.pickFolderFailed"),
      );
      setPickingFolder(false);
      return;
    }
    setPickingFolder(false);
    if (!dest) {
      if (!canPickDesktopFolder()) {
        message.error(t("organization.downloadSourceDest"));
      }
      return;
    }
    setSourceDest(dest);
    await saveSourceTo(dest);
  };

  const flagLabel = (value: boolean | undefined) =>
    value ? t("organization.yes") : t("organization.no");

  const assemble = () =>
    runAction("assemble", async () => {
      const result: OrgAssembleResult = await orgModuleApi.assemble();
      const names = result.spawned
        .map((row) => row.name || row.slug)
        .filter(Boolean);
      setLastActionNotes(result.notes);
      setLastReceipt({
        kind: "assemble",
        lines: [
          t("organization.assembleReceipt", { count: result.spawned.length }),
          ...names.slice(0, 6),
          t("organization.assembleNext"),
        ],
      });
      message.success(
        t("organization.assembleDone", { count: result.spawned.length }),
      );
    });

  const produce = () =>
    runAction("produce", async () => {
      const result: OrgProduceResult = await orgModuleApi.produce({
        name: produceName.trim(),
        ima_url: produceIma.trim(),
      });
      setLastActionNotes(result.notes);
      message.success(
        t("organization.produceDone", { name: result.slug || produceName }),
      );
    });

  const packBack = () =>
    runAction("pack", async () => {
      const result: OrgPackResult = await orgModuleApi.pack();
      if (result.applied.landed) setLanded(result.applied.landed);
      const remote = result.applied.remote_applied
        ? t("organization.packRemoteYes")
        : t("organization.packRemoteNo");
      setLastActionNotes([
        ...result.pack.notes,
        ...result.applied.notes,
        remote,
      ]);
      setLastReceipt({
        kind: "pack",
        lines: [t("organization.packReceipt"), remote],
      });
      message.success(t("organization.packDone"));
    });

  const runLoop = () =>
    runAction("loop", async () => {
      const proof = await orgModuleApi.runLoop();
      setLoopProof(proof);
      if (proof.landed) setLanded(proof.landed);
      setLastActionNotes(proof.notes);
      setLastReceipt({
        kind: "loop",
        lines: [
          proof.ok ? t("organization.loopOk") : t("organization.loopPartial"),
          `${t("organization.timelineRemote")}: ${flagLabel(
            Boolean(proof.remote_applied),
          )}`,
        ],
      });
      message.success(
        proof.ok ? t("organization.loopOk") : t("organization.loopPartial"),
      );
    });

  const progressLabel =
    busy === "assemble"
      ? t("organization.progressAssemble")
      : busy === "pack"
      ? t("organization.progressPack")
      : busy === "loop"
      ? t("organization.progressLoop")
      : busy === "produce"
      ? t("organization.progressProduce")
      : null;

  const lastLoop = (loopProof ?? overview?.last_loop) as OrgLoopProof | null;
  const lastSync = overview?.last_sync
    ? formatServerIsoDateTime(overview.last_sync, timeZone)
    : t("organization.neverSynced");
  const catalog = overview?.catalog ?? [];
  const disabledKeys = useMemo(
    () =>
      catalog
        .filter((row) => moduleToggles[row.key] === false)
        .map((row) => row.key),
    [catalog, moduleToggles],
  );
  const localConsoleUrl = (
    overview?.sidecar_url || "http://127.0.0.1:3780"
  ).replace(/\/$/, "");
  const previewUrl = useMemo(() => {
    const base = `${localConsoleUrl}/`;
    if (!disabledKeys.length) return base;
    return `${base}?freeos_disabled=${encodeURIComponent(
      disabledKeys.join(","),
    )}`;
  }, [localConsoleUrl, disabledKeys]);
  const showFrame = Boolean(previewUrl);

  const pushTogglesToPreview = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      { type: "freeos:module-toggles", disabled: disabledKeys },
      "*",
    );
  }, [disabledKeys]);

  useEffect(() => {
    if (!showFrame) return;
    pushTogglesToPreview();
  }, [showFrame, pushTogglesToPreview]);

  return (
    <PageShell title={t("organization.title")} fill>
      <div className={styles.page}>
        <section className={styles.statusBar}>
          <div className={styles.statusMeta}>
            <p className={styles.statusTitle}>
              {t("organization.statusBarTitle")}
            </p>
            <span className={styles.chip}>
              {overview?.enabled ? t("organization.on") : t("organization.off")}
            </span>
            <span className={styles.chip}>
              {previewBlank
                ? t("organization.sidecarEmbedFailed")
                : sidecarUp
                ? t("organization.sidecarUp")
                : t("organization.sidecarOpening")}
            </span>
            <span className={styles.chip}>
              {t("organization.lastSync")}: {lastSync}
            </span>
          </div>
          <div className={styles.statusActions}>
            <Button
              type="default"
              onClick={() => setDrawer("module")}
              data-testid="org-enable-module"
            >
              {t("organization.enableModule")}
            </Button>
            <Button
              type="default"
              icon={<Settings2 size={14} />}
              onClick={() => setDrawer("manage")}
              data-testid="org-manage-os"
            >
              {t("organization.manageOs")}
            </Button>
            {showFrame && (
              <Button
                type="link"
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                icon={<ExternalLink size={14} />}
                style={{ color: "#fff" }}
              >
                {t("organization.openSidecar")}
              </Button>
            )}
          </div>
        </section>

        <div className={styles.embedPane}>
          {!sidecarUp && (
            <div className={styles.previewOffline}>
              {t("organization.previewOffline")}
            </div>
          )}
          {previewBlank && (
            <div
              className={styles.previewBlank}
              data-testid="org-preview-blank"
            >
              {t("organization.previewBlank")}
            </div>
          )}
          <iframe
            key={sidecarUp ? "open" : "opening"}
            ref={iframeRef}
            title={t("organization.previewTitle")}
            src={previewUrl}
            className={styles.embed}
            allow="clipboard-read; clipboard-write"
            onLoad={pushTogglesToPreview}
          />
        </div>
      </div>

      <Drawer
        title={t("organization.moduleDrawerTitle")}
        open={drawer === "module"}
        onClose={() => setDrawer(null)}
        width={480}
        destroyOnHidden
      >
        <div className={styles.drawerBody}>
          <div className={styles.moduleToggle}>
            <Building2 size={18} />
            <span>{t("organization.toggleLabel")}</span>
            <Switch
              checked={Boolean(overview?.enabled)}
              loading={saving || loading}
              onChange={(checked) => void toggle(checked)}
            />
          </div>
          <p className={styles.catalogDesc}>{t("organization.glossary")}</p>
          <section>
            <p className={styles.timelineTitle}>
              {t("organization.catalogTitle")}
            </p>
            <p className={styles.catalogDesc} style={{ marginBottom: 12 }}>
              {t("organization.catalogToggleHint")}
            </p>
            <div className={styles.catalog}>
              {catalog.map((row) => (
                <article key={row.key} className={styles.catalogItem}>
                  <p className={styles.catalogName}>
                    {isZh ? row.label_zh : row.label}{" "}
                    <Tag>
                      {row.locked
                        ? t("organization.locked")
                        : moduleToggles[row.key] === false
                        ? t("organization.catalogDisabled")
                        : t("organization.catalogEnabled")}
                    </Tag>
                  </p>
                  <p className={styles.catalogDesc}>
                    {isZh ? row.description_zh : row.description}
                  </p>
                  {!row.locked && (
                    <Switch
                      size="small"
                      checked={moduleToggles[row.key] !== false}
                      onChange={(checked) =>
                        void toggleModule(row.key, checked)
                      }
                    />
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </Drawer>

      <Drawer
        title={t("organization.manageDrawerTitle")}
        open={drawer === "manage"}
        onClose={() => setDrawer(null)}
        width={720}
        destroyOnHidden
      >
        <div className={styles.drawerBody}>
          <p className={styles.heroStory}>{t("organization.heroStory")}</p>
          <p className={styles.heroStory}>{t("organization.glossary")}</p>

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
                    {sidecarUp
                      ? t("organization.sidecarUp")
                      : t("organization.sidecarOpening")}
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

          {progressLabel && (
            <section className={styles.recover}>
              <p className={styles.recoverTitle}>{progressLabel}</p>
            </section>
          )}

          <section className={styles.actions}>
            <div className={styles.action}>
              <Users size={18} />
              <p className={styles.actionTitle}>
                {t("organization.assembleTitle")}
              </p>
              <p className={styles.actionBody}>
                {t("organization.assembleBody")}
              </p>
              <Button
                type="primary"
                loading={busy === "assemble"}
                disabled={busy !== null}
                onClick={() => void assemble()}
              >
                {t("organization.assembleAction")}
              </Button>
            </div>
            <div className={styles.action}>
              <Package size={18} />
              <p className={styles.actionTitle}>
                {t("organization.packTitle")}
              </p>
              <p className={styles.actionBody}>{t("organization.packBody")}</p>
              <Button
                loading={busy === "pack"}
                disabled={busy !== null}
                onClick={() => void packBack()}
              >
                {t("organization.packAction")}
              </Button>
            </div>
            <div className={styles.action}>
              <Play size={18} />
              <p className={styles.actionTitle}>
                {t("organization.loopTitle")}
              </p>
              <p className={styles.actionBody}>{t("organization.loopBody")}</p>
              <Button
                loading={busy === "loop"}
                disabled={busy !== null}
                onClick={() => void runLoop()}
              >
                {t("organization.loopAction")}
              </Button>
            </div>
            <div className={styles.action}>
              <Users size={18} />
              <p className={styles.actionTitle}>
                {t("organization.produceTitle")}
              </p>
              <p className={styles.actionBody}>
                {t("organization.produceBody")}
              </p>
              <Input
                value={produceName}
                onChange={(event) => setProduceName(event.target.value)}
                placeholder={t("organization.produceName")}
              />
              <Input
                value={produceIma}
                onChange={(event) => setProduceIma(event.target.value)}
                placeholder={t("organization.produceIma")}
              />
              <Button
                loading={busy === "produce"}
                disabled={busy !== null}
                onClick={() => void produce()}
              >
                {t("organization.produceAction")}
              </Button>
            </div>
          </section>

          {lastReceipt ? (
            <section className={styles.timeline}>
              <p className={styles.timelineTitle}>
                {t("organization.receiptTitle")}
              </p>
              <ol className={styles.timelineList}>
                {lastReceipt.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className={styles.timeline}>
            <p className={styles.timelineTitle}>
              {t("organization.timelineTitle")}
            </p>
            {lastLoop ? (
              <ol className={styles.timelineList}>
                <li>
                  {t("organization.timelineOk")}: {flagLabel(lastLoop.ok)}
                </li>
                {lastLoop.employees?.length ? (
                  <li>
                    {t("organization.timelineEmployees")}:{" "}
                    {lastLoop.employees.join(", ")}
                  </li>
                ) : null}
                {lastLoop.skills?.length ? (
                  <li>
                    {t("organization.timelineSkills")}: {lastLoop.skills.length}
                  </li>
                ) : null}
                <li>
                  {t("organization.timelineRemote")}:{" "}
                  {flagLabel(Boolean(lastLoop.remote_applied))}
                </li>
                <li>
                  {t("organization.timelineGovernance")}:{" "}
                  {flagLabel(Boolean(lastLoop.governance_blocked))}
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
              {t("organization.landedTitle")}
            </p>
            {landed ? (
              <pre className={styles.catalogDesc}>
                {JSON.stringify(landed, null, 2)}
              </pre>
            ) : (
              <p>{t("organization.landedEmpty")}</p>
            )}
          </section>

          {(sidecarUp || overview?.enabled) && (
            <section className={styles.timeline}>
              <p className={styles.timelineTitle}>
                {t("organization.downloadSource")}
              </p>
              <p className={styles.catalogDesc}>
                {t("organization.downloadSourceHint")}
              </p>
              <Space wrap style={{ marginTop: 12 }}>
                <Space.Compact style={{ minWidth: 320 }}>
                  <Input
                    value={sourceDest}
                    onChange={(event) => setSourceDest(event.target.value)}
                    placeholder={t("organization.downloadSourceDest")}
                    readOnly={canPickDesktopFolder()}
                  />
                  <Button
                    loading={pickingFolder}
                    onClick={() => void browseSourceDest()}
                  >
                    {t("organization.browseDest")}
                  </Button>
                </Space.Compact>
                <Button
                  type="primary"
                  loading={downloading || pickingFolder}
                  onClick={() => void downloadSource()}
                >
                  {t("organization.downloadSource")}
                </Button>
              </Space>
            </section>
          )}
        </div>
      </Drawer>
    </PageShell>
  );
}
