import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import PageShell from "../../../layouts/PageShell";
import {
  EmployeeDetailPage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationEmployeeDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
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
  const employeeId = Number(id);

  return (
    <PageShell
      title={t("organization.employeesTitle")}
      subtitle={t("organization.employeesBody")}
      fill
      pathTabs={pathTabs}
    >
      <EmployeeDetailPage
        client={client.employees}
        session={session}
        locale={locale}
        employeeId={Number.isFinite(employeeId) ? employeeId : 0}
        onBack={() => navigate("/organization/employees")}
      />
    </PageShell>
  );
}
