import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  loadFixture,
  login,
  current,
  gql,
  raw,
  base,
} from "../../scripts/foundation-client.mjs";
import { createPrincipalResolver } from "../../apps/business-api/src/auth/resolve-principal.js";
import { getVerifiedIdentity } from "../../apps/business-api/src/integrations/twenty/identity-client.js";
let f: any;
const run = process.env.M0_NATIVE_INTEGRATION === "1";
const schemaQuery = "{__schema{mutationType{fields{name}}}}";
async function snapshot() {
  const rows = [];
  for (const filter of ["", ",filter:{deletedAt:{is:NOT_NULL}}"]) {
    const data = await gql(
      `{mZeroProbes(first:1000${filter}){edges{node{id name deletedAt updatedAt}} pageInfo{hasNextPage}}}`,
      {},
      f.admin.token,
      "/graphql",
    );
    expect(data.mZeroProbes.pageInfo.hasNextPage).toBe(false);
    rows.push(...data.mZeroProbes.edges.map((x: any) => x.node));
  }
  return rows.sort((a: any, b: any) => a.id.localeCompare(b.id));
}
function denied(result: any) {
  expect(result.errors?.length, JSON.stringify(result)).toBeGreaterThan(0);
  for (const e of result.errors) {
    expect(e.extensions?.code).not.toBe("GRAPHQL_VALIDATION_FAILED");
    expect(e.message).toMatch(
      /permission|forbidden|unauthorized|access denied/i,
    );
  }
}
async function rest(
  method: string,
  path: string,
  token: string,
  body?: unknown,
) {
  const r = await fetch(base + "/rest/" + path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
function restSuccess(r: any) {
  expect(r.status, JSON.stringify(r)).toBeGreaterThanOrEqual(200);
  expect(r.status, JSON.stringify(r)).toBeLessThan(300);
  for (const value of Object.values(r.body.data ?? {})) {
    if (Array.isArray(value))
      expect(value.length, JSON.stringify(r)).toBeGreaterThan(0);
  }
}
function restDenied(r: any) {
  expect(r.body.code, JSON.stringify(r)).toBe("PERMISSION_DENIED");
  expect(r.status).toBeGreaterThanOrEqual(400);
}
async function mcp(token: string, name: string, args: unknown) {
  const r = await fetch(base + "/mcp", {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: ["get_tool_catalog", "learn_tools"].includes(name)
          ? name
          : "execute_tool",
        arguments: ["get_tool_catalog", "learn_tools"].includes(name)
          ? args
          : { toolName: name, arguments: args },
      },
    }),
  });
  return { status: r.status, ...(await r.json()) };
}
function mcpSuccess(r: any) {
  expect(r.error, JSON.stringify(r)).toBeUndefined();
  expect(r.result?.isError, JSON.stringify(r)).not.toBe(true);
  if (r.result?.content?.[0]?.text) {
    expect(
      JSON.parse(r.result.content[0].text).success,
      JSON.stringify(r),
    ).not.toBe(false);
  }
}
function mcpDenied(r: any) {
  expect(!!r.error || r.result?.isError === true, JSON.stringify(r)).toBe(true);
  expect(JSON.stringify(r)).toMatch(
    /permission|forbidden|not allowed|not found|unauthorized|not available|authentication|jwt/i,
  );
  expect(JSON.stringify(r)).not.toMatch(/invalid.*argument|validation.*error/i);
}
describe.skipIf(!run)("real isolated native permission matrix", () => {
  beforeAll(async () => {
    f = await loadFixture();
    expect(f.base).toBe("http://127.0.0.1:3100");
    for (const k of ["admin", "a", "b"])
      f[k].token = await login(f[k], f.origin);
  }, 30000);
  it("real supported sessions identify distinct trusted users; rejects invalid session, wrong workspace and asserted actor", async () => {
    const config = {
      workspaceId: f.workspaceId,
      adminRoleIds: [f.adminRoleId],
      staffRoleIds: [f.staffRole.id],
    };
    const resolve = createPrincipalResolver(config, (token) =>
      getVerifiedIdentity({ token }),
    );
    for (const k of ["a", "b", "admin"]) {
      const user = await current(f[k].token);
      expect(user.disabled).toBe(false);
      expect(user.currentWorkspace.activationStatus).toBe("ACTIVE");
      if (k !== "admin") {
        expect(user.currentUserWorkspace.permissionFlags).toEqual([]);
        expect(user.workspaceMember.roles.map((r: any) => r.id)).toEqual([
          f.staffRole.id,
        ]);
        expect(
          user.currentUserWorkspace.objectPermissions.find(
            (p: any) => p.objectMetadataId === f.object.id,
          ),
        ).toEqual({
          objectMetadataId: f.object.id,
          canReadObjectRecords: true,
          canUpdateObjectRecords: false,
          canSoftDeleteObjectRecords: false,
          canDestroyObjectRecords: false,
        });
      }
      const p = await resolve(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            authorization: `Bearer ${f[k].token}`,
            "x-user-id": f.admin.identity.id,
            "x-is-admin": "true",
          },
          body: JSON.stringify({
            userId: f.admin.identity.id,
            isAdmin: true,
            ownerId: f.admin.identity.id,
          }),
        }),
      );
      expect(p.userId).toBe(f[k].identity.id);
      expect(p.isBusinessAdmin).toBe(k === "admin");
    }
    await expect(
      resolve(
        new Request("http://localhost", {
          headers: { authorization: "Bearer invalid-session" },
        }),
      ),
    ).rejects.toThrow("Unauthorized");
    await expect(
      createPrincipalResolver(
        { ...config, workspaceId: randomUUID() },
        (token) => getVerifiedIdentity({ token }),
      )(
        new Request("http://localhost", {
          headers: { authorization: `Bearer ${f.a.token}` },
        }),
      ),
    ).rejects.toThrow("Unauthorized");
  });
  for (const k of ["a", "b"]) {
    it(`${k} GraphQL read + 11 write denials with admin positive controls and unchanged state`, async () => {
      const create = async () =>
        (
          await gql(
            "mutation($data:MZeroProbeCreateInput!){createMZeroProbe(data:$data){id name}}",
            { data: { name: "matrix-" + randomUUID() } },
            f.admin.token,
            "/graphql",
          )
        ).createMZeroProbe;
      const row = await create();
      const read = await gql(
        "query($id:UUID!){mZeroProbe(filter:{id:{eq:$id}}){id name}}",
        { id: row.id },
        f[k].token,
        "/graphql",
      );
      expect(read.mZeroProbe.id).toBe(row.id);
      const ops = [
        ["createMZeroProbe", 'data:{name:"denied-create"}', "{id}", undefined],
        ["createMZeroProbes", 'data:[{name:"denied-bulk"}]', "{id}", undefined],
        [
          "updateMZeroProbe",
          `id:"${row.id}",data:{name:"updated-control"}`,
          "{id}",
          undefined,
        ],
        [
          "updateMZeroProbes",
          `filter:{id:{eq:"${row.id}"}},data:{name:"bulk-control"}`,
          "{id}",
          undefined,
        ],
        ["deleteMZeroProbe", `id:"${row.id}"`, "{id}", undefined],
        ["restoreMZeroProbe", `id:"${row.id}"`, "{id}", "deleted"],
        ["destroyMZeroProbe", `id:"${row.id}"`, "{id}", "deleted"],
        [
          "deleteMZeroProbes",
          `filter:{id:{eq:"${row.id}"}}`,
          "{id}",
          undefined,
        ],
        [
          "restoreMZeroProbes",
          `filter:{id:{eq:"${row.id}"}}`,
          "{id}",
          "deleted",
        ],
        [
          "destroyMZeroProbes",
          `filter:{id:{eq:"${row.id}"}}`,
          "{id}",
          "deleted",
        ],
      ];
      for (const [name, args, selection, state] of ops) {
        // Reset sentinel and ensure restore/destroy are tested against an actually deleted readable record.
        await gql(
          `mutation{restoreMZeroProbe(id:"${row.id}"){id}}`,
          {},
          f.admin.token,
          "/graphql",
        );
        if (state === "deleted")
          await gql(
            `mutation{deleteMZeroProbe(id:"${row.id}"){id}}`,
            {},
            f.admin.token,
            "/graphql",
          );
        const before = await snapshot();
        const result = await raw(
          `mutation{${name}(${args})${selection}}`,
          {},
          f[k].token,
          "/graphql",
        );
        denied(result);
        expect(await snapshot()).toEqual(before);
        await gql(
          `mutation{${name}(${args})${selection}}`,
          {},
          f.admin.token,
          "/graphql",
        );
        if (name?.startsWith("destroy")) {
          // Recreate same synthetic sentinel using supported ID input.
          await gql(
            `mutation{createMZeroProbe(data:{id:"${row.id}",name:"recreated-control"}){id}}`,
            {},
            f.admin.token,
            "/graphql",
          );
        }
      }
      const before = await snapshot();
      denied(
        await raw(
          `mutation{createMZeroProbe(data:{name:"share-bypass"},shareWith:[{workspaceMemberId:"${f[k].identity.workspaceMember.id}",accessLevel:FULL}]){id}}`,
          {},
          f[k].token,
          "/graphql",
        ),
      );
      expect(await snapshot()).toEqual(before);
    }, 60000);
    it(`${k} REST read + single/bulk create/update/delete/restore/destroy denied with admin controls`, async () => {
      const created = await rest("POST", "mZeroProbes", f.admin.token, {
        name: "rest-" + randomUUID(),
      });
      restSuccess(created);
      const row = created.body.data.createMZeroProbe;
      restSuccess(await rest("GET", `mZeroProbes/${row.id}`, f[k].token));
      const filter = `filter=id[eq]:${row.id}`;
      const ops: [string, string, unknown?, boolean?][] = [
        ["POST", "mZeroProbes", { name: "denied-rest" }],
        ["POST", "batch/mZeroProbes", [{ name: "denied-batch" }]],
        ["PATCH", `mZeroProbes/${row.id}`, { name: "rest-control" }],
        ["PATCH", `mZeroProbes?${filter}`, { name: "bulk-rest-control" }],
        ["DELETE", `mZeroProbes/${row.id}?soft_delete=true`],
        ["PATCH", `mZeroProbes/${row.id}/restore`, undefined, true],
        ["DELETE", `mZeroProbes/${row.id}`, undefined, true],
        ["DELETE", `mZeroProbes?${filter}&soft_delete=true`],
        ["PATCH", `mZeroProbes/restore?${filter}`, undefined, true],
        ["DELETE", `mZeroProbes?${filter}`, undefined, true],
      ];
      for (const [method, path, body, deleted] of ops) {
        restSuccess(
          await rest("PATCH", `mZeroProbes/${row.id}/restore`, f.admin.token),
        );
        if (deleted)
          restSuccess(
            await rest(
              "DELETE",
              `mZeroProbes/${row.id}?soft_delete=true`,
              f.admin.token,
            ),
          );
        const before = await snapshot();
        restDenied(await rest(method, path, f[k].token, body));
        expect(await snapshot()).toEqual(before);
        restSuccess(await rest(method, path, f.admin.token, body));
        if (method === "DELETE" && !path.includes("soft_delete"))
          restSuccess(
            await rest("POST", "mZeroProbes", f.admin.token, {
              id: row.id,
              name: "rest-recreated",
            }),
          );
      }
    }, 60000);
    it(`${k} MCP exact catalog tools reject writes, including bulk import-equivalent operations`, async () => {
      const catalog = await mcp(f.admin.token, "get_tool_catalog", {});
      mcpSuccess(catalog);
      const tools = JSON.parse(catalog.result.content[0].text).catalog
        .DATABASE_CRUD;
      expect(tools.some((t: any) => t.name === "create_one_m_zero_probe")).toBe(
        true,
      );
      const row = (
        await gql(
          'mutation{createMZeroProbe(data:{name:"mcp-control"}){id name}}',
          {},
          f.admin.token,
          "/graphql",
        )
      ).createMZeroProbe;
      const ops = [
        ["create_one_m_zero_probe", { name: "mcp-created" }],
        [
          "create_many_m_zero_probes",
          { records: [{ name: "mcp-bulk-created" }] },
        ],
        ["update_one_m_zero_probe", { id: row.id, name: "mcp-updated" }],
        [
          "update_many_m_zero_probes",
          { filter: { name: { eq: row.name } }, data: { name: row.name } },
        ],
        ["upsert_many_m_zero_probes", { records: [{ name: "mcp-upserted" }] }],
        ["delete_many_m_zero_probes", { filter: { name: { eq: row.name } } }],
        ["delete_one_m_zero_probe", { id: row.id }],
      ] as const;
      for (const [name, args] of ops) {
        await gql(
          `mutation{restoreMZeroProbe(id:"${row.id}"){id}}`,
          {},
          f.admin.token,
          "/graphql",
        );
        await gql(
          `mutation{updateMZeroProbe(id:"${row.id}",data:{name:"mcp-control"}){id}}`,
          {},
          f.admin.token,
          "/graphql",
        );
        const before = await snapshot();
        mcpDenied(await mcp(f[k].token, name, args));
        expect(await snapshot()).toEqual(before);
        const control = await mcp(f.admin.token, name, args);
        mcpSuccess(control);
        const result = JSON.parse(control.result.content[0].text).result;
        if (Array.isArray(result))
          expect(result.length, JSON.stringify(control)).toBeGreaterThan(0);
      }
      mcpDenied(
        await mcp("", "create_one_m_zero_probe", { name: "unauthenticated" }),
      );
    }, 60000);
  }
});

