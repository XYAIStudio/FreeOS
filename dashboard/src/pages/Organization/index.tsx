import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Drawer, Input, Space, Switch, Tag } from "antd";
import {
  ArrowDownUp,
  Building2,
  Download,
  Package,
  Play,
  RefreshCw,
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
import { sidecarRecoverPhase, shouldShowPreviewBlank } from "./sidecarRecover";
import { confirmSidecarLivez, sidecarPreviewGate } from "./sidecarLivez";
import OrgMiniBrowser from "./OrgMiniBrowser";
import OrgRestartOverlay from "./OrgRestartOverlay";
import {
  DEFAULT_ORG_URL,
  closeOrgTab,
  createHomeTab,
  goBackOrgTab,
  goForwardOrgTab,
  isSidecarOriginUrl,
  navigateOrgTab,
  normalizeOrgUrl,
  openOrgTab,
  parseOrgNavigatedMessage,
  parseOrgOpenTabMessage,
  reloadOrgTab,
  sidecarOriginOf,
  tabTitleFromUrl,
  type OrgBrowserTab,
} from "./orgBrowser";
import { installOrgPageWindowTrap } from "./orgPageWindowTrap";
import { registerOrgBrowserHost } from "../../utils/orgBrowserHost";
import styles from "./Organization.module.less";

type ActionKey =
  | "assemble"
  | "pack"
  | "loop"
  | "sidecar"
  | "restart"
  | "produce"
  | null;
type DrawerKey = "module" | "manage" | null;

type LastReceipt = {
  kind: "assemble" | "pack" | "loop";
  lines: string[];
};

function metric(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

function landedCount(
  landed: Record<string, unknown> | null | undefined,
  surface: string,
): number {
  const inner =
    landed && typeof landed.landed === "object" && landed.landed
      ? (landed.landed as Record<
          string,
          { created?: number; updated?: number }
        >)
      : (landed as Record<
          string,
          { created?: number; updated?: number }
        > | null);
  const row = inner?.[surface];
  return Number(row?.created || 0) + Number(row?.updated || 0);
}

function landedTenant(
  landed: Record<string, unknown> | null | undefined,
  fallback?: number | null,
): string {
  const raw = landed?.tenant_id ?? fallback;
  return raw === undefined || raw === null || raw === "" ? "—" : String(raw);
}

export default function OrganizationPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const livezOkRef = useRef(false);
  const [previewNonce, setPreviewNonce] = useState("");
  const [livezOk, setLivezOk] = useState(false);
  const [autoStarting, setAutoStarting] = useState(false);
  const [autoStartFailed, setAutoStartFailed] = useState(false);
  const [restartFinished, setRestartFinished] = useState(false);
  const [openBlocked, setOpenBlocked] = useState(false);
  const homeTitle = t("organization.homeTabTitle");
  const [tabs, setTabs] = useState<OrgBrowserTab[]>(() => [
    createHomeTab(DEFAULT_ORG_URL, homeTitle),
  ]);
  const [activeId, setActiveId] = useState("org-home");
  const [addressValue, setAddressValue] = useState(DEFAULT_ORG_URL);

  const showPreview = useCallback(
    (path: string) => {
      const dest = normalizeOrgUrl(
        `${(overview?.sidecar_url || DEFAULT_ORG_URL).replace(/\/$/, "")}${
          path.startsWith("/") ? path : `/${path}`
        }`,
      );
      const origin = sidecarOriginOf(
        (overview?.sidecar_url || DEFAULT_ORG_URL).replace(/\/$/, ""),
      );
      if (isSidecarOriginUrl(dest, origin) && !livezOkRef.current) {
        void confirmSidecarLivez({
          origin,
          apiProbe: orgModuleApi.probeLivez,
        }).then((ok) => {
          setLivezOk(ok);
          livezOkRef.current = ok;
          if (!ok) setOpenBlocked(true);
        });
      }
      setTabs((current) =>
        navigateOrgTab(current, "org-home", dest, homeTitle),
      );
      setActiveId("org-home");
      setAddressValue(dest);
      setPreviewNonce(String(Date.now()));
    },
    [homeTitle, overview?.sidecar_url],
  );

  const applyOverview = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const next = await orgModuleApi.overview();
        setOverview(next);
        setLivezOk(Boolean(next.sidecar_reachable));
        livezOkRef.current = Boolean(next.sidecar_reachable);
        if (next.sidecar_reachable) setOpenBlocked(false);
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

  const sidecarUp = Boolean(overview?.sidecar_reachable) && livezOk;
  const embedOk = overview?.sidecar_embed_ok;
  const previewBlank = shouldShowPreviewBlank({
    sidecarUp,
    embedOk,
  });
  const recoverPhase = sidecarRecoverPhase({
    sidecarUp,
    installReady: Boolean(overview?.install_ready),
    startAvailable: Boolean(overview?.start_available),
    autoStarting,
    autoStartFailed,
  });
  const previewGate = sidecarPreviewGate({
    livezOk: sidecarUp,
    restarting: busy === "restart",
  });
  const showRestartGate =
    Boolean(overview) &&
    previewGate === "needsRestart" &&
    (openBlocked || recoverPhase === "needsRestart");
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
      if (key !== "sidecar" && key !== "restart") {
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
      setAutoStarting(true);
      setAutoStartFailed(false);
      try {
        const result = await orgModuleApi.startSidecar();
        setLastActionNotes([result.detail, result.command].filter(Boolean));
        const next = result.reachable
          ? await applyOverview(true)
          : await waitForSidecar();
        if (next?.sidecar_reachable) {
          setAutoStartFailed(false);
          return;
        }
        setAutoStartFailed(true);
      } catch {
        setAutoStartFailed(true);
      } finally {
        setAutoStarting(false);
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
          t("organization.assemblePreviewExperts"),
        ],
      });
      message.success(
        t("organization.assembleDone", { count: result.spawned.length }),
      );
      setDrawer(null);
      await applyOverview(true);
      navigate(result.preview_path || "/experts");
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
      const landedLines = result.applied.remote_applied
        ? [
            t("organization.packLanded", {
              tenant: landedTenant(
                result.applied.landed,
                result.applied.tenant_id,
              ),
              employees: landedCount(result.applied.landed, "employees"),
              talent: landedCount(result.applied.landed, "talent"),
              skills: landedCount(result.applied.landed, "skills"),
              plugins: landedCount(result.applied.landed, "plugins"),
            }),
            t("organization.packPreviewEmployees"),
          ]
        : [];
      setLastActionNotes([
        ...result.pack.notes,
        ...result.applied.notes,
        remote,
      ]);
      setLastReceipt({
        kind: "pack",
        lines: [t("organization.packReceipt"), remote, ...landedLines],
      });
      setDrawer(null);
      await applyOverview(true);
      if (result.applied.remote_applied) {
        showPreview(result.applied.preview_path || "/employees");
      }
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
          ...(proof.remote_applied
            ? [
                t("organization.packLanded", {
                  tenant: landedTenant(proof.landed),
                  employees: landedCount(proof.landed, "employees"),
                  talent: landedCount(proof.landed, "talent"),
                  skills: landedCount(proof.landed, "skills"),
                  plugins: landedCount(proof.landed, "plugins"),
                }),
                t("organization.packPreviewEmployees"),
              ]
            : []),
        ],
      });
      setDrawer(null);
      await applyOverview(true);
      if (proof.remote_applied) {
        showPreview("/employees");
      }
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
      : busy === "restart"
      ? t("organization.restartingSidecar")
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
  const localConsoleUrl = (overview?.sidecar_url || DEFAULT_ORG_URL).replace(
    /\/$/,
    "",
  );
  const sidecarOrigin = sidecarOriginOf(localConsoleUrl);

  const confirmLivez = useCallback(async (): Promise<boolean> => {
    const origin = sidecarOriginOf(
      (overview?.sidecar_url || DEFAULT_ORG_URL).replace(/\/$/, ""),
    );
    const ok = await confirmSidecarLivez({
      origin,
      apiProbe: orgModuleApi.probeLivez,
    });
    setLivezOk(ok);
    livezOkRef.current = ok;
    if (ok) setOpenBlocked(false);
    return ok;
  }, [overview?.sidecar_url]);

  const openTab = useCallback(
    (raw: string, title?: string, reuse = true) => {
      const url = normalizeOrgUrl(raw);
      const origin = sidecarOriginOf(
        (overview?.sidecar_url || DEFAULT_ORG_URL).replace(/\/$/, ""),
      );
      if (isSidecarOriginUrl(url, origin) && !livezOkRef.current) {
        void confirmLivez().then((ok) => {
          if (!ok) setOpenBlocked(true);
        });
      }
      const label = title || tabTitleFromUrl(url, homeTitle);
      let nextActive = "";
      let nextAddress = url;
      setTabs((current) => {
        const next = openOrgTab(current, url, label, reuse);
        nextActive = next.activeId;
        nextAddress =
          next.tabs.find((tab) => tab.id === next.activeId)?.url ?? url;
        return next.tabs;
      });
      if (nextActive) setActiveId(nextActive);
      setAddressValue(nextAddress);
      return true;
    },
    [confirmLivez, homeTitle, overview?.sidecar_url],
  );

  const submitAddress = useCallback(() => {
    const url = normalizeOrgUrl(addressValue, localConsoleUrl + "/");
    if (isSidecarOriginUrl(url, sidecarOrigin) && !livezOkRef.current) {
      void confirmLivez().then((ok) => {
        if (!ok) setOpenBlocked(true);
      });
    }
    setTabs((current) =>
      navigateOrgTab(current, activeId, url, tabTitleFromUrl(url, homeTitle)),
    );
    setAddressValue(url);
  }, [
    activeId,
    addressValue,
    confirmLivez,
    homeTitle,
    localConsoleUrl,
    sidecarOrigin,
  ]);

  const goHomeAfterRestart = useCallback(() => {
    const home = normalizeOrgUrl(localConsoleUrl + "/");
    setTabs([createHomeTab(home, homeTitle)]);
    setActiveId("org-home");
    setAddressValue(home);
    setPreviewNonce(String(Date.now()));
  }, [homeTitle, localConsoleUrl]);

  const onBrowserBack = useCallback(() => {
    setTabs((current) => {
      const next = goBackOrgTab(current, activeId, homeTitle);
      const url = next.find((tab) => tab.id === activeId)?.url;
      if (url) setAddressValue(url);
      return next;
    });
  }, [activeId, homeTitle]);

  const onBrowserForward = useCallback(() => {
    setTabs((current) => {
      const next = goForwardOrgTab(current, activeId, homeTitle);
      const url = next.find((tab) => tab.id === activeId)?.url;
      if (url) setAddressValue(url);
      return next;
    });
  }, [activeId, homeTitle]);

  const onBrowserReload = useCallback(() => {
    const tab = tabs.find((row) => row.id === activeId);
    if (
      tab &&
      isSidecarOriginUrl(tab.url, sidecarOrigin) &&
      !livezOkRef.current
    ) {
      void confirmLivez().then((ok) => {
        if (!ok) setOpenBlocked(true);
      });
      return;
    }
    setTabs((current) => reloadOrgTab(current, activeId));
  }, [activeId, confirmLivez, sidecarOrigin, tabs]);

  const restartSidecar = () =>
    runAction("restart", async () => {
      setRestartFinished(false);
      setOpenBlocked(false);
      const result = await orgModuleApi.restartSidecar();
      setLastActionNotes([result.detail, result.command].filter(Boolean));
      const next = result.reachable
        ? await applyOverview(true)
        : await waitForSidecar();
      if (next?.sidecar_reachable) {
        setRestartFinished(true);
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        goHomeAfterRestart();
        message.success(t("organization.restartSidecarDone"));
        return;
      }
      message.error(
        t("organization.restartSidecarFailed", {
          detail: result.detail || t("organization.actionFailed"),
        }),
      );
    });

  const pushTogglesToPreview = useCallback(() => {
    for (const frame of Object.values(iframeRefs.current)) {
      frame?.contentWindow?.postMessage(
        { type: "freeos:module-toggles", disabled: disabledKeys },
        "*",
      );
    }
  }, [disabledKeys]);

  useEffect(() => {
    pushTogglesToPreview();
  }, [pushTogglesToPreview]);

  useEffect(() => {
    const home = normalizeOrgUrl(localConsoleUrl + "/");
    setTabs((current) => {
      const existing = current.find((tab) => tab.id === "org-home");
      if (!existing || existing.url === home) return current;
      if (existing.url !== DEFAULT_ORG_URL) return current;
      return navigateOrgTab(current, "org-home", home, homeTitle);
    });
    setAddressValue((current) =>
      current === DEFAULT_ORG_URL ? home : current,
    );
  }, [homeTitle, localConsoleUrl]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const opened = parseOrgOpenTabMessage(event.data);
      if (opened) {
        openTab(opened.url, opened.title);
        return;
      }
      const navigated = parseOrgNavigatedMessage(event.data);
      if (!navigated) return;
      setTabs((current) =>
        navigateOrgTab(
          current,
          activeId,
          navigated.url,
          navigated.title || tabTitleFromUrl(navigated.url, homeTitle),
          false,
        ),
      );
      setAddressValue(navigated.url);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activeId, homeTitle, openTab]);

  useEffect(() => {
    const stopHost = registerOrgBrowserHost(openTab);
    const stopTrap = installOrgPageWindowTrap();
    return () => {
      stopTrap();
      stopHost();
    };
  }, [openTab]);

  useEffect(() => {
    if (sidecarUp) {
      setPreviewNonce((current) => current || String(Date.now()));
    }
  }, [sidecarUp]);

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
            <Button
              size="small"
              className={`${styles.restartBtn} ${
                showRestartGate ? styles.restartBtnPulse : ""
              }`}
              icon={<RefreshCw size={13} />}
              loading={busy === "restart"}
              disabled={busy !== null && busy !== "restart"}
              onClick={() => void restartSidecar()}
              data-testid="org-restart-sidecar"
              title={t("organization.restartSidecar")}
            >
              {t("organization.restartSidecar")}
            </Button>
            <span className={styles.chip} data-testid="org-last-sync">
              {t("organization.lastSync")}: {lastSync}
            </span>
          </div>
          <div className={styles.statusActions}>
            <Button
              type="primary"
              icon={<Download size={14} />}
              loading={downloading || pickingFolder}
              onClick={() => void downloadSource()}
              data-testid="org-download-source"
              title={t("organization.downloadSource")}
            >
              {t("organization.downloadSourceBar")}
            </Button>
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
          </div>
        </section>

        <OrgMiniBrowser
          tabs={tabs}
          activeId={activeId}
          addressValue={addressValue}
          sidecarOrigin={sidecarOrigin}
          disabledKeys={disabledKeys}
          previewNonce={previewNonce}
          sidecarUp={sidecarUp}
          livezOk={livezOk}
          previewBlank={previewBlank}
          recoverPhase={recoverPhase}
          iframeRefs={iframeRefs}
          onAddressChange={setAddressValue}
          onAddressSubmit={submitAddress}
          onSelectTab={(id) => {
            setActiveId(id);
            const tab = tabs.find((row) => row.id === id);
            if (tab) setAddressValue(tab.url);
          }}
          onCloseTab={(id) => {
            let nextActive = activeId;
            let nextAddress = addressValue;
            setTabs((current) => {
              const next = closeOrgTab(current, activeId, id);
              nextActive = next.activeId;
              nextAddress =
                next.tabs.find((row) => row.id === next.activeId)?.url ??
                addressValue;
              return next.tabs;
            });
            setActiveId(nextActive);
            setAddressValue(nextAddress);
          }}
          onNewTab={() => openTab(localConsoleUrl + "/", homeTitle, false)}
          onBack={onBrowserBack}
          onForward={onBrowserForward}
          onReload={onBrowserReload}
          onFrameLoad={pushTogglesToPreview}
        />
        {(busy === "restart" || showRestartGate) && (
          <OrgRestartOverlay
            mode={busy === "restart" ? "restarting" : "needsRestart"}
            finished={restartFinished}
            onRestart={() => void restartSidecar()}
          />
        )}
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
                data-testid="org-assemble"
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
                data-testid="org-pack"
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
                data-testid="org-loop"
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
            <section className={styles.timeline} data-testid="org-last-receipt">
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
                {!canPickDesktopFolder() && (
                  <Input
                    value={sourceDest}
                    onChange={(event) => setSourceDest(event.target.value)}
                    placeholder={t("organization.downloadSourceDest")}
                    style={{ minWidth: 280 }}
                  />
                )}
                <Button
                  loading={downloading || pickingFolder}
                  onClick={() => void downloadSource()}
                  data-testid="org-download-source-drawer"
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
