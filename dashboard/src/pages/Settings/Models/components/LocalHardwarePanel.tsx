import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  List,
  Modal,
  Progress,
  Space,
  Tag,
  Typography,
} from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  localModelsApi,
  type LocalInstalledModel,
  type LocalProbe,
  type LocalRuntimeResult,
  type LocalScanJob,
} from "../../../../api/modules/localModels";
import { formatBytes } from "../../../../utils/embeddingDownload";
import {
  loadSpeedResults,
  saveSpeedResult,
  speedResultKey,
  type StoredLocalSpeedResult,
} from "../../../../utils/localSpeedResults";
import {
  canPickDesktopFolder,
  pickDesktopFolder,
} from "../../../../utils/desktopFolder";
import { message } from "../../../../utils/antdMessage";
import { apiErrorMessage } from "../../../../utils/apiError";
import { CONVERSATION_LIST_PATH } from "../../../../layouts/conversationHome";
import { notifyModelsChanged } from "../modelsChanged";

function mergeModels(
  ...groups: Array<LocalInstalledModel[] | undefined>
): LocalInstalledModel[] {
  const seen = new Set<string>();
  const out: LocalInstalledModel[] = [];
  for (const group of groups) {
    for (const item of group ?? []) {
      const key = `${item.source}:${item.path || item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function canRegister(item: LocalInstalledModel): boolean {
  if (item.registered) return false;
  if (item.registerable === false) return false;
  return (
    item.source === "gguf" || item.source === "ggml" || item.source === "ollama"
  );
}

function canSpeedTest(item: LocalInstalledModel): boolean {
  return item.registered === true || item.source === "ollama";
}

function canSetDefault(item: LocalInstalledModel): boolean {
  return item.registered === true;
}

const SPEED_TEST_TIMEOUT_MS = 45_000;

export function LocalHardwarePanel({
  onSaved,
}: {
  onSaved?: () => void | Promise<void>;
} = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [probe, setProbe] = useState<LocalProbe | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [speedResults, setSpeedResults] = useState<
    Record<string, StoredLocalSpeedResult>
  >(() => loadSpeedResults());
  const [scanRoot, setScanRoot] = useState("");
  const [fullDisk, setFullDisk] = useState(false);
  const [scan, setScan] = useState<LocalScanJob | null>(null);
  const [scanning, setScanning] = useState(false);
  const pollRef = useRef<number | null>(null);
  const speedAbortRef = useRef<AbortController | null>(null);
  const speedAbortReasonRef = useRef<"user" | "timeout" | null>(null);

  const stopPoll = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      setProbe(await localModelsApi.probe());
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localProbeFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => {
      stopPoll();
      speedAbortRef.current?.abort();
    };
  }, []);

  const showRuntimeError = (result: LocalRuntimeResult, fallback: string) => {
    message.error(result.next_step || result.error || fallback);
  };

  const startOllama = async () => {
    setStarting(true);
    try {
      const result = await localModelsApi.startOllama();
      if (result.ok && result.running) {
        message.success(t("models.localOllamaStarted"));
        await refresh();
        return;
      }
      showRuntimeError(result, t("models.localOllamaStartFailed"));
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localOllamaStartFailed"),
      );
    } finally {
      setStarting(false);
    }
  };

  const ensureDeps = async (install: boolean) => {
    setEnsuring(true);
    try {
      const result = await localModelsApi.ensureDeps(install);
      if (result.ok && (result.running || result.installed)) {
        message.success(
          result.running
            ? t("models.localOllamaStarted")
            : t("models.localDepsInstalled"),
        );
        await refresh();
        return;
      }
      showRuntimeError(result, t("models.localDepsFailed"));
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localDepsFailed"),
      );
    } finally {
      setEnsuring(false);
    }
  };

  const install = async (name: string) => {
    const hw = probe?.hardware;
    const missing = (probe?.deps ?? []).length > 0 || !hw?.ollama_reachable;
    if (missing) {
      Modal.confirm({
        title: t("models.localDepsNeededTitle"),
        content: t("models.localDepsNeededBody"),
        okText: t("models.localOneClickInstall"),
        cancelText: t("common.cancel"),
        onOk: async () => {
          const installed = hw?.ollama_installed || hw?.ollama_binary;
          await ensureDeps(!installed);
          const latest = await localModelsApi.probe();
          setProbe(latest);
          if (!latest.hardware.ollama_reachable) {
            return;
          }
          await pullModel(name);
        },
      });
      return;
    }
    await pullModel(name);
  };

  const pullModel = async (name: string) => {
    setInstalling(name);
    try {
      const result = await localModelsApi.install(name);
      if (!result.ok) {
        showRuntimeError(result, t("models.localInstallFailed"));
        await refresh();
        return;
      }
      notifyModelsChanged();
      await onSaved?.();
      message.success(
        t(
          result.registered === false
            ? "models.localInstallNeedProvider"
            : "models.localInstallRegistered",
          { name: result.name || name },
        ),
      );
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localInstallFailed"),
      );
    } finally {
      setInstalling(null);
    }
  };

  const pollScan = (jobId: string) => {
    stopPoll();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const next = await localModelsApi.getScan(jobId);
          setScan(next);
          if (
            next.status === "completed" ||
            next.status === "failed" ||
            next.status === "cancelled"
          ) {
            stopPoll();
            setScanning(false);
            if (next.status === "completed") {
              message.success(
                t("models.localScanDone", { count: next.found?.length ?? 0 }),
              );
            } else if (next.status === "failed") {
              message.error(next.error || t("models.localScanFailed"));
            }
            await refresh();
          }
        } catch (err) {
          stopPoll();
          setScanning(false);
          message.error(
            err instanceof Error ? err.message : t("models.localScanFailed"),
          );
        }
      })();
    }, 800);
  };

  const beginScan = async () => {
    const run = async () => {
      setScanning(true);
      try {
        const job = await localModelsApi.startScan({
          root: scanRoot.trim() || undefined,
          full_disk: fullDisk,
        });
        setScan(job);
        const terminal =
          job.status === "completed" ||
          job.status === "failed" ||
          job.status === "cancelled";
        if (job.job_id && !terminal) {
          pollScan(job.job_id);
        } else {
          setScanning(false);
        }
      } catch (err) {
        setScanning(false);
        message.error(
          err instanceof Error ? err.message : t("models.localScanFailed"),
        );
      }
    };
    if (fullDisk) {
      Modal.confirm({
        title: t("models.localScanFullDiskTitle"),
        content: t("models.localScanFullDiskWarn"),
        okText: t("models.localScanStart"),
        cancelText: t("common.cancel"),
        onOk: () => run(),
      });
      return;
    }
    await run();
  };

  const cancelScan = async () => {
    if (!scan?.job_id) return;
    try {
      const next = await localModelsApi.cancelScan(scan.job_id);
      setScan(next);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localScanCancelFailed"),
      );
    } finally {
      stopPoll();
      setScanning(false);
    }
  };

  const pickFolder = async () => {
    const path = await pickDesktopFolder();
    if (path) {
      setScanRoot(path);
      return;
    }
    if (!canPickDesktopFolder()) {
      message.info(t("models.localScanPickHint"));
    }
  };

  const register = async (item: LocalInstalledModel) => {
    if (!canRegister(item)) {
      message.info(t("models.localRegisterManual"));
      return;
    }
    setRegistering(item.path || item.name);
    try {
      const result = await localModelsApi.register({
        path: item.path,
        name: item.name,
        source: item.source,
        size: item.size,
      });
      if (!result.ok) {
        showRuntimeError(result, t("models.localRegisterFailed"));
        return;
      }
      notifyModelsChanged();
      await onSaved?.();
      message.success(t("models.localRegisterDone", { name: result.name }));
      await refresh();
    } catch (err) {
      message.error(apiErrorMessage(err, t("models.localRegisterFailed"), t));
    } finally {
      setRegistering(null);
    }
  };

  const itemKey = (item: LocalInstalledModel) =>
    speedResultKey(item.source, item.name);

  const runSpeedTest = async (item: LocalInstalledModel) => {
    const key = itemKey(item);
    speedAbortRef.current?.abort();
    const controller = new AbortController();
    speedAbortRef.current = controller;
    speedAbortReasonRef.current = null;
    const timer = window.setTimeout(() => {
      speedAbortReasonRef.current = "timeout";
      controller.abort();
    }, SPEED_TEST_TIMEOUT_MS);
    setTestingKey(key);
    try {
      const result = await localModelsApi.speedTest(item.name, {
        signal: controller.signal,
      });
      const stored = saveSpeedResult(item.source, item.name, result);
      setSpeedResults((prev) => ({ ...prev, [key]: stored }));
      if (result.ok) {
        message.success(
          t("models.localSpeedSuccess", {
            name: item.name,
            latency: result.latency_ms ?? 0,
          }),
        );
        return;
      }
      message.error(
        result.action === "unreachable"
          ? t("models.localSpeedNeedRuntime")
          : result.action === "timeout"
          ? t("models.localSpeedTimeout")
          : result.next_step || result.error || t("models.localSpeedFailed"),
      );
    } catch (err) {
      if (controller.signal.aborted) {
        message.info(
          speedAbortReasonRef.current === "timeout"
            ? t("models.localSpeedTimeout")
            : t("models.localSpeedCancelled"),
        );
        return;
      }
      const stored = saveSpeedResult(item.source, item.name, {
        ok: false,
        error:
          err instanceof Error ? err.message : t("models.localSpeedFailed"),
      });
      setSpeedResults((prev) => ({ ...prev, [key]: stored }));
      message.error(
        err instanceof Error ? err.message : t("models.localSpeedFailed"),
      );
    } finally {
      window.clearTimeout(timer);
      if (speedAbortRef.current === controller) {
        speedAbortRef.current = null;
      }
      setTestingKey((current) => (current === key ? null : current));
    }
  };

  const cancelSpeedTest = () => {
    speedAbortReasonRef.current = "user";
    speedAbortRef.current?.abort();
  };

  const setAsDefault = async (item: LocalInstalledModel) => {
    setSettingDefault(item.name);
    try {
      const result = await localModelsApi.setDefault(item.name);
      if (!result.ok) {
        message.error(
          result.action === "not_registered"
            ? t("models.localDefaultNeedRegister")
            : result.next_step ||
                result.error ||
                t("models.localDefaultFailed"),
        );
        return;
      }
      notifyModelsChanged();
      await onSaved?.();
      message.success(t("models.localDefaultSet", { name: item.name }));
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localDefaultFailed"),
      );
    } finally {
      setSettingDefault(null);
    }
  };

  const clearDefault = async (item: LocalInstalledModel) => {
    setSettingDefault(item.name);
    try {
      const result = await localModelsApi.clearDefault(item.name);
      if (!result.ok) {
        message.error(
          result.next_step || result.error || t("models.localDefaultFailed"),
        );
        return;
      }
      notifyModelsChanged();
      await onSaved?.();
      message.success(t("models.localDefaultCleared"));
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localDefaultFailed"),
      );
    } finally {
      setSettingDefault(null);
    }
  };

  const formatSpeed = (result: StoredLocalSpeedResult) => {
    if (!result.ok) {
      if (result.action === "unreachable")
        return t("models.localSpeedNeedRuntime");
      if (result.action === "timeout") return t("models.localSpeedTimeout");
      return result.error || t("models.localSpeedFailed");
    }
    const parts = [
      t("models.localSpeedLatency", { ms: result.latency_ms ?? 0 }),
    ];
    if (result.ttft_ms != null) {
      parts.push(t("models.localSpeedTtft", { ms: result.ttft_ms }));
    }
    if (result.tokens_per_sec != null) {
      parts.push(
        t("models.localSpeedTps", { tps: result.tokens_per_sec.toFixed(1) }),
      );
    }
    return parts.join(" · ");
  };

  const hw = probe?.hardware;
  const ollamaInstalled = Boolean(hw?.ollama_installed || hw?.ollama_binary);
  const ollamaUp = Boolean(hw?.ollama_reachable);
  const deps = probe?.deps ?? [];
  const models = useMemo(
    () => mergeModels(probe?.installed, scan?.found),
    [probe?.installed, scan?.found],
  );
  const scanActive = scanning || scan?.status === "running";

  return (
    <Card
      size="small"
      loading={loading && !probe}
      title={t("models.localHardwareTitle")}
      extra={
        <Button size="small" onClick={() => void refresh()} loading={loading}>
          {t("common.refresh")}
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      {hw && (
        <Space wrap size={8} style={{ marginBottom: 12 }}>
          <Tag>
            {hw.os} / {hw.arch}
          </Tag>
          <Tag>
            {t("models.localCpu")}: {hw.cpu_count}
          </Tag>
          <Tag>
            {t("models.localRam")}: {hw.ram_gb} GB
          </Tag>
          <Tag>
            {t("models.localGpu")}: {hw.gpu || t("models.localGpuNone")}
          </Tag>
          <Tag
            color={ollamaUp ? "green" : ollamaInstalled ? "orange" : "default"}
          >
            Ollama{" "}
            {ollamaUp
              ? t("organization.on")
              : ollamaInstalled
              ? t("models.localOllamaInstalledStopped")
              : t("organization.off")}
          </Tag>
        </Space>
      )}
      <Typography.Paragraph type="secondary">
        {t("models.localHardwareHint")}
      </Typography.Paragraph>
      {ollamaInstalled && !ollamaUp && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("models.localOllamaInstalledNotRunning")}
          action={
            <Button
              type="primary"
              size="small"
              loading={starting}
              onClick={() => void startOllama()}
            >
              {t("models.localStartOllama")}
            </Button>
          }
        />
      )}

      {deps.some((dep) => dep.id === "ollama") && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("models.localOllamaMissing")}
          description={
            deps.find((dep) => dep.id === "ollama")?.automatable
              ? t("models.localOllamaMissingAuto")
              : t("models.localOllamaMissingManual")
          }
          action={
            <Button
              type="primary"
              size="small"
              loading={ensuring}
              onClick={() => void ensureDeps(true)}
            >
              {t("models.localOneClickInstall")}
            </Button>
          }
        />
      )}

      <Button
        size="small"
        type="link"
        style={{ paddingLeft: 0, marginBottom: 8 }}
        onClick={() => navigate(CONVERSATION_LIST_PATH)}
      >
        {t("models.useInChat")}
      </Button>

      <Typography.Title level={5}>
        {t("models.localInstalled")}
      </Typography.Title>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          size="small"
          style={{ minWidth: 260 }}
          value={scanRoot}
          onChange={(event) => setScanRoot(event.target.value)}
          placeholder={t("models.localScanRootPlaceholder")}
        />
        <Button size="small" onClick={() => void pickFolder()}>
          {t("models.localScanPickFolder")}
        </Button>
        <Checkbox
          checked={fullDisk}
          onChange={(event) => setFullDisk(event.target.checked)}
        >
          {t("models.localScanFullDisk")}
        </Checkbox>
        <Button
          size="small"
          type="primary"
          loading={scanActive}
          onClick={() => void beginScan()}
        >
          {t("models.localSearchModels")}
        </Button>
        {scanActive && (
          <Button size="small" onClick={() => void cancelScan()}>
            {t("common.cancel")}
          </Button>
        )}
      </Space>
      {scanActive && (
        <div style={{ marginBottom: 12 }}>
          <Progress
            percent={
              scan?.files_found
                ? Math.min(95, 10 + (scan.dirs_scanned ?? 0) / 20)
                : scan?.dirs_scanned
                ? Math.min(80, 5 + (scan.dirs_scanned ?? 0) / 30)
                : 8
            }
            status="active"
          />
          <Typography.Text type="secondary">
            {t("models.localScanProgress", {
              dirs: scan?.dirs_scanned ?? 0,
              files: scan?.files_found ?? 0,
              current: scan?.current || "…",
            })}
          </Typography.Text>
        </div>
      )}
      <List
        size="small"
        dataSource={models}
        locale={{ emptyText: t("models.localInstalledEmpty") }}
        renderItem={(item) => {
          const key = itemKey(item);
          const testing = testingKey === key;
          const lastSpeed = speedResults[key];
          const actions: ReactNode[] = [];
          if (canSpeedTest(item)) {
            actions.push(
              testing ? (
                <Button
                  key="cancel-speed"
                  size="small"
                  onClick={cancelSpeedTest}
                >
                  {t("models.localSpeedCancel")}
                </Button>
              ) : (
                <Button
                  key="speed"
                  size="small"
                  disabled={!ollamaUp}
                  title={
                    ollamaUp ? undefined : t("models.localSpeedNeedRuntime")
                  }
                  onClick={() => void runSpeedTest(item)}
                >
                  {t("models.localSpeedTest")}
                </Button>
              ),
            );
          }
          if (canSetDefault(item)) {
            actions.push(
              item.is_default ? (
                <Button
                  key="clear-default"
                  size="small"
                  loading={settingDefault === item.name}
                  onClick={() => void clearDefault(item)}
                >
                  {t("models.localClearDefault")}
                </Button>
              ) : (
                <Button
                  key="set-default"
                  size="small"
                  loading={settingDefault === item.name}
                  onClick={() => void setAsDefault(item)}
                >
                  {t("models.localSetDefault")}
                </Button>
              ),
            );
          } else if (canRegister(item)) {
            actions.push(
              <Button
                key="register"
                size="small"
                loading={registering === (item.path || item.name)}
                onClick={() => void register(item)}
              >
                {t("models.localRegister")}
              </Button>,
            );
          } else if (item.source === "safetensors") {
            actions.push(
              <Typography.Text key="manual" type="secondary">
                {t("models.localRegisterManual")}
              </Typography.Text>,
            );
          }
          const description = [
            item.path || t("models.localOllamaManaged"),
            lastSpeed ? formatSpeed(lastSpeed) : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <List.Item actions={actions.length ? actions : undefined}>
              <List.Item.Meta
                title={
                  <Space wrap size={6}>
                    <span>{item.name}</span>
                    <Tag>{item.source}</Tag>
                    {item.size > 0 && <Tag>{formatBytes(item.size)}</Tag>}
                    {item.is_default && (
                      <Tag color="green">{t("models.localDefaultBadge")}</Tag>
                    )}
                  </Space>
                }
                description={description}
              />
            </List.Item>
          );
        }}
      />
      <Typography.Title level={5} style={{ marginTop: 16 }}>
        {t("models.localRecommended")}
      </Typography.Title>
      <List
        size="small"
        dataSource={probe?.recommended ?? []}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button
                key="install"
                size="small"
                type="primary"
                loading={installing === item.id}
                onClick={() => void install(item.id)}
              >
                {t("models.localInstall")}
              </Button>,
            ]}
          >
            <List.Item.Meta title={item.id} description={item.reason} />
          </List.Item>
        )}
      />
    </Card>
  );
}
