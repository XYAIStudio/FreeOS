import { Button, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import styles from "./HostDeepLinkPage.module.css";

const COPY: Record<
  string,
  { title: { zh: string; en: string }; body: { zh: string; en: string } }
> = {
  chat: {
    title: { zh: "沟通协作未迁入独立站", en: "Chat is not in this package" },
    body: {
      zh: "对话运行时留在 FreeOS / Octop。请打开宿主 Dashboard 的 /chat，不要在独立站里找第二套 Chat。",
      en: "Conversation stays on FreeOS / Octop. Open /chat on the host Dashboard — this export does not ship a second chat runtime.",
    },
  },
  experts: {
    title: { zh: "专家目录在宿主", en: "Experts live on the host" },
    body: {
      zh: "注册后的数字同事出现在 FreeOS Experts。独立站只编译 / 流转同事，不编辑宿主智能体。",
      en: "Spawned colleagues appear on FreeOS Experts. This site only compiles / transitions colleagues.",
    },
  },
  personalization: {
    title: { zh: "个性化编辑器在宿主", en: "Personalization stays on the host" },
    body: {
      zh: "FreeOS 个性化智能体编辑器不在本导出包内。",
      en: "The FreeOS personalization editor is not part of this export.",
    },
  },
  "system-settings": {
    title: { zh: "系统设置在宿主", en: "System settings stay on the host" },
    body: {
      zh: "大模型密钥、用户、时区仍在 FreeOS /system-settings。本站设置页只改组织模块开关与本地偏好。",
      en: "LLM keys, users, and timezone stay on FreeOS /system-settings. This site only edits org-module toggles and prefs.",
    },
  },
};

export function HostDeepLinkPage(props: {
  kind: keyof typeof COPY;
  locale: "zh" | "en";
}) {
  const navigate = useNavigate();
  const copy = COPY[props.kind];
  const locale = props.locale;
  return (
    <div className={styles.page} data-testid={`standalone-deeplink-${props.kind}`}>
      <Typography.Title level={3}>{copy.title[locale]}</Typography.Title>
      <p className={styles.body}>{copy.body[locale]}</p>
      <Button type="primary" onClick={() => navigate("/app")}>
        {locale === "zh" ? "返回工作台" : "Back to workspace"}
      </Button>
    </div>
  );
}
