import { useEffect, useState } from "react";
import { Button, Input, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { knowledgeBasesApi } from "../../api/modules/knowledgeBases";
import { message } from "../../utils/antdMessage";

interface CloudMountPanelProps {
  kbId: string;
}

export function CloudMountPanel({ kbId }: CloudMountPanelProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState("ima");
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const next = await knowledgeBasesApi.getMount(kbId);
    if (next.kind === "cloud") {
      setMounted(next.mounted);
      setUrl(next.cloud_url || "");
      setProvider(next.cloud_provider || "ima");
    }
  };

  useEffect(() => {
    void load().catch(() => undefined);
  }, [kbId]);

  const mount = async () => {
    if (!url.trim()) {
      message.error(t("knowledgeBases.cloudUrlRequired"));
      return;
    }
    setBusy(true);
    try {
      await knowledgeBasesApi.setMount(kbId, "", "", {
        kind: "cloud",
        cloud_url: url.trim(),
        cloud_provider: provider.trim() || "ima",
      });
      message.success(t("knowledgeBases.cloudMountSaved"));
      await load();
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
    const folder = window.prompt(t("knowledgeBases.cloudDistillDest"));
    if (!folder) return;
    setBusy(true);
    try {
      const result = await knowledgeBasesApi.distillMount(kbId, folder);
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

  return (
    <div style={{ margin: "12px 0 16px" }}>
      <Typography.Text strong>
        {t("knowledgeBases.cloudMountTitle")}
      </Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
        {t("knowledgeBases.cloudMountHint")}
      </Typography.Paragraph>
      <Space wrap>
        <Input
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          placeholder={t("knowledgeBases.cloudProvider")}
          style={{ width: 120 }}
        />
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("knowledgeBases.cloudUrl")}
          style={{ minWidth: 280 }}
        />
        <Button type="primary" loading={busy} onClick={() => void mount()}>
          {t("knowledgeBases.cloudMountAction")}
        </Button>
        {mounted && (
          <Button loading={busy} onClick={() => void distill()}>
            {t("knowledgeBases.cloudAttachAction")}
          </Button>
        )}
      </Space>
    </div>
  );
}
