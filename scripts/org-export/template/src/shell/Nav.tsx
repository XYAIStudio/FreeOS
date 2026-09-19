import { Button } from "antd";
import { NavLink } from "react-router-dom";
import type { LocalJwtBridge } from "org-ui";
import styles from "./Nav.module.css";

const LINKS: { to: string; en: string; zh: string }[] = [
  { to: "/app", en: "Workspace", zh: "工作台" },
  { to: "/announcements", en: "Announcements", zh: "公告" },
  { to: "/org", en: "Org", zh: "架构" },
  { to: "/employees", en: "Employees", zh: "员工" },
  { to: "/skills", en: "Skills", zh: "技能" },
  { to: "/agents", en: "Agents", zh: "智能体" },
  { to: "/tasks", en: "Tasks", zh: "任务" },
  { to: "/knowledge", en: "Knowledge", zh: "知识" },
  { to: "/reflections", en: "Reflections", zh: "反思" },
  { to: "/governance", en: "Governance", zh: "治理" },
  { to: "/settings", en: "Settings", zh: "设置" },
];

export function StandaloneNav(props: {
  bridge: LocalJwtBridge;
  locale: "zh" | "en";
  onSignOut: () => void;
}) {
  const session = props.bridge.getSession();
  const zh = props.locale === "zh";
  return (
    <header className={styles.bar} data-testid="standalone-nav">
      <strong className={styles.brand}>openXYOS</strong>
      <nav className={styles.links}>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            {zh ? link.zh : link.en}
          </NavLink>
        ))}
      </nav>
      <div className={styles.user}>
        <span>{session.displayName || session.role}</span>
        <Button size="small" onClick={props.onSignOut}>
          {zh ? "退出" : "Sign out"}
        </Button>
      </div>
    </header>
  );
}
