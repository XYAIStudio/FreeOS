import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import PageShell from "../../../layouts/PageShell";
import {
  EmployeesPage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { ORG_PAGE_SHELL, useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationEmployeesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const pathTabs = useOrgPathTabs("employees");
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
      title={t("organization.employeesTitle")}
      subtitle={t("organization.employeesBody")}
      {...ORG_PAGE_SHELL}
      pathTabs={pathTabs}
    >
      <EmployeesPage
        client={client.employees}
        session={session}
        locale={locale}
        onOpenEmployee={(id) => navigate(`/organization/employees/${id}`)}
      />
    </PageShell>
  );
}
