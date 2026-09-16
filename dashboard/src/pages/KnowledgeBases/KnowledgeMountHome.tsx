import { Button, Typography } from "antd";
import { Cloud, FolderUp, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { XyaiMascot } from "../../components/EmptyState";
import { CloudMountPanel } from "./CloudMountPanel";
import { LocalMountPanel } from "./LocalMountPanel";
import styles from "./index.module.less";

interface KnowledgeMountHomeProps {
  canConfigure: boolean;
  onOpenSettings: () => void;
  ensureKb: (name: string) => Promise<string>;
  onMounted: () => void;
}

export function KnowledgeMountHome({
  canConfigure,
  onOpenSettings,
  ensureKb,
  onMounted,
}: KnowledgeMountHomeProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.mountHome}>
      <XyaiMascot size={96} className={styles.setupMascot} />
      <Typography.Title level={3} className={styles.mountHomeTitle}>
        {t("knowledgeBases.homeTitle")}
      </Typography.Title>
      <Typography.Paragraph className={styles.mountHomeLead}>
        {t("knowledgeBases.homeDesc")}
      </Typography.Paragraph>
      <div className={styles.mountHomeCards}>
        <section className={styles.mountCard}>
          <div className={styles.mountCardIcon} aria-hidden>
            <FolderUp size={22} strokeWidth={1.8} />
          </div>
          <LocalMountPanel
            prominent
            ensureKb={() =>
              ensureKb(t("knowledgeBases.defaultLocalName"))
            }
            onMounted={onMounted}
          />
        </section>
        <section className={styles.mountCard}>
          <div className={styles.mountCardIcon} aria-hidden>
            <Cloud size={22} strokeWidth={1.8} />
          </div>
          <CloudMountPanel
            prominent
            ensureKb={() =>
              ensureKb(t("knowledgeBases.defaultCloudName"))
            }
            onMounted={onMounted}
          />
        </section>
      </div>
      {canConfigure ? (
        <div className={styles.mountHomeAdvanced}>
          <Typography.Text type="secondary">
            {t("knowledgeBases.homeAdvancedHint")}
          </Typography.Text>
          <Button
            type="link"
            icon={<Settings size={14} />}
            onClick={onOpenSettings}
          >
            {t("knowledgeBases.settingsFoundation")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
