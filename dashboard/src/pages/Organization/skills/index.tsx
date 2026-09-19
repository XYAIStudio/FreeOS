import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import PageShell from "../../../layouts/PageShell";
import {
  SkillsPage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { ORG_PAGE_SHELL, useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationSkillsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const pathTabs = useOrgPathTabs("skills");
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
      title={t("organization.skillsTitle")}
      subtitle={t("organization.skillsBody")}
      {...ORG_PAGE_SHELL}
      pathTabs={pathTabs}
    >
      <SkillsPage
        client={client.skills}
        session={session}
        locale={locale}
        onOpenHostSkills={() => navigate("/personalization/skill-packages")}
      />
    </PageShell>
  );
}
