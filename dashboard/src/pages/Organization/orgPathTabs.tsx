import {
  BookOpen,
  Brain,
  Building2,
  ListTodo,
  Megaphone,
  Network,
  Package,
  Bot,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { PathTabsConfig } from "../../layouts/PageShell";

export function useOrgPathTabs(
  active:
    | "workbench"
    | "announcements"
    | "org"
    | "employees"
    | "skills"
    | "governance"
    | "knowledge"
    | "tasks"
    | "reflections"
    | "settings"
    | "agents",
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
      {
        value: "employees",
        label: t("organization.navEmployees"),
        icon: <Users size={14} />,
      },
      {
        value: "skills",
        label: t("organization.navSkills"),
        icon: <Package size={14} />,
      },
      {
        value: "governance",
        label: t("organization.navGovernance"),
        icon: <Shield size={14} />,
      },
      {
        value: "knowledge",
        label: t("organization.navKnowledge"),
        icon: <BookOpen size={14} />,
      },
      {
        value: "tasks",
        label: t("organization.navTasks"),
        icon: <ListTodo size={14} />,
      },
      {
        value: "reflections",
        label: t("organization.navReflections"),
        icon: <Brain size={14} />,
      },
      {
        value: "settings",
        label: t("organization.navSettings"),
        icon: <Settings size={14} />,
      },
      {
        value: "agents",
        label: t("organization.navAgents"),
        icon: <Bot size={14} />,
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
      if (value === "employees") {
        navigate("/organization/employees");
        return;
      }
      if (value === "skills") {
        navigate("/organization/skills");
        return;
      }
      if (value === "governance") {
        navigate("/organization/governance");
        return;
      }
      if (value === "knowledge") {
        navigate("/organization/knowledge");
        return;
      }
      if (value === "tasks") {
        navigate("/organization/tasks");
        return;
      }
      if (value === "reflections") {
        navigate("/organization/reflections");
        return;
      }
      if (value === "settings") {
        navigate("/organization/settings");
        return;
      }
      if (value === "agents") {
        navigate("/organization/agents");
        return;
      }
      navigate("/organization");
    },
  };
}
