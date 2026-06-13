// FIXME: This should be exported from the ra-core package
type CanAccessParams<
  RecordType extends Record<string, any> = Record<string, any>,
> = {
  action: string;
  resource: string;
  record?: RecordType;
};

/**
 * Inmovel roles: "admin", "manager", "asesor".
 *  - admin: full access, including the users (sales) and configuration screens.
 *  - manager / asesor: same UI surface (no users/configuration screens). The
 *    difference between them is row scope (a manager also sees their team's
 *    leads), which is enforced server-side by RLS (can_access_lead), not here.
 *    The frontend only gates which SCREENS are reachable.
 */
export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  role: string,
  params: CanAccessParams<RecordType>,
) => {
  if (role === "admin") {
    return true;
  }

  // Non-admins (manager, asesor) can't reach the users (sales) screen
  if (params.resource === "sales") {
    return false;
  }

  // Non-admins can't reach the configuration screen
  if (params.resource === "configuration") {
    return false;
  }

  return true;
};
