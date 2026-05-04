/**
 * Live PHP backend origin. Rebuild and redeploy the frontend after changing this.
 * Optional override: set VITE_API_BASE to the same origin (no trailing slash), e.g.
 * https://mediumorchid-emu-182487.hostingersite.com
 */
export const DEFAULT_API_ORIGIN = "https://mediumorchid-emu-182487.hostingersite.com";

export function getApiOrigin(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return DEFAULT_API_ORIGIN;
}
