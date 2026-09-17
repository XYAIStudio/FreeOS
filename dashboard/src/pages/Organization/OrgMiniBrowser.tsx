import { useMemo, type MutableRefObject } from "react";
import { Button, Input } from "antd";
import { useTranslation } from "react-i18next";
import { ChromeTabBar } from "../../components/ChromeTabBar";
import {
  buildEmbedSrc,
  iframeSandboxFor,
  type OrgBrowserTab,
} from "./orgBrowser";
import styles from "./Organization.module.less";

type OrgMiniBrowserProps = {
  tabs: OrgBrowserTab[];
  activeId: string;
  addressValue: string;
  sidecarOrigin: string;
  disabledKeys: string[];
  previewNonce: string;
  sidecarUp: boolean;
  previewBlank: boolean;
  iframeRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
  onAddressChange: (value: string) => void;
  onAddressSubmit: () => void;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onFrameLoad: () => void;
};

export default function OrgMiniBrowser({
  tabs,
  activeId,
  addressValue,
  sidecarOrigin,
  disabledKeys,
  previewNonce,
  sidecarUp,
  previewBlank,
  iframeRefs,
  onAddressChange,
  onAddressSubmit,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onFrameLoad,
}: OrgMiniBrowserProps) {
  const { t } = useTranslation();
  const chromeTabs = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab.id,
        label: tab.title,
        tooltip: tab.url,
        closable: tabs.length > 1,
      })),
    [tabs],
  );

  return (
    <div className={styles.browserChrome} data-testid="org-mini-browser">
      <ChromeTabBar
        tabs={chromeTabs}
        activeKey={activeId}
        onChange={onSelectTab}
        onClose={(key, event) => {
          event.preventDefault();
          onCloseTab(key);
        }}
        onNewTab={onNewTab}
        newTabTitle={t("organization.browserNewTab")}
      />
      <form
        className={styles.addressBar}
        onSubmit={(event) => {
          event.preventDefault();
          onAddressSubmit();
        }}
      >
        <Input
          data-testid="org-address-bar"
          value={addressValue}
          onChange={(event) => onAddressChange(event.target.value)}
          placeholder={t("organization.addressPlaceholder")}
          aria-label={t("organization.addressPlaceholder")}
        />
        <Button htmlType="submit" data-testid="org-address-go">
          {t("organization.addressGo")}
        </Button>
      </form>
      <div className={styles.embedPane}>
        {!sidecarUp && (
          <div className={styles.previewOffline}>
            {t("organization.previewOffline")}
          </div>
        )}
        {previewBlank && (
          <div className={styles.previewBlank} data-testid="org-preview-blank">
            {t("organization.previewBlank")}
          </div>
        )}
        {tabs.map((tab) => {
          const src = buildEmbedSrc(tab.srcUrl, {
            sidecarOrigin,
            disabledKeys,
            nonce: previewNonce,
          });
          const active = tab.id === activeId;
          return (
            <iframe
              key={tab.id}
              ref={(node) => {
                iframeRefs.current[tab.id] = node;
              }}
              title={active ? t("organization.previewTitle") : `${tab.title}`}
              src={src}
              className={`${styles.embed} ${
                active ? "" : styles.embedInactive
              }`}
              data-testid="org-browser-frame"
              data-active={active ? "true" : "false"}
              data-tab-id={tab.id}
              sandbox={iframeSandboxFor(src, sidecarOrigin)}
              allow="clipboard-read; clipboard-write"
              onLoad={onFrameLoad}
            />
          );
        })}
      </div>
    </div>
  );
}
