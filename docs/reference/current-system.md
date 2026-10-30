# 当前系统与迁移参考基线

核验日期：2026-10-30（Asia/Shanghai）。本文记录已取得的证据、目标映射建议和迁移前检查项，不表示业务扩展已实现、数据已迁移或生产链路已验收。当前实施边界见 [AGENTS.md](../../AGENTS.md)、[首版范围](../SCOPE.md)；目标设计见 [架构](../ARCHITECTURE.md)、[负责人权限](../specs/permissions.md)、[建档与邮件规格](../specs/onboarding-and-mail.md)。

## 1. 证据来源与版本边界

| 来源 | 本次可确认的范围 | 使用限制 |
|---|---|---|
| `/Users/tian/Documents/code/company-helper` | 最初检查的目录；HEAD 为 `107abafa`（2026-10-26），工作树有未提交改动 | 旧提交与本地改动混合，不能作为当前业务基线；本文代码证据改指向下面的 main 工作树 |
| `/Users/tian/.codex/worktrees/main-integrated/company-helper` | 当前参考 main，提交 `1e3f19f214780062ac2724f6e06caf4ee277eccd`（2026-10-29）；实体、约束、模块入口已只读核验 | 源码存在不等于线上功能成功运行；未证明生产部署与该提交逐字节相同 |
| 线上旧业务工作台 | 主代理完成页面核验，导航包含客户、网关申请、企业申请、域名、邮箱、浏览器、代理、卡头查询、账单模板 | 页面可见只证明入口存在；没有导出生产数据，也未完成真实发信、企业设立或 EIN 自动申请验收 |
| `/Users/tian/Documents/code/monirensheng/twenty` | 主代理检查的 Twenty 本机源码基线为 `ab962b0`，并完成下面列出的 MCP 协议核验 | 本机提交不能替代运行服务版本核对；MCP 连通不代表本项目的对象、权限或业务流程已实现 |

后续复核代码时应同时核对仓库、提交和行号。本文绝对文件链接指向本机 main 工作树；若工作树更新，须重新确认引用内容。文档不保存令牌、密钥、生产客户资料或邮件正文。

### 1.1 已纠正的旧版本判断

- **Hostinger 和建站已移除。** main 的约定明确记录 2026-10-29 的 D-167；域名、邮箱由员工手工维护，网站在其他服务建设。旧目录中的 hosting、sites、采购等实现不进入本项目目标模型。[源码约定](/Users/tian/.codex/worktrees/main-integrated/company-helper/AGENTS.md:3)
- **PDF 转 HTML 已不在 main 当前工具中。** 本次不迁移该功能；不能用旧目录仍有的实现反推当前范围。
- **Grist 的同步表是历史结构。** main 明确不恢复 Grist 导入、MCP、客户或代理同步；残留同步表仅服务迁移和审计，不能认定集成正在运行。[约定](/Users/tian/.codex/worktrees/main-integrated/company-helper/AGENTS.md:74)、[退役表说明](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/grist-sync.ts:1)
- **企业办理状态字段已退役。** `companies.registration_status/registration_note` 仅保留历史值；当前企业申请维护订单自己的状态。新增的 `formed_on`、`service_phone` 需要纳入字段核对。[企业字段](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:117)
- **账单模板不是本地持久 documents 模型。** 当前 company-helper 适配层使用内存任务和一小时 TTL，调用外部渲染服务的 `/render`、`/jobs/:id/pdf`。外部服务自己的存储实现尚未核验。[任务服务](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/tools/statement-templates/service.ts:26)、[远端接口](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/integrations/statement-templates/client.ts:121)

### 1.2 Twenty MCP 已完成的核验

以下为主代理的会话实测摘要；本文作者未重复连接或读取配置中的凭据。

