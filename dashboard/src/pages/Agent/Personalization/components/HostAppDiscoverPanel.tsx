import { useEffect, useMemo, useState } from "react";
import { Button, Empty, List, Space, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";
import {
  hostAppsApi,
  type HostAppItem,
  type HostAppReport,
} from "../../../../api/modules/hostApps";
import { message } from "../../../../utils/antdMessage";

type DiscoverKind = "skill" | "plugin" | "mcp";

interface HostAppDiscoverPanelProps {
  kinds: DiscoverKind[];
}

function itemsFor(host: HostAppReport, kinds: DiscoverKind[]): HostAppItem[] {
  const out: HostAppItem[] = [];
  if (kinds.includes("skill")) out.push(...host.skills);
  if (kinds.includes("plugin")) out.push(...host.plugins);
  if (kinds.includes("mcp")) out.push(...host.mcp);
  return out;
}

export default function HostAppDiscoverPanel({
  kinds,
}: HostAppDiscoverPanelProps) {
  const { t } = useTranslation();
  const [hosts, setHosts] = useState<HostAppReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const next = await hostAppsApi.list();
      setHosts(next.hosts);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("hostApps.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      hosts.filter(
        (host) => host.installed || itemsFor(host, kinds).length > 0,
      ),
    [hosts, kinds],
  );

  const importItem = async (host: HostAppReport, item: HostAppItem) => {
    const kind = (
      item.kind === "mcp" || item.kind === "plugin" || item.kind === "skill"
        ? item.kind
        : kinds[0]
    ) as DiscoverKind;
    const key = `${host.id}:${item.id}`;
    setBusyKey(key);
    try {
      await hostAppsApi.importItem({
        host_id: host.id,
        item_id: item.id,
        kind,
      });
      message.success(t("hostApps.imported"));
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("hostApps.importFailed"),
      );
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Text strong>{t("hostApps.title")}</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
        {t("hostApps.hint")}
      </Typography.Paragraph>
      <List
        loading={loading}
        locale={{
          emptyText: (
            <Empty
              description={t("hostApps.empty")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        dataSource={visible}
        renderItem={(host) => {
          const items = itemsFor(host, kinds);
          return (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <span>{host.label}</span>
                    <Tag color={host.installed ? "green" : "default"}>
                      {host.installed
                        ? t("hostApps.installed")
                        : t("hostApps.missing")}
                    </Tag>
                  </Space>
                }
                description={
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: "100%" }}
                  >
                    {host.notes ? <span>{host.notes}</span> : null}
                    {host.paths_found.length > 0 ? (
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {host.paths_found.join(" · ")}
                      </Typography.Text>
                    ) : null}
                    {items.length === 0 ? (
                      <span>{t("hostApps.noItems")}</span>
                    ) : (
                      items.map((item) => (
                        <Space key={`${host.id}-${item.id}`} wrap>
                          <Tag>{item.kind}</Tag>
                          <span>{item.name}</span>
                          <Button
                            size="small"
                            type="link"
                            loading={busyKey === `${host.id}:${item.id}`}
                            onClick={() => void importItem(host, item)}
                          >
                            {t("hostApps.importAction")}
                          </Button>
                        </Space>
                      ))
                    )}
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}
