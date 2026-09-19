import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Modal, Space, Table, Tabs, Tag, Typography } from "antd";
import { History, RefreshCw, Shield } from "lucide-react";
import type {
  GovernanceAuditEvent,
  GovernancePause,
  OrgGovernanceClient,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { governanceLabels } from "./labels";
import styles from "./GovernancePage.module.css";

export interface GovernancePageProps {
  client: OrgGovernanceClient;
  session: OrgSession;
  locale: OrgLocale;
  formatDateTime?: (iso: string) => string;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

function toIso(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "";
  const millis = ts > 1e12 ? ts : ts * 1000;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function defaultFormat(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function statusColor(status: string): string {
  if (status === "pending") return "gold";
  if (status === "approved" || status === "allow") return "green";
  if (status === "rejected" || status === "deny") return "red";
  if (status === "expired") return "default";
  return "blue";
}

export function GovernancePage({
  client,
  session,
  locale,
  formatDateTime,
}: GovernancePageProps) {
  const labels = governanceLabels(locale);
  const format = formatDateTime ?? defaultFormat;
  const [pauses, setPauses] = useState<GovernancePause[]>([]);
  const [events, setEvents] = useState<GovernanceAuditEvent[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState<string>("");
  const [detail, setDetail] = useState<GovernanceAuditEvent | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pausePayload, auditPayload] = await Promise.all([
        client.pauses(),
        client.audit(80),
      ]);
      setPauses(pausePayload.pauses);
      setEnabled(
        typeof pausePayload.enabled === "boolean" ? pausePayload.enabled : null,
      );
      setEvents(auditPayload.events.slice().reverse());
    } catch {
      setPauses([]);
      setEvents([]);
      setError(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [client, labels.loadFailed]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const pending = useMemo(
    () => pauses.filter((row) => row.status === "pending"),
    [pauses],
  );
  const allowed = events.filter((row) => row.result === "allow").length;
  const denied = events.filter((row) => row.result === "deny").length;

  const resolve = async (pauseId: string, approve: boolean) => {
    setResolving(pauseId);
    setError("");
    try {
      await client.resolve(pauseId, approve);
      await fetchAll();
    } catch {
      setError(labels.resolveFailed);
    } finally {
      setResolving("");
    }
  };

  const askResolve = (pause: GovernancePause, approve: boolean) => {
    Modal.confirm({
      title: approve ? labels.confirmApprove : labels.confirmReject,
      okText: approve ? labels.approve : labels.reject,
      okButtonProps: {
        danger: !approve,
        "data-testid": approve
          ? `org-gov-confirm-approve-${pause.pause_id}`
          : `org-gov-confirm-reject-${pause.pause_id}`,
      },
      onOk: () => resolve(pause.pause_id, approve),
    });
  };

  return (
    <div className={styles.page} data-testid="org-ui-governance">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Shield size={20} />
          <div>
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
            <p className={styles.subtitle}>{labels.subtitle}</p>
          </div>
        </div>
        <Space>
          {enabled === true ? (
            <Tag color="green" data-testid="org-gov-enabled">
              {labels.enabled}
            </Tag>
          ) : enabled === false ? (
            <Tag data-testid="org-gov-disabled">{labels.disabled}</Tag>
          ) : null}
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => void fetchAll()}
            data-testid="org-gov-refresh"
          >
            {labels.refresh}
          </Button>
        </Space>
      </div>

      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}

      <div className={styles.stats} data-testid="org-gov-stats">
        <div className={styles.stat}>
          <div className={styles.statValue}>{pending.length}</div>
          <div className={styles.statLabel}>{labels.pendingCount}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{allowed}</div>
          <div className={styles.statLabel}>{labels.allowed}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{denied}</div>
          <div className={styles.statLabel}>{labels.denied}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{events.length}</div>
          <div className={styles.statLabel}>{labels.totalEvents}</div>
        </div>
      </div>

      <p className={styles.hint}>
        {enabled ? labels.enabledHint : labels.disabledHint}
      </p>
      {session.isAdmin ? null : (
        <p className={styles.hint}>{labels.adminOnly}</p>
      )}

      <Tabs
        defaultActiveKey="pending"
        items={[
          {
            key: "overview",
            label: labels.overview,
            children: (
              <div>
                {loading ? (
                  <p className={styles.empty}>{labels.loading}</p>
                ) : (
                  <p className={styles.hint}>{labels.enabledHint}</p>
                )}
              </div>
            ),
          },
          {
            key: "pending",
            label: `${labels.pending} (${pending.length})`,
            children: loading ? (
              <p className={styles.empty}>{labels.loading}</p>
            ) : pending.length === 0 ? (
              <div className={styles.empty} data-testid="org-gov-pending-empty">
                <p>{labels.emptyPending}</p>
                <p>{labels.emptyPendingHint}</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <Table
                  rowKey="pause_id"
                  dataSource={pending}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: labels.time,
                      dataIndex: "created_at",
                      render: (value: number) => format(toIso(value)),
                    },
                    { title: labels.tool, dataIndex: "tool_name" },
                    {
                      title: labels.category,
                      dataIndex: "category",
                      render: (value: string) => <Tag>{value || "—"}</Tag>,
                    },
                    {
                      title: labels.actor,
                      dataIndex: "actor_id",
                      render: (value: string) => value || labels.noActor,
                    },
                    {
                      title: labels.reason,
                      dataIndex: "reason",
                      render: (value: string) => (
                        <span className={styles.reason} title={value}>
                          {value}
                        </span>
                      ),
                    },
                    {
                      title: labels.pauseId,
                      dataIndex: "pause_id",
                      render: (value: string) => (
                        <span className={styles.mono}>{value}</span>
                      ),
                    },
                    {
                      title: labels.actions,
                      key: "actions",
                      render: (_: unknown, row: GovernancePause) =>
                        session.isAdmin ? (
                          <Space>
                            <Button
                              type="primary"
                              size="small"
                              loading={resolving === row.pause_id}
                              onClick={() => askResolve(row, true)}
                              data-testid={`org-gov-approve-${row.pause_id}`}
                            >
                              {labels.approve}
                            </Button>
                            <Button
                              danger
                              size="small"
                              loading={resolving === row.pause_id}
                              onClick={() => askResolve(row, false)}
                              data-testid={`org-gov-reject-${row.pause_id}`}
                            >
                              {labels.reject}
                            </Button>
                          </Space>
                        ) : null,
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: "audit",
            label: labels.audit,
            children: loading ? (
              <p className={styles.empty}>{labels.loading}</p>
            ) : events.length === 0 ? (
              <div className={styles.empty} data-testid="org-gov-audit-empty">
                <History size={28} />
                <p>{labels.emptyAudit}</p>
                <p>{labels.emptyAuditHint}</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <Table
                  rowKey={(row, index) =>
                    String(row.audit_id || `${row.ts || "evt"}-${index}`)
                  }
                  dataSource={events}
                  pagination={{ pageSize: 20 }}
                  size="small"
                  columns={[
                    {
                      title: labels.time,
                      dataIndex: "ts",
                      render: (value: number) => format(toIso(value)),
                    },
                    {
                      title: labels.event,
                      dataIndex: "event",
                      render: (value: string) => value || "—",
                    },
                    {
                      title: labels.tool,
                      dataIndex: "tool_name",
                      render: (value: string) => value || "—",
                    },
                    {
                      title: labels.result,
                      dataIndex: "result",
                      render: (value: string) =>
                        value ? (
                          <Tag color={statusColor(value)}>{value}</Tag>
                        ) : (
                          "—"
                        ),
                    },
                    {
                      title: labels.reason,
                      dataIndex: "reason",
                      render: (value: string) => (
                        <span className={styles.reason} title={value}>
                          {value || "—"}
                        </span>
                      ),
                    },
                    {
                      title: labels.actions,
                      key: "detail",
                      render: (_: unknown, row: GovernanceAuditEvent) => (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setDetail(row)}
                          data-testid={`org-gov-audit-detail-${
                            row.audit_id || row.pause_id || "row"
                          }`}
                        >
                          {labels.detail}
                        </Button>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={labels.detail}
        open={detail != null}
        onCancel={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>{labels.close}</Button>}
      >
        {detail ? (
          <div className={styles.detailGrid}>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.event}</span>
              <span>{String(detail.event || "—")}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.tool}</span>
              <span>{String(detail.tool_name || "—")}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.category}</span>
              <span>{String(detail.category || "—")}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.actor}</span>
              <span>{String(detail.actor_id || labels.noActor)}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.result}</span>
              <span>{String(detail.result || "—")}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.pauseId}</span>
              <span className={styles.mono}>
                {String(detail.pause_id || "—")}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.ruleSource}</span>
              <span>{String(detail.rule_source || "—")}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.muted}>{labels.digest}</span>
              <span className={styles.mono}>
                {String(detail.args_digest || "—")}
              </span>
            </div>
            <p className={styles.body}>{String(detail.reason || "")}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
