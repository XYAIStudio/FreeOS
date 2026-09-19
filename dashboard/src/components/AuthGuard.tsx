import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spin } from "antd";
import { clearAuthToken, getAuthToken, setAuthToken } from "../api/request";
import { authApi, type OctopUser } from "../api/modules/auth";
import { applyUserLocale } from "../utils/locale";
import { desktopPostSessionPath } from "../utils/desktopOnboarding";
import { isDesktopShell } from "../utils/desktopShell";
import { CurrentUserProvider } from "../hooks/useCurrentUser";
import { AuthPromptProvider } from "../context/AuthPromptContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Gate protected routes on setup + a session. Desktop / loopback first
 * launch uses ``/auth/local-session`` so the login wall is skipped until
 * a later save needs a real account.
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const desktopQuery = params.toString();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<OctopUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    const desktop = isDesktopShell(desktopQuery ? `?${desktopQuery}` : "");

    const adopt = async (me: OctopUser) => {
      await applyUserLocale(me.locale);
      if (!cancelled) {
        setUser(me);
        setAuthed(true);
        setChecking(false);
      }
    };

    const enterAfterSession = async (me: OctopUser, hasProviders: boolean) => {
      if (desktop && desktopPostSessionPath(hasProviders) === "/setup") {
        if (!cancelled) navigate("/setup", { replace: true });
        return;
      }
      await adopt(me);
    };

    const adoptLocal = async (hasProviders = false): Promise<boolean> => {
      try {
        const res = await authApi.localSession();
        setAuthToken(res.access_token);
        await enterAfterSession(res.user, hasProviders);
        return true;
      } catch {
        return false;
      }
    };

    const tryLocalSession = async (
      attempts: number,
      delayMs: number,
      hasProviders = false,
    ) => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (await adoptLocal(hasProviders)) return true;
        if (attempt < attempts - 1) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, delayMs);
          });
        }
      }
      return false;
    };

    const holdForDesktop = async (hasProviders = false) => {
      while (!cancelled) {
        if (await adoptLocal(hasProviders)) return;
        await new Promise((resolve) => {
          window.setTimeout(resolve, 400);
        });
      }
    };

    const check = async () => {
      try {
        const organization = await authApi.organizationIdentityStatus();
        if (organization.integrated) {
          const organizationToken =
            getAuthToken() || localStorage.getItem("token") || "";
          if (!organizationToken) {
            if (!cancelled) navigate("/login", { replace: true });
            return;
          }
          setAuthToken(organizationToken);
          localStorage.setItem("token", organizationToken);
          try {
            const me = await authApi.me();
            await adopt(me);
          } catch {
            clearAuthToken();
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            if (!cancelled) navigate("/login", { replace: true });
          }
          return;
        }
        const status = await authApi.getAuthStatus();

        if (status.setup_required) {
          if (
            await tryLocalSession(
              desktop ? 20 : 4,
              desktop ? 250 : 150,
              status.has_providers === true,
            )
          )
            return;
          if (desktop) {
            await holdForDesktop(status.has_providers === true);
            return;
          }
          clearAuthToken();
          if (!cancelled) navigate("/setup", { replace: true });
          return;
        }

        if (
          desktop &&
          desktopPostSessionPath(status.has_providers === true) === "/setup"
        ) {
          if (await tryLocalSession(20, 250, status.has_providers === true))
            return;
          if (!cancelled) navigate("/setup", { replace: true });
          return;
        }

        const token = getAuthToken();
        if (!token) {
          if (
            await tryLocalSession(
              desktop ? 20 : 4,
              desktop ? 250 : 150,
              status.has_providers === true,
            )
          )
            return;
          if (desktop) {
            await holdForDesktop();
            return;
          }
          if (!cancelled) {
            setAuthed(false);
            navigate("/login", { replace: true });
          }
          return;
        }

        try {
          const me = await authApi.me();
          await adopt(me);
        } catch {
          if (await tryLocalSession(desktop ? 20 : 4, desktop ? 250 : 150))
            return;
          if (desktop) {
            await holdForDesktop();
            return;
          }
          if (!cancelled) {
            setAuthed(false);
            navigate("/login", { replace: true });
          }
        }
      } catch {
        if (desktop) {
          await holdForDesktop();
          return;
        }
        if (!cancelled) {
          setAuthed(true);
          setChecking(false);
        }
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [desktopQuery, navigate]);

  if (checking || !authed) {
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
    <CurrentUserProvider user={user} setUser={setUser}>
      <AuthPromptProvider>{children}</AuthPromptProvider>
    </CurrentUserProvider>
  );
}
