import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import PageShell from "../../../layouts/PageShell";
import {
  AgentsPage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationAgentsPage() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const pathTabs = useOrgPathTabs("agents");
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
      title={t("organization.agentsTitle")}
      subtitle={t("organization.agentsBody")}
      fill
      pathTabs={pathTabs}
    >
      <AgentsPage client={client.agents} session={session} locale={locale} />
    </PageShell>
  );
}
