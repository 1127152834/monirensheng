export type Principal = {
  userId: string;
  workspaceId: string;
  isBusinessAdmin: boolean;
  permissions: string[];
};
export type VerifiedIdentity = {
  userId: string;
  workspaceId: string;
  memberId: string;
  roleIds: string[];
};
export type IdentityConfig = {
  workspaceId: string;
  adminRoleIds: readonly string[];
  staffRoleIds: readonly string[];
};
