import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Segmented,
  Space,
} from "antd";
import { FolderKanban, MessageSquareText, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "../../layouts/PageShell";
import PageLoading from "../../components/PageLoading";
import { projectsApi, type Project } from "../../api/modules/projects";
import { message } from "../../utils/antdMessage";

const CronJobsPage = lazy(() => import("../Control/CronJobs"));

type WorkspaceView = "projects" | "tasks" | "conversations";

export default function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ name: string; work_dir?: string }>();
  const view = (searchParams.get("view") || "projects") as WorkspaceView;

  const setView = (next: WorkspaceView) => {
    const params = new URLSearchParams(searchParams);
    if (next === "projects") params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  const load = async () => {
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

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const conversations = useMemo(
    () =>
      projects.flatMap((project) =>
        (
          project.conversations ||
          project.conversation_ids.map((id) => ({ id, title: id }))
        ).map((item) => ({ ...item, projectName: project.name })),
      ),
    [projects],
  );

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
      await load();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("projects.createFailed"),
      );
    }
  };

  return (
    <PageShell
      title={t("nav.workspace")}
      subtitle={t("projects.subtitle")}
      actions={
        <Space>
          <Segmented
            value={view}
            onChange={(value) => setView(String(value) as WorkspaceView)}
            options={[
              { value: "projects", label: t("projects.tabProjects") },
              { value: "tasks", label: t("projects.tabTasks") },
              { value: "conversations", label: t("projects.tabConversations") },
            ]}
          />
          {view === "projects" ? (
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setOpen(true)}
            >
              {t("nav.newProject")}
            </Button>
          ) : null}
          {view === "conversations" ? (
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => navigate("/chat")}
            >
              {t("nav.newConversation")}
            </Button>
          ) : null}
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
                description={t("projects.conversationsEmpty")}
              />
            ),
          }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="open"
                  type="link"
                  onClick={() => navigate(`/chat`)}
                >
                  {t("nav.chat")}
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.title}
                description={item.projectName}
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
                  onClick={() => navigate("/chat")}
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
          <Form.Item name="work_dir" label={t("projects.workDir")}>
            <Input placeholder={t("projects.workDirHint")} />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
