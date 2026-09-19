import { Building2, Megaphone, Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { PathTabsConfig } from "../../layouts/PageShell";

export function useOrgPathTabs(
  active: "workbench" | "announcements" | "org",
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
      {
        value: "org",
        label: t("organization.navOrgChart"),
        icon: <Network size={14} />,
      },
    ],
    onChange: (value) => {
      if (value === "announcements") {
        navigate("/organization/announcements");
        return;
      }
      if (value === "org") {
        navigate("/organization/org");
        return;
      }
      navigate("/organization");
    },
  };
}