- `initialize` 返回 HTTP 200，服务自报 `Twenty MCP Server 0.1.0`，协议 `2025-06-18`。
- 已读取 `tools/list`，通过 `learn_tools` 查看对象元数据、字段元数据、完整工作流、视图和工作流列表相关工具 schema。**查看 create 工具的 schema 不等于执行创建。**
- 已只读执行 `list_object_metadata_names`、`get_object_metadata`、Person 的 `get_views` 和 `list_workflows`。
- 工作流列表当时有两条 ACTIVE：`Quick Lead`、`Create company when adding a new person`。**正式导入前应审查并暂停会对导入产生副作用的自动化，或提供等效的导入隔离机制，避免重复创建企业；本次尚未暂停它们。**
- 本机 MCP 配置已写入，配置文件权限为 `600`；当前会话的原生工具列表尚未热加载，本次通过直接 MCP 协议验证。没有通过该核验创建业务对象、字段、客户或工作流。

## 2. 当前实体到目标模型的映射

下表中的目标名称是本项目设计用语，实际 Twenty metadata 名称与字段以规格和实施结果为准。

| 当前实体及含义 | 目标映射 | 必须保留或澄清的关系 |
|---|---|---|
| `customers`：业务档案入口，含编号、归档、删除冻结、有效获批完成标记 | **CustomerCase：客户档案/服务案件** | 保留来源 ID 和客户编号；它不等于自然人唯一身份，也不等于办理出来的公司。[证据](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:29) |
| `person_profiles`：姓名、生日、联系方式及身份资料 | **Person：自然人** | 当前以 customer_id 为主键，实际是档案的 1:1 子表；不能仅凭姓名或邮箱自动合并成唯一自然人。[证据](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:55) |
| `companies`：该档案中的法律实体资料 | **Company：法律实体** | 本项目中 Company 明确表示 LLC 等法律实体，不能默认是委托服务的客户组织。Person、CustomerCase 与 Company 显式关联；首次导入可保留原 1:1，不把这个来源限制当未来不可变规则。[证据](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:102) |
| `bank_profiles`：银行名称、账号、Routing Number | CustomerCase/Company 关联的受限银行资料 | 当前仍以 customer_id 为主键；迁移前确认账户所属主体，不从字段所在页面推断银行账户必然属于公司。[证据](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:143) |
| `company_filings`、`ein_applications` | FormationApplication、EinApplication | EIN 当前与设立单 1:1。首版保留人工办理和历史记录，桌面自动执行不迁；设立单不是法律实体本身。[证据](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/filings.ts:191)、[EIN 关联](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/filings.ts:361) |
| `dictionary_items` 的 gateway_platform、`applications` | 网关平台、GatewayApplication | 平台、一次申请、获批后的商户账号分别建模；当前没有独立网关商户账号实体的证据，不把 approved 自动转换成可运营账号。[申请字段](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/applications.ts:99) |
| `requirements`、`requirement_outcomes`、状态变化、邮件归属 | 申请要求、处理记录、申请事件及邮件证据 | 保留原文证据引用、来源、处理人和时间，不能只导入最终状态。[要求记录](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/applications.ts:249) |
| `files`、`attachments`、申请字段/文件定稿 | 材料记录、不可变内容、ApplicationSnapshot | 当前附件与开始申请时的定稿分别保存；替换当前文件不能改变历史定稿。[材料](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/files.ts:41)、[定稿](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/applications.ts:152) |
| `domains`、`domain_bindings`、`mailboxes`、邮件会话/消息/草稿 | 申请所需域名、Mailbox、邮件会话与回复 | 域名手动登记；商业邮箱独立于 Person 的个人邮箱；当前一档案一个域名及商业邮箱。只保留业务资产引用和邮件能力，不引入 Hostinger 管理对象。[域名](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/domains.ts:1)、[邮箱](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/mail.ts:22) |
| 网站相关旧结构和企业旧 website 字段 | 必要的网站业务资产引用；其余历史归档 | 不迁建站、部署、主机采购或 Hostinger MCP；旧 website 字段已退役，具体取值需导入时核对，不视作活跃网站管理记录。[退役字段](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:119) |
| `onboarding_batches/items`：上传、识别、确认、重复处理、逐项提交 | 批量驾照建档工作流 | **首版必须包含**；保留每项独立结果、可重试失败项、原图与人工确认关系。[流程](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/onboarding/service.ts:1)、[逐项提交](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/onboarding/service.ts:247) |
| 账单模板工具、州申请付款记录 | 工具集成；必要的付款历史摘要 | 模板 PDF 不是财务账簿，也不是已实现的永久文档库。当前没有完整应收应付、总账或对账模型的证据。[模板服务](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/tools/statement-templates/service.ts:31)、[付款尝试](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/filings.ts:330) |
| 卡头目录与查询页面 | Web 查询工具 | 保留目录查询和来源信息，不把卡头目录当作客户付款卡、完整卡号或账务记录。[目录模型](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/web/src/features/tools/bin-lookup/model.ts:13)、[查询页面](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/web/src/features/tools/bin-lookup/bin-lookup-page.tsx:29) |
| 内部 IM、Grist 来源、浏览器/代理/设备、AI 检查点 | 分类归档或保留原服务，迁移范围单独决定 | 内部消息不能误导入客户邮件；桌面 RPA、指纹浏览器、代理与设备执行推迟；旧执行状态不能自动恢复为新任务。[内部消息](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/chat.ts:23)、[设备任务](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/platform.ts:200) |

