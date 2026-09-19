import type { OrgLocale } from "../../shell";

const EN = {
  title: "Announcements",
  unread: "unread",
  markAllRead: "Mark all read",
  publish: "Publish announcement",
  edit: "Edit announcement",
  all: "All",
  notice: "Notice",
  policy: "Policy",
  news: "News",
  emergency: "Emergency",
  search: "Search announcements...",
  loading: "Loading...",
  empty: "No announcements",
  urgent: "Urgent",
  expired: "Expired",
  system: "System",
  publisher: "Publisher",
  published: "Published",
  expires: "Expires",
  read: "read",
  fieldTitle: "Title",
  fieldContent: "Content",
  fieldType: "Type",
  fieldPriority: "Priority",
  pin: "Pin",
  unpin: "Unpin",
  expiresAt: "Expires",
  save: "Save changes",
  priorityLow: "Low",
  priorityNormal: "Normal",
  priorityImportant: "Important",
  required: "Title and content are required",
  confirmDelete: "Delete this announcement?",
  editShort: "Edit",
  deleteShort: "Delete",
};

const ZH: typeof EN = {
  title: "通知公告",
  unread: "条未读",
  markAllRead: "全部已读",
  publish: "发布公告",
  edit: "编辑公告",
  all: "全部",
  notice: "通知",
  policy: "制度",
  news: "新闻",
  emergency: "紧急",
  search: "搜索公告...",
  loading: "加载中...",
  empty: "暂无公告",
  urgent: "紧急",
  expired: "已过期",
  system: "系统",
  publisher: "发布者",
  published: "发布时间",
  expires: "有效期至",
  read: "已读",
  fieldTitle: "标题",
  fieldContent: "内容",
  fieldType: "类型",
  fieldPriority: "优先级",
  pin: "置顶",
  unpin: "取消置顶",
  expiresAt: "有效期至",
  save: "保存修改",
  priorityLow: "低",
  priorityNormal: "普通",
  priorityImportant: "重要",
  required: "标题和内容不能为空",
  confirmDelete: "确定删除该公告？",
  editShort: "编辑",
  deleteShort: "删除",
};

export type AnnouncementLabels = typeof EN;

export function announcementLabels(locale: OrgLocale): AnnouncementLabels {
  return locale === "zh" ? ZH : EN;
}

export function typeLabel(type: string, locale: OrgLocale): string {
  const labels = announcementLabels(locale);
  if (type === "policy") return labels.policy;
  if (type === "news") return labels.news;
  if (type === "emergency") return labels.emergency;
  return labels.notice;
}
