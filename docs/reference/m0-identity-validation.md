# M0-02 身份与原生只读验证

日期：2026-10-31 Asia/Shanghai。状态：身份与员工原生对象只读已通过自动验证；共享管理、工作流执行、浏览器 application token 仍有下述限制。不是 M0 人工验收或生产权限验证。

## 隔离与身份

仅操作 M0-01 的 `127.0.0.1:3100`、独立 PostgreSQL15432/Redis16379。通过 `signUp → signUpInNewWorkspace → activateWorkspace → signUpInWorkspace` 创建全新的 Company Helper M0 synthetic 工作区及随机 `.invalid` A/B/admin；未使用官方样本管理员、伪造 JWT、SQL 身份注入或现有3000业务数据。激活返回 ACTIVE。激活/加入后必须重新执行真实凭据登录及 login-token exchange；最初 signup token 的 pendingActivationUser context 不能作为可用原生写身份。

`node scripts/seed-foundation-fixtures.mjs` 创建一次性隔离 fixture；发现已有文件则拒绝重复创建。凭据、实际 user/member/workspace/role/object UUID 在忽略文件 `.local/foundation-fixtures.json`，权限600、目录700；不得把此文件提交或打印。`admin.identity.id`、`a.identity.id`、`b.identity.id` 为同一 User.id 域；`workspaceMember.id` 是另一 ID 域。

`getVerifiedIdentity({token})` 固定调用本地 `/metadata currentUser`，每次验证有效会话、`disabled === false`、工作区 ACTIVE、UserWorkspace 与 WorkspaceMember 的 userId 一致及成员存在。`createPrincipalResolver(config, verifier)` 再固定 workspace UUID 及受信角色 UUID；未知角色（含混合已知/未知）、缺失角色、错误工作区、上游错误全部拒绝。管理员来自实际 `workspaceMember.roles[].id` 与受信配置的交集，不使用标签、JWT 解码、请求 body 或角色 header。没有身份/权限缓存。

`resolvePrincipal(request)` 是供后续业务 API 接入的入口；服务端变量为 `TWENTY_WORKSPACE_ID`、`TWENTY_BUSINESS_ADMIN_ROLE_IDS`、`TWENTY_BUSINESS_STAFF_ROLE_IDS`。缺配置拒绝。员工映射 `customer.read/customer.update`，管理员另加 `customer.reassign`；这是 M0 固定角色到业务动作映射，不等于已实现负责人授权或生产功能权限管理。API 此任务仍只有 health 路由；后续任务接入业务命令和运行时变量。

契约在 `packages/contracts/src/identity.ts`；实现位于 `apps/business-api/src/auth/resolve-principal.ts` 与 `apps/business-api/src/integrations/twenty/identity-client.ts`。原生会话测试不是浏览器 application token 测试；后者明确交给 M0-03。

## 员工角色与真实矩阵

管理员通过支持的 metadata API 创建 `mZeroProbe/mZeroProbes` 和 M0 Staff Read Only 角色。角色所有全局更新/软删/永久删除/设置/工具/agent chat 权限为 false；不可分配给 agent/API key；permissionFlags 为空；只对 probe 对象 grant read，update/soft-delete/destroy 显式 false。A/B 各只有该角色。创建能力与 update 共用平台权限，不存在独立 create grant。管理员保留工作区实际管理员角色。

运行 `npm run test:integration -- tests/integration/native-readonly.test.ts` 必须有已就绪隔离服务和 fixture，缺失会失败，不当作跳过。`test:integration` 显式启用 `M0_NATIVE_INTEGRATION=1`；普通 `npm test` 默认跳过这10项有真实副作用的测试。完整含实时检查使用 `M0_NATIVE_INTEGRATION=1 npm test`。

| 通道 | A/B 每人实际请求 | 有效控制与检查 |
|---|---|---|
| GraphQL `/graphql` | 对同一 ID 可读；create/createMany/update/updateMany/delete/deleteMany/restore/restoreMany/destroy/destroyMany 全拒绝 | 每种相同有效操作均有 admin 成功控制；restore/destroy 使用真实已软删目标；拒绝后比较全部可见/已删 probe 的 id/name/deletedAt/updatedAt，分页未截断 |
| REST `/rest` | GET同一 ID；POST、POST batch、PATCH单条/批量、DELETE单条/批量（soft_delete=true）、PATCH单条/批量restore、DELETE单条/批量永久删除全拒绝 | 同上；响应400、code=PERMISSION_DENIED；正控制要求非空批量结果 |
| MCP `/mcp` | 管理员 catalog/learn_tools 确认生成名；execute_tool 调 create_one/create_many/update_one/update_many/upsert_many/delete_one/delete_many_m_zero_probe(s)，全拒绝 | admin 同名/同形状成功并非空结果；员工返回 isError=true、success=false、Tool … not found（按角色过滤的 registry），每次状态不变；无认证也拒绝 |
| shareWith create | 员工携带自身 member/FULL 的有效 GraphQL create请求拒绝，状态不变 | 对象 write guard 拒绝；未宣称成功创建或授予共享的 admin 对照 |
| MCP workflow create | A/B 的 create_complete_workflow 拒绝 | admin 成功创建不激活、无步骤的手动工作流；员工尝试前后管理员工作流列表和 probe 状态不变 |