## 3. 关键兼容项与新增规则

### 3.1 客户负责人是新需求

旧 `customers` 只有 `created_by`，没有客户负责人；旧 `applications.owner_id` 是某次网关申请的负责人。新 CustomerCase 的负责人必须独立定义，不能直接取建档人、最后修改人或任意一条历史申请负责人。历史导入需有可审查的负责人分配表；建议将无可靠来源的列入待分配清单，不静默猜测。无负责人客户如何办理仍是范围规格的待决项。[客户创建信息](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:48)、[申请负责人](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/applications.ts:112)

用户已确定：员工按功能权限查看客户；有负责人的客户只能由负责人或管理员修改、办理，管理员可处理全部客户并改派。该授权必须覆盖 API、批量导入、附件、申请、发信、AI 工具和后台写回，并在执行时读取真实身份及当前归属。旧系统的动作 RBAC 不能直接证明新规则已实现：邮箱访问检查目前只验证目标存在和动作权限。[旧权限入口](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/permissions/http-middleware.ts:8)、[旧邮箱访问检查](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/mail/access.ts:15)

### 3.2 历史身份、字段归因和状态不能混用

- 重复检测只提示，不自动合并或拒绝；EIN 表也明确考虑同一自然人对应多个档案。自然人去重要有人工确认及合并映射，不能删除来源身份。[重复检测](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/onboarding/duplicates.ts:1)、[EIN 自然人约束](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/filings.ts:372)
- `field_attributions` 只表示字段当前值的最后一次操作人、来源、时间和版本，不是完整修改历史。导入后保留原 actor 与触发人；迁移账号只是执行导入的主体，不能覆盖历史归因。[归因结构](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:157)
- 客户完成、归档、删除冻结与当前申请状态是不同维度；Company.ready 是资料齐备的派生条件，不是“企业办理已完成”。[客户标记](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:37)、[企业就绪](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/customers.ts:128)
- 单在办仍是现行业务约束：网关申请按状态性质判断；冲突记录未处理时不得新增。目标实现需保留服务端并发保证，不能只用页面按钮限制。[业务规则](/Users/tian/.codex/worktrees/main-integrated/company-helper/docs/business/business-rules.md:131)、[服务端检查](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/applications/start.ts:60)、[数据库约束](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/applications.ts:141)

### 3.3 材料草稿与定稿

当前材料桶为 `person/company/supplementary/draft`，还有 `source` 与 `isLicenseEvidence`；旧 section、kind 和 proofType 允许为空或仅保留历史用途。**draft 不参与材料审核和申请定稿。** 这不表示草稿应被删除：若迁移草稿，应保留草稿属性，不能自动升级为正式材料。[附件分类](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/db/schema/files.ts:16)、[审核范围](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/reviews/service.ts:54)、[定稿排除 draft](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/applications/start.ts:101)

开始申请在同一事务中写申请、字段定稿、不可变文件内容引用和首条状态记录。迁移时必须保留当时字段、当时归因、负责人、确认人和材料内容，不能用今天的档案重建历史定稿，也不能只保存会变化的当前附件链接。[原子创建与定稿](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/applications/start.ts:60)

