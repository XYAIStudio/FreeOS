import { useState } from "react";
import { Input, Button } from "antd";
import { message } from "@/utils/antdMessage";
import { Lock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAuthToken, setAuthToken } from "../api";
import {
  authApi,
  type LoginResponse,
  type OidcStatus,
} from "../api/modules/auth";
import { apiErrorMessage } from "../utils/apiError";
import { refreshServerLabels } from "../i18n";
import { applyUserLocale } from "../utils/locale";
import {
  MIN_PASSWORD_LENGTH,
  passwordPolicyIssue,
} from "../utils/passwordPolicy";
import SlideCaptcha from "../pages/Login/SlideCaptcha";

export type AuthFormMode = "login" | "register";

interface AuthFormProps {
  mode: AuthFormMode;
  onModeChange?: (mode: AuthFormMode) => void;
  onSuccess: (res: LoginResponse) => void;
  oidc?: OidcStatus | null;
  allowRegister?: boolean;
}

export default function AuthForm({
  mode,
  onModeChange,
  onSuccess,
  oidc,
  allowRegister = true,
}: AuthFormProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [slideVerified, setSlideVerified] = useState(false);
  const [slideResetKey, setSlideResetKey] = useState(0);

  const resetSlide = () => {
    setSlideVerified(false);
    setSlideResetKey((k) => k + 1);
  };

  const onOidc = async () => {
    setOidcLoading(true);
    try {
      const { authorization_url } = await authApi.startOidc("/chat");
      window.location.href = authorization_url;
    } catch (err) {
      message.error(apiErrorMessage(err, t("login.oidcStartFailed"), t));
      setOidcLoading(false);
    }
  };

  const applySession = async (res: LoginResponse) => {
    setAuthToken(res.access_token);
    await applyUserLocale(res.user.locale);
    void refreshServerLabels(res.user.locale);
    onSuccess(res);
  };

  const handleSubmit = async () => {
    if (!username || !password || !slideVerified) return;
    if (mode === "register") {
      const issue = passwordPolicyIssue(password);
      if (issue) {
        message.error(
          issue === "too_short"
            ? t("account.passwordTooShort", { min: MIN_PASSWORD_LENGTH })
            : t("account.passwordTooWeak"),
        );
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "register" && !getAuthToken()) {
        const guest = await authApi.localSession();
        setAuthToken(guest.access_token);
      }
      const res =
        mode === "register"
          ? await authApi.register(username, password)
          : await authApi.login(username, password);
      await applySession(res);
    } catch (err) {
      message.error(
        apiErrorMessage(
          err,
          mode === "register" ? t("login.registerFailed") : t("login.failed"),
          t,
        ),
      );
      resetSlide();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Input
        prefix={
          <User size={16} style={{ color: "var(--fn-text-quaternary)" }} />
        }
        placeholder={t("login.username")}
        size="large"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
        style={{ borderRadius: 10 }}
      />
      <Input.Password
        prefix={
          <Lock size={16} style={{ color: "var(--fn-text-quaternary)" }} />
        }
        placeholder={t("login.password")}
        size="large"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onPressEnter={() => void handleSubmit()}
        style={{ borderRadius: 10 }}
      />
      <SlideCaptcha
        hint={t("login.slideHint")}
        verifiedLabel={t("login.slideVerified")}
        onVerified={() => setSlideVerified(true)}
        resetKey={slideResetKey}
      />
      <Button
        type="primary"
        size="large"
        block
        loading={loading}
        onClick={() => void handleSubmit()}
        disabled={!username || !password || !slideVerified}
        style={{ borderRadius: 10, height: 44, fontWeight: 500 }}
      >
        {mode === "register" ? t("login.registerSubmit") : t("login.submit")}
      </Button>
      {allowRegister && onModeChange ? (
        <Button
          type="link"
          block
          onClick={() => onModeChange(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? t("login.switchToRegister")
            : t("login.switchToLogin")}
        </Button>
      ) : null}
      {oidc?.enabled && mode === "login" ? (
        <>
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--fn-text-tertiary)",
              fontSize: 13,
            }}
          >
            <span
              style={{
                flex: 1,
                height: 1,
                background: "var(--fn-border-primary)",
              }}
            />
            {t("login.or")}
            <span
              style={{
                flex: 1,
                height: 1,
                background: "var(--fn-border-primary)",
              }}
            />
          </div>
          <Button
            size="large"
            block
            loading={oidcLoading}
            onClick={() => void onOidc()}
            style={{ borderRadius: 10, height: 44, fontWeight: 500 }}
          >
            {t("login.oidcWith", { name: oidc.display_name })}
          </Button>
        </>
      ) : null}
    </>
  );
}
