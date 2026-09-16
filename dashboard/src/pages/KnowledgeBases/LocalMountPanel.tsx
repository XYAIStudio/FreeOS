import { useEffect, useState } from "react";
import { Button, Input, List, Space, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { knowledgeBasesApi } from "../../api/modules/knowledgeBases";
import { message } from "../../utils/antdMessage";

interface LocalMountPanelProps {
  kbId: string;
}

export function LocalMountPanel({ kbId }: LocalMountPanelProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");
  const [entries, setEntries] = useState<
    Array<{ path: string; name: string; is_dir: boolean; size: number }>
  >([]);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const next = await knowledgeBasesApi.getMount(kbId);
    setMounted(next.mounted);
    setSource(next.source_path || "");
    setDest(next.distill_path || "");
    setEntries(next.entries || []);
  };

  useEffect(() => {
    void load().catch(() => undefined);
  }, [kbId]);

  const mount = async () => {
    if (!source.trim()) {
      message.error(t("knowledgeBases.mountSourceRequired"));
      return;
    }
    setBusy(true);
    try {
      await knowledgeBasesApi.setMount(kbId, source.trim(), dest.trim());
      message.success(t("knowledgeBases.mountSaved"));
      await load();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("knowledgeBases.mountFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const distill = async () => {
    const folder = window.prompt(t("knowledgeBases.distillDest"));
    if (!folder) return;
    setBusy(true);
    try {
      const result = await knowledgeBasesApi.distillMount(kbId, folder);
      message.success(
        t("knowledgeBases.distillDone", {
          count: result.copied,
          path: result.distill_path,
        }),
      );
      await load();
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
      <Typography.Text strong>{t("knowledgeBases.mountTitle")}</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
        {t("knowledgeBases.mountHint")}
      </Typography.Paragraph>
      <Space wrap>
        <Input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder={t("knowledgeBases.mountSource")}
          style={{ minWidth: 280 }}
        />
        <Button type="primary" loading={busy} onClick={() => void mount()}>
          {t("knowledgeBases.mountAction")}
        </Button>
        {mounted && (
          <Button loading={busy} onClick={() => void distill()}>
            {t("knowledgeBases.distillAction")}
          </Button>
        )}
      </Space>
      {mounted && (
        <List
          size="small"
          style={{ marginTop: 12 }}
          dataSource={entries.slice(0, 20)}
          renderItem={(item) => (
            <List.Item>
              {item.name}{" "}
              <Tag>
                {item.is_dir
                  ? t("knowledgeBases.mountDir")
                  : t("knowledgeBases.mountFile")}
              </Tag>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
