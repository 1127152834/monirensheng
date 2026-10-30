# Company Helper CRM M0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用合成客户与 A/B/管理员三种身份，证明 Twenty 扩展页面、用户身份、原生只读权限和负责人受控写接口可以组成可用方案。

**Architecture:** 新建独立开发环境与最小业务 API，通过支持的 Twenty 扩展方式展示一个客户样本。Twenty 原生业务对象对员工只读，业务 API 解析真实会话并按当前负责人执行写入。此阶段不迁真实业务，不开放发信或企业自动执行。

**Tech Stack:** Node 24、TypeScript、npm workspaces、Hono、Zod、Drizzle/PostgreSQL、Twenty SDK、Vitest、Playwright；数据库和 Redis 使用独立 Docker Compose 项目。

**Spec:** [架构](../ARCHITECTURE.md)、[范围](../SCOPE.md)、[权限规格](../specs/permissions.md)。

状态：开发中，M0-01 已验证，正在进入 M0-02。未勾选的文件、命令和测试仍为计划，不代表已经存在或已经通过。所有路径相对业务扩展仓库根目录。

验收约定：M0 自动验证完成后交付可访问环境、合成 A/B/admin 账号和人工验收清单，等待用户亲自测试通过后再进入 M1。

## Global Constraints

- 可以访问外网；不迁移 Hostinger 和建站平台。
- 首版必须包含批量驾照建档、邮箱 AI 回复及翻译。
- 员工可按功能权限查看客户；有负责人的客户只能由负责人或管理员修改、办理；管理员可处理全部客户并改派负责人。
- 企业自动申请、指纹浏览器、代理/设备执行等桌面能力暂不迁移；首版保留企业人工办理记录。
- 纯翻译不能顺带推进申请状态。发送邮件、更新申请、写入补件属于独立业务动作。
- 不修改现有 localhost:3000 工作空间，不复用其数据库、APP_SECRET 或管理员 MCP 写 key 作为测试环境身份。
- 测试只使用合成客户、虚构邮箱和假发送器；凭据保存在忽略的本机文件，文档只记录变量名。

## Review Focus

1. 启动脚本误连现有数据库或端口：预检拒绝，既有服务仍正常（M0-01）。
2. 客户端伪造 userId、ownerId 或管理员标志：后端只采用经验证身份（M0-02）。
3. 原生共享/导入/MCP/工作流绕过只读角色：实际接口拒写，不能仅测按钮隐藏（M0-02/M0-03）。
4. A 打开页面后转交给 B：A 的保存和尚未执行的动作失效，B 可处理（M0-04）。
5. SDK 组件缺乏可信身份或被运行时禁用：明确报告失败，不能把服务 key 下发作为绕行（M0-03）。

## 计划接口

```ts
type Principal = {
  userId: string;
  workspaceId: string;
  isBusinessAdmin: boolean;
  permissions: string[];
};
type CustomerAccess = {
  id: string;
  ownerUserId: string | null;
  ownerVersion: number;
};
type BusinessAction = 'customer.update' | 'customer.reassign';
type CheckResult = { name: string; ok: boolean; message: string };
type PreflightConfig = {
  environment: 'development';
  isolationId: 'company-helper-crm-dev';
  twentyPort: number;
  businessApiPort: number;
  twentyDatabaseUrl: string;
  businessDatabaseUrl: string;
  redisUrl: string;
};
```

M0 样本客户必须有明确 owner，不替 Q-01 决定正式无负责人策略。运行时出现未定义的分配策略时拒绝执行并返回需配置错误，不临时放开权限。

## M0-01：隔离环境与可复现基线

**Files:**
- Create: `package.json`、`package-lock.json`、`tsconfig.base.json`、`.env.example`。
- Create: `dev/compose.yaml`、`scripts/dev-preflight.mjs`、`scripts/dev-twenty.mjs`。
- Create: `apps/business-api/package.json`、`apps/business-api/src/app.ts`、`apps/business-api/src/index.ts`。
- Test: `tests/integration/dev-isolation.test.ts`。
- Update: `docs/reference/current-system.md`。
- Record: `docs/reference/m0-validation.md`（在执行时创建）。

