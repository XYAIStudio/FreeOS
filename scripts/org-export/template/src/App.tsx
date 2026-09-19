import { useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  AgentsPage,
  AnnouncementPage,
  EmployeeDetailPage,
  EmployeesPage,
  GovernancePage,
  KnowledgePage,
  OrgChartPage,
  ReflectionsPage,
  SHARED_ORG_UI_MODULES,
  SettingsPage,
  SkillsPage,
  TaskDetailPage,
  TasksPage,
  WorkspacePage,
  createBridgeFetcher,
  createLocalJwtBridge,
  createOrgApiClient,
  StandaloneUnauthorizedError,
  type OrgEmployeesClient,
  type OrgSession,
  type OrgTasksClient,
} from "org-ui";
import { LoginPage } from "./auth/LoginPage";
import { HostDeepLinkPage } from "./shell/HostDeepLinkPage";
import { StandaloneNav } from "./shell/Nav";

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

const STANDALONE_LINKS = {
  workbench: "/app",
  announcements: "/announcements",
  organization: "/org",
  employees: "/employees",
  skills: "/skills",
  agents: "/agents",
  tasks: "/tasks",
  knowledge: "/knowledge",
  reflections: "/reflections",
  governance: "/governance",
  settings: "/settings",
  chat: "/chat",
};

function EmployeeRoute(props: {
  client: OrgEmployeesClient;
  session: OrgSession;
  locale: "zh" | "en";
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <EmployeeDetailPage
      client={props.client}
      session={props.session}
      locale={props.locale}
      employeeId={Number(id || 0)}
      onBack={() => navigate("/employees")}
      modules={SHARED_ORG_UI_MODULES}
    />
  );
}

function TaskRoute(props: {
  client: OrgTasksClient;
  session: OrgSession;
  locale: "zh" | "en";
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <TaskDetailPage
      client={props.client}
      session={props.session}
      locale={props.locale}
      taskId={Number(id || 0)}
      onBack={() => navigate("/tasks")}
      modules={SHARED_ORG_UI_MODULES}
    />
  );
}

/**
 * Runnable standalone shell. IdentityBridge is local JWT
 * (`openxyos.standalone.jwt`), distinct from the FreeOS Dashboard session.
 * Pages are the same org-ui components Dashboard mounts under /organization/...
 */
export default function App() {
  const navigate = useNavigate();
  const locale: "zh" | "en" =
    typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")
      ? "zh"
      : "en";
  const [epoch, setEpoch] = useState(0);
  const bridge = useMemo(
    () =>
      createLocalJwtBridge({
        apiBase: API_BASE,
        locale,
        navigate: (path) => navigate(path),
      }),
    [locale, navigate],
  );
  const client = useMemo(
    () =>
      createOrgApiClient({
        fetchJson: async (path, init) => {
          try {
            return await createBridgeFetcher(bridge)(path, init);
          } catch (err) {
            if (err instanceof StandaloneUnauthorizedError) {
              bridge.clearSession();
              setEpoch((n) => n + 1);
              navigate("/login");
            }
            throw err;
          }
        },
      }),
    [bridge, navigate],
  );
  void epoch;
  const session = bridge.getSession();
  const signedIn = bridge.hasToken();

  if (!signedIn) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            <LoginPage
              bridge={bridge}
              locale={locale}
              onSignedIn={() => {
                setEpoch((n) => n + 1);
                navigate("/app");
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <StandaloneNav
        bridge={bridge}
        locale={locale}
        onSignOut={() => {
          bridge.clearSession();
          setEpoch((n) => n + 1);
          navigate("/login");
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Navigate to="/app" replace />} />
        <Route path="/organization" element={<Navigate to="/app" replace />} />
        <Route
          path="/app"
          element={
            <WorkspacePage
              client={client.workspace}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
              workbenchHref="/app"
              links={STANDALONE_LINKS}
            />
          }
        />
        <Route
          path="/announcements"
          element={
            <AnnouncementPage
              client={client.announcements}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
            />
          }
        />
        <Route
          path="/org"
          element={
            <OrgChartPage
              client={client.org}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
            />
          }
        />
        <Route
          path="/employees"
          element={
            <EmployeesPage
              client={client.employees}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
              onOpenEmployee={(id) => navigate(`/employees/${id}`)}
            />
          }
        />
        <Route
          path="/employees/:id"
          element={
            <EmployeeRoute
              client={client.employees}
              session={session}
              locale={locale}
            />
          }
        />
        <Route
          path="/skills"
          element={
            <SkillsPage
              client={client.skills}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
            />
          }
        />
        <Route
          path="/agents"
          element={
            <AgentsPage
              client={client.agents}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
              workbenchHref="/app"
            />
          }
        />
        <Route
          path="/tasks"
          element={
            <TasksPage
              client={client.tasks}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
              onOpenTask={(id) => navigate(`/tasks/${id}`)}
            />
          }
        />
        <Route
          path="/tasks/:id"
          element={
            <TaskRoute client={client.tasks} session={session} locale={locale} />
          }
        />
        <Route
          path="/knowledge"
          element={
            <KnowledgePage
              client={client.knowledge}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
            />
          }
        />
        <Route
          path="/reflections"
          element={
            <ReflectionsPage
              client={client.reflections}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
            />
          }
        />
        <Route
          path="/governance"
          element={
            <GovernancePage
              client={client.governance}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              client={client.settings}
              session={session}
              locale={locale}
              modules={SHARED_ORG_UI_MODULES}
              workbenchHref="/app"
            />
          }
        />
        <Route
          path="/chat"
          element={<HostDeepLinkPage kind="chat" locale={locale} />}
        />
        <Route
          path="/experts"
          element={<HostDeepLinkPage kind="experts" locale={locale} />}
        />
        <Route
          path="/personalization"
          element={<HostDeepLinkPage kind="personalization" locale={locale} />}
        />
        <Route
          path="/system-settings/*"
          element={<HostDeepLinkPage kind="system-settings" locale={locale} />}
        />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  );
}
