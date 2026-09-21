import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Checkbox, Form, Input, Modal } from "antd";
import { Plus, Search } from "lucide-react";
import { useAgent } from "../../../context/AgentContext";
import type { OctopAgent } from "../../../context/AgentContext";
import { message } from "../../../utils/antdMessage";
import { openGroupChat } from "../../../utils/openGroupChat";
import { expertMentionToken } from "../utils/expertMention";
import styles from "../index.module.less";

interface SessionListToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  agents: OctopAgent[];
}

export default function SessionListToolbar({
  searchQuery,
  onSearchQueryChange,
  agents,
}: SessionListToolbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setActiveAgent } = useAgent();
  const [searchOpen, setSearchOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ title?: string; members: string[] }>();

  const showSearch = searchOpen || Boolean(searchQuery.trim());
  const newGroupLabel = t("chat.newGroupChat", "新建群聊");

  const createGroup = async () => {
    const values = await form.validateFields();
    const members = values.members || [];
    if (members.length < 2) {
      message.error(
        t("projects.groupMembersRequired", "请至少选择两位（同事或智能助手）"),
      );
      return;
    }
    const named = members
      .map((id) => agents.find((agent) => agent.agent_id === id)?.name)
      .filter((name): name is string => Boolean(name));
    setCreating(true);
    try {
      const { record, created } = await openGroupChat({
        memberIds: members,
        memberNames: named,
        title: values.title,
      });
      const prefill = named.map((name) => expertMentionToken(name)).join(" ");
      message.success(
        created
          ? t("projects.groupCreated", "群聊已创建")
          : t("chat.expertPickerGroupOpened", "已进入群聊"),
      );
      setGroupOpen(false);
      form.resetFields();
      setActiveAgent(record.hostAgentId);
      navigate(`/chat/${record.hostAgentId}/${record.threadId}`, {
        state: { prefillInput: `${prefill} ` },
      });
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("projects.groupCreateFailed", "无法创建群聊"),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.sessionHeader} data-testid="chat-session-toolbar">
      <div className={styles.sessionHeaderRow}>
        <h2 className={styles.sessionTitle}>
          {t("nav.conversations", "对话")}
        </h2>
        <div className={styles.sessionHeaderActions}>
          <button
            type="button"
            className={styles.sessionAddBtn}
            aria-label={t("chat.searchSessions", "搜索会话")}
            aria-expanded={showSearch}
            title={t("chat.searchSessions", "搜索会话")}
            data-testid="chat-session-search-toggle"
            onClick={() => {
              if (showSearch && !searchQuery.trim()) {
                setSearchOpen(false);
                return;
              }
              setSearchOpen(true);
            }}
          >
            <Search size={16} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.sessionAddBtn}
            aria-label={newGroupLabel}
            title={newGroupLabel}
            data-testid="chat-session-new-group"
            onClick={() => setGroupOpen(true)}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      {showSearch ? (
        <div className={styles.sessionSearchWrap}>
          <Search
            size={14}
            className={styles.sessionSearchIcon}
            strokeWidth={2}
          />
          <input
            type="search"
            className={styles.sessionSearchInput}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t("chat.searchSessions", "搜索会话")}
            aria-label={t("chat.searchSessions", "搜索会话")}
            data-testid="chat-session-search"
            autoFocus
          />
        </div>
      ) : null}

      <Modal
        title={newGroupLabel}
        open={groupOpen}
        onCancel={() => {
          setGroupOpen(false);
          form.resetFields();
        }}
        onOk={() => void createGroup()}
        okText={t("common.create", "创建")}
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t("projects.groupTitle", "群聊名称")}>
            <Input
              placeholder={t(
                "projects.groupTitlePlaceholder",
                "可选，例如「产品周会」",
              )}
            />
          </Form.Item>
          <Form.Item
            name="members"
            label={t("projects.groupMembers", "选择同事或智能助手")}
            rules={[
              {
                validator: async (_, value: string[] | undefined) => {
                  if (!value || value.length < 2) {
                    throw new Error(
                      t(
                        "projects.groupMembersRequired",
                        "请至少选择两位（同事或智能助手）",
                      ),
                    );
                  }
                },
              },
            ]}
          >
            <Checkbox.Group
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
              options={agents.map((agent) => ({
                label: agent.name,
                value: agent.agent_id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
