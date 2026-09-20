import { useEffect, useState } from "react";
import { Spin } from "antd";
import { useTranslation } from "react-i18next";
import { orgModuleApi } from "../../api/modules/orgModule";
import OrganizationPage from "./index";

/**
 * Studio nav stays in the dashboard shell. The integrated room is another
 * door in the same house — it keeps its own guestbook.
 */
export default function OrganizationEntry() {
  const { t } = useTranslation();
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
        }}
      >
        <p
          data-testid="org-room-door-hint"
          style={{
            margin: 0,
            padding: "10px 16px",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--fn-text-secondary)",
            background: "var(--fn-bg-elevated)",
            borderBottom: "1px solid var(--fn-border-primary)",
          }}
        >
          {t("organization.roomDoorHint")}
        </p>
        <iframe
          title={t("organization.roomFrameTitle")}
          src="/organization-app/dashboard?freeos_embed=1"
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
            flex: 1,
            minHeight: 0,
          }}
        />
      </div>
    );
  }
  return (
    <div className="h-full grid place-items-center">
      <Spin />
    </div>
  );
}
