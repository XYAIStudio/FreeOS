import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Segmented,
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
import { octopThreadsApi, type OctopThread } from "../../api/modules/octopThreads";
import { useAgent, selectEnabledExperts } from "../../context/AgentContext";
import { onSessionEvent } from "../Chat/hooks/chatStore";
import { expertMentionToken } from "../Chat/utils/expertMention";
import {
  canPickDesktopFolder,
  pickDesktopFolder,
} from "../../utils/desktopFolder";
import {
  groupChatTitle,
  loadGroupChats,
  saveGroupChat,
  type GroupChatRecord,
} from "../../utils/groupChats";
import { message } from "../../utils/antdMessage";

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
  const [groups, setGroups] = useState<GroupChatRecord[]>(() => loadGroupChats());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [form] = Form.useForm<{ name: string; work_dir?: string }>();
  const [groupForm] = Form.useForm<{ title?: string; members: string[] }>();
  const view = (searchParams.get("view") || "conversations") as WorkspaceView;
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
    if (searchParams.get("new") === "1") {
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
    if (searchParams.get("group") === "1") {
      setGroupOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("group");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
    const hostId = members[0];
    const named = members
      .map((id) => enabledExperts.find((agent) => agent.agent_id === id)?.name)
      .filter((name): name is string => Boolean(name));
    try {
      const created = await octopThreadsApi.create(hostId);
      const title = groupChatTitle(values.title, named);
      await octopThreadsApi.rename(hostId, created.thread_id, title);
      const record: GroupChatRecord = {
        id: created.thread_id,
        threadId: created.thread_id,
        hostAgentId: hostId,
        memberIds: members,
        title,
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
      setGroups(saveGroupChat(record));
      const prefill = named.map((name) => expertMentionToken(name)).join(" ");
      message.success(t("projects.groupCreated"));
      setGroupOpen(false);
      groupForm.resetFields();
      setActiveAgent(hostId);
      navigate(`/chat/${hostId}/${created.thread_id}`, {
        state: { prefillInput: `${prefill} ` },
      });
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("projects.groupCreateFailed"),
      );
    }
  };

  const actionBar = (
    <Space wrap>
      <Button
        icon={<MessageSquarePlus size={14} />}
        onClick={startNewConversation}
      >
        {t("nav.newConversation")}
      </Button>
      <Button
        icon={<ListPlus size={14} />}
        onClick={() => navigate("/projects?view=tasks&new=1")}
      >
        {t("nav.newTask")}
      </Button>
      <Button
        icon={<FolderPlus size={14} />}
        onClick={() => setOpen(true)}
      >
        {t("nav.newProject")}
      </Button>
      <Button
        type="primary"
        icon={<Users size={14} />}
        onClick={() => setGroupOpen(true)}
      >
        {t("nav.newGroup")}
      </Button>
    </Space>
  );

  return (
    <PageShell
      title={t("nav.workspace")}
      subtitle={t("projects.subtitle")}
      actions={
        <Space direction="vertical" align="end" size={8}>
          {actionBar}
          <Segmented
            value={view}
            onChange={(value) => setView(String(value) as WorkspaceView)}
            options={[
              { value: "conversations", label: t("projects.tabConversations") },
              { value: "projects", label: t("projects.tabProjects") },
              { value: "tasks", label: t("projects.tabTasks") },
            ]}
          />
        </Space>
      }
    >
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
                <Button
                  key="chat"
                  type="link"
                  onClick={startNewConversation}
                >
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
