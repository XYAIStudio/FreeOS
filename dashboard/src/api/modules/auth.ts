import { clearSetupRequired, markSetupRequired, request } from "../request";
import type { OrganizationIdentityStatus } from "./orgModule";

/**
 * Auth + setup module — adapted to octop's multi-user backend.
 *
 * Octop endpoints (spec §11.3):
 *  - GET  /api/setup/status         → { setup_required }
 *  - POST /api/setup/initial-admin  → 201 { id, username, role }
 *  - POST /api/auth/login           → { access_token, token_type, expires_in, user }
 *  - POST /api/auth/logout          → 204
 *  - GET  /api/auth/me              → { id, username, role, display_name }
 *  - POST /api/auth/change-password → 204
 *
 * The shape exported below is intentionally a superset that keeps a few
 * legacy fields populated (``setup_done``, ``enabled``, ``has_password``)
 * so existing finnie-derived components compile until they're replaced
 * by the octop settings editors in phase 14.6.
 */

export interface AuthStatus {
  permission_mode_overrides?: boolean;
  /** True when no admin exists yet — UI must redirect to /setup. */
  setup_required: boolean;
  /** Legacy alias of ``!setup_required`` kept for compat. */
  setup_done: boolean;
  /** Octop always requires auth; kept true so legacy components don't unguard. */
  enabled: boolean;
  /** Legacy field — octop always uses passwords. */
  has_password: boolean;
  /** True when ~/.octop/octop-login.txt exists on the server (wizard-only). */
  wizard_password_exists: boolean;
  /** When false, the wizard skips the CLI bootstrap password step. */
  wizard_password_required: boolean;
  /** Absolute path to the one-time bootstrap password file on the server. */
  wizard_password_path?: string;
  /** True after `/setup/database` has bound the control-plane pool. */
  database_bound: boolean;
  /** Active control-plane driver when bound (`sqlite` | `postgresql`). */
  database_driver?: string | null;
  /** True when the host process is the Wails desktop / portable shell. */
  desktop?: boolean;
  /** True when at least one LLM provider is already configured. */
  has_providers?: boolean;
}

export interface OctopUser {
  id: number;
  username: string;
  role: "admin" | "user";
  display_name: string | null;
  locale: string;
  /** Module permission keys; admin responses include the full catalog. */
  permissions?: string[];
  /** True while the desktop/loopback guest has not registered. */
  is_local?: boolean;
  /** Organization-room role when this profile is a mapping; never host admin. */
  organization_role?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: OctopUser;
  /** Legacy alias for ``access_token`` so old callers using ``.token`` keep working. */
  token: string;
  /** True when the shared FreeOS/openXYOS organization account issued the token. */
  organization?: boolean;
  /** Original organization identity retained for the embedded openXYOS client. */
  organization_user?: OrganizationIdentityUser;
}

export interface OidcStatus {
  enabled: boolean;
  display_name: string;
}

export interface SetupBody {
  username: string;
  password: string;
  display_name?: string | null;
}

interface RawSetupStatus {
  permission_mode_overrides?: boolean;
  setup_required: boolean;
  wizard_password_required?: boolean;
  wizard_password_exists?: boolean;
  wizard_password_path?: string;
  database_bound?: boolean;
  database_driver?: string | null;
  desktop?: boolean;
  has_providers?: boolean;
}

interface RawLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: OctopUser;
}

export interface OrganizationIdentityUser {
  id: number;
  email: string;
  nickname?: string;
  role: string;
  tenant_id: number;
}

interface RawOrganizationSession {
  success: boolean;
  data: {
    user: OrganizationIdentityUser;
    tokens: { accessToken: string; expiresIn?: number };
  };
}

export const ORG_ROOM_TOKEN_KEY = "org_room_token";
export const ORG_ROOM_USER_KEY = "org_room_user";

function organizationSession(raw: RawOrganizationSession): LoginResponse {
  const token = raw.data.tokens.accessToken;
  const user = raw.data.user;
  return {
    access_token: token,
    token,
    token_type: "bearer",
    expires_in: raw.data.tokens.expiresIn ?? 3600,
    organization: true,
    organization_user: user,
    user: hostUserFromOrganization(user),
  };
}

/** Organization-room principal as a studio profile — always a host `user`. */
export function hostUserFromOrganization(
  user: OrganizationIdentityUser,
): OctopUser {
  return {
    id: user.id,
    username: user.email,
    role: "user",
    display_name: user.nickname || user.email,
    locale: "zh",
    permissions: [],
    organization_role: user.role,
  };
}

export function setOrgRoomSession(
  token: string,
  user: OrganizationIdentityUser,
): void {
  localStorage.setItem(ORG_ROOM_TOKEN_KEY, token);
  localStorage.setItem(ORG_ROOM_USER_KEY, JSON.stringify(user));
}

/** Coalesce AuthGuard / Login / Setup probing the same endpoint in parallel. */
let statusInFlight: Promise<AuthStatus> | null = null;

