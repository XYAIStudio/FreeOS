/**
 * 职业头像组件 — 统一员工头像显示
 * 53张序号头像随机分配，支持自定义形象照
 */
import { getProfessionalAvatar } from "../utils/avatar";

interface AvatarProps {
  id?: number | string;
  name?: string;
  size?: number;
  className?: string;
  rounded?: boolean;
  /** 自定义头像URL，优先级高于自动分配的头像 */
  customSrc?: string;
}

export default function Avatar({ id, name, size = 40, className = "", rounded = true, customSrc }: AvatarProps) {
  const src = customSrc || getProfessionalAvatar(id);
  const radius = rounded ? "50%" : "8px";
  return (
    <img
      src={src}
      alt={name ? `${name}的头像` : "职业头像"}
      width={size}
      height={size}
      className={`shrink-0 object-cover ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, borderRadius: radius }}
      loading="lazy"
    />
  );
}
