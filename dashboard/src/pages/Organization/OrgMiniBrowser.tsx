import { useMemo, type MutableRefObject } from "react";
import { Button, Input, Tooltip } from "antd";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChromeTabBar } from "../../components/ChromeTabBar";
import {
  buildEmbedSrc,
  canGoBack,
  canGoForward,
  iframeSandboxFor,
  type OrgBrowserTab,
} from "./orgBrowser";
import { shouldLoadSidecarFrame } from "./sidecarLivez";
import styles from "./Organization.module.less";

type OrgMiniBrowserProps = {
  tabs: OrgBrowserTab[];
  activeId: string;
  addressValue: string;
  sidecarOrigin: string;
  disabledKeys: string[];
  previewNonce: string;
  sidecarUp: boolean;
  livezOk: boolean;
  previewBlank: boolean;
  recoverPhase: "hidden" | "opening" | "needsRestart";
  iframeRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
  onAddressChange: (value: string) => void;
  onAddressSubmit: () => void;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
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
  livezOk,
  previewBlank,
  recoverPhase,
  iframeRefs,
  onAddressChange,
  onAddressSubmit,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onBack,
  onForward,
  onReload,
  onFrameLoad,
}: OrgMiniBrowserProps) {
  const { t } = useTranslation();
  const activeTab = tabs.find((tab) => tab.id === activeId);
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
        <Tooltip title={t("organization.browserBack")}>
          <Button
            data-testid="org-browser-back"
            aria-label={t("organization.browserBack")}
            icon={<ArrowLeft size={14} />}
            disabled={!canGoBack(activeTab)}
            onClick={onBack}
          />
        </Tooltip>
        <Tooltip title={t("organization.browserForward")}>
          <Button
            data-testid="org-browser-forward"
            aria-label={t("organization.browserForward")}
            icon={<ArrowRight size={14} />}
            disabled={!canGoForward(activeTab)}
            onClick={onForward}
          />
        </Tooltip>
        <Tooltip title={t("organization.browserReload")}>
          <Button
            data-testid="org-browser-reload"
            aria-label={t("organization.browserReload")}
            icon={<RotateCcw size={14} />}
            onClick={onReload}
          />
        </Tooltip>
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
        {recoverPhase === "opening" && (
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
          const allowFrame = shouldLoadSidecarFrame({
            url: tab.srcUrl,
            sidecarOrigin,
            livezOk: livezOk && sidecarUp,
          });
          const src = allowFrame
            ? buildEmbedSrc(tab.srcUrl, {
                sidecarOrigin,
                disabledKeys,
                nonce: previewNonce,
              })
            : "about:blank";
          const active = tab.id === activeId;
          return (
            <iframe
              key={`${tab.id}-${tab.reloadSeq ?? 0}`}
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
              sandbox={
                allowFrame
                  ? iframeSandboxFor(src, sidecarOrigin)
                  : "allow-same-origin"
              }
              allow="clipboard-read; clipboard-write"
              onLoad={onFrameLoad}
            />
          );
        })}
      </div>
    </div>
  );
}
