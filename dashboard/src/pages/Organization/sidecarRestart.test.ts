import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import zh from "../../locales/zh.json";
import {
  SIDECAR_RESTART_STEPS,
  sidecarRestartSpeechKeys,
  sidecarRestartStepId,
  sidecarRestartStepIndex,
  sidecarRestartStepLabelKey,
} from "./sidecarRestart";

describe("sidecarRestartStepIndex", () => {
  it("starts on stop and advances through the Studio checklist", () => {
    expect(sidecarRestartStepId(0)).toBe("stop");
    expect(sidecarRestartStepId(1599)).toBe("stop");
    expect(sidecarRestartStepId(1600)).toBe("preferLayout");
    expect(sidecarRestartStepId(3400)).toBe("startApi");
    expect(sidecarRestartStepId(5600)).toBe("waitPort");
    expect(sidecarRestartStepId(20_000)).toBe("waitPort");
  });

  it("holds the last step until livez finishes", () => {
    expect(sidecarRestartStepIndex(20_000)).toBe(3);
    expect(sidecarRestartStepIndex(20_000, { finished: true })).toBe(4);
    expect(sidecarRestartStepId(100, { finished: true })).toBe("loadLogin");
  });

  it("maps speech and checklist keys for every step", () => {
    expect(SIDECAR_RESTART_STEPS).toEqual([
      "stop",
      "preferLayout",
      "startApi",
      "waitPort",
      "loadLogin",
    ]);
    for (const step of SIDECAR_RESTART_STEPS) {
      const speech = sidecarRestartSpeechKeys(step);
      expect(speech.title).toBe(`organization.restartSpeech.${step}Title`);
      expect(speech.body).toBe(`organization.restartSpeech.${step}Body`);
      expect(sidecarRestartStepLabelKey(step)).toBe(
        `organization.restartStep.${step}`,
      );
    }
  });

  it("keeps zh/en restart copy for every Studio step", () => {
    for (const step of SIDECAR_RESTART_STEPS) {
      expect(zh.organization.restartStep[step]).toBeTruthy();
      expect(en.organization.restartStep[step]).toBeTruthy();
      expect(
        zh.organization.restartSpeech[
          `${step}Title` as keyof typeof zh.organization.restartSpeech
        ],
      ).toBeTruthy();
      expect(
        en.organization.restartSpeech[
          `${step}Title` as keyof typeof en.organization.restartSpeech
        ],
      ).toBeTruthy();
    }
    expect(zh.organization.restartOverlayTitle).toBe("正在重启前后端服务");
    expect(zh.organization.restartSidecarCta).toBe("重启前后端服务");
  });
});
