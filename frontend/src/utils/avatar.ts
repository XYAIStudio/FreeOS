/**
 * 职业头像工具 — 53张序号头像，随机分配
 */

/** 全部53张系统头像 */
export const PRESET_AVATARS = [
  "/avatars/preset-01.webp",
  "/avatars/preset-02.webp",
  "/avatars/preset-03.webp",
  "/avatars/preset-04.webp",
  "/avatars/preset-05.webp",
  "/avatars/preset-06.webp",
  "/avatars/preset-07.webp",
  "/avatars/preset-08.webp",
  "/avatars/preset-09.webp",
  "/avatars/preset-10.webp",
  "/avatars/preset-11.webp",
  "/avatars/preset-12.webp",
  "/avatars/preset-13.webp",
  "/avatars/preset-14.webp",
  "/avatars/preset-15.webp",
  "/avatars/preset-16.webp",
  "/avatars/preset-17.webp",
  "/avatars/preset-18.webp",
  "/avatars/preset-19.webp",
  "/avatars/preset-20.webp",
  "/avatars/preset-21.webp",
  "/avatars/preset-22.webp",
  "/avatars/preset-23.webp",
  "/avatars/preset-24.webp",
  "/avatars/preset-25.webp",
  "/avatars/preset-26.webp",
  "/avatars/preset-27.webp",
  "/avatars/preset-28.webp",
  "/avatars/preset-29.webp",
  "/avatars/preset-30.webp",
  "/avatars/preset-31.webp",
  "/avatars/preset-32.webp",
  "/avatars/preset-33.webp",
  "/avatars/preset-34.webp",
  "/avatars/preset-35.webp",
  "/avatars/preset-36.webp",
  "/avatars/preset-37.webp",
  "/avatars/preset-38.webp",
  "/avatars/preset-39.webp",
  "/avatars/preset-40.webp",
  "/avatars/preset-41.webp",
  "/avatars/preset-42.webp",
  "/avatars/preset-43.webp",
  "/avatars/preset-44.webp",
  "/avatars/preset-45.webp",
  "/avatars/preset-46.webp",
  "/avatars/preset-47.webp",
  "/avatars/preset-48.webp",
  "/avatars/preset-49.webp",
  "/avatars/preset-50.webp",
  "/avatars/preset-51.webp",
  "/avatars/preset-52.webp",
  "/avatars/preset-53.webp",
];

// 按员工ID缓存随机结果，同一员工同一次页面加载期间头像不变
const avatarCache = new Map<string, string>();

/**
 * 获取职业头像 URL — 从53张序号头像中随机分配
 * @param id 员工ID
 */
export function getProfessionalAvatar(id: number | string | undefined): string {
  const key = String(id ?? "__anon__");
  if (avatarCache.has(key)) return avatarCache.get(key)!;

  const idx = Math.floor(Math.random() * PRESET_AVATARS.length);
  const result = PRESET_AVATARS[idx];
  avatarCache.set(key, result);
  return result;
}
