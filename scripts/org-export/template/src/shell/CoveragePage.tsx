import { Typography } from "antd";
import manifest from "../modules.json";
import styles from "./CoveragePage.module.css";

type Omission = {
  id: string;
  in_full_tree: boolean;
  in_slice: boolean;
  title_en: string;
  title_zh: string;
  reason_en: string;
  reason_zh: string;
};

type AppRoute = {
  source_shell: string;
  route: string;
  component: string;
  catalog_key: string;
  kind: string;
  host_route: string;
  host_route_exists: boolean;
  in_slice: boolean;
  in_full_tree: boolean;
};

type Manifest = {
  mode: string;
  licenses: { openxyos_tree: string; host_bridge_slice: string };
  shared_org_ui_modules: string[];
  host_organization_routes: string[];
  openxyos_app_routes: AppRoute[];
  omissions: Omission[];
};

const data = manifest as Manifest;

export function CoveragePage(props: { locale: "zh" | "en" }) {
  const zh = props.locale === "zh";
  const appOnly = data.openxyos_app_routes.filter((row) => row.source_shell === "App.tsx");
  return (
    <div className={styles.page} data-testid="standalone-coverage">
      <Typography.Title level={3}>
        {zh ? "导出对照（相对桌面组织模块）" : "Export coverage vs desktop org modules"}
      </Typography.Title>
      <p className={styles.lead}>
        {zh
          ? `当前包模式 ${data.mode}。许可证：openXYOS 树 ${data.licenses.openxyos_tree}，宿主桥 slice ${data.licenses.host_bridge_slice}。`
          : `Pack mode ${data.mode}. Licenses: openXYOS tree ${data.licenses.openxyos_tree}, host-bridge slice ${data.licenses.host_bridge_slice}.`}
      </p>
      <Typography.Title level={4}>{zh ? "宿主 org-ui 切片" : "Host org-ui slices"}</Typography.Title>
      <ul className={styles.list}>
        {data.shared_org_ui_modules.map((key) => (
          <li key={key}>
            <code>{key}</code>
          </li>
        ))}
      </ul>
      <Typography.Title level={4}>{zh ? "桌面 /organization 路由" : "Desktop /organization routes"}</Typography.Title>
      <ul className={styles.list}>
        {data.host_organization_routes.map((route) => (
          <li key={route}>
            <code>{route}</code>
          </li>
        ))}
      </ul>
      <Typography.Title level={4}>{zh ? "App.tsx 模块" : "App.tsx modules"}</Typography.Title>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{zh ? "路由" : "Route"}</th>
              <th>{zh ? "组件" : "Component"}</th>
              <th>{zh ? "完整树" : "Full tree"}</th>
              <th>Slice</th>
              <th>{zh ? "宿主路由" : "Host route"}</th>
            </tr>
          </thead>
          <tbody>
            {appOnly.map((row) => (
              <tr key={`${row.source_shell}:${row.route}`}>
                <td>
                  <code>{row.route}</code>
                </td>
                <td>{row.component}</td>
                <td>{row.in_full_tree ? "yes" : "no"}</td>
                <td>{row.in_slice ? "yes" : "no"}</td>
                <td>
                  <code>{row.host_route}</code>
                  {row.host_route_exists ? "" : zh ? "（宿主未挂）" : " (not on host)"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Typography.Title level={4}>{zh ? "有意省略" : "Intentional omissions"}</Typography.Title>
      <ul className={styles.omissions}>
        {data.omissions.map((item) => (
          <li key={item.id}>
            <strong>{zh ? item.title_zh : item.title_en}</strong>
            <span className={styles.meta}>
              {zh ? "完整树" : "full"}: {item.in_full_tree ? "yes" : "no"} · slice:{" "}
              {item.in_slice ? "yes" : "no"}
            </span>
            <p>{zh ? item.reason_zh : item.reason_en}</p>
          </li>
        ))}
      </ul>
      <p className={styles.foot}>
        {zh ? "机器可读清单见 " : "Machine-readable manifest: "}
        <code>src/modules.json</code>
      </p>
    </div>
  );
}
