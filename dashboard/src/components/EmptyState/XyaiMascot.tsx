import { xyaiMascotSrc, type XyaiMascotPose } from "../../assets/mascot";
import styles from "./EmptyState.module.less";

interface XyaiMascotProps {
  className?: string;
  /** Square edge in px; default 160. */
  size?: number;
  /** Pose from the shared XYAI pack; default empty-state. */
  pose?: XyaiMascotPose;
}

/**
 * XYAI / FreeOS mascot image with shared sizing.
 * Use inside custom empty UIs or pass as ``EmptyState`` icon /
 * antd ``Empty`` ``image``.
 */
export function XyaiMascot({
  className,
  size = 160,
  pose = "empty",
}: XyaiMascotProps) {
  return (
    <img
      src={xyaiMascotSrc(pose)}
      alt=""
      draggable={false}
      className={className ? `${styles.mascot} ${className}` : styles.mascot}
      style={size === 160 ? undefined : { width: size, height: size }}
    />
  );
}
