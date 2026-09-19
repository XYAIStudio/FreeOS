import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { request } from "../../../api/request";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { useServerTimezone } from "../../../hooks/useServerTimezone";
import PageShell from "../../../layouts/PageShell";
import {
  AnnouncementPage,
  createOrgApiClient,
  type OrgSession,
} from "../../../org-ui";
import { formatServerIsoDateTime } from "../../../utils/formatMessageTime";
import { useOrgPathTabs } from "../orgPathTabs";

export default function OrganizationAnnouncementsPage() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const timeZone = useServerTimezone();
  const pathTabs = useOrgPathTabs("announcements");
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
      title={t("organization.announcementsTitle")}
      subtitle={t("organization.announcementsBody")}
      fill
      pathTabs={pathTabs}
    >
      <AnnouncementPage
        client={client.announcements}
        session={session}
        locale={locale}
        timeZone={timeZone}
        formatDateTime={(iso) => formatServerIsoDateTime(iso, timeZone)}
      />
    </PageShell>
  );
}
