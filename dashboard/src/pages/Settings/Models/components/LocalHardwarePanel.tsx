import { useEffect, useState } from "react";
import { Button, Card, List, Space, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";
import {
  localModelsApi,
  type LocalProbe,
} from "../../../../api/modules/localModels";
import { message } from "../../../../utils/antdMessage";

export function LocalHardwarePanel() {
  const { t } = useTranslation();
  const [probe, setProbe] = useState<LocalProbe | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

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
  }, []);

  const install = async (name: string) => {
    setInstalling(name);
    try {
      await localModelsApi.install(name);
      message.success(t("models.localInstallDone", { name }));
      await refresh();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("models.localInstallFailed"),
      );
    } finally {
      setInstalling(null);
    }
  };

  const hw = probe?.hardware;
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
          <Tag color={hw.ollama_reachable ? "green" : "default"}>
            Ollama{" "}
            {hw.ollama_reachable ? t("organization.on") : t("organization.off")}
          </Tag>
        </Space>
      )}
      <Typography.Paragraph type="secondary">
        {t("models.localHardwareHint")}
      </Typography.Paragraph>
      <Typography.Title level={5}>
        {t("models.localInstalled")}
      </Typography.Title>
      <List
        size="small"
        dataSource={probe?.installed ?? []}
        locale={{ emptyText: t("models.localInstalledEmpty") }}
        renderItem={(item) => (
          <List.Item>
            {item.name} <Tag>{item.source}</Tag>
          </List.Item>
        )}
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
                disabled={!hw?.ollama_binary}
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
