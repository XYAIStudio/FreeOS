import { useCallback, useEffect, useState } from "react";
import { Button, Input, Switch, Tag, Typography } from "antd";
import { ExternalLink, Settings } from "lucide-react";
import type {
  OrgCapability,
  OrgPrefs,
  OrgSettingsClient,
  OrgSettingsSnapshot,
  OrgSystemSettingsLinks,
} from "../../api/createClient";
import type { OrgLocale, OrgSession } from "../../shell";
import { settingsLabels } from "./labels";
import styles from "./SettingsPage.module.css";

export interface SettingsPageProps {
  client: OrgSettingsClient;
  session: OrgSession;
  locale: OrgLocale;
  /** Present so export App.tsx can pass SHARED_ORG_UI_MODULES without unused props. */
  modules?: readonly string[];
  workbenchHref?: string;
}

const EMPTY_PREFS: OrgPrefs = { name: "", description: "" };
const EMPTY_LINKS: OrgSystemSettingsLinks = {
  overview: "/system-settings",
  models: "/system-settings/models",
  users: "/system-settings/users",
};

export function SettingsPage({
  client,
  session,
  locale,
  workbenchHref = "/organization",
}: SettingsPageProps) {
  const labels = settingsLabels(locale);
  const [catalog, setCatalog] = useState<OrgCapability[]>([]);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [prefs, setPrefs] = useState<OrgPrefs>(EMPTY_PREFS);
  const [links, setLinks] = useState<OrgSystemSettingsLinks>(EMPTY_LINKS);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [toggling, setToggling] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const applySnapshot = (snap: OrgSettingsSnapshot) => {
    setCatalog(snap.catalog);
    setToggles(snap.modules);
    setPrefs(snap.prefs);
    if (snap.system_settings) setLinks(snap.system_settings);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      applySnapshot(await client.snapshot());
    } catch {
      setCatalog([]);
      setToggles({});
      setPrefs(EMPTY_PREFS);
      setError(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [client, labels.loadFailed]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const savePrefs = async () => {
    if (!session.isAdmin) return;
    setSavingPrefs(true);
    setError("");
    setMessage("");
    try {
      const saved = await client.savePrefs({
        name: prefs.name,
        description: prefs.description,
      });
      setPrefs(saved);
      setMessage(labels.saved);
    } catch {
      setError(labels.saveFailed);
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleModule = async (key: string, enabled: boolean) => {
    if (!session.isAdmin) return;
    const previous = toggles;
    setToggles({ ...toggles, [key]: enabled });
    setToggling(key);
    setError("");
    try {
      const saved = await client.saveModules({ [key]: enabled });
      setToggles(saved);
    } catch {
      setToggles(previous);
      setError(labels.saveFailed);
    } finally {
      setToggling("");
    }
  };

  const capLabel = (row: OrgCapability) =>
    locale === "zh" ? row.label_zh || row.label : row.label;
  const capDesc = (row: OrgCapability) =>
    locale === "zh" ? row.description_zh || row.description : row.description;

  if (loading) {
    return (
      <div className={styles.page} data-testid="org-ui-settings">
        <div className={styles.empty}>{labels.loading}</div>
      </div>
    );
  }

  return (
    <div className={styles.page} data-testid="org-ui-settings">
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <Settings size={20} />
            <Typography.Title level={3} className={styles.title}>
              {labels.title}
            </Typography.Title>
          </div>
          <p className={styles.subtitle}>{labels.subtitle}</p>
        </div>
        {workbenchHref ? (
          <Button href={workbenchHref} data-testid="org-settings-workbench">
            {labels.openWorkbench}
          </Button>
        ) : null}
      </div>

      <section className={styles.callout} data-testid="org-settings-boundary">
        <p className={styles.calloutTitle}>{labels.notHereTitle}</p>
        <p className={styles.hint}>{labels.notHereBody}</p>
        <p className={styles.hint}>{labels.hostHint}</p>
        <div className={styles.links}>
          <Button
            href={links.overview}
            icon={<ExternalLink size={14} />}
            data-testid="org-settings-system"
          >
            {labels.openSystem}
          </Button>
          <Button href={links.models} data-testid="org-settings-models">
            {labels.openModels}
          </Button>
          <Button href={links.users} data-testid="org-settings-users">
            {labels.openUsers}
          </Button>
        </div>
      </section>

      {error ? (
        <p className={styles.error} data-testid="org-settings-error">
          {error}
        </p>
      ) : null}

      <section className={styles.card} data-testid="org-settings-prefs">
        <h2 className={styles.cardTitle}>{labels.profileTitle}</h2>
        <p className={styles.hint}>{labels.profileHint}</p>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{labels.name}</span>
          <Input
            value={prefs.name}
            placeholder={labels.namePlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) =>
              setPrefs((prev) => ({ ...prev, name: event.target.value }))
            }
            data-testid="org-settings-name"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{labels.description}</span>
          <Input.TextArea
            rows={3}
            value={prefs.description}
            placeholder={labels.descriptionPlaceholder}
            disabled={!session.isAdmin}
            onChange={(event) =>
              setPrefs((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            data-testid="org-settings-description"
          />
        </label>
        <div className={styles.actions}>
          <Button
            type="primary"
            onClick={() => void savePrefs()}
            disabled={!session.isAdmin || savingPrefs}
            data-testid="org-settings-save-prefs"
          >
            {savingPrefs ? labels.saving : labels.savePrefs}
          </Button>
          {message ? <span className={styles.status}>{message}</span> : null}
          {!session.isAdmin ? (
            <span className={styles.status}>{labels.readOnly}</span>
          ) : null}
        </div>
      </section>

      <section className={styles.card} data-testid="org-settings-modules">
        <h2 className={styles.cardTitle}>{labels.modulesTitle}</h2>
        <p className={styles.hint}>{labels.modulesHint}</p>
        <p className={styles.hint}>{labels.deliveryHint}</p>
        <div className={styles.moduleList}>
          {catalog.map((row) => {
            const on = toggles[row.key] !== false;
            const hostPage =
              row.delivery !== "managed_node_iframe" && Boolean(row.host_path);
            return (
              <div
                key={row.key}
                className={styles.moduleRow}
                data-testid={`org-settings-module-${row.key}`}
              >
                <div className={styles.moduleMeta}>
                  <div className={styles.moduleName}>{capLabel(row)}</div>
                  <div className={styles.moduleDesc}>{capDesc(row)}</div>
                  <div className={styles.moduleTags}>
                    <Tag data-testid={`org-settings-delivery-${row.key}`}>
                      {hostPage ? labels.deliveryHost : labels.deliveryIframe}
                    </Tag>
                    {row.host_path ? (
                      <span className={styles.modulePath}>{row.host_path}</span>
                    ) : null}
                  </div>
                </div>
                {row.locked ? (
                  <Tag>{labels.locked}</Tag>
                ) : (
                  <Switch
                    checked={on}
                    disabled={!session.isAdmin || toggling === row.key}
                    onChange={(enabled) => void toggleModule(row.key, enabled)}
                    checkedChildren={labels.enabled}
                    unCheckedChildren={labels.disabled}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
