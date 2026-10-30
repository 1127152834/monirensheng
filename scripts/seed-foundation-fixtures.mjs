import { randomBytes } from "node:crypto";
import {
  base,
  gql,
  exchange,
  current,
  saveFixture,
  fixturePath,
  login,
} from "./foundation-client.mjs";
import { access } from "node:fs/promises";
try {
  await access(fixturePath);
  throw Error("Fixture file exists; refusing to duplicate setup");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const suffix = randomBytes(5).toString("hex");
const makePerson = (label) => ({
  email: `m0-${label}-${suffix}@example.invalid`,
  password: randomBytes(24).toString("base64url"),
});
const fixture = {
  base,
  origin: "http://localhost:3100",
  admin: makePerson("admin"),
  a: makePerson("a"),
  b: makePerson("b"),
};
await saveFixture(fixture);
const signup = await gql(
  `mutation($email:String!,$password:String!){signUp(email:$email,password:$password){tokens{accessOrWorkspaceAgnosticToken{token}}}}`,
  fixture.admin,
);
const agnostic = signup.signUp.tokens.accessOrWorkspaceAgnosticToken.token;
const created = await gql(
  `mutation($input:SignUpInNewWorkspaceInput){signUpInNewWorkspace(input:$input){loginToken{token} workspace{id workspaceUrls{customUrl subdomainUrl}}}}`,
  { input: { displayName: "Company Helper M0 synthetic" } },
  agnostic,
);
fixture.workspaceId = created.signUpInNewWorkspace.workspace.id;
fixture.origin =
  created.signUpInNewWorkspace.workspace.workspaceUrls.subdomainUrl ||
  fixture.origin;
fixture.admin.token = await exchange(
  created.signUpInNewWorkspace.loginToken.token,
  fixture.origin,
);
await saveFixture(fixture);
const activated = (
  await gql(
    `mutation{activateWorkspace(data:{}){id activationStatus inviteHash workspaceUrls{subdomainUrl customUrl}}}`,
    {},
    fixture.admin.token,
  )
).activateWorkspace;
if (activated.activationStatus !== "ACTIVE")
  throw Error("workspace not active");
fixture.inviteHash = activated.inviteHash;
fixture.admin.token = await login(fixture.admin, fixture.origin);
await saveFixture(fixture);
for (const key of ["a", "b"]) {
  const joined = await gql(
    `mutation($email:String!,$password:String!,$workspaceId:UUID,$workspaceInviteHash:String){signUpInWorkspace(email:$email,password:$password,workspaceId:$workspaceId,workspaceInviteHash:$workspaceInviteHash){loginToken{token}}}`,
    {
      ...fixture[key],
      workspaceId: fixture.workspaceId,
      workspaceInviteHash: fixture.inviteHash,
    },
  );
  fixture[key].token = await exchange(
    joined.signUpInWorkspace.loginToken.token,
    fixture.origin,
  );
  fixture[key].token = await login(fixture[key], fixture.origin);
  fixture[key].identity = await current(fixture[key].token);
  await saveFixture(fixture);
}
fixture.admin.identity = await current(fixture.admin.token);
fixture.adminRoleId = fixture.admin.identity.workspaceMember.roles[0].id;
fixture.object = (
  await gql(
    `mutation($input:CreateOneObjectInput!){createOneObject(input:$input){id nameSingular namePlural}}`,
    {
      input: {
        object: {
          nameSingular: "mZeroProbe",
          namePlural: "mZeroProbes",
          labelSingular: "M0 Probe",
          labelPlural: "M0 Probes",
        },
      },
    },
    fixture.admin.token,
  )
).createOneObject;
fixture.staffRole = (
  await gql(
    `mutation($createRoleInput:CreateRoleInput!){createOneRole(createRoleInput:$createRoleInput){id label}}`,
    {
      createRoleInput: {
        label: "M0 Staff Read Only",
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
    fixture.admin.token,
  )
).createOneRole;
await saveFixture(fixture);
await gql(
  `mutation($input:UpsertObjectPermissionsInput!){upsertObjectPermissions(upsertObjectPermissionsInput:$input){objectMetadataId canReadObjectRecords canUpdateObjectRecords}}`,
  {
    input: {
      roleId: fixture.staffRole.id,
      objectPermissions: [
        {
          objectMetadataId: fixture.object.id,
          canReadObjectRecords: true,
          canUpdateObjectRecords: false,
          canSoftDeleteObjectRecords: false,
          canDestroyObjectRecords: false,
        },
      ],
    },
  },
  fixture.admin.token,
);
for (const key of ["a", "b"]) {
  await gql(
    `mutation($workspaceMemberId:UUID!,$roleId:UUID!){updateWorkspaceMemberRole(workspaceMemberId:$workspaceMemberId,roleId:$roleId){id roles{id}}}`,
    {
      workspaceMemberId: fixture[key].identity.workspaceMember.id,
      roleId: fixture.staffRole.id,
    },
    fixture.admin.token,
  );
  fixture[key].identity = await current(fixture[key].token);
  if (
    fixture[key].identity.workspaceMember.roles.length !== 1 ||
    fixture[key].identity.workspaceMember.roles[0].id !== fixture.staffRole.id
  )
    throw Error("Unexpected staff roles");
}
await saveFixture(fixture);
console.log(
  "Synthetic workspace ACTIVE; A/B/admin and read-only role saved to ignored mode600 fixture file.",
);
