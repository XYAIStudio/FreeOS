import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { message } from "@/utils/antdMessage";

import { useTranslation } from "react-i18next";
import { clearAuthToken, setAuthToken } from "../../api";
import {
  authApi,
  type LoginResponse,
  type OidcStatus,
} from "../../api/modules/auth";
import AuthForm, { type AuthFormMode } from "../../components/AuthForm";
import BrandMark from "../../components/BrandMark";
import { applyGuestLocale, applyUserLocale } from "../../utils/locale";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [oidc, setOidc] = useState<OidcStatus | null>(null);
  const [mode, setMode] = useState<AuthFormMode>("login");

  useEffect(() => {
    void applyGuestLocale();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const session = await authApi.localSession();
        setAuthToken(session.access_token);
        await applyUserLocale(session.user.locale);
        if (!cancelled) navigate("/chat", { replace: true });
        return;
      } catch {
        // Remote / multi-user installs still show the form.
      }
      try {
        const status = await authApi.getAuthStatus();
        if (cancelled) return;
        if (status.setup_required) {
          clearAuthToken();
          navigate("/setup", { replace: true });
          return;
        }
        const next = await authApi.getOidcStatus();
        if (!cancelled) setOidc(next);
      } catch {
        // Keep the login form when status probes fail.
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const code = searchParams.get("oidc_error");
    if (!code) return;
    message.error(
      t(`login.oidcError.${code}`, {
        defaultValue: t("login.oidcError.generic"),
      }),
    );
    navigate("/login", { replace: true });
  }, [navigate, searchParams, t]);

  const onSuccess = (_res: LoginResponse) => {
    navigate("/chat", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--fn-bg-layout)",
        transition: "background var(--fn-transition)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "48px 32px 40px",
          background: "var(--fn-bg-elevated)",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          border: "1px solid var(--fn-border-primary)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          margin: "0 16px",
        }}
      >
        <BrandMark height={48} />

        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--fn-text-primary)",
            margin: 0,
            textAlign: "center",
          }}
        >
          {mode === "register" ? t("login.registerTitle") : t("login.title")}
        </h2>

        <AuthForm
          mode={mode}
          onModeChange={setMode}
          onSuccess={onSuccess}
          oidc={oidc}
        />
      </div>
    </div>
  );
}
