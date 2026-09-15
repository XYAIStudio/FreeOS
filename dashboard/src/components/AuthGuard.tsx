import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { clearAuthToken, getAuthToken, setAuthToken } from "../api/request";
import { authApi, type OctopUser } from "../api/modules/auth";
import { applyUserLocale } from "../utils/locale";
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
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<OctopUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const adopt = async (me: OctopUser) => {
      await applyUserLocale(me.locale);
      if (!cancelled) {
        setUser(me);
        setAuthed(true);
        setChecking(false);
      }
    };

    const tryLocalSession = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const res = await authApi.localSession();
          setAuthToken(res.access_token);
          await adopt(res.user);
          return true;
        } catch {
          if (attempt < 3) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 150);
            });
          }
        }
      }
      return false;
    };

    const check = async () => {
      try {
        const status = await authApi.getAuthStatus();

        if (status.setup_required) {
          if (await tryLocalSession()) return;
          clearAuthToken();
          if (!cancelled) navigate("/setup", { replace: true });
          return;
        }

        const token = getAuthToken();
        if (!token) {
          if (await tryLocalSession()) return;
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
          if (await tryLocalSession()) return;
          if (!cancelled) {
            setAuthed(false);
            navigate("/login", { replace: true });
          }
        }
      } catch {
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
  }, [navigate]);

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