**Interfaces:**
- Consumes: 固定 Twenty checkout、现有编译/启动路径及本机 Docker 能力，只读核验后使用。
- Produces: `runPreflight(config): Promise<{ok: boolean; checks: CheckResult[]}>`；独立开发 API `/health`；独立 Twenty 与业务数据库的连接配置。

- [x] 写 `dev-isolation.test.ts`：现有端口 3000 或原数据库目标被传入时预检失败；缺少隔离标识时失败；测试数据源与现有环境不相同。
- [x] 建立运行该测试所需的最小 workspace/脚本，执行 `npm run test:integration -- tests/integration/dev-isolation.test.ts`，确认因隔离逻辑尚未实现而失败。
- [x] 实现预检及启动脚本。默认开发端口候选为 Twenty 3100、业务 API 8788、PostgreSQL 15432、Redis 16379；占用时明确报错，不杀进程或擅自换到现有环境。固定 Compose 项目名 `company-helper-crm-dev` 和独立卷。
- [x] 从当前 Twenty 源码的启动定义解析实际入口，显式传入隔离环境。保持主实例不变；需要函数运行时调整时只改开发配置并记录理由。
- [x] 运行隔离测试、独立实例健康检查及既有 3000 的只读健康检查；结果写入验证报告。成功后单独提交此任务文件。

实际证据：15 项自动测试、类型检查、隔离停止/重启和原实例健康验证通过，任务审查已关闭；首次 red/green 执行顺序有偏差，详见 [验证记录](../reference/m0-validation.md)。

**完成条件：** 开发实例可独立启动/停止，测试不会读写当前业务库；报告记录真实版本、端口与检查结果，不记录密钥。

## M0-02：验证真实身份及原生只读对象

**Files:**
- Create: `packages/contracts/package.json`、`packages/contracts/src/identity.ts`。
- Create: `apps/business-api/src/auth/resolve-principal.ts`、`apps/business-api/src/auth/resolve-principal.test.ts`。
- Create: `apps/business-api/src/integrations/twenty/identity-client.ts`。
- Create: `scripts/seed-foundation-fixtures.mjs`。
- Test: `tests/integration/native-readonly.test.ts`。

**Interfaces:**
- Consumes: M0-01 隔离实例和配置。
- Produces: `resolvePrincipal(request: Request): Promise<Principal>`；`getVerifiedIdentity(authContext): Promise<{userId; workspaceId}>`；A/B/admin 合成用户与只读业务测试对象。

- [ ] 写身份测试：有效受支持用户会话返回对应稳定 ID；失效会话和错误 workspace 拒绝；body/header 中的自报 userId、ownerId、isAdmin 不改变身份结果。
- [ ] 执行 `npm --workspace @company-helper-crm/business-api run test -- src/auth/resolve-principal.test.ts`，确认未实现的身份解析测试失败。
- [ ] 根据当前 Twenty 的受保护 `currentUser` 与受支持用户授权方式实现适配。必须验证 workspace 成员关系；管理员身份来自受信角色映射。若扩展无法获得支持的用户上下文，记录阻断原因，不改为信任请求参数。
- [ ] 在独立实例创建 A/B/admin 和一个无敏感数据的业务对象，给普通角色读权限并拒绝新增/修改/删除，清除可扩权的样本共享授权。后端写身份与员工查询身份分离。
- [ ] 写并执行 `npm run test:integration -- tests/integration/native-readonly.test.ts`：A/B 可以原生读取，原生 REST/GraphQL 和员工可用的 MCP 写路径拒绝；导入/工作流/写 AI 权限不能绕过。使用真实平台响应，不能只 mock 权限结果。
- [ ] 将实际能力、角色配置、失败入口和验证命令记录到 M0 报告；身份和权限验证通过后提交。

**完成条件：** 身份不可伪造、全员可读、原生业务写受控。若某通道不可用，应记录“不可用/未验证”，不把跳过写成测试通过。

## M0-03：扩展页面与负责人受控写入

**Files:**
- Create: `apps/twenty-app/package.json`、`apps/twenty-app/src/application.ts`。
- Create: `apps/twenty-app/src/objects/foundation-customer.ts`、`apps/twenty-app/src/components/foundation-customer.tsx`。
- Create: `apps/business-api/src/modules/customers/access.ts`、`access.test.ts`、`foundation-routes.ts`。
- Create: `apps/business-api/src/db/schema/foundation-customers.ts`。
- Test: `tests/e2e/foundation.spec.ts`。

