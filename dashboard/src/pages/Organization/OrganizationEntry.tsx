import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Spin } from "antd";
import { orgModuleApi } from "../../api/modules/orgModule";

const OPENXYOS_EMBED = "/organization-app/dashboard?freeos_embed=1";

/**
 * Organization nav opens the integrated openXYOS app (same-origin embed).
 * Host-native slices stay at /organization/workspace and siblings.
 * The old assemble/pack workbench UI is deleted from the dashboard bundle.
 * First-run still lands on /chat/main — only this nav entry changed.
 */
export default function OrganizationEntry() {
  const [integrated, setIntegrated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void orgModuleApi
      .identityStatus()
      .then((status) => {
        if (active) setIntegrated(Boolean(status.integrated));
      })
      .catch(() => {
        if (active) setIntegrated(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (integrated === true) {
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
  if (integrated === false) {
    return <Navigate to="/organization/workspace" replace />;
  }
  return (
    <div
      className="h-full grid place-items-center"
      data-testid="org-entry-loading"
    >
      <Spin />
    </div>
  );
}
