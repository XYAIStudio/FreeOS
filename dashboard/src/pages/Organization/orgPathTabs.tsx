import { Building2, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { PathTabsConfig } from "../../layouts/PageShell";

export function useOrgPathTabs(
  active: "workbench" | "announcements",
): PathTabsConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return {
    value: active,
    options: [
      {
        value: "workbench",
        label: t("organization.navWorkbench"),
        icon: <Building2 size={14} />,
      },
      {
        value: "announcements",
        label: t("organization.navAnnouncements"),
        icon: <Megaphone size={14} />,
      },
    ],
    onChange: (value) => {
      navigate(
        value === "announcements"
          ? "/organization/announcements"
          : "/organization",
      );
    },
  };
}
