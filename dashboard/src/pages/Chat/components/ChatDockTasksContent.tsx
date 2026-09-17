import { useEffect, useState } from "react";
import { Button, Empty, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { octopCronApi } from "../../../api/modules/cronjob";
import type { OctopCronRow } from "../../../api/types";
import { useServerTimezone } from "../../../hooks/useServerTimezone";
import { WORKSPACE_TASKS_PATH } from "../../../layouts/conversationHome";
import { formatCronTimestamp } from "../../Control/CronJobs/cronDisplay";
import { apiErrorMessage } from "../../../utils/apiError";
import styles from "../index.module.less";

interface ChatDockTasksContentProps {
  agentId: string;
  visible: boolean;
}

export default function ChatDockTasksContent({
  agentId,
  visible,
}: ChatDockTasksContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timeZone = useServerTimezone();
  const [jobs, setJobs] = useState<OctopCronRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !agentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void octopCronApi
      .list(agentId)
      .then((rows) => {
        if (!cancelled) setJobs(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            apiErrorMessage(
              err,
              t("chat.rightRail.tasksLoadFailed", "加载任务失败"),
              t,
            ),
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, t, visible]);

  const openTasksPage = () => navigate(WORKSPACE_TASKS_PATH);

  if (loading && jobs.length === 0) {
    return (
      <div className={styles.rightRailPanelEmpty}>
        <Spin />
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <div className={styles.rightRailPanelEmpty}>
        <Empty description={error}>
          <Button type="primary" onClick={openTasksPage}>
            {t("chat.rightRail.tasksOpenPage", "管理定时任务")}
          </Button>
        </Empty>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className={styles.rightRailPanelEmpty}>
        <Empty
          description={
            <div>
              <div>
                {t("chat.rightRail.tasksEmpty", "当前没有后台任务")}
              </div>
              <p className={styles.rightRailPanelEmptyHint}>
                {t(
                  "chat.rightRail.tasksEmptyHint",
                  "定时任务和正在运行的工作会显示在这里。",
                )}
              </p>
            </div>
          }
        >
          <Button type="primary" onClick={openTasksPage}>
            {t("chat.rightRail.tasksOpenPage", "管理定时任务")}
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.rightRailTasks}>
      <ul className={styles.rightRailTaskList}>
        {jobs.map((job) => (
          <li key={job.id} className={styles.rightRailTaskItem}>
            <div className={styles.rightRailTaskName}>{job.name || job.id}</div>
            <div className={styles.rightRailTaskMeta}>
              <span>{job.trigger}</span>
              <span>
                {job.enabled
                  ? t("chat.rightRail.taskOn", "已启用")
                  : t("chat.rightRail.taskOff", "已停用")}
              </span>
              <span>
                {formatCronTimestamp(job.last_run_at, timeZone)}
                {job.last_status ? ` · ${job.last_status}` : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.rightRailTaskFooter}>
        <Button type="link" onClick={openTasksPage}>
          {t("chat.rightRail.tasksOpenPage", "管理定时任务")}
        </Button>
      </div>
    </div>
  );
}