describe.skipIf(!run)("runtime channel capabilities", () => {
  beforeAll(async () => {
    f = await loadFixture();
    for (const k of ["admin", "a", "b"])
      f[k].token = await login(f[k], f.origin);
  }, 30000);
  it("trusted roles are freshly resolved after real role revocation, then restored", async () => {
    const role = (
      await gql(
        "mutation($input:CreateRoleInput!){createOneRole(createRoleInput:$input){id}}",
        {
          input: {
            label: "M0 unconfigured " + randomUUID(),
            canBeAssignedToUsers: true,
            canBeAssignedToAgents: false,
            canBeAssignedToApiKeys: false,
            canUpdateAllSettings: false,
            canAccessAllTools: false,
            canAccessAllAgentChatChannels: false,
            canReadAllObjectRecords: false,
            canUpdateAllObjectRecords: false,
            canSoftDeleteAllObjectRecords: false,
            canDestroyAllObjectRecords: false,
          },
        },
        f.admin.token,
      )
    ).createOneRole;
    const assign = (roleId: string) =>
      gql(
        "mutation($member:UUID!,$role:UUID!){updateWorkspaceMemberRole(workspaceMemberId:$member,roleId:$role){id}}",
        { member: f.a.identity.workspaceMember.id, role: roleId },
        f.admin.token,
      );
    const resolve = createPrincipalResolver(
      {
        workspaceId: f.workspaceId,
        adminRoleIds: [f.adminRoleId],
        staffRoleIds: [f.staffRole.id],
      },
      (token) => getVerifiedIdentity({ token }),
    );
    const request = new Request("http://localhost", {
      headers: { authorization: `Bearer ${f.a.token}` },
    });
    expect((await resolve(request)).userId).toBe(f.a.identity.id);
    try {
      await assign(role.id);
      await expect(resolve(request)).rejects.toThrow("Unauthorized");
    } finally {
      await assign(f.staffRole.id);
    }
    expect((await resolve(request)).isBusinessAdmin).toBe(false);
  });
  it("workflow creation is denied through exact supported MCP tool with successful harmless admin control", async () => {
    const args = {
      name: "M0 harmless manual " + randomUUID(),
      trigger: { type: "MANUAL", settings: { outputSchema: {} } },
      steps: [],
      activate: false,
    };
    const control = await mcp(f.admin.token, "create_complete_workflow", args);
    mcpSuccess(control);
    const data = JSON.parse(control.result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.result.coreWorkflowId).toBeTruthy();
    const workflowsBefore = await mcp(f.admin.token, "list_workflows", {});
    mcpSuccess(workflowsBefore);
    for (const k of ["a", "b"]) {
      const before = await snapshot();
      mcpDenied(await mcp(f[k].token, "create_complete_workflow", args));
      expect(await snapshot()).toEqual(before);
    }
    expect(await mcp(f.admin.token, "list_workflows", {})).toEqual(
      workflowsBefore,
    );
    // Runtime lacks the source-described execution mutation. This is capability evidence, not a passed denial.
    for (const path of ["/metadata", "/graphql"]) {
      const schema = await gql(schemaQuery, {}, f.admin.token, path);
      expect(
        schema.__schema.mutationType.fields.some(
          (x: any) => x.name === "runCoreWorkflowVersion",
        ),
      ).toBe(false);
    }
  });
  it("sharing manager is unavailable for this unrestricted object, with no exposed employee sharing grants", async () => {
    const row = (
      await gql(
        'mutation{createMZeroProbe(data:{name:"sharing-capability"}){id}}',
        {},
        f.admin.token,
        "/graphql",
      )
    ).createMZeroProbe;
    for (const k of ["admin", "a", "b"]) {
      const target = { objectMetadataId: f.object.id, recordId: row.id };
      const sharing = (
        await gql(
          "query($target:RecordTargetInput!){recordSharing(target:$target){canManageSharing generalAccessLevel shares{id principalId accessLevel}}}",
          { target },
          f[k].token,
        )
      ).recordSharing;
      expect(sharing).toEqual({
        canManageSharing: false,
        generalAccessLevel: null,
        shares: [],
      });
      const before = await snapshot();
      const result = await raw(
        "mutation($target:RecordTargetInput!,$principal:RecordSharePrincipalInput!){setRecordShare(target:$target,principal:$principal,accessLevel:FULL){canManageSharing}}",
        {
          target,
          principal: { workspaceMemberId: f.a.identity.workspaceMember.id },
        },
        f[k].token,
      );
      expect(result.errors?.[0]?.message).toBe("Record not found"); // NOT counted as permission denial: admin also unavailable.
      expect(await snapshot()).toEqual(before);
    }
  });
});
