import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import type {
  OrgKnowledgeBase,
  OrgKnowledgeClient,
  OrgKnowledgeDocument,
  OrgKnowledgePreview,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { knowledgeLabels } from "./labels";
import styles from "./KnowledgePage.module.css";

export interface KnowledgePageProps {
  client: OrgKnowledgeClient;
  session: OrgSession;
  locale: OrgLocale;
  canWrite?: boolean;
  onOpenHostKnowledge?: () => void;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgePage({
  client,
  session,
  locale,
  canWrite,
  onOpenHostKnowledge,
}: KnowledgePageProps) {
  const labels = knowledgeLabels(locale);
  const writable = canWrite ?? session.isAdmin;
  const [bases, setBases] = useState<OrgKnowledgeBase[]>([]);
  const [stats, setStats] = useState({
    bases: 0,
    documents: 0,
    shared: 0,
    owned: 0,
  });
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [usable, setUsable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [documents, setDocuments] = useState<OrgKnowledgeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [preview, setPreview] = useState<OrgKnowledgePreview | null>(null);
  const [baseOpen, setBaseOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [baseName, setBaseName] = useState("");
  const [baseDescription, setBaseDescription] = useState("");
  const [baseShared, setBaseShared] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [activeTab, setActiveTab] = useState("bases");

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await client.list();
      setBases(payload.bases);
      setStats(payload.stats);
      setFeatureEnabled(payload.capability.feature_enabled);
      setUsable(payload.capability.usable);
    } catch {
      setBases([]);
      setStats({ bases: 0, documents: 0, shared: 0, owned: 0 });
      setError(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [client, labels.loadFailed]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const loadDocuments = useCallback(
    async (kbId: string) => {
      setDocsLoading(true);
      try {
        const detail = await client.get(kbId);
        setDocuments(detail.documents || []);
      } catch {
        setDocuments([]);
        setError(labels.loadFailed);
      } finally {
        setDocsLoading(false);
      }
    },
    [client, labels.loadFailed],
  );

  useEffect(() => {
    if (!selectedId) {
      setDocuments([]);
      return;
    }
    void loadDocuments(selectedId);
  }, [loadDocuments, selectedId]);

  const query = search.trim().toLowerCase();
  const visibleBases = useMemo(
    () =>
      query
        ? bases.filter((row) => {
            const hay =
              `${row.name} ${row.description} ${row.id}`.toLowerCase();
            return hay.includes(query);
          })
        : bases,
    [bases, query],
  );
  const visibleDocs = useMemo(
    () =>
      query
        ? documents.filter((row) => {
            const hay =
              `${row.filename} ${row.path} ${row.kind} ${row.status}`.toLowerCase();
            return hay.includes(query);
          })
        : documents,
    [documents, query],
  );

  const selected = bases.find((row) => row.id === selectedId) || null;

  const createBase = async () => {
    if (!baseName.trim()) return;
    setBusy("base");
    setError("");
    setNotice("");
    try {
      const created = await client.createBase({
        name: baseName.trim(),
        description: baseDescription.trim(),
        shared: baseShared,
      });
      setNotice(labels.createBaseDone);
      setBaseOpen(false);
      setBaseName("");
      setBaseDescription("");
      setBaseShared(false);
      await fetchList();
      setSelectedId(created.id);
    } catch {
      setError(labels.createBaseFailed);
    } finally {
      setBusy("");
    }
  };

  const createNote = async () => {
    if (!selectedId || !noteTitle.trim()) return;
    setBusy("note");
    setError("");
    setNotice("");
    try {
      await client.createNote(selectedId, {
        title: noteTitle.trim(),
        content: noteContent,
      });
      setNotice(labels.createNoteDone);
      setNoteOpen(false);
      setNoteTitle("");
      setNoteContent("");
      await fetchList();
      await loadDocuments(selectedId);
    } catch {
      setError(labels.createNoteFailed);
    } finally {
      setBusy("");
    }
  };

  const openPreview = async (doc: OrgKnowledgeDocument) => {
    try {
      setPreview(await client.preview(doc.kb_id, doc.id));
    } catch {
      setError(labels.previewFailed);
    }
  };

  const askCreateBase = () => {
    Modal.confirm({
      title: labels.confirmCreateBase,
      okText: labels.createBase,
      okButtonProps: { "data-testid": "org-knowledge-confirm-base" },
      onOk: () => createBase(),
    });
  };

  const askCreateNote = () => {
    Modal.confirm({
      title: labels.confirmCreateNote,
      okText: labels.createNote,
      okButtonProps: { "data-testid": "org-knowledge-confirm-note" },
      onOk: () => createNote(),
    });
  };

  return (
    <div className={styles.page} data-testid="org-ui-knowledge">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <BookOpen size={20} />
          <div>
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
            <p className={styles.subtitle}>{labels.subtitle}</p>
          </div>
        </div>
        <Space wrap>
          {writable ? (
            <Button
              type="primary"
              onClick={() => setBaseOpen(true)}
              data-testid="org-knowledge-create-base"
            >
              {labels.createBase}
            </Button>
          ) : null}
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => void fetchList()}
            data-testid="org-knowledge-refresh"
          >
            {labels.refresh}
          </Button>
        </Space>
      </div>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
      {notice ? (
        <Typography.Text type="success">{notice}</Typography.Text>
      ) : null}
      {!featureEnabled ? (
        <Typography.Text type="warning">{labels.disabled}</Typography.Text>
      ) : null}
      {featureEnabled && !usable ? (
        <Typography.Text type="warning">{labels.notUsable}</Typography.Text>
      ) : null}

      <div className={styles.stats} data-testid="org-knowledge-stats">
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.bases}</div>
          <div className={styles.statLabel}>{labels.bases}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.documents}</div>
          <div className={styles.statLabel}>{labels.documents}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.shared}</div>
          <div className={styles.statLabel}>{labels.shared}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.owned}</div>
          <div className={styles.statLabel}>{labels.owned}</div>
        </div>
      </div>

      {writable ? null : <p className={styles.hint}>{labels.adminOnly}</p>}
      <p className={styles.hint}>{labels.hostHint}</p>
      {onOpenHostKnowledge ? (
        <Button
          onClick={onOpenHostKnowledge}
          data-testid="org-knowledge-open-host"
        >
          {labels.openHost}
        </Button>
      ) : null}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "bases",
            label: labels.basesTab,
            children: (
              <>
                <div className={styles.filters}>
                  <Input
                    prefix={<Search size={14} />}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={labels.search}
                    allowClear
                    data-testid="org-knowledge-search"
                  />
                </div>
                {loading ? (
                  <p className={styles.empty}>{labels.loading}</p>
                ) : visibleBases.length === 0 ? (
                  <div
                    className={styles.empty}
                    data-testid="org-knowledge-empty"
                  >
                    <p>{labels.emptyBases}</p>
                    <p>{labels.emptyBasesHint}</p>
                  </div>
                ) : (
                  <div className={styles.grid} data-testid="org-knowledge-grid">
                    {visibleBases.map((row) => (
                      <div
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        className={`${styles.card} ${
                          selectedId === row.id ? styles.cardSelected : ""
                        }`}
                        onClick={() => {
                          setSelectedId(row.id);
                          setActiveTab("docs");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(row.id);
                            setActiveTab("docs");
                          }
                        }}
                        data-testid={`org-knowledge-card-${row.id}`}
                      >
                        <p className={styles.cardTitle}>{row.name}</p>
                        <p className={styles.cardMeta}>
                          <span className={styles.mono}>{row.id}</span>
                        </p>
                        <p className={styles.cardBody}>
                          {row.description || "—"}
                        </p>
                        <Space size={6} wrap style={{ marginTop: 10 }}>
                          <Tag>
                            {row.document_count} {labels.documents}
                          </Tag>
                          {row.shared ? <Tag>{labels.shared}</Tag> : null}
                          {row.owned ? <Tag>{labels.owned}</Tag> : null}
                        </Space>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ),
          },
          {
            key: "docs",
            label: labels.docsTab,
            children: (
              <>
                <div className={styles.filters}>
                  <Input
                    prefix={<Search size={14} />}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={labels.search}
                    allowClear
                    data-testid="org-knowledge-doc-search"
                  />
                  {writable && selectedId ? (
                    <Button
                      type="primary"
                      onClick={() => setNoteOpen(true)}
                      data-testid="org-knowledge-create-note"
                    >
                      {labels.createNote}
                    </Button>
                  ) : null}
                </div>
                {!selectedId ? (
                  <div
                    className={styles.empty}
                    data-testid="org-knowledge-select-base"
                  >
                    <p>{labels.selectBase}</p>
                  </div>
                ) : docsLoading ? (
                  <p className={styles.empty}>{labels.loading}</p>
                ) : visibleDocs.length === 0 ? (
                  <div
                    className={styles.empty}
                    data-testid="org-knowledge-docs-empty"
                  >
                    <p>{labels.emptyDocs}</p>
                    <p>{labels.emptyDocsHint}</p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <Table
                      rowKey="id"
                      dataSource={visibleDocs}
                      pagination={false}
                      size="small"
                      onRow={(row) => ({
                        onClick: () => void openPreview(row),
                        "data-testid": `org-knowledge-doc-${row.id}`,
                      })}
                      columns={[
                        { title: labels.name, dataIndex: "filename" },
                        {
                          title: labels.kind,
                          dataIndex: "kind",
                          render: (value: string) =>
                            value === "note" ? labels.note : labels.file,
                        },
                        { title: labels.status, dataIndex: "status" },
                        {
                          title: labels.size,
                          dataIndex: "byte_size",
                          render: (value: number) => formatBytes(value),
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
        title={labels.createBase}
        open={baseOpen}
        onCancel={() => setBaseOpen(false)}
        footer={
          <Space>
            <Button
              type="primary"
              loading={busy === "base"}
              onClick={askCreateBase}
              data-testid="org-knowledge-save-base"
            >
              {labels.createBase}
            </Button>
            <Button onClick={() => setBaseOpen(false)}>{labels.close}</Button>
          </Space>
        }
      >
        <div className={styles.row}>
          <span className={styles.muted}>{labels.name}</span>
          <Input
            value={baseName}
            onChange={(event) => setBaseName(event.target.value)}
            data-testid="org-knowledge-base-name"
          />
        </div>
        <div className={styles.row}>
          <span className={styles.muted}>{labels.description}</span>
          <Input.TextArea
            value={baseDescription}
            onChange={(event) => setBaseDescription(event.target.value)}
            rows={3}
            data-testid="org-knowledge-base-description"
          />
        </div>
        <div className={styles.row}>
          <span className={styles.muted}>{labels.share}</span>
          <Switch
            checked={baseShared}
            onChange={setBaseShared}
            data-testid="org-knowledge-base-shared"
          />
        </div>
      </Modal>

      <Modal
        title={labels.createNote}
        open={noteOpen}
        onCancel={() => setNoteOpen(false)}
        footer={
          <Space>
            <Button
              type="primary"
              loading={busy === "note"}
              onClick={askCreateNote}
              data-testid="org-knowledge-save-note"
            >
              {labels.createNote}
            </Button>
            <Button onClick={() => setNoteOpen(false)}>{labels.close}</Button>
          </Space>
        }
      >
        <p className={styles.hint}>{selected?.name}</p>
        <div className={styles.row}>
          <span className={styles.muted}>{labels.noteTitle}</span>
          <Input
            value={noteTitle}
            onChange={(event) => setNoteTitle(event.target.value)}
            data-testid="org-knowledge-note-title"
          />
        </div>
        <div className={styles.row}>
          <span className={styles.muted}>{labels.noteContent}</span>
          <Input.TextArea
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            rows={6}
            data-testid="org-knowledge-note-content"
          />
        </div>
      </Modal>

      <Modal
        title={labels.detail}
        open={preview != null}
        onCancel={() => setPreview(null)}
        footer={
          <Button onClick={() => setPreview(null)}>{labels.close}</Button>
        }
      >
        {preview ? (
          <div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.name}</span>
              <span>{preview.filename}</span>
            </div>
            <pre className={styles.body} data-testid="org-knowledge-preview">
              {preview.text}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