**Interfaces:**
- Consumes: `Principal`、`resolvePrincipal`、M0-02 原生只读角色。
- Produces: `assertCustomerAction(principal: Principal, customer: CustomerAccess, action: BusinessAction): void`；`PATCH /api/foundation/customers/:id`，请求 `{displayName, expectedOwnerVersion}`。
- 原生测试对象仅保存投影；真实权限和当前 owner 从业务存储取值。

- [ ] 写 `access.test.ts`：A 写 A 负责客户成功；B 写该客户失败；管理员成功；非管理员 reassign 失败；缺少对应功能权限仍失败。
- [ ] 执行 `npm --workspace @company-helper-crm/business-api run test -- src/modules/customers/access.test.ts`，确认授权逻辑实现前失败。
- [ ] 实现有版本检查的合成客户更新接口。对象归属由后端读取，服务写凭据不出现在响应、组件包或日志中。
- [ ] 用 Twenty SDK 的实际支持方式构建一个最小组件及导航入口：展示客户/负责人，负责人和管理员可通过表单更新合成显示名，其他员工可查看。前端按钮不是唯一授权。
- [ ] 验证开发配置下组件安装和身份传递；记录 DISABLED runtime 是否影响所选路径。若需不同 SDK 方案，先更新决策，再实施，保留可复现记录。
- [ ] 执行 `npm run test:e2e -- tests/e2e/foundation.spec.ts`，覆盖 A/B/admin 登录、读取和服务端拒绝；对组件构建产物进行服务凭据泄露检查。通过后提交。

**完成条件：** 原生读视图和自定义写入口共同可用，不能用业务 API 单元测试替代浏览器和真实平台集成验证。

## M0-04：改派、并发与后续任务边界

**Files:**
- Create: `apps/business-api/src/modules/customers/reassign.ts`、`reassign.test.ts`。
- Create: `apps/business-api/src/modules/jobs/authorize-execution.ts`、`authorize-execution.test.ts`。
- Test: `tests/integration/ownership-handover.test.ts`。
- Update: `docs/reference/m0-validation.md`、`docs/STATUS.md`、`docs/DECISIONS.md`、当日日志。

**Interfaces:**
- Consumes: `Principal`、`CustomerAccess`、`assertCustomerAction` 与真实身份适配。
- Produces: `reassignCustomer({customerId, newOwnerUserId, expectedOwnerVersion, principal})`；`assertExecutionAuthorization({customerId, actorUserId, expectedOwnerVersion, action})`。
- 当前 ownerVersion 和客户写入在同一锁/事务边界检查，不能检查完后无条件写。

- [ ] 写测试：管理员将 A 的客户转给 B，ownerVersion 增加；A 旧页面保存拒绝，B 新请求成功；历史 createdBy 和已发生事件的 actor 不被重写。
- [ ] 写任务执行测试：A 排队的假“发送”在转交后被拒，假发送器调用次数为 0；已记录发送成功的结果不被改成未发送。
- [ ] 执行对应单测确认实现前失败，再实现事务改派、执行时重新授权及审计事件。
- [ ] 执行 `npm run test:integration -- tests/integration/ownership-handover.test.ts`，覆盖转交与保存/执行并发，不使用真实 SMTP。
- [ ] 完成 `npm run typecheck`、适用单元/集成/E2E 检查，整理通过与未验证清单；只对全部退出标准满足的 M0 标完成。
- [ ] 自审范围与接口一致性，提交此任务，补写 M1 可执行计划；Q-01 未决定前不正式实现建档的默认分配策略。

## 自审与执行顺序

M0-01 → M0-02 → M0-03 → M0-04。身份、平台权限和前端接入有依赖，不应四个任务同时修改。任务内部独立的测试/证据核对可以并行。

计划自审已覆盖：范围、接口名称、五项 Review Focus、真假平台验证区分、既有服务保护和无真实外部副作用。运行结果仍为空；执行时在日志中填写实际命令与结果，不能从本计划复制“预期通过”作为证据。
