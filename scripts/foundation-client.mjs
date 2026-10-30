import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
export const base = "http://127.0.0.1:3100";
export const fixturePath = new URL(
  "../.local/foundation-fixtures.json",
  import.meta.url,
);
export async function saveFixture(fixture) {
  await mkdir(new URL("../.local", import.meta.url), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2), {
    mode: 0o600,
  });
  await chmod(fixturePath, 0o600);
}
export async function loadFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}
export async function raw(query, variables = {}, token, path = "/metadata") {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return { status: response.status, ...(await response.json()) };
}
export async function gql(query, variables = {}, token, path = "/metadata") {
  const result = await raw(query, variables, token, path);
  if (result.errors?.length || result.status !== 200)
    throw Error(
      JSON.stringify({ status: result.status, errors: result.errors }),
    );
  return result.data;
}
export async function exchange(loginToken, origin) {
  return (
    await gql(
      `mutation($loginToken:String!,$origin:String!){getAuthTokensFromLoginToken(loginToken:$loginToken,origin:$origin){tokens{accessOrWorkspaceAgnosticToken{token}}}}`,
      { loginToken, origin },
    )
  ).getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
}
export async function login(person, origin) {
  const result = await gql(
    `mutation($email:String!,$password:String!,$origin:String!){getLoginTokenFromCredentials(email:$email,password:$password,origin:$origin){loginToken{token}}}`,
    { email: person.email, password: person.password, origin },
  );
  return exchange(result.getLoginTokenFromCredentials.loginToken.token, origin);
}
export const currentQuery = `query {currentUser{id disabled currentWorkspace{id activationStatus} currentUserWorkspace{id userId permissionFlags objectPermissions{objectMetadataId canReadObjectRecords canUpdateObjectRecords canSoftDeleteObjectRecords canDestroyObjectRecords}} workspaceMember{id userId roles{id label}}}}`;
export async function current(token) {
  return (await gql(currentQuery, {}, token)).currentUser;
}
