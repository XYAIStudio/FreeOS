import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import type { LoginResponse, OctopUser } from "../api/modules/auth";
import AuthForm, { type AuthFormMode } from "../components/AuthForm";
import BrandMark from "../components/BrandMark";
import { useCurrentUser, useSetCurrentUser } from "../hooks/useCurrentUser";

type Resolver = (ok: boolean) => void;

interface AuthPromptContextValue {
  openAuthPrompt: () => Promise<boolean>;
}

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null);

export function userNeedsAccount(user: OctopUser | null | undefined): boolean {
  return Boolean(user?.is_local);
}

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const setUser = useSetCurrentUser();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthFormMode>("register");
  const resolverRef = useRef<Resolver | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const openAuthPrompt = useCallback(() => {
    if (!userNeedsAccount(user)) {
      return Promise.resolve(true);
    }
    setMode("register");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [user]);

  const onSuccess = (res: LoginResponse) => {
    setUser(res.user);
    settle(!res.user.is_local);
  };

  const value = useMemo(() => ({ openAuthPrompt }), [openAuthPrompt]);

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
      <Modal
        open={open}
        onCancel={() => settle(false)}
        footer={null}
        destroyOnHidden
        centered
        width={400}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: "8px 4px 4px",
          }}
        >
          <BrandMark height={40} />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--fn-text-primary)",
              }}
            >
              {mode === "register"
                ? t("login.accountRequiredTitle")
                : t("login.title")}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "var(--fn-text-tertiary)",
              }}
            >
              {mode === "register"
                ? t("login.accountRequiredBody")
                : t("login.subtitle")}
            </div>
          </div>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <AuthForm
              mode={mode}
              onModeChange={setMode}
              onSuccess={onSuccess}
            />
          </div>
        </div>
      </Modal>
    </AuthPromptContext.Provider>
  );
}

export function useAuthPrompt(): AuthPromptContextValue {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) {
    return {
      openAuthPrompt: async () => true,
    };
  }
  return ctx;
}

export function useRequireAccount(): () => Promise<boolean> {
  const user = useCurrentUser();
  const { openAuthPrompt } = useAuthPrompt();
  return useCallback(async () => {
    if (!userNeedsAccount(user)) return true;
    return openAuthPrompt();
  }, [openAuthPrompt, user]);
}
