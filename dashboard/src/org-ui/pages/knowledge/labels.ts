import type { OrgLocale } from "../../shell";

const EN = {
  title: "Knowledge",
  subtitle:
    "Organization Knowledge lists the same FreeOS knowledge bases Chat and Agents retrieve from. It is not a second notes database and does not start a sidecar.",
  loading: "Loading knowledge…",
  refresh: "Refresh",
  search: "Search bases or documents…",
  basesTab: "Knowledge bases",
  docsTab: "Documents",
  bases: "Bases",
  documents: "Documents",
  shared: "Shared",
  owned: "Yours",
  emptyBases: "No host knowledge bases yet.",
  emptyBasesHint:
    "Create a base here, or open Knowledge Bases to mount a folder. Agents retrieve these same rows — there is no org-only knowledge table.",
  emptyDocs: "No documents in this knowledge base.",
  emptyDocsHint:
    "Add a markdown note here, or upload files on the host Knowledge Bases page.",
  selectBase: "Select a knowledge base to see its documents.",
  adminOnly:
    "Creating bases and notes requires the knowledge-bases permission.",
  hostHint:
    "Upload, folders, embedding, and IMA mounts stay on host Knowledge Bases. This page only lists and adds notes.",
  openHost: "Open Knowledge Bases",
  createBase: "New knowledge base",
  createNote: "New note",
  detail: "Document",
  close: "Close",
  name: "Name",
  description: "Description",
  share: "Shared with the instance",
  noteTitle: "Title",
  noteContent: "Content",
  status: "Status",
  kind: "Kind",
  note: "Note",
  file: "File",
  size: "Size",
  disabled:
    "Knowledge bases are turned off for this instance. Turn them on in Foundation settings.",
  notUsable:
    "Knowledge bases are on, but embeddings are not ready. Configure a model on the host Knowledge Bases page before new notes can be indexed.",
  loadFailed: "Could not load knowledge bases",
  createBaseFailed: "Could not create this knowledge base",
  createNoteFailed: "Could not create this note",
  previewFailed: "Could not open this document",
  createBaseDone: "Created a host knowledge base.",
  createNoteDone: "Saved a markdown note in the host knowledge base.",
  confirmCreateBase:
    "Create a host knowledge base? Agents can retrieve it in chat.",
  confirmCreateNote:
    "Save this note as a markdown document in the selected host knowledge base?",
};

const ZH: typeof EN = {
  title: "知识",
  subtitle:
    "组织知识列出的是 Chat / 智能体检索用的同一套 FreeOS 知识库，不是第二套笔记库，也不启动边车。",
  loading: "加载知识…",
  refresh: "刷新",
  search: "搜索知识库或文档…",
  basesTab: "知识库",
  docsTab: "文档",
  bases: "知识库",
  documents: "文档",
  shared: "已共享",
  owned: "我的",
  emptyBases: "还没有宿主知识库。",
  emptyBasesHint:
    "可在此新建，或打开「知识库」挂载目录。智能体检索的就是这些行——没有单独的组织知识表。",
  emptyDocs: "该知识库还没有文档。",
  emptyDocsHint: "可在此添加 Markdown 笔记，或到宿主「知识库」页上传文件。",
  selectBase: "先选择一个知识库，再查看文档。",
  adminOnly: "新建知识库和笔记需要「知识库」权限。",
  hostHint:
    "上传、文件夹、向量模型和 IMA 挂载仍在宿主「知识库」页。本页只列出并添加笔记。",
  openHost: "打开知识库",
  createBase: "新建知识库",
  createNote: "新建笔记",
  detail: "文档",
  close: "关闭",
  name: "名称",
  description: "描述",
  share: "实例内共享",
  noteTitle: "标题",
  noteContent: "正文",
  status: "状态",
  kind: "类型",
  note: "笔记",
  file: "文件",
  size: "大小",
  disabled: "本实例已关闭知识库。请到基础设置中打开。",
  notUsable:
    "知识库已打开，但嵌入模型尚未就绪。请先在宿主「知识库」页配置模型，新笔记才能被索引。",
  loadFailed: "无法加载知识库",
  createBaseFailed: "无法创建该知识库",
  createNoteFailed: "无法创建该笔记",
  previewFailed: "无法打开该文档",
  createBaseDone: "已创建宿主知识库。",
  createNoteDone: "已将 Markdown 笔记写入宿主知识库。",
  confirmCreateBase: "创建宿主知识库？智能体可在对话中检索它。",
  confirmCreateNote: "把这篇笔记存为所选宿主知识库中的 Markdown 文档？",
};

export type KnowledgeLabels = typeof EN;

export function knowledgeLabels(locale: OrgLocale): KnowledgeLabels {
  return locale === "zh" ? ZH : EN;
}
