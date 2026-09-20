import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Spin } from "antd";
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
import { desktopPostSessionPath } from "../../utils/desktopOnboarding";
import { isDesktopShell } from "../../utils/desktopShell";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [oidc, setOidc] = useState<OidcStatus | null>(null);
  const [mode, setMode] = useState<AuthFormMode>("login");
  const [roomOpen, setRoomOpen] = useState(false);
  const desktop = isDesktopShell(`?${searchParams.toString()}`);

  useEffect(() => {
    void applyGuestLocale();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const organization = await authApi.organizationIdentityStatus();
        if (!cancelled) setRoomOpen(Boolean(organization.integrated));
      } catch {
        // Continue with the studio door when the room is not open yet.
      }
      const attempts = desktop ? 20 : 4;
      const delayMs = desktop ? 250 : 150;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const session = await authApi.localSession();
          setAuthToken(session.access_token);
          await applyUserLocale(session.user.locale);
          if (!cancelled) {
            let hasProviders = false;
            let desktopFlow = desktop;
            try {
              const status = await authApi.getAuthStatus();
              hasProviders = status?.has_providers === true;
              desktopFlow = desktopFlow || status?.desktop === true;
            } catch {
              /* first-run still goes to model setup when the probe fails */
            }
            navigate(
              desktopFlow ? desktopPostSessionPath(hasProviders) : "/chat",
              { replace: true },
            );
          }
          return;
        } catch {
          if (cancelled) return;
          if (attempt < attempts - 1) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, delayMs);
            });
          }
        }
      }
      if (desktop) {
        while (!cancelled) {
          try {
            const session = await authApi.localSession();
            setAuthToken(session.access_token);
            await applyUserLocale(session.user.locale);
            if (!cancelled) {
              let hasProviders = false;
              try {
                const status = await authApi.getAuthStatus();
                hasProviders = status?.has_providers === true;
              } catch {
                /* stay on first-run setup */
              }
              navigate(desktopPostSessionPath(hasProviders), { replace: true });
            }
            return;
          } catch {
            if (cancelled) return;
            await new Promise((resolve) => {
              window.setTimeout(resolve, 400);
            });
          }
        }
        return;
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
  }, [desktop, navigate]);

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

  if (desktop) {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--fn-bg-layout)",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

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
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--fn-text-tertiary)",
            textAlign: "center",
          }}
        >
          {t("login.studioHint")}
        </p>

        <AuthForm
          mode={mode}
          onModeChange={setMode}
          onSuccess={onSuccess}
          oidc={oidc}
        />
        {roomOpen ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--fn-text-tertiary)",
              textAlign: "center",
            }}
          >
            {t("login.roomDoorHint")}{" "}
            <Link to="/organization">{t("login.roomDoorLink")}</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