### 3.4 邮箱 AI 和纯翻译

邮箱 AI 回复及翻译是首版范围。旧代码已有“中文回复意图→英文稿→回译→防编造检查”，结果先落草稿，发信使用独立接口。[起草](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/mail/ai.ts:211)、[起草/发送路由](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/mail/routes.ts:168)

旧“读懂邮件”同时涉及分类、归属、补充要求和申请状态推进，不能直接作为新“纯翻译”的实现。新纯翻译不得顺带发送、推进申请或写补件；这些动作需要分别授权和记录。迁移历史邮件时也不能默认全部重新运行旧读懂图，否则可能改写当前申请状态。[旧读懂流程](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/mail/read-graph.ts:1)

发送必须保留幂等与结果未知语义：SMTP 接受不等于送达；`sending/unknown` 不能因重启或导入自动重发。旧发信成功后还会调用业务推进逻辑，新实现需显式界定该动作及负责人授权。[发信状态](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/mail/send.ts:58)、[发送后处理及 unknown](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/modules/mail/send.ts:118)

### 3.5 文件、凭据和执行状态

文件按 SHA256 内容寻址，当前磁盘存储保存原始内容；外部服务凭据另用主密钥派生的 AES-GCM 加密。应分别迁移文件内容、元数据和凭据引用，不把旧密文当作目标服务可直接解密的字符串，也不把密钥放入普通 CRM 字段。身份证明、银行资料和付款卡凭据不能随通用导出扩散。[文件存储](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/lib/file-store.ts:18)、[凭据加密](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/lib/crypto.ts:1)

当前存在 REMOTE_RUNTIME 模式；LangGraph 检查点与模块后台恢复也独立于 CRM 记录。正式迁移前要确认文件与 worker 的实际归属，不能仅凭本机目录推断线上存储位置。新系统不会因导入旧 queued/running/unknown 字段就恢复外部操作。[启动装配与恢复](/Users/tian/.codex/worktrees/main-integrated/company-helper/apps/server/src/index.ts:62)

## 4. 迁移前核对清单

以下均为待实施检查，本次文档工作没有执行生产迁移或停用自动化。

1. **确认快照边界。** 核对线上部署版本、实际 migration 版本、数据库/文件/worker 归属，生成一致的只读快照与备份；记录导出时间和变更截止点。
2. **盘点数量和关系。** 各实体计数、孤儿引用、归档/删除中档案、重复自然人/法律实体、EIN/域名冲突、在办冲突、未完成建档、失败和 unknown 操作分别列出，不在导入时静默修复。
3. **确定负责人。** 建立旧用户到目标成员的映射和 CustomerCase 负责人分配表；保留已停用人员的历史归因。旧用户名不能自动当目标登录邮箱，旧 created_by 不能自动当 owner。
4. **固定可重跑映射。** 每条迁移记录记录 sourceSystem、sourceEntity、sourceId、sourceUpdatedAt、migrationBatchId；保存新旧 ID 对照及人工合并决定，重复执行不能产生重复档案、公司或申请。
5. **隔离导入副作用。** 审查目标 ACTIVE 工作流，尤其是添加 Person 时创建 Company 的自动化；正式导入前暂停或隔离，记录恢复条件。来源的邮件 AI、桌面领单和外部执行也要在切换窗口协调，避免两个系统同时写入。
6. **按依赖顺序导入。** 先用户映射/字典，再 Person、Company、CustomerCase 及关联；随后申请、材料、定稿、状态事件、邮件及要求。草稿维持草稿，历史来源维持历史来源，退役资源按归档方案处理。
7. **单独验证文件与凭据。** 核对二进制 SHA256、大小、类型、原名和所有引用；区分当前材料、移除标记、定稿和 IM 附件。凭据走专门重新接入或受控重加密步骤，不进入报告和普通导入文件。
8. **核实不可逆操作。** 对发信、申请提交、EIN、支付等已开始但结果未知的记录核验结果，不重放。首版企业人工办理记录不启动旧桌面执行器。
9. **验证业务和授权。** 用合成样本验证批量驾照部分失败、重复处理、纯翻译无业务副作用、回复确认、发送幂等、负责人变更后的即时授权、单在办并发和定稿不可变性；UI、API、AI 和后台入口均要覆盖。
10. **对账后切换。** 对比实体数、关系数、关键字段、有效获批完成标记、状态与事件、文件 hash、定稿内容和原操作人；确认差异清单后再做最终增量及主写权切换。保留只读旧系统和回滚所需快照。

