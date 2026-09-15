/**
 * Shared XYAI / FreeOS mascot pack (served from ``dashboard/public``).
 * Prefer ``XyaiMascot`` / ``EmptyState variant="mascot"`` over hardcoding paths.
 */

export type XyaiMascotPose =
  | "welcome"
  | "empty"
  | "peek"
  | "think"
  | "type"
  | "work"
  | "tasks"
  | "success";

const POSE_FILES: Record<XyaiMascotPose, string> = {
  welcome: "xyai-mascot-welcome.webp",
  empty: "xyai-mascot-empty.webp",
  peek: "xyai-mascot-peek.webp",
  think: "xyai-mascot-think.webp",
  type: "xyai-mascot-type.webp",
  work: "xyai-mascot-type.webp",
  tasks: "xyai-mascot-tasks.webp",
  success: "xyai-mascot-tasks.webp",
};

/** Distinct stills for tap-to-switch surfaces (welcome + desktop splash). */
export const XYAI_MASCOT_SWITCH_POSES = [
  "welcome",
  "peek",
  "think",
  "type",
  "tasks",
] as const satisfies readonly XyaiMascotPose[];

export function xyaiMascotSrc(pose: XyaiMascotPose = "empty"): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}${POSE_FILES[pose]}`;
}

export function xyaiMascotSwitchSrcs(): string[] {
  return XYAI_MASCOT_SWITCH_POSES.map((pose) => xyaiMascotSrc(pose));
}

export const XYAI_EMPTY_MASCOT_SRC = xyaiMascotSrc("empty");
