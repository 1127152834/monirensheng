import { it, expect } from "vitest";
import { getVerifiedIdentity } from "./identity-client.js";
const user = {
  id: "u",
  disabled: false,
  currentWorkspace: { id: "w", activationStatus: "ACTIVE" },
  currentUserWorkspace: { id: "uw", userId: "u" },
  workspaceMember: { id: "m", userId: "u", roles: [{ id: "r" }] },
};
const fetchUser = (value: unknown) => async () =>
  new Response(JSON.stringify({ data: { currentUser: value } }));
it("verifies current membership with the upstream protected query", async () => {
  expect(
    await getVerifiedIdentity({ token: "valid" }, fetchUser(user)),
  ).toEqual({ userId: "u", workspaceId: "w", memberId: "m", roleIds: ["r"] });
});
it.each([
  { ...user, disabled: true },
  { ...user, currentWorkspace: { id: "w", activationStatus: "SUSPENDED" } },
  { ...user, workspaceMember: null },
  { ...user, workspaceMember: { ...user.workspaceMember, userId: "other" } },
  { ...user, currentUserWorkspace: { id: "uw", userId: "other" } },
])(
  "rejects disabled/suspended/missing or mismatched membership",
  async (value) => {
    await expect(
      getVerifiedIdentity({ token: "x" }, fetchUser(value)),
    ).rejects.toThrow();
  },
);
it("rejects GraphQL errors even with data", async () => {
  await expect(
    getVerifiedIdentity(
      { token: "x" },
      async () =>
        new Response(
          JSON.stringify({
            data: { currentUser: user },
            errors: [{ message: "denied" }],
          }),
        ),
    ),
  ).rejects.toThrow();
});
