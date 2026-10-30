import type { VerifiedIdentity } from "../../../../../packages/contracts/src/identity.js";
const endpoint = "http://127.0.0.1:3100/metadata";
export const CURRENT_USER_QUERY = `query BusinessIdentity { currentUser { id disabled currentWorkspace { id activationStatus } currentUserWorkspace { id userId } workspaceMember { id userId roles { id } } } }`;
export async function getVerifiedIdentity(
  authContext: { token: string },
  transport: typeof fetch = fetch,
): Promise<VerifiedIdentity> {
  const response = await transport(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authContext.token}`,
    },
    body: JSON.stringify({ query: CURRENT_USER_QUERY }),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok) throw Error("Identity verification failed");
  const result = await response.json();
  const user = result.data?.currentUser;
  const member = user?.workspaceMember;
  if (
    result.errors?.length ||
    !user ||
    user.disabled !== false ||
    !user.id ||
    !user.currentWorkspace?.id ||
    user.currentWorkspace.activationStatus !== "ACTIVE" ||
    !user.currentUserWorkspace?.id ||
    user.currentUserWorkspace.userId !== user.id ||
    !member?.id ||
    member.userId !== user.id ||
    !Array.isArray(member.roles) ||
    member.roles.some((role: { id?: unknown }) => typeof role.id !== "string")
  )
    throw Error("Identity verification failed");
  return {
    userId: user.id,
    workspaceId: user.currentWorkspace.id,
    memberId: member.id,
    roleIds: member.roles.map((role: { id: string }) => role.id),
  };
}
