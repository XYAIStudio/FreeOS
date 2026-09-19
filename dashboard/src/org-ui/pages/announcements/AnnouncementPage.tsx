import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { Eye, Megaphone, Pin, Plus, Search } from "lucide-react";
import type {
  Announcement,
  OrgAnnouncementsClient,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { announcementLabels, typeLabel } from "./labels";
import styles from "./AnnouncementPage.module.css";

const TYPE_COLOR: Record<string, string> = {
  notice: "blue",
  policy: "purple",
  news: "green",
  emergency: "red",
};

export interface AnnouncementPageProps {
  client: OrgAnnouncementsClient;
  session: OrgSession;
  locale: OrgLocale;
  timeZone?: string;
  formatDateTime?: (iso: string) => string;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultFormat(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export function AnnouncementPage({
  client,
  session,
  locale,
  formatDateTime,
}: AnnouncementPageProps) {
  const labels = announcementLabels(locale);
  const format = formatDateTime ?? defaultFormat;
  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [detail, setDetail] = useState<Announcement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    type: "notice",
    priority: "normal",
    is_pinned: false,
    expires_at: "",
  });
  const limit = 10;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await client.list({
        page,
        limit,
        type: filterType,
        search,
      });
      setItems(data.list);
      setTotal(data.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [client, page, filterType, search]);

  const fetchUnread = useCallback(async () => {
    try {
      const data = await client.unread();
      setUnreadCount(data.count);
    } catch {
      /* ignore */
    }
  }, [client]);

  useEffect(() => {
    void fetchList();
    void fetchUnread();
  }, [fetchList, fetchUnread]);

  const openDetail = async (row: Announcement) => {
    try {
      const next = await client.get(row.id);
      setDetail(next);
      setItems((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, is_read: true } : item,
        ),
      );
      void fetchUnread();
    } catch {
      setDetail(row);
    }
  };

  const markAllRead = async () => {
    await client.markAllRead();
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({
      title: "",
      content: "",
      type: "notice",
      priority: "normal",
      is_pinned: false,
      expires_at: "",
    });
    setShowForm(true);
  };

  const openEdit = (row: Announcement) => {
    setEditId(row.id);
    setForm({
      title: row.title,
      content: row.content,
      type: row.type,
      priority: row.priority,
      is_pinned: row.is_pinned === 1,
      expires_at: row.expires_at || "",
    });
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      window.alert(labels.required);
      return;
    }
    const body = {
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      priority: form.priority,
      is_pinned: form.is_pinned,
      expires_at: form.expires_at || null,
    };
    if (editId) {
      await client.update(editId, body);
    } else {
      await client.create(body);
    }
    setShowForm(false);
    await fetchList();
  };

  const deleteAnnouncement = async (id: number) => {
    if (!window.confirm(labels.confirmDelete)) return;
    await client.remove(id);
    await fetchList();
    void fetchUnread();
  };

  const togglePin = async (id: number) => {
    await client.togglePin(id);
    await fetchList();
  };

  return (
    <div className={styles.page} data-testid="org-ui-announcements">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Megaphone size={22} />
          <h1 className={styles.title}>{labels.title}</h1>
          {unreadCount > 0 ? (
            <Tag color="red" style={{ borderRadius: 999 }}>
              {unreadCount} {labels.unread}
            </Tag>
          ) : null}
        </div>
        <Space>
          <Button onClick={() => void markAllRead()}>
            {labels.markAllRead}
          </Button>
          {session.isAdmin ? (
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={openCreate}
              data-testid="org-announcements-publish"
            >
              {labels.publish}
            </Button>
          ) : null}
        </Space>
      </div>

      <div className={styles.filters}>
        <Space wrap>
          {[
            { key: "all", label: labels.all },
            { key: "notice", label: labels.notice },
            { key: "policy", label: labels.policy },
            { key: "news", label: labels.news },
            { key: "emergency", label: labels.emergency },
          ].map((filter) => (
            <Button
              key={filter.key}
              type={filterType === filter.key ? "primary" : "default"}
              size="small"
              onClick={() => {
                setFilterType(filter.key);
                setPage(1);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </Space>
        <Input
          allowClear
          prefix={<Search size={14} />}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={labels.search}
          style={{ maxWidth: 240 }}
        />
      </div>

      {loading ? (
        <div className={styles.empty}>{labels.loading}</div>
      ) : items.length === 0 ? (
        <div className={styles.empty} data-testid="org-announcements-empty">
          <div className={styles.emptyIcon} aria-hidden>
            <Megaphone size={48} />
          </div>
          {labels.empty}
        </div>
      ) : (
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          {items.map((row) => {
            const expired =
              Boolean(row.expires_at) &&
              new Date(row.expires_at as string).getTime() < Date.now();
            return (
              <div
                key={row.id}
                className={`${styles.card} ${
                  row.is_pinned === 1 ? styles.cardPinned : ""
                } ${expired ? styles.cardExpired : ""}`}
                data-testid={`org-announcement-${row.id}`}
                onClick={() => void openDetail(row)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void openDetail(row);
                }}
              >
                {row.is_pinned === 1 ? (
                  <Pin size={14} className={styles.pinBadge} />
                ) : null}
                <div className={styles.cardTitle}>
                  <Tag color={TYPE_COLOR[row.type] || "blue"}>
                    {typeLabel(row.type, locale)}
                  </Tag>
                  {!row.is_read ? <span className={styles.unreadDot} /> : null}
                  <Typography.Text strong={!row.is_read} ellipsis>
                    {row.title}
                  </Typography.Text>
                  {row.priority === "urgent" ? (
                    <Tag color="red">{labels.urgent}</Tag>
                  ) : null}
                  {expired ? <Tag>{labels.expired}</Tag> : null}
                  {session.isAdmin ? (
                    <Space
                      size={4}
                      onClick={(event) => event.stopPropagation()}
                      style={{ marginLeft: "auto" }}
                    >
                      <Button
                        type="link"
                        size="small"
                        onClick={() => openEdit(row)}
                      >
                        {labels.editShort}
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => void togglePin(row.id)}
                      >
                        {row.is_pinned ? labels.unpin : labels.pin}
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => void deleteAnnouncement(row.id)}
                      >
                        {labels.deleteShort}
                      </Button>
                    </Space>
                  ) : null}
                </div>
                <p className={styles.preview}>
                  {stripTags(row.content).slice(0, 80)}
                </p>
                <div className={styles.meta}>
                  <span>{row.creator_name || labels.system}</span>
                  <span>{format(row.published_at)}</span>
                  <span>
                    <Eye size={11} style={{ marginRight: 4 }} />
                    {row.read_percent ?? 0}% ({row.read_count ?? 0}/
                    {row.total_users ?? 1})
                  </span>
                </div>
              </div>
            );
          })}
        </Space>
      )}

      {total > limit ? (
        <Pagination
          current={page}
          pageSize={limit}
          total={total}
          onChange={setPage}
          size="small"
          style={{ alignSelf: "center" }}
        />
      ) : null}

      <Modal
        open={Boolean(detail)}
        title={detail?.title}
        footer={null}
        onCancel={() => setDetail(null)}
        width={720}
      >
        {detail ? (
          <div>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={TYPE_COLOR[detail.type] || "blue"}>
                {typeLabel(detail.type, locale)}
              </Tag>
              <span>
                {labels.publisher}: {detail.creator_name || labels.system}
              </span>
              <span>
                {labels.published}: {format(detail.published_at)}
              </span>
              {detail.expires_at ? (
                <span>
                  {labels.expires}: {format(detail.expires_at)}
                </span>
              ) : null}
            </Space>
            <div className={styles.detailBody}>{detail.content}</div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={showForm}
        title={editId ? labels.edit : labels.publish}
        onCancel={() => setShowForm(false)}
        onOk={() => void submitForm()}
        okText={editId ? labels.save : labels.publish}
        okButtonProps={{ "data-testid": "org-announcement-submit" }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldTitle}
            </Typography.Text>
            <Input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              data-testid="org-announcement-title"
            />
          </div>
          <div>
            <Typography.Text type="secondary">
              {labels.fieldContent}
            </Typography.Text>
            <Input.TextArea
              rows={6}
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
              data-testid="org-announcement-content"
            />
          </div>
          <Space wrap>
            <Select
              value={form.type}
              style={{ width: 140 }}
              onChange={(value) => setForm({ ...form, type: value })}
              options={[
                { value: "notice", label: labels.notice },
                { value: "policy", label: labels.policy },
                { value: "news", label: labels.news },
                { value: "emergency", label: labels.emergency },
              ]}
            />
            <Select
              value={form.priority}
              style={{ width: 140 }}
              onChange={(value) => setForm({ ...form, priority: value })}
              options={[
                { value: "low", label: labels.priorityLow },
                { value: "normal", label: labels.priorityNormal },
                { value: "important", label: labels.priorityImportant },
                { value: "urgent", label: labels.urgent },
              ]}
            />
            <Checkbox
              checked={form.is_pinned}
              onChange={(event) =>
                setForm({ ...form, is_pinned: event.target.checked })
              }
            >
              {labels.pin}
            </Checkbox>
          </Space>
          <div>
            <Typography.Text type="secondary">
              {labels.expiresAt}
            </Typography.Text>
            <Input
              type="datetime-local"
              value={form.expires_at ? form.expires_at.slice(0, 16) : ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  expires_at: event.target.value
                    ? `${event.target.value}:00`
                    : "",
                })
              }
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}

export default AnnouncementPage;
