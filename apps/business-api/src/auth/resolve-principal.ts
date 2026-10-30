import type {
  IdentityConfig,
  Principal,
  VerifiedIdentity,
} from "../../../../packages/contracts/src/identity.js";
import { getVerifiedIdentity } from "../integrations/twenty/identity-client.js";
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
  }
}
export function createPrincipalResolver(
  config: IdentityConfig,
  verify: (token: string) => Promise<VerifiedIdentity>,
) {
  return async (request: Request): Promise<Principal> => {
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.get("authorization") ?? "",
    );
    if (!match) throw new UnauthorizedError();
    try {
      const identity = await verify(match[1]);
      if (
        identity.workspaceId !== config.workspaceId ||
        identity.roleIds.some(
          (id) =>
            !config.adminRoleIds.includes(id) &&
            !config.staffRoleIds.includes(id),
        )
      )
        throw new UnauthorizedError();
      const isBusinessAdmin = identity.roleIds.some((id) =>
        config.adminRoleIds.includes(id),
      );
      const isStaff = identity.roleIds.some((id) =>
        config.staffRoleIds.includes(id),
      );
      if (!isBusinessAdmin && !isStaff) throw new UnauthorizedError();
      return {
        userId: identity.userId,
        workspaceId: identity.workspaceId,
        isBusinessAdmin,
        permissions: isBusinessAdmin
          ? ["customer.read", "customer.update", "customer.reassign"]
          : ["customer.read", "customer.update"],
      };
    } catch {
      throw new UnauthorizedError();
    }
  };
}
// Configuration comes only from the server environment, never request headers/body.
export async function resolvePrincipal(request: Request): Promise<Principal> {
  const workspaceId = process.env.TWENTY_WORKSPACE_ID;
  const adminRoleIds =
    process.env.TWENTY_BUSINESS_ADMIN_ROLE_IDS?.split(",").filter(Boolean) ??
    [];
  const staffRoleIds =
    process.env.TWENTY_BUSINESS_STAFF_ROLE_IDS?.split(",").filter(Boolean) ??
    [];
  if (!workspaceId || !adminRoleIds.length || !staffRoleIds.length)
    throw new UnauthorizedError();
  return createPrincipalResolver(
    { workspaceId, adminRoleIds, staffRoleIds },
    (token) => getVerifiedIdentity({ token }),
  )(request);
}
