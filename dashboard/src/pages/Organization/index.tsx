import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { Building2, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import PageShell from "../../layouts/PageShell";
import {
  orgModuleApi,
  type OrgCapability,
  type OrgModuleStatus,
} from "../../api/modules/orgModule";
import { message } from "../../utils/antdMessage";

const { Paragraph, Text } = Typography;

export default function OrganizationPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.toLowerCase().startsWith("zh") ?? false;
  const [status, setStatus] = useState<OrgModuleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await orgModuleApi.status());
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("organization.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      setStatus(await orgModuleApi.setEnabled(enabled));
      message.success(
        enabled ? t("organization.enabled") : t("organization.disabled"),
      );
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("organization.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const catalog: OrgCapability[] = status?.catalog ?? [];
  const sidecarUp = Boolean(status?.sidecar.reachable);
  const embedUrl = status?.enabled && sidecarUp ? status.embed_url : "";
  const showEmbed = Boolean(embedUrl);

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
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card loading={loading}>
          <Space align="start" size={16} style={{ width: "100%" }}>
            <Building2 size={28} strokeWidth={1.6} />
            <div style={{ flex: 1 }}>
              <Space size={12} wrap>
                <Text strong>{t("organization.toggleLabel")}</Text>
                <Switch
                  checked={Boolean(status?.enabled)}
                  loading={saving}
                  onChange={(checked) => void toggle(checked)}
                />
                <Tag color={status?.enabled ? "green" : "default"}>
                  {status?.enabled
                    ? t("organization.on")
                    : t("organization.off")}
                </Tag>
                <Tag color={sidecarUp ? "green" : "orange"}>
                  {sidecarUp
                    ? t("organization.sidecarUp")
                    : t("organization.sidecarDown")}
                </Tag>
              </Space>
              <Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
                {t("organization.bridgeHint")}
              </Paragraph>
              {status && (
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {t("organization.home")}: <Text code>{status.home}</Text>
                  <br />
                  {t("organization.sidecar")}:{" "}
                  <Text code>{status.sidecar.url}</Text>
                </Paragraph>
              )}
            </div>
          </Space>
        </Card>

        {status?.enabled && !sidecarUp && (
          <Alert
            type="warning"
            showIcon
            message={t("organization.startSidecarTitle")}
            description={
              <span>
                {t("organization.startSidecarBody")}{" "}
                <Text code>{status.start_command}</Text>
              </span>
            }
          />
        )}

        {status?.notes?.length ? (
          <Alert
            type="info"
            showIcon
            message={t("organization.notesTitle")}
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {status.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            }
          />
        ) : null}

        <Card title={t("organization.catalogTitle")}>
          <Table<OrgCapability>
            rowKey="key"
            size="small"
            pagination={false}
            dataSource={catalog}
            columns={[
              {
                title: t("organization.colKey"),
                dataIndex: "key",
                width: 140,
                render: (key: string) => <Text code>{key}</Text>,
              },
              {
                title: t("organization.colName"),
                render: (_, row) => (isZh ? row.label_zh : row.label),
              },
              {
                title: t("organization.colDesc"),
                render: (_, row) =>
                  isZh ? row.description_zh : row.description,
              },
              {
                title: t("organization.colLock"),
                dataIndex: "locked",
                width: 100,
                render: (locked: boolean) =>
                  locked ? (
                    <Tag>{t("organization.locked")}</Tag>
                  ) : (
                    <Tag color="blue">{t("organization.optional")}</Tag>
                  ),
              },
            ]}
          />
        </Card>

        {showEmbed && (
          <Card
            title={t("organization.embedTitle")}
            extra={
              <Button
                type="link"
                href={embedUrl}
                target="_blank"
                rel="noreferrer"
                icon={<ExternalLink size={14} />}
              >
                {t("organization.openSidecar")}
              </Button>
            }
          >
            <iframe
              title={t("organization.embedTitle")}
              src={embedUrl}
              style={{
                width: "100%",
                minHeight: 640,
                border: "1px solid var(--fn-border-primary, #e5e7eb)",
                borderRadius: 8,
                background: "#fff",
              }}
            />
          </Card>
        )}
      </Space>
    </PageShell>
  );
}
