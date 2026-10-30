# M0 执行验证记录

日期：2026-10-31（Asia/Shanghai）。本页记录实际执行结果；M0-02 及后续技术验证未执行。

## M0-01：隔离基线

- Twenty 源码：`ab962b01c4fdb26cf3cffcc770c7bed0c38bb53e`，已有 dist 复制到忽略目录 `.runtime/twenty/dist`；node_modules 只读引用原已安装依赖。未重新构建上游全部源码。
- Twenty Node：26.12.1，来自源码 `.nvmrc`；业务 API Node：24.22.0，TypeScript 编译后执行。
- PostgreSQL：`postgres:16`；Redis：`redis:7`；Docker Server 29.9.1。镜像 tag 尚未按 digest 固定。
- Compose 项目：`company-helper-crm-dev`；卷：`company-helper-crm-dev_postgres-data`、`company-helper-crm-dev_redis-data`。
- 端口：Twenty3100、API8788、PostgreSQL15432、Redis16379；后两者及 API 只监听 loopback。Twenty 仅供本机开发，不开放生产访问。
- 目标库：`company_helper_twenty_dev`、`company_helper_business_dev`，均为新建。Twenty 初始化完成后 `core.workspace` 行数为 0，无原工作区数据。

## 可复现操作

在本项目工作树、Node24 下执行：

```sh
npm ci
npm test
npm run typecheck
npm run dev
curl -fsS http://localhost:3100/healthz
curl -fsS http://127.0.0.1:8788/health
curl -fsS http://localhost:3000/healthz
npm run dev:stop
```

`npm run dev` 要求 macOS 用户 launchctl 会话、Docker 和 fnm 中的 Node26.12.1、固定 Twenty sibling checkout 及完整已有构建。首次自动创建两个数据库并依源码初始化/迁移、upgrade、flush、cron register。端口被占用即拒绝，不终止占用进程；重复启动运行中的环境会拒绝，先明确停止再重启。

秘密仅在忽略文件 `.local/dev.env` 和 `.runtime/twenty/.env`（均 600），目录 700。不要输出它们，也不要运行会展示展开凭据的 compose config 或完整 launchctl print。变量名为 `POSTGRES_USER`、`POSTGRES_PASSWORD`、`TWENTY_DATABASE_URL`、`BUSINESS_DATABASE_URL`、`REDIS_URL`、`APP_SECRET`、`ENCRYPTION_KEY`。未使用原 `.env` 或 APP_SECRET。`down` 只停止本项目唯一 launchctl labels 与 Compose 容器，保留卷和附件。

开发进程 labels 为 `org.codex.company-helper-crm-dev.server`、`.worker`、`.api`；日志为 `/tmp/company-helper-crm-dev-0.log`、`-1.log`、`-2.log`（600）。Twenty cwd `.runtime/twenty`、附件 `.runtime/twenty/storage`，API 编译产物 `.runtime/business-api`。启动会核对实际数据库中的迁移表；删除开发卷后即使保留本地标记也会重新初始化。勿触碰原环境。

## 实际检查结果

- `npm run test:integration -- tests/integration/dev-isolation.test.ts`：guard stub 返回全 true 时 10 failed/1 passed；真实 guard 后 11 passed。
- `npm test`：2 files / 12 passed；运行中及停止状态都验证过。`npm run typecheck`：exit0。
- `npm audit --audit-level=moderate`：升级 Hono node adapter 2.1.3+ 后 0 vulnerabilities。
- `npm run dev`：真实独立初始化完成、健康轮询通过；停止/再启动成功。
- Twenty3100 `/healthz`：200，`status=ok`。API8788 `/health`：200，`status=ok`、`environment=development`、`isolationId=company-helper-crm-dev`。
- 原3000 `/healthz`：启动前、启动后及重启后均200，`status=ok`。原进程和 DB/Redis 没有停止、改配置或写入。
- 独立 PG/Redis：Compose healthy，实际端口15432/16379；查询得到两个上述独立数据库名。
- worker：launchctl 活 PID，日志中处理 `CronTriggerCronJob` / `AgentCronTriggerCronJob` 成功，socket 指向15432/16379。
- frontend：3100 HTML返回200，`window._env_={}`；源码 fallback 使用 `window.location.origin`；注入 client-config 的 `serverUrl=http://localhost:3100`。未发现指向原3000的运行时配置。

## 限制与执行偏差

- npm install 异步完成晚于 guard 实现，第一次自动测试实际已绿。随后显式恢复 permissive stub，观察10个正确断言失败，再恢复实现观察绿。这是补做失效验证，不声称严格按红后编码执行。
- 仅健康与环境基线；尚无真实 A/B/admin、对象只读与受控写/SDK验收。业务 `/health` 表示 API 进程存活，不代表业务数据库完整 schema 或用户会话已实现。
- 初次 launchctl 使用 Documents 内日志导致 EX_CONFIG78，改为独立 `/tmp` 日志；使用与既有部署相同的 bash wrapper 后稳定启动。
- 一次诊断误输出生成的合成开发凭据，已立即对独立 DB 密码、APP_SECRET、ENCRYPTION_KEY 轮换，最后启动使用新值；没有读取或泄露原实例秘密。
- 不声明全仓 Twenty 测试、浏览器用户流程或离线部署通过。当前依赖现成本机 dist/依赖及 macOS launchctl；升级上游后须重新核验。

## M0-01 审查修复第 1 轮：IPv6 与服务身份

- 新增 `::1:3100` 的 IPv6-only 真实监听回归：旧预检错误认为端口空闲，实际观察 `expected true to be false`。未终止该监听进程；测试只关闭自己创建的 socket。
- 预检对每个固定开发端口依次检查 `127.0.0.1`、`::1`、`0.0.0.0`、`::`。macOS wildcard/reuse 行为意味着仅检查 wildcard 也不足；任一地址绑定失败即拒绝。各探针按序关闭，避免探针之间相互占用。
- 健康请求固定 `127.0.0.1`，不依赖 localhost 的地址族解析；成功前从唯一 launchctl label 读取 PID，核验实际 `ps` 命令完整匹配预期 Node/入口，并以 `lsof` 验证该 PID 拥有 HTTP 监听端口。server、worker、API 在最终成功前再次核验存活与身份。读取的完整 launchctl 状态仅用于内存解析，不打印。
- 新增真实子进程测试：正确身份与端口通过；错误命令、未持有监听端口、已退出 PID 拒绝。先在空实现观察2 failed，再实现后通过。
- 最终 `npm test`：3 files / 15 passed；`npm run typecheck`：exit0。实际隔离 stop/up 后健康与身份检查通过；原3000保持200。
- 修正初始化检查对大小写混合迁移表名的错误识别，使用 information_schema 精确表名，避免每次重启多跑迁移。
- 执行报告保留在忽略的 `.superpowers/sdd/2026-10-30-m0-foundation/task-1-report.md`，已从 Git 索引移除；持久验证依据为本页。