/** Drop any in-flight setup-status probe (e.g. after creating the admin). */
export function invalidateAuthStatusCache(): void {
  statusInFlight = null;
}

function applySetupFlags(status: AuthStatus): AuthStatus {
  if (status.setup_required) {
    markSetupRequired();
  } else {
    clearSetupRequired();
  }
  return status;
}

export const authApi = {
  organizationIdentityStatus: () =>
    request<OrganizationIdentityStatus>("/org-module/identity/status"),

  organizationLogin: async (
    email: string,
    password: string,
  ): Promise<LoginResponse> => {
    const raw = await request<RawOrganizationSession>(
      "/org-module/identity/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    return organizationSession(raw);
  },

  organizationRegister: async (
    email: string,
    password: string,
  ): Promise<LoginResponse> => {
    const raw = await request<RawOrganizationSession>(
      "/org-module/identity/register",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          nickname: email.split("@")[0],
          organization_name: email.split("@")[0],
        }),
      },
    );
    return organizationSession(raw);
  },

  /** Probe whether the initial admin has been created. */
  getAuthStatus: async (): Promise<AuthStatus> => {
    if (statusInFlight) return statusInFlight;

    statusInFlight = (async () => {
      try {
        const raw = await request<RawSetupStatus>("/setup/status");
        const value: AuthStatus = {
          setup_required: raw.setup_required,
          setup_done: !raw.setup_required,
          enabled: true,
          has_password: true,
          wizard_password_exists: raw.wizard_password_exists ?? false,
          wizard_password_required: raw.wizard_password_required ?? true,
          wizard_password_path: raw.wizard_password_path,
          database_bound: raw.database_bound ?? false,
          database_driver: raw.database_driver ?? null,
          desktop: raw.desktop ?? false,
          has_providers: raw.has_providers ?? false,
          permission_mode_overrides: raw.permission_mode_overrides,
        };
        return applySetupFlags(value);
      } finally {
        statusInFlight = null;
      }
    })();

    return statusInFlight;
  },

  /** Bootstrap the first admin (only succeeds while user_manager is empty). */
  createInitialAdmin: async (body: SetupBody) => {
    const result = await request<{
      id: number;
      username: string;
      role: string;
    }>("/setup/initial-admin", {
      method: "POST",
      body: JSON.stringify(body),
    });
    invalidateAuthStatusCache();
    clearSetupRequired();
    return result;
  },

  /** Login — octop uses username + password. */
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const raw = await request<RawLoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return { ...raw, token: raw.access_token };
  },

  /** Desktop / loopback guest or single-user JWT (no login form). */
  localSession: async (): Promise<LoginResponse> => {
    const raw = await request<RawLoginResponse>("/auth/local-session", {
      method: "POST",
    });
    return { ...raw, token: raw.access_token };
  },

  /** Claim the local guest session with a username and password. */
  register: async (
    username: string,
    password: string,
    displayName?: string | null,
  ): Promise<LoginResponse> => {
    const raw = await request<RawLoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        display_name: displayName ?? null,
      }),
    });
    return { ...raw, token: raw.access_token };
  },

  /** Return whether the configured OIDC provider can accept logins. */
  getOidcStatus: () => request<OidcStatus>("/auth/oidc/status"),

  /** Start an OIDC authorization-code login flow. */
  startOidc: (redirect_after?: string) =>
    request<{ authorization_url: string }>("/auth/oidc/start", {
      method: "POST",
      body: JSON.stringify({ redirect_after }),
    }),

  /** Exchange the one-time browser code for the standard JWT login response. */
  exchangeOidcCode: async (code: string): Promise<LoginResponse> => {
    const raw = await request<RawLoginResponse>("/auth/oidc/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    return { ...raw, token: raw.access_token };
  },

  /** Server-side logout (best-effort; client clears token regardless). */
  logout: () =>
    request<void>("/auth/logout", { method: "POST" }).catch(() => undefined),

  /** Get the current authenticated user. */
  me: () => request<OctopUser>("/auth/me"),

  /** Change current user's password. */
  changePassword: (oldPassword: string, newPassword: string) =>
    request<void>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    }),

  /** Update the current user's display name (PATCH /auth/me). */
  updateProfile: (displayName: string | null) =>
    request<OctopUser>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ display_name: displayName }),
    }),

  // --- Legacy stubs kept so finnie-era components compile ----------------
  // These call paths are removed in octop's data model; the actual
  // settings UI is rewritten in phase 14.6. Stubs return rejected
  // promises with a clear message to make accidental use loud.

  /** @deprecated Octop always requires auth — there is no first-time set step. */
  setPassword: (): Promise<never> =>
    Promise.reject(
      new Error("setPassword is not supported in octop; use change-password"),
    ),

  /** @deprecated Octop cannot disable auth. */
  disableAuth: (): Promise<never> =>
    Promise.reject(new Error("disableAuth is not supported in octop")),

  /** @deprecated Octop's setup wizard is single-step; nothing to mark done. */
  markSetupDone: (): Promise<{ ok: boolean }> => Promise.resolve({ ok: true }),
};
