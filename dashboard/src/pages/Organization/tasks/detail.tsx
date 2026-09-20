import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { request, requestBlob, requestUpload } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import PageShell from "../../../layouts/PageShell";
import {
  TaskDetailPage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationTaskDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const pathTabs = useOrgPathTabs("tasks");
  const client = useMemo(
    () =>
      createOrgApiClient({
        fetchJson: (path, init) => request(path, init),
        uploadForm: (path, body) => requestUpload(path, body),
        fetchBlob: (path) => requestBlob(path),
      }),
    [],
  );
  const locale = i18n.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
  const session: OrgSession = {
    userId: user?.id ?? 0,
    displayName: user?.display_name || user?.username || "",
    role: user?.role || "user",
    isAdmin: user?.role === "admin",
  };
  const taskId = Number(id);

  return (
    <PageShell
      title={t("organization.tasksTitle")}
      subtitle={t("organization.tasksBody")}
      fill
      pathTabs={pathTabs}
    >
      <TaskDetailPage
        client={client.tasks}
        session={session}
        locale={locale}
        taskId={Number.isFinite(taskId) ? taskId : 0}
        onBack={() => navigate("/organization/tasks")}
      />
    </PageShell>
  );
}
