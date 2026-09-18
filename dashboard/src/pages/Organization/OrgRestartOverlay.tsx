import { useEffect, useState } from "react";
import { Button } from "antd";
import { useTranslation } from "react-i18next";
import { xyaiMascotSrc } from "../../assets/mascot";
import {
  SIDECAR_RESTART_STEPS,
  sidecarRestartSpeechKeys,
  sidecarRestartStepId,
  sidecarRestartStepIndex,
  sidecarRestartStepLabelKey,
} from "./sidecarRestart";
import styles from "./Organization.module.less";

type OrgRestartOverlayProps = {
  mode: "restarting" | "needsRestart";
  finished?: boolean;
  onRestart: () => void;
};

export default function OrgRestartOverlay({
  mode,
  finished = false,
  onRestart,
}: OrgRestartOverlayProps) {
  const { t } = useTranslation();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (mode !== "restarting") {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 200);
    return () => window.clearInterval(id);
  }, [mode]);

  const stepIndex = sidecarRestartStepIndex(elapsedMs, { finished });
  const stepId = sidecarRestartStepId(elapsedMs, { finished });
  const speech =
    mode === "needsRestart"
      ? {
          title: "organization.restartSpeech.needsRestartTitle",
          body: "organization.restartSpeech.needsRestartBody",
        }
      : sidecarRestartSpeechKeys(stepId);

  return (
    <div
      className={styles.restartOverlay}
      data-testid={
        mode === "restarting" ? "org-restart-overlay" : "org-sidecar-gate"
      }
      role="status"
      aria-live="polite"
      aria-busy={mode === "restarting"}
    >
      <div className={styles.restartCard}>
        <div className={styles.restartHero}>
          <img
            className={styles.restartMascot}
            src={xyaiMascotSrc("work")}
            alt=""
            aria-hidden
            draggable={false}
          />
          <div className={styles.restartSpeech}>
            <p className={styles.restartSpeechTitle}>{t(speech.title)}</p>
            <p className={styles.restartSpeechBody}>{t(speech.body)}</p>
            {mode === "restarting" ? (
              <p className={styles.restartSpeechWait}>
                {t("organization.restartWaitHint")}
              </p>
            ) : null}
          </div>
        </div>

        {mode === "restarting" ? (
          <>
            <div className={styles.restartSpinner} aria-hidden />
            <h2 className={styles.restartTitle}>
              {t("organization.restartOverlayTitle")}
            </h2>
            <ol className={styles.restartSteps}>
              {SIDECAR_RESTART_STEPS.map((id, index) => {
                const state =
                  index < stepIndex
                    ? "done"
                    : index === stepIndex
                      ? "current"
                      : "pending";
                return (
                  <li
                    key={id}
                    className={styles.restartStep}
                    data-state={state}
                    data-testid="org-restart-step"
                    data-step={id}
                  >
                    <span className={styles.restartStepDot} aria-hidden />
                    <span>{t(sidecarRestartStepLabelKey(id))}</span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <div className={styles.restartGate}>
            <h2 className={styles.restartTitle}>
              {t("organization.previewNeedsRestartTitle")}
            </h2>
            <p className={styles.restartGateBody}>
              {t("organization.previewNeedsRestart")}
            </p>
            <Button
              type="primary"
              data-testid="org-sidecar-gate-restart"
              onClick={onRestart}
            >
              {t("organization.restartSidecarCta")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