## 5. 尚未验证的事项

| 事项 | 当前证据 | 后续所需验证 |
|---|---|---|
| 生产部署与 main 提交是否完全一致 | 页面与 main 的模块范围一致；没有完整发布校验 | 读取可核对的发布版本和 migration 标识；不能据此文件直接宣称生产 hash 一致 |
| 数据量、重复率、文件完整性、生产任务状态 | 只读源码及页面核验，没有生产数据导出 | 经授权的脱敏统计和一致快照核对 |
| 账单模板端到端可用性 | 线上核验时渲染链路出现重试提示；main 有外部调用适配层 | 用合成输入验证生成、预览、下载、过期和错误恢复；不把重试提示解释成自动重试策略或成功产出 |
| 企业设立/EIN 生产自动执行 | 有 schema、设备任务及流程代码 | 未证明真实生产自动链路成功；本期不迁桌面执行，保留人工办理记录 |
| Twenty 对象与扩展界面 | MCP 元数据读取和工具发现成功 | 在开发环境实现并验证目标对象、关系、视图及业务入口 |
| 客户负责人授权 | 用户已确认需求，旧系统不具备该客户字段和完整规则 | 按功能权限与 owner 联合授权，验证所有服务端写入口、AI 工具及后台任务 |
| Twenty 邮件能力与现有 IMAP/SMTP 的衔接 | 旧系统邮箱明确支持手工服务器配置；未完成目标邮箱接入演练 | 确定邮件同步、草稿、翻译与发送的唯一主写服务，验证重复收信、回复关联和 unknown 处理 |
| 批量驾照识别与 AI 回复的目标实现 | 原系统已有可参考流程；首版范围已确认 | 用合成材料和邮件跑完整流程、权限和幂等验收；源码参考不计作目标实现完成 |
| 历史 IM、退役集成、运行检查点的保存边界 | 有相应源表和文件引用 | 明确只读归档、保留原服务或选择性迁移，不默认恢复运行 |

当前结论仅支持进入有范围约束的设计和开发：以 CustomerCase、自然人、法律实体、办理记录和材料证据为核心，首版补齐客户负责人授权、批量驾照建档与邮箱 AI；允许外网，不迁 Hostinger、建站和 PDF 转 HTML，桌面执行能力推迟。

## M0-01 隔离运行基线（2026-10-31，Asia/Shanghai）

已在独立工作树建立并实际启动 Twenty server/worker 与业务 API；原实例 3000 的只读健康检查仍返回 200。开发地址为 Twenty 3100、业务 API 8788、PostgreSQL 15432、Redis 16379，Compose 项目固定为 `company-helper-crm-dev`。两个新库分别为 `company_helper_twenty_dev`、`company_helper_business_dev`，未读取原 `.env`、业务库或 MCP 写 key。

Twenty 固定源码提交 `ab962b01c4fdb26cf3cffcc770c7bed0c38bb53e`，采用已有编译产物的隔离副本；其 `.nvmrc` 指定 Node 26.12.1，业务工作区使用 Node 24.22.0。源码 package scripts 和根部署脚本解析到 `dist/main.js`、`dist/queue-worker/queue-worker.js`，不在原源码 cwd 启动。原 datasource 会以 `override:true` 加载 cwd `.env`，因此启动目录、配置、密钥与本地附件存储全部独立。`LOGIC_FUNCTION_TYPE=DISABLED` 保持禁用；尚未证明 SDK 安装与真实用户权限链路。

启动/停止及真实测试证据见 [M0 验证记录](m0-validation.md)。这只完成 M0-01 的环境基线，不表示 M0 或首版业务已验收。
