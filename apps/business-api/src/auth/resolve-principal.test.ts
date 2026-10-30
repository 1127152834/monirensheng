import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createPrincipalResolver,
  resolvePrincipal,
} from "./resolve-principal.js";
const identity = {
  userId: "user-a",
  workspaceId: "ws",
  memberId: "member-a",
  roleIds: ["staff"],
};
const config = {
  workspaceId: "ws",
  adminRoleIds: ["admin"],
  staffRoleIds: ["staff"],
};
describe("verified principal", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("fails closed when server role configuration is missing", async () => {
    vi.stubEnv("TWENTY_WORKSPACE_ID", "");
    await expect(
      resolvePrincipal(
        new Request("http://localhost", {
          headers: { authorization: "Bearer valid" },
        }),
      ),
    ).rejects.toThrow("Unauthorized");
  });
  it("uses fresh upstream identity, ignoring asserted actors", async () => {
    let calls = 0;
    const resolve = createPrincipalResolver(config, async () => {
      calls++;
      return identity;
    });
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "x-user-id": "admin",
        "x-is-admin": "true",
      },
      body: JSON.stringify({
        userId: "admin",
        ownerId: "admin",
        isAdmin: true,
      }),
    });
    expect(await resolve(request)).toEqual({
      userId: "user-a",
      workspaceId: "ws",
      isBusinessAdmin: false,
      permissions: ["customer.read", "customer.update"],
    });
    await resolve(request);
    expect(calls).toBe(2);
  });
  it("rejects absent authorization before upstream", async () => {
    let calls = 0;
    const resolve = createPrincipalResolver(config, async () => {
      calls++;
      return identity;
    });
    await expect(resolve(new Request("http://localhost"))).rejects.toThrow(
      "Unauthorized",
    );
    expect(calls).toBe(0);
  });
  it("rejects upstream session errors", async () => {
    const resolve = createPrincipalResolver(config, async () => {
      throw Error("expired");
    });
    await expect(
      resolve(
        new Request("http://localhost", {
          headers: { authorization: "Bearer expired" },
        }),
      ),
    ).rejects.toThrow("Unauthorized");
  });
  it.each([
    { ...identity, workspaceId: "other" },
    { ...identity, roleIds: [] },
    { ...identity, roleIds: ["unknown"] },
    { ...identity, roleIds: ["staff", "unknown"] },
  ])("denies wrong workspace and unknown roles", async (value) => {
    const resolve = createPrincipalResolver(config, async () => value);
    await expect(
      resolve(
        new Request("http://localhost", {
          headers: { authorization: "Bearer valid" },
        }),
      ),
    ).rejects.toThrow("Unauthorized");
  });
  it("maps only configured admin role ID", async () => {
    const resolve = createPrincipalResolver(config, async () => ({
      ...identity,
      roleIds: ["admin"],
    }));
    expect(
      (
        await resolve(
          new Request("http://localhost", {
            headers: { authorization: "Bearer valid" },
          }),
        )
      ).isBusinessAdmin,
    ).toBe(true);
  });
});
