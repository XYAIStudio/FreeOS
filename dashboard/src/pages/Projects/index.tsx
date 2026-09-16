import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Space,
  Tag,
} from "antd";
import {
  FolderKanban,
  FolderPlus,
  ListPlus,
  MessageSquarePlus,
  MessageSquareText,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "../../layouts/PageShell";
import PageLoading from "../../components/PageLoading";
import { projectsApi, type Project } from "../../api/modules/projects";
import {
  octopThreadsApi,
  type OctopThread,
} from "../../api/modules/octopThreads";
import { useAgent, selectEnabledExperts } from "../../context/AgentContext";
import { onSessionEvent } from "../Chat/hooks/chatStore";
import { expertMentionToken } from "../Chat/utils/expertMention";
import {
  canPickDesktopFolder,
  pickDesktopFolder,
} from "../../utils/desktopFolder";
import { loadGroupChats, type GroupChatRecord } from "../../utils/groupChats";
import { openGroupChat } from "../../utils/openGroupChat";
import { message } from "../../utils/antdMessage";
import styles from "./index.module.less";

const CronJobsPage = lazy(() => import("../Control/CronJobs"));

type WorkspaceView = "conversations" | "projects" | "tasks";

interface LiveConversation {
  id: string;
  title: string;
  kind: "direct" | "group";
  agentId: string;
  lastActive: number;
  subtitle?: string;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { agents, activeAgentId, setActiveAgent } = useAgent();
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<
    Array<OctopThread & { agentId: string; agentName: string }>
  >([]);
  const [groups, setGroups] = useState<GroupChatRecord[]>(() =>
    loadGroupChats(),
  );
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [form] = Form.useForm<{ name: string; work_dir?: string }>();
  const [groupForm] = Form.useForm<{ title?: string; members: string[] }>();
  const rawView = searchParams.get("view");
  const view: WorkspaceView =
    rawView === "projects" || rawView === "tasks" ? rawView : "conversations";
  const enabledExperts = useMemo(
    () => selectEnabledExperts(agents, activeAgentId, { pinActive: false }),
    [agents, activeAgentId],
  );

  const setView = (next: WorkspaceView) => {
    const params = new URLSearchParams(searchParams);
    if (next === "conversations") params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const next = await projectsApi.list();
      setProjects(next.projects);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("projects.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const loadThreads = useCallback(async () => {
    if (enabledExperts.length === 0) {
      setThreads([]);
      return;
    }
    const rows = await Promise.all(
      enabledExperts.map(async (agent) => {
        try {
          const list = await octopThreadsApi.list(agent.agent_id, 40);
          return list.map((item) => ({
            ...item,
            agentId: agent.agent_id,
            agentName: agent.name,
          }));
        } catch {
          return [];
        }
      }),
    );
    setThreads(rows.flat());
    setGroups(loadGroupChats());
  }, [enabledExperts]);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    const unsub = onSessionEvent(() => {
      void loadThreads();
    });
    const id = window.setInterval(() => {
      void loadThreads();
    }, 4000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [loadThreads]);

  useEffect(() => {
    if (searchParams.get("group") === "1") {
      setGroupOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("group");
      if (next.get("view") === "tasks" || next.get("view") === "projects") {
        next.delete("view");
      }
      setSearchParams(next, { replace: true });
    }
    if (searchParams.get("new") !== "1") return;
    if (view === "tasks") return;
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, view]);

  const conversations = useMemo<LiveConversation[]>(() => {
    const groupByThread = new Map(groups.map((item) => [item.threadId, item]));
    const live: LiveConversation[] = threads.map((item) => {
      const group = groupByThread.get(item.thread_id);
      if (group) {
        return {
          id: item.thread_id,
          title: group.title || item.title || t("nav.groupChat"),
          kind: "group",
          agentId: group.hostAgentId,
          lastActive: Math.max(item.last_active || 0, group.lastActive),
          subtitle: t("projects.kindGroup"),
        };
      }
      return {
        id: item.thread_id,
        title: item.title || t("nav.newConversation"),
        kind: "direct",
        agentId: item.agentId,
        lastActive: item.last_active || 0,
        subtitle: item.agentName,
      };
    });
    for (const group of groups) {
      if (live.some((row) => row.id === group.threadId)) continue;
      live.push({
        id: group.threadId,
        title: group.title,
        kind: "group",
        agentId: group.hostAgentId,
        lastActive: group.lastActive,
        subtitle: t("projects.kindGroup"),
      });
    }
    return live.sort((a, b) => b.lastActive - a.lastActive);
  }, [groups, t, threads]);

  const browseWorkDir = async () => {
    setPickingFolder(true);
    try {
      const path = await pickDesktopFolder();
      if (path) {
        form.setFieldValue("work_dir", path);
      } else if (!canPickDesktopFolder()) {
        message.info(t("projects.pickFolderFailed"));
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("projects.pickFolderFailed"),
      );
    } finally {
      setPickingFolder(false);
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    try {
      await projectsApi.create({
        name: values.name,
        work_dir: values.work_dir || "",
      });
      message.success(t("projects.created"));
      setOpen(false);
      form.resetFields();
      await loadProjects();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("projects.createFailed"),
      );
    }
  };

  const openConversation = (item: LiveConversation) => {
    setActiveAgent(item.agentId);
    navigate(`/chat/${item.agentId}/${item.id}`);
  };

  const startNewConversation = () => {
    const agentId = activeAgentId || enabledExperts[0]?.agent_id;
    if (!agentId) {
      navigate("/chat");
      return;
    }
    setActiveAgent(agentId);
    navigate(`/chat/${agentId}`, { state: { newChat: true } });
  };

  const createGroup = async () => {
    const values = await groupForm.validateFields();
    const members = values.members || [];
    if (members.length < 2) {
      message.error(t("projects.groupMembersRequired"));
      return;
    }
    const named = members
      .map((id) => enabledExperts.find((agent) => agent.agent_id === id)?.name)
      .filter((name): name is string => Boolean(name));
    try {
      const { record, created } = await openGroupChat({
        memberIds: members,
        memberNames: named,
        title: values.title,
      });
      setGroups(loadGroupChats());
      const prefill = named.map((name) => expertMentionToken(name)).join(" ");
      message.success(
        created
          ? t("projects.groupCreated")
          : t("chat.expertPickerGroupOpened"),
      );
      setGroupOpen(false);
      groupForm.resetFields();
      setActiveAgent(record.hostAgentId);
      navigate(`/chat/${record.hostAgentId}/${record.threadId}`, {
        state: { prefillInput: `${prefill} ` },
      });
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("projects.groupCreateFailed"),
      );
    }
  };

  const startNewTask = () => {
    const params = new URLSearchParams(searchParams);
    params.set("view", "tasks");
    params.set("new", "1");
    setSearchParams(params);
  };

  const zoneTabs: { value: WorkspaceView; label: string }[] = [
    { value: "conversations", label: t("projects.tabConversations") },
    { value: "tasks", label: t("projects.tabTasks") },
    { value: "projects", label: t("projects.tabProjects") },
  ];

  return (
    <PageShell title={t("nav.workspace")} subtitle={t("projects.subtitle")}>
      <div className={styles.zone}>
        <div className={styles.tabs} role="tablist">
          {zoneTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={view === tab.value}
              className={`${styles.tab} ${
                view === tab.value ? styles.tabActive : ""
              }`}
              onClick={() => setView(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          {view === "conversations" ? (
            <>
              <Button
                icon={<MessageSquarePlus size={14} />}
                onClick={startNewConversation}
              >
                {t("nav.newConversation")}
              </Button>
              <Button
                type="primary"
                icon={<Users size={14} />}
                onClick={() => setGroupOpen(true)}
              >
                {t("nav.newGroup")}
              </Button>
            </>
          ) : null}
          {view === "tasks" ? (
            <Button
              type="primary"
              icon={<ListPlus size={14} />}
              onClick={startNewTask}
            >
              {t("nav.newTask")}
            </Button>
          ) : null}
          {view === "projects" ? (
            <Button
              type="primary"
              icon={<FolderPlus size={14} />}
              onClick={() => setOpen(true)}
            >
              {t("nav.newProject")}
            </Button>
          ) : null}
        </div>
      </div>

      {view === "tasks" ? (
        <Suspense fallback={<PageLoading />}>
          <CronJobsPage />
        </Suspense>
      ) : null}

      {view === "conversations" ? (
        <List
          dataSource={conversations}
          locale={{
            emptyText: (
              <Empty
                image={<MessageSquareText size={36} />}
                description={t("projects.liveEmpty")}
              />
            ),
          }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  onClick={() => openConversation(item)}
                >
                  {t("nav.chat")}
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{item.title}</span>
                    <Tag>
                      {item.kind === "group"
                        ? t("projects.kindGroup")
                        : t("projects.kindDirect")}
                    </Tag>
                  </Space>
                }
                description={item.subtitle}
              />
            </List.Item>
          )}
        />
      ) : null}

      {view === "projects" ? (
        <List
          loading={loading}
          dataSource={projects}
          locale={{
            emptyText: (
              <Empty
                image={<FolderKanban size={36} />}
                description={t("projects.empty")}
              />
            ),
          }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="chat" type="link" onClick={startNewConversation}>
                  {t("nav.newConversation")}
                </Button>,
                <Button
                  key="task"
                  type="link"
                  onClick={() => navigate("/projects?view=tasks&new=1")}
                >
                  {t("nav.newTask")}
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={
                  <Space direction="vertical" size={0}>
                    {item.work_dir ? (
                      <span>
                        {t("projects.workDir")}: {item.work_dir}
                      </span>
                    ) : (
                      <span>{t("projects.noWorkDir")}</span>
                    )}
                    <span>
                      {t("projects.counts", {
                        conversations:
                          item.conversations?.length ??
                          item.conversation_ids.length,
                        tasks: item.tasks?.length ?? item.task_ids.length,
                      })}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      ) : null}

      <Modal
        title={t("nav.newProject")}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void create()}
        okText={t("common.create")}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t("projects.name")}
            rules={[{ required: true, message: t("projects.nameRequired") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label={t("projects.workDir")}>
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="work_dir" noStyle>
                <Input placeholder={t("projects.workDirHint")} />
              </Form.Item>
              <Button
                loading={pickingFolder}
                onClick={() => void browseWorkDir()}
              >
                {t("projects.browseWorkDir")}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t("nav.newGroup")}
        open={groupOpen}
        onCancel={() => setGroupOpen(false)}
        onOk={() => void createGroup()}
        okText={t("common.create")}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item name="title" label={t("projects.groupTitle")}>
            <Input placeholder={t("projects.groupTitlePlaceholder")} />
          </Form.Item>
          <Form.Item
            name="members"
            label={t("projects.groupMembers")}
            rules={[
              {
                validator: async (_, value: string[] | undefined) => {
                  if (!value || value.length < 2) {
                    throw new Error(t("projects.groupMembersRequired"));
                  }
                },
              },
            ]}
          >
            <Checkbox.Group
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
              options={enabledExperts.map((agent) => ({
                label: agent.name,
                value: agent.agent_id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
