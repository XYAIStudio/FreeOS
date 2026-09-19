import { useEffect, useState } from "react";
import { Spin } from "antd";
import { orgModuleApi } from "../../api/modules/orgModule";
import OrganizationPage from "./index";

/**
 * The integrated product has one complete organization application under the
 * same FreeOS origin.  Keep the old workbench only for legacy installations
 * that have not enabled that runtime.
 */
export default function OrganizationEntry() {
  const [integrated, setIntegrated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void orgModuleApi
      .identityStatus()
      .then((status) => {
        if (!active) return;
        setIntegrated(status.integrated);
      })
      .catch(() => {
        if (active) setIntegrated(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (integrated === false) return <OrganizationPage />;
  if (integrated === true) {
    return (
      <iframe
        title="openXYOS Organization"
        src="/organization-app/dashboard?freeos_embed=1"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    );
  }
  return (
    <div className="h-full grid place-items-center">
      <Spin />
    </div>
  );
}
