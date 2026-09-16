import { useEffect, useState } from "react";
import { Button, Input, List, Space, Tag, Typography } from "antd";
import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { knowledgeBasesApi } from "../../api/modules/knowledgeBases";
import { message } from "../../utils/antdMessage";
import {
  canPickKnowledgeFolder,
  pickKnowledgeFolder,
} from "./pickKnowledgeFolder";

interface LocalMountPanelProps {
  kbId?: string;
  ensureKb?: () => Promise<string>;
  onMounted?: () => void;
  prominent?: boolean;
}

export function LocalMountPanel({
  kbId,
  ensureKb,
  onMounted,
  prominent = false,
}: LocalMountPanelProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState("");
  const [entries, setEntries] = useState<
    Array<{ path: string; name: string; is_dir: boolean; size: number }>
  >([]);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const canPick = canPickKnowledgeFolder();

  const load = async (id: string) => {
    const next = await knowledgeBasesApi.getMount(id);
    setMounted(next.mounted);
    setSource(next.source_path || "");
    setEntries(next.entries || []);
  };

  useEffect(() => {
    if (!kbId) return;
    void load(kbId).catch(() => undefined);
  }, [kbId]);

  const resolveKb = async () => {
    if (kbId) return kbId;
    if (!ensureKb) {
      throw new Error(t("knowledgeBases.mountFailed"));
    }
    return ensureKb();
  };

  const pickSource = async () => {
    const path = await pickKnowledgeFolder();
    if (path) {
      setSource(path);
      return;
    }
    if (!canPick) {
      message.info(t("knowledgeBases.pickFolderUnavailable"));
    }
  };

  const mount = async () => {
    if (!source.trim()) {
      message.error(t("knowledgeBases.mountSourceRequired"));
      return;
    }
    setBusy(true);
    try {
      const id = await resolveKb();
      await knowledgeBasesApi.setMount(id, source.trim());
      message.success(t("knowledgeBases.mountSaved"));
      await load(id);
      onMounted?.();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("knowledgeBases.mountFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const distill = async () => {
    let folder = await pickKnowledgeFolder();
    if (!folder && !canPick) {
      folder = window.prompt(t("knowledgeBases.distillDest")) || "";
    }
    if (!folder) return;
    setBusy(true);
    try {
      const id = await resolveKb();
      const result = await knowledgeBasesApi.distillMount(id, folder);
      message.success(
        t("knowledgeBases.distillDone", {
          count: result.copied,
          path: result.distill_path,
        }),
      );
      await load(id);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("knowledgeBases.distillFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={prominent ? undefined : { margin: "12px 0 16px" }}>
      <Typography.Text strong>{t("knowledgeBases.mountTitle")}</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
        {t("knowledgeBases.mountHint")}
      </Typography.Paragraph>
      <Space wrap>
        <Input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder={t("knowledgeBases.mountSource")}
          style={{ minWidth: 240 }}
        />
        <Button
          icon={<FolderOpen size={14} />}
          onClick={() => void pickSource()}
        >
          {t("knowledgeBases.pickFolder")}
        </Button>
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
