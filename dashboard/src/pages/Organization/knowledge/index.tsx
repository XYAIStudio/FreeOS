import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import PageShell from "../../../layouts/PageShell";
import {
  KnowledgePage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { userCan } from "../../../utils/permissions";
import { ORG_PAGE_SHELL, useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationKnowledgePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const pathTabs = useOrgPathTabs("knowledge");
  const client = useMemo(
    () =>
      createOrgApiClient({
        fetchJson: (path, init) => request(path, init),
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

  return (
    <PageShell
      title={t("organization.knowledgeTitle")}
      subtitle={t("organization.knowledgeBody")}
      {...ORG_PAGE_SHELL}
      pathTabs={pathTabs}
    >
      <KnowledgePage
        client={client.knowledge}
        session={session}
        locale={locale}
        canWrite={userCan(user, "knowledge_bases")}
        onOpenHostKnowledge={() => navigate("/knowledge-bases")}
      />
    </PageShell>
  );
}
