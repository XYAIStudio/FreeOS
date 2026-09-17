import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Typography,
} from "antd";
import { ExternalLink, Folder, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  knowledgeBasesApi,
  type ImaConnectorSummary,
  type ImaKnowledgeBase,
  type ImaKnowledgeDoc,
  type ImaKnowledgeFolder,
  type ImaSelectedBase,
  type ImaSelectedDoc,
} from "../../api/modules/knowledgeBases";
import { message } from "../../utils/antdMessage";
import {
  canPickKnowledgeFolder,
  pickKnowledgeFolder,
} from "./pickKnowledgeFolder";
import styles from "./CloudMountPanel.module.less";

const IMA_AUTH_URL = "https://ima.qq.com/agent-interface";

interface CloudMountPanelProps {
  kbId?: string;
  ensureKb?: () => Promise<string>;
  onMounted?: () => void;
  prominent?: boolean;
}

export function CloudMountPanel({
  kbId,
  ensureKb,
  onMounted,
  prominent = false,
}: CloudMountPanelProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(true);
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [clientPreview, setClientPreview] = useState("");
  const [instances, setInstances] = useState<ImaConnectorSummary[]>([]);
  const [bases, setBases] = useState<ImaKnowledgeBase[]>([]);
  const [basesEnd, setBasesEnd] = useState(true);
  const [basesCursor, setBasesCursor] = useState("");
  const [baseQuery, setBaseQuery] = useState("");
  const [basesError, setBasesError] = useState("");
  const [activeKbId, setActiveKbId] = useState("");
  const [docs, setDocs] = useState<ImaKnowledgeDoc[]>([]);
  const [folders, setFolders] = useState<ImaKnowledgeFolder[]>([]);
  const [folderPath, setFolderPath] = useState<ImaKnowledgeFolder[]>([]);
  const [docsError, setDocsError] = useState("");
  const [docQuery, setDocQuery] = useState("");
  const [docsCursor, setDocsCursor] = useState("");
  const [docsEnd, setDocsEnd] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [selectedBases, setSelectedBases] = useState<ImaSelectedBase[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<ImaSelectedDoc[]>([]);
  const canPick = canPickKnowledgeFolder();

  const selectedBaseIds = useMemo(
    () => new Set(selectedBases.map((item) => item.id)),
    [selectedBases],
  );
  const selectedDocKeys = useMemo(
    () =>
      new Set(
        selectedDocs.map(
          (item) => `${item.knowledge_base_id}:${item.media_id}`,
        ),
      ),
    [selectedDocs],
  );

  const applyStatus = (status: {
    connected: boolean;
    instance_id: string;
    client_id_preview: string;
    instances: ImaConnectorSummary[];
  }) => {
    setInstances(status.instances || []);
    setInstanceId(status.instance_id || "");
    setClientPreview(status.client_id_preview || "");
    setShowAuthForm(!status.connected);
  };

  const loadBases = useCallback(
    async (id: string, query = "", cursor = "", append = false) => {
      setBasesError("");
      const result = await knowledgeBasesApi.imaListBases({
        query,
        cursor,
        instance_id: id,
      });
      setBases((prev) => (append ? [...prev, ...result.items] : result.items));
      setBasesCursor(result.next_cursor || "");
      setBasesEnd(result.is_end);
      if (!append && result.items.length > 0) {
        setActiveKbId((current) => current || result.items[0].id);
      }
      if (!append && result.items.length === 0) {
        setActiveKbId("");
        setDocs([]);
        setFolders([]);
        setActiveFolderId("");
        setDocQuery("");
      }
    },
    [],
  );

  const loadDocs = useCallback(
    async (
      id: string,
      imaKbId: string,
      folderId = "",
      query = "",
      cursor = "",
      append = false,
    ) => {
      setDocsError("");
      try {
        const result = await knowledgeBasesApi.imaListDocuments(imaKbId, {
          folder_id: query ? "" : folderId,
          query,
          cursor,
          instance_id: id,
        });
        setDocs((prev) =>
          append ? [...prev, ...result.items] : result.items || [],
        );
        setFolders((prev) =>
          append ? [...prev, ...(result.folders || [])] : result.folders || [],
        );
        if (!append) {
          setFolderPath(result.current_path || []);
          setActiveFolderId(query ? "" : folderId);
        }
        setDocsCursor(result.next_cursor || "");
        setDocsEnd(result.is_end);
      } catch (err) {
        if (!append) {
          setDocs([]);
          setFolders([]);
        }
        setDocsError(
          err instanceof Error
            ? err.message
            : t("knowledgeBases.imaLoadDocsFailed"),
        );
      }
    },
    [t],
  );

  const browseDocs = useCallback(
    (id: string, imaKbId: string, folderId = "", query = "") => {
      setDocQuery(query);
      setActiveFolderId(query ? "" : folderId);
      void loadDocs(id, imaKbId, folderId, query);
    },
    [loadDocs],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [status, mount] = await Promise.all([
          knowledgeBasesApi.imaStatus(),
          kbId
            ? knowledgeBasesApi.getMount(kbId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        let nextInstance = status.instance_id;
        applyStatus(status);
        if (mount?.kind === "cloud") {
          setMounted(mount.mounted);
          if (mount.connector_instance_id) {
            nextInstance = mount.connector_instance_id;
            setInstanceId(mount.connector_instance_id);
          }
          setSelectedBases(mount.selected_bases || []);
          setSelectedDocs(mount.selected_docs || []);
          if (mount.selected_bases?.[0]?.id) {
            setActiveKbId(mount.selected_bases[0].id);
          }
        }
        if (nextInstance) {
          setShowAuthForm(false);
          try {
            await loadBases(nextInstance);
          } catch (err) {
            if (cancelled) return;
            setBasesError(
              err instanceof Error
                ? err.message
                : t("knowledgeBases.imaLoadBasesFailed"),
            );
          }
        }
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kbId, loadBases]);

  useEffect(() => {
    if (!instanceId || !activeKbId || showAuthForm) return;
    setDocQuery("");
    setActiveFolderId("");
    void loadDocs(instanceId, activeKbId);
    // loadDocs is stable enough for mount/selection; omit it so i18n `t`
    // identity changes do not retrigger listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, activeKbId, showAuthForm]);

  const resolveKb = async () => {
    if (kbId) return kbId;
    if (!ensureKb) {
      throw new Error(t("knowledgeBases.cloudMountFailed"));
    }
    return ensureKb();
  };

  const connect = async () => {
    const freshId = clientId.trim();
    const freshKey = apiKey.trim();
    if (!instanceId && !freshId) {
      message.error(t("knowledgeBases.imaClientIdRequired"));
      return;
    }
    if (freshId && !freshKey) {
      message.error(t("knowledgeBases.imaApiKeyRequired"));
      return;
    }
    setBusy(true);
    try {
      const status = await knowledgeBasesApi.imaConnect({
        client_id: freshId || undefined,
        api_key: freshKey || undefined,
        instance_id: instanceId || undefined,
      });
      applyStatus(status);
      setApiKey("");
      await loadBases(status.instance_id, baseQuery);
      message.success(
        t("knowledgeBases.imaConnected", { preview: status.client_id_preview }),
      );
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("knowledgeBases.cloudMountFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleBase = (base: ImaKnowledgeBase, checked: boolean) => {
    setSelectedBases((prev) => {
      if (checked) {
        if (prev.some((item) => item.id === base.id)) return prev;
        return [...prev, { id: base.id, name: base.name }];
      }
      return prev.filter((item) => item.id !== base.id);
    });
    if (!checked) {
      setSelectedDocs((prev) =>
        prev.filter((item) => item.knowledge_base_id !== base.id),
      );
    } else {
      setActiveKbId(base.id);
    }
  };

  const toggleDoc = (doc: ImaKnowledgeDoc, checked: boolean) => {
    if (!activeKbId) return;
    const baseName =
      selectedBases.find((item) => item.id === activeKbId)?.name ||
      bases.find((item) => item.id === activeKbId)?.name ||
      activeKbId;
    if (checked && !selectedBaseIds.has(activeKbId)) {
      setSelectedBases((prev) => [...prev, { id: activeKbId, name: baseName }]);
    }
    setSelectedDocs((prev) => {
      const key = `${activeKbId}:${doc.media_id}`;
      if (checked) {
        if (
          prev.some(
            (item) => `${item.knowledge_base_id}:${item.media_id}` === key,
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            knowledge_base_id: activeKbId,
            knowledge_base_name: baseName,
            media_id: doc.media_id,
            title: doc.title,
          },
        ];
      }
      return prev.filter(
        (item) => `${item.knowledge_base_id}:${item.media_id}` !== key,
      );
    });
  };

  const selectAllDocs = () => {
    for (const doc of docs) {
      toggleDoc(doc, true);
    }
  };

  const clearActiveDocs = () => {
    setSelectedDocs((prev) =>
      prev.filter((item) => item.knowledge_base_id !== activeKbId),
    );
  };

  const mount = async () => {
    if (selectedBases.length === 0 && selectedDocs.length === 0) {
      message.error(t("knowledgeBases.imaSelectionRequired"));
      return;
    }
    if (!instanceId) {
      message.error(t("knowledgeBases.imaClientIdRequired"));
      return;
    }
    setBusy(true);
    try {
      const id = await resolveKb();
      await knowledgeBasesApi.setMount(id, "", "", {
        kind: "cloud",
        cloud_provider: "ima",
        cloud_url: IMA_AUTH_URL,
        connector_instance_id: instanceId,
        selected_bases: selectedBases,
        selected_docs: selectedDocs,
      });
      message.success(t("knowledgeBases.cloudMountSaved"));
      setMounted(true);
      onMounted?.();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("knowledgeBases.cloudMountFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const distill = async () => {
    let folder = await pickKnowledgeFolder();
    if (!folder && !canPick) {
      folder = window.prompt(t("knowledgeBases.cloudDistillDest")) || "";
    }
    if (!folder) return;
    setBusy(true);
    try {
      const id = await resolveKb();
      const result = await knowledgeBasesApi.distillMount(id, folder);
      message.success(
        t("knowledgeBases.cloudDistillDone", { path: result.distill_path }),
      );
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("knowledgeBases.distillFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const activeBaseName =
    bases.find((item) => item.id === activeKbId)?.name ||
    selectedBases.find((item) => item.id === activeKbId)?.name ||
    "";
  const activeHasDocs = selectedDocs.some(
    (item) => item.knowledge_base_id === activeKbId,
  );

  return (
    <div
      className={styles.panel}
      style={prominent ? undefined : { margin: "12px 0 16px" }}
    >
      <Typography.Text strong>
        {t("knowledgeBases.cloudMountTitle")}
      </Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
        {t("knowledgeBases.cloudMountHint")}
      </Typography.Paragraph>

      {showAuthForm ? (
        <div className={styles.authBox}>
          <Typography.Text>{t("knowledgeBases.imaAuthTitle")}</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {t("knowledgeBases.imaAuthHint")}
          </Typography.Paragraph>
          <a href={IMA_AUTH_URL} target="_blank" rel="noreferrer">
            {t("knowledgeBases.imaAuthLink")} <ExternalLink size={12} />
          </a>
          {instances.length > 0 ? (
            <Select
              style={{ width: "100%", marginTop: 12 }}
              placeholder={t("knowledgeBases.imaExistingPlaceholder")}
              value={instanceId || undefined}
              onChange={(value) => setInstanceId(value)}
              options={instances.map((item) => ({
                value: item.instance_id,
                label: item.display_name || item.client_id_preview,
              }))}
              allowClear
            />
          ) : null}
          <Input
            style={{ marginTop: 8 }}
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder={t("knowledgeBases.imaClientId")}
            autoComplete="off"
          />
          <Input.Password
            style={{ marginTop: 8 }}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={t("knowledgeBases.imaApiKey")}
          />
          <Button
            type="primary"
            loading={busy}
            style={{ marginTop: 12 }}
            onClick={() => void connect()}
          >
            {instanceId && !clientId
              ? t("knowledgeBases.imaReconnectAction")
              : t("knowledgeBases.imaConnectAction")}
          </Button>
        </div>
      ) : (
        <Space wrap style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">
            {t("knowledgeBases.imaConnected", {
              preview: clientPreview || instanceId,
            })}
          </Typography.Text>
          <Button
            type="link"
            size="small"
            onClick={() => setShowAuthForm(true)}
          >
            {t("knowledgeBases.imaChangeCredentials")}
          </Button>
        </Space>
      )}

      {!showAuthForm && instanceId ? (
        <>
          <div className={styles.toolbar}>
            <Input.Search
              allowClear
              placeholder={t("knowledgeBases.imaSearchBases")}
              value={baseQuery}
              onChange={(event) => setBaseQuery(event.target.value)}
              onSearch={(value) => {
                void loadBases(instanceId, value).catch((err: unknown) => {
                  setBasesError(
                    err instanceof Error
                      ? err.message
                      : t("knowledgeBases.imaLoadBasesFailed"),
                  );
                });
              }}
            />
            <Button
              icon={<RefreshCw size={14} />}
              loading={busy}
              onClick={() =>
                void loadBases(instanceId, baseQuery).catch((err: unknown) => {
                  setBasesError(
                    err instanceof Error
                      ? err.message
                      : t("knowledgeBases.imaLoadBasesFailed"),
                  );
                })
              }
            >
              {t("knowledgeBases.imaRefresh")}
            </Button>
          </div>
          {basesError ? (
            <Alert type="error" showIcon message={basesError} />
          ) : null}
          <Typography.Text type="secondary">
            {t("knowledgeBases.imaSelectBases")}
          </Typography.Text>
          {bases.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("knowledgeBases.imaBasesEmpty")}
            />
          ) : (
            <div className={styles.baseList}>
              {bases.map((base) => (
                <label
                  key={base.id}
                  className={`${styles.baseRow}${
                    activeKbId === base.id ? ` ${styles.baseRowActive}` : ""
                  }`}
                >
                  <Checkbox
                    checked={selectedBaseIds.has(base.id)}
                    onChange={(event) => toggleBase(base, event.target.checked)}
                    onClick={() => setActiveKbId(base.id)}
                  >
                    {base.name}
                  </Checkbox>
                </label>
              ))}
              {!basesEnd ? (
                <Button
                  size="small"
                  onClick={() =>
                    void loadBases(instanceId, baseQuery, basesCursor, true)
                  }
                >
                  {t("knowledgeBases.imaLoadMore")}
                </Button>
              ) : null}
            </div>
          )}

          {activeKbId ? (
            <div className={styles.docBox}>
              <div className={styles.toolbar}>
                <Typography.Text>
                  {t("knowledgeBases.imaSelectDocs")}
                  {activeBaseName ? ` · ${activeBaseName}` : ""}
                </Typography.Text>
                <Space size={4}>
                  <Button size="small" onClick={selectAllDocs}>
                    {t("knowledgeBases.imaSelectAllDocs")}
                  </Button>
                  <Button size="small" onClick={clearActiveDocs}>
                    {t("knowledgeBases.imaClearDocs")}
                  </Button>
                </Space>
              </div>
              <Input.Search
                allowClear
                placeholder={t("knowledgeBases.imaSearchDocs")}
                value={docQuery}
                onChange={(event) => setDocQuery(event.target.value)}
                onSearch={(value) => {
                  browseDocs(instanceId, activeKbId, "", value);
                }}
              />
              {!docQuery ? (
                <div className={styles.crumbs}>
                  <button
                    type="button"
                    onClick={() => browseDocs(instanceId, activeKbId, "")}
                  >
                    {t("knowledgeBases.imaRootFolder")}
                  </button>
                  {folderPath.map((folder) => (
                    <button
                      key={folder.folder_id}
                      type="button"
                      onClick={() =>
                        browseDocs(instanceId, activeKbId, folder.folder_id)
                      }
                    >
                      / {folder.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {docsError ? (
                <Alert type="error" showIcon message={docsError} />
              ) : null}
              {folders.map((folder) => (
                <button
                  key={folder.folder_id}
                  type="button"
                  className={styles.folderRow}
                  onClick={() =>
                    browseDocs(instanceId, activeKbId, folder.folder_id)
                  }
                >
                  <Folder size={14} />
                  {folder.name}
                  <Typography.Text type="secondary">
                    {t("knowledgeBases.imaFolder")}
                  </Typography.Text>
                </button>
              ))}
              {docs.length === 0 && folders.length === 0 && !docsError ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    docQuery
                      ? t("knowledgeBases.imaDocsSearchEmpty")
                      : t("knowledgeBases.imaDocsEmpty")
                  }
                />
              ) : (
                docs.map((doc) => (
                  <label key={doc.media_id} className={styles.docRow}>
                    <Checkbox
                      checked={selectedDocKeys.has(
                        `${activeKbId}:${doc.media_id}`,
                      )}
                      onChange={(event) => toggleDoc(doc, event.target.checked)}
                    >
                      {doc.title}
                    </Checkbox>
                  </label>
                ))
              )}
              {!docsEnd ? (
                <Button
                  size="small"
                  onClick={() =>
                    void loadDocs(
                      instanceId,
                      activeKbId,
                      activeFolderId,
                      docQuery,
                      docsCursor,
                      true,
                    )
                  }
                >
                  {t("knowledgeBases.imaLoadMore")}
                </Button>
              ) : null}
              {selectedBaseIds.has(activeKbId) && !activeHasDocs ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                  {t("knowledgeBases.imaWholeBaseHint")}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}

          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            {t("knowledgeBases.imaSelectionSummary", {
              bases: selectedBases.length,
              docs: selectedDocs.length,
            })}
          </Typography.Paragraph>
          <Space wrap>
            <Button type="primary" loading={busy} onClick={() => void mount()}>
              {t("knowledgeBases.cloudMountAction")}
            </Button>
            {mounted ? (
              <Button loading={busy} onClick={() => void distill()}>
                {t("knowledgeBases.cloudAttachAction")}
              </Button>
            ) : null}
          </Space>
        </>
      ) : null}
    </div>
  );
}