GraphQL 拒绝为 `FORBIDDEN` / `PERMISSION_DENIED`，并检查权限消息，`GRAPHQL_VALIDATION_FAILED` 不计通过。MCP 不能直接以 generated tool name 调普通 tools/call：该模式先调用 `execute_tool` 并传入 `{toolName, arguments}`；早期直接调用连 admin 都报 Unknown tool，已纠正，不把它计作员工权限拒绝。CSV 没有独立导入服务端入口证据，覆盖客户端所调用的 bulk create/update/upsert，不把隐藏 IMPORT_CSV 按钮当成保障。写 AI 在此仅覆盖员工可调用的 MCP CRUD/工作流工具；没有连接模型、邮箱或运行 AI agent。

真实身份测试验证 A/B/admin 稳定且不同、body/header 伪造 actor/admin/owner 无效、非法 session 和错误 workspace 拒绝。另通过 admin 将 A 临时改为全拒绝且未配置角色：相同旧 token 下一次业务解析立即拒绝；finally 恢复 staff 角色后再次成功。disabled、暂停工作区、缺失/错配成员、GraphQL错误均有单元拒绝测试；未执行真实用户全局 disabled 或真实超时等待。

## 明确未验证/不可用

- `recordSharing` 对新建 probe 的 admin/A/B 返回 canManageSharing=false、generalAccessLevel=null、shares=[]。对象处于默认 unrestricted 模式。支持的 setRecordShare 在 admin/A/B 都返回 Record not found，属于不可用管理能力，**不是通过共享写权限拒绝测试**。没有切换 Enterprise/RLS/sharing flag、注入许可证或配置付费共享模式。不能据此声称所有共享模式已验证；业务投影上线前仍须检查升级和遗留授权。
- 初次内省 `/metadata` 与 `/graphql` 均未列出 `runCoreWorkflowVersion`，曾误判执行入口不可用。控制器后续直接请求 `/graphql` 已证实入口存在：不存在的版本 ID 在管理员请求中进入执行定义检查，而 A 返回 `FORBIDDEN` 权限拒绝。内省省略不能证明运行入口不存在，也不能据此认定构建产物落后。有效无副作用工作流的管理员正控制、A/B 拒绝与执行记录不变检查仍待补齐；MCP workflow 创建已测。
- 浏览器带用户 application token、只读 app role交集、前端 token刷新/CORS、服务 key 与用户委托隔离的实际页面检查属于 M0-03。本任务只证明 native真实user session的行为；未创建/使用 API key作为员工身份。
- 原生probe没有客户 owner/ownerVersion；负责人写授权、转交、审计、幂等仍属于后续任务。合成记录/未配置空角色/不激活的空工作流留在隔离环境用于重放验证，不涉及发信、模型调用或企业执行。

## 实际测试证据

1. identity resolver permissive stub：指定 workspace测试7失败；实现后7通过。identity client stub：7失败；实现后7通过。追加“staff+unknown角色组合”先出现1失败/7通过，严格映射后8通过；再补缺配置拒绝。
2. 初次实时矩阵因平台拒绝重复 root resolver 的 alias snapshot 而6失败/1通过；拆成两次读取后 GraphQL/REST通过。MCP 最初错误传输形状导致 admin控制失败，改为 execute_tool 后通过。后续加强非空批量正控制和工作流列表状态检查，实时10测试全部通过。
3. 首次裸全套扫描误包含 root暂存的忽略路径 `.local/twenty-cli-stage/**` 上游源码/模板，110 suite失败（共同原因是该隔离副本缺上游alias/test运行配置；例 write-define-file.spec.ts、doctor.spec.ts、validate-view-filter-operands.spec.ts、application-config.test.ts）。项目自身用例通过。新增 `vitest.config.ts` 明确只发现维护的 apps/packages/tests，隔离CLI副本并非项目测试或交付物。
4. 最终完整测试、类型与格式结果见同任务交付报告；依赖审计0 vulnerabilities。未更改原 Twenty 工作树/原 .env，未读取或写入3000工作区业务记录。

最终验证：`M0_NATIVE_INTEGRATION=1 npm test` **41 passed / 6 files**（10实时集成、16身份单元、15环境基线）；`npm run typecheck` exit0；`node --check scripts/seed-foundation-fixtures.mjs` exit0；`git diff --check` clean。合成人工登录清单保存于忽略的 `.local/m0-test-accounts.txt`（600），只含3100入口及A/B/admin邮箱/密码，不含token/API key或数据库凭据。此清单为后续完整M0人工验收准备，尚不表示用户已验收。
