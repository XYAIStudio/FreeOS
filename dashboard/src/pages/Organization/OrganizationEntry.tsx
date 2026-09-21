import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Spin } from "antd";
import { orgModuleApi } from "../../api/modules/orgModule";
import { isDesktopShell } from "../../utils/desktopShell";
import OrgRestartOverlay from "./OrgRestartOverlay";
import {
  shouldEmbedOpenXYOS,
  shouldFallbackToHostWorkspace,
} from "./orgLanding";
import { sidecarPreviewGate } from "./sidecarLivez";

const OPENXYOS_EMBED = "/organization-app/dashboard?freeos_embed=1";

/**
 * Organization nav opens the integrated openXYOS module (same-origin embed).
 * FreeOS desktop always takes this path: missing Node is a recover overlay,
 * not a Navigate to the host org-ui workspace.
 * Non-desktop studio without FREEOS_ORG_INTEGRATED still falls back to
 * /organization/workspace.
 * First-run still lands on /chat/main — only this nav entry changed.
 */
export default function OrganizationEntry() {
  const desktop = isDesktopShell();
  const [integrated, setIntegrated] = useState<boolean | null>(
    desktop ? true : null,
  );
  const [livezOk, setLivezOk] = useState(false);
  const [probed, setProbed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    let active = true;
    void orgModuleApi
      .identityStatus()
      .then((status) => {
        if (active) setIntegrated(Boolean(status.integrated) || desktop);
      })
      .catch(() => {
        if (active && !desktop) setIntegrated(false);
      });
    return () => {
      active = false;
    };
  }, [desktop]);

  const embed = shouldEmbedOpenXYOS({ desktop, integrated });
  const fallback = shouldFallbackToHostWorkspace({ desktop, integrated });

  useEffect(() => {
    if (!embed) return;
    let active = true;
    void orgModuleApi
      .probeLivez()
      .then((result) => {
        if (active) setLivezOk(Boolean(result.reachable));
      })
      .catch(() => {
        if (active) setLivezOk(false);
      })
      .finally(() => {
        if (active) setProbed(true);
      });
    return () => {
      active = false;
    };
  }, [embed]);

  useEffect(() => {
    if (!embed || !probed || livezOk || autoTried) return;
    setAutoTried(true);
    setRestarting(true);
    let active = true;
    void orgModuleApi
      .startSidecar()
      .then(() => orgModuleApi.probeLivez())
      .then((result) => {
        if (active) setLivezOk(Boolean(result.reachable));
      })
      .catch(() => {
        if (active) setLivezOk(false);
      })
      .finally(() => {
        if (active) setRestarting(false);
      });
    return () => {
      active = false;
    };
  }, [embed, probed, livezOk, autoTried]);

  const onRestart = () => {
    setRestarting(true);
    void orgModuleApi
      .restartSidecar()
      .then(() => orgModuleApi.probeLivez())
      .then((result) => setLivezOk(Boolean(result.reachable)))
      .catch(() => setLivezOk(false))
      .finally(() => setRestarting(false));
  };

  if (fallback) {
    return <Navigate to="/organization/workspace" replace />;
  }
  if (!embed || !probed) {
    return (
      <div
        className="h-full grid place-items-center"
        data-testid="org-entry-loading"
      >
        <Spin />
      </div>
    );
  }

  const gate = sidecarPreviewGate({ livezOk, restarting });
  if (gate !== "open") {
    return (
      <OrgRestartOverlay
        mode={gate === "restarting" ? "restarting" : "needsRestart"}
        onRestart={onRestart}
      />
    );
  }

  return (
    <div
      style={{ width: "100%", height: "100%", minHeight: 0 }}
      data-testid="org-openxyos-embed"
    >
      <iframe
        title="openXYOS"
        src={OPENXYOS_EMBED}
        data-testid="org-openxyos-frame"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  );
}
