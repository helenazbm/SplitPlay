/**
 * Avatares ilustrados disponíveis para o perfil (assets em public/avatars).
 */
export const AVATARS = [
  "/avatars/avatar-1.png",
  "/avatars/avatar-2.png",
  "/avatars/avatar-3.png",
  "/avatars/avatar-4.png",
] as const;

export const DEFAULT_AVATAR = AVATARS[0];

export function resolveAvatar(url?: string | null): string {
  if (!url || !url.trim()) {
    return DEFAULT_AVATAR;
  }
  // Compat: avatares escolhidos antes da migração foram salvos como .svg
  // (ex.: /avatars/avatar-2.svg). Os arquivos agora são .png — reaponta.
  return url.replace(/\/avatars\/avatar-(\d+)\.svg$/, "/avatars/avatar-$1.png");
}
