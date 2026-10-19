export interface ManagingTarget {
  id: string;
  name: string;
}

const STORAGE_KEY = 'mc_managing_home';

/** The funeral home a SUPER_ADMIN is currently managing, persisted across reloads. */
export function getStoredManagingTarget(): ManagingTarget | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManagingTarget;
    return parsed && parsed.id && parsed.name ? parsed : null;
  } catch {
    return null;
  }
}

export function storeManagingTarget(target: ManagingTarget | null) {
  if (target) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Id sent as the X-Managing-Funeral-Home header on API requests, if any. */
export function getManageTargetId(): string | null {
  return getStoredManagingTarget()?.id ?? null;
}
