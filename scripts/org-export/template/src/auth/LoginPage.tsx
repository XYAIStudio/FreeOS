import { useState } from "react";
import { Button, Form, Input, Typography } from "antd";
import {
  createLocalJwtBridge,
  sessionFromLoginUser,
  type LocalJwtBridge,
} from "org-ui";
import styles from "./LoginPage.module.css";

export function LoginPage(props: {
  bridge: LocalJwtBridge;
  locale: "zh" | "en";
  onSignedIn: () => void;
}) {
  const zh = props.locale === "zh";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (values: { username: string; password: string }) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${props.bridge.apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => ({}))) as {
        access_token?: string;
        user?: {
          id?: number;
          username?: string;
          display_name?: string;
          role?: string;
        };
        message?: string;
        error?: string;
      };
      if (!response.ok || !body.access_token) {
        throw new Error(
          body.message ||
            body.error ||
            (zh ? "登录失败" : "Sign-in failed"),
        );
      }
      props.bridge.setSession(
        body.access_token,
        sessionFromLoginUser(body.user || { username: values.username }),
      );
      props.onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.page} data-testid="standalone-login">
      <div className={styles.card}>
        <Typography.Title level={3} className={styles.title}>
          openXYOS
        </Typography.Title>
        <p className={styles.hint}>
          {zh
            ? "独立站使用本地 JWT（openxyos.standalone.jwt），不是 Dashboard 嵌入会话。"
            : "Standalone local JWT (openxyos.standalone.jwt), not the embedded Dashboard session."}
        </p>
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            name="username"
            label={zh ? "用户名" : "Username"}
            rules={[{ required: true }]}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label={zh ? "密码" : "Password"}
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {error ? <p className={styles.error}>{error}</p> : null}
          <Button type="primary" htmlType="submit" loading={pending} block>
            {zh ? "登录" : "Sign in"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
