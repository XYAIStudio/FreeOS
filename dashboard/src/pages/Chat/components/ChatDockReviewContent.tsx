import { useState } from "react";
import { Button, Empty, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { useTrajectorySession } from "../hooks/useTrajectorySession";
import TrajectoryLedger from "./TrajectoryLedger";
import styles from "../index.module.less";

interface ChatDockReviewContentProps {
  agentId: string;
  threadId?: string | null;
  visible: boolean;
}

export default function ChatDockReviewContent({
  agentId,
  threadId,
  visible,
}: ChatDockReviewContentProps) {
  const { t } = useTranslation();
  const { events, loading, error, retry } = useTrajectorySession({
    agentId,
    threadId: threadId ?? null,
    visible,
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (!threadId) {
    return (
      <div className={styles.rightRailPanelEmpty}>
        <Empty
          description={t(
            "chat.rightRail.reviewNeedSession",
            "先选一段对话，才能查看审查记录。",
          )}
        />
      </div>
    );
  }

  if (loading && events.length === 0) {
    return (
      <div className={styles.rightRailPanelEmpty}>
        <Spin />
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={styles.rightRailPanelEmpty}>
        <Empty description={t("chat.trajectoryLoadError")}>
          <Button type="primary" onClick={() => void retry()}>
            {t("common.retry", "重试")}
          </Button>
        </Empty>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.rightRailPanelEmpty}>
        <Empty
          description={
            <div>
              <div>
                {t("chat.rightRail.reviewEmpty", "还没有可审查的操作")}
              </div>
              <p className={styles.rightRailPanelEmptyHint}>
                {t(
                  "chat.rightRail.reviewEmptyHint",
                  "和助手对话后，工具调用与改动会显示在这里。",
                )}
              </p>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.rightRailReviewBody}>
      <TrajectoryLedger
        events={events}
        selectedEventId={selectedEventId}
        onSelect={setSelectedEventId}
        focusEventIds={null}
        searchMatchIds={null}
      />
    </div>
  );
}
