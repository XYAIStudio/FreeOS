import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import PageShell from "../../../layouts/PageShell";
import {
  ReflectionsPage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationReflectionsPage() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const pathTabs = useOrgPathTabs("reflections");
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
      title={t("organization.reflectionsTitle")}
      subtitle={t("organization.reflectionsBody")}
      fill
      pathTabs={pathTabs}
    >
      <ReflectionsPage
        client={client.reflections}
        session={session}
        locale={locale}
      />
    </PageShell>
  );
}
