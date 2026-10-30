# Company Helper CRM 业务扩展

把客户从驾照建档、企业办理到支付网关获批的业务整合进 Twenty。此目录是后续业务扩展与开发记录的固定入口；Twenty 上游源码和旧 company-helper 保持独立。

**当前状态：M0 开发中；隔离环境已运行，身份与业务权限尚待验证。** 已有业务 API 基础骨架，尚未迁入生产数据。更新时间：2026-10-31（Asia/Shanghai）。

## 阅读入口

| 文档 | 用途 |
|---|---|
| [里程碑计划](docs/MILESTONES.md) | 建设顺序、依赖、交付物与退出标准 |
| [当前进度](docs/STATUS.md) | 正在做什么、已完成什么、下一步与待决事项 |
| [首版范围](docs/SCOPE.md) | 用户确认的需求、技术建议及明确延后的功能 |
| [架构与数据设计](docs/ARCHITECTURE.md) | 数据权威来源、扩展方式、权限及异步任务边界 |
| [负责人权限规格](docs/specs/permissions.md) | 全员可看、负责人办理、管理员改派的完整规则 |
| [驾照建档与邮件规格](docs/specs/onboarding-and-mail.md) | 批量 OCR、邮件翻译与 AI 回复的流程和验收 |
| [源码与现状基线](docs/reference/current-system.md) | 参考版本、实际能力、已知缺口及迁移映射 |
| [M0 执行计划](docs/plans/2026-10-30-m0-foundation.md) | 下一阶段可以逐项执行的技术验证任务 |
| [M0 验证记录](docs/reference/m0-validation.md) | 实际启动、测试结果和限制 |
| [M0 人工验收](docs/acceptance/m0.md) | 交付时由用户执行的步骤；当前准备中 |
| [决策记录](docs/DECISIONS.md) | 为什么这样设计，以及哪些问题尚未决定 |
| [变更记录](docs/CHANGELOG.md) | 范围、模型、接口和行为的变化 |
| [最新开发日志](docs/journal/2026-10-31.md) | 每次工作的事实、验证证据和后续事项；历史记录保存在 journal 目录 |

## 已确认的首版方向

- 可以访问外网；使用 Twenty 作为内部 CRM 工作台，不做客户登录门户。
- 客户资料对有查看权限的员工可见；已设置负责人的客户，只能由负责人或管理员修改和办理；管理员可处理全部客户并改派。
- 支持驾照单张与批量上传、OCR、人工核对、查重及批量建档。
- 迁移邮件翻译、中文意图起草英文回复、中文回译、编辑、附件与人工确认发送。
- 保留企业人工办理与网关申请完整闭环。
- Hostinger、建站平台不纳入；企业自动申请、指纹浏览器及其他桌面功能暂缓。

## 目录约定

```text
company-helper-crm/
├── AGENTS.md                 工作与记录维护约定
├── README.md                 文档索引
├── scripts/check-docs.py     本地链接、行号及凭据模式检查
└── docs/
    ├── SCOPE.md              需求与范围
    ├── ARCHITECTURE.md       架构与数据边界
    ├── MILESTONES.md         总体里程碑
    ├── STATUS.md             当前进度
    ├── DECISIONS.md          决策与待决事项
    ├── CHANGELOG.md          变更历史
    ├── specs/               业务规格
    ├── plans/               分阶段执行计划
    ├── reference/           旧系统与平台证据
    ├── journal/             按日追加开发日志
    └── templates/           日志与变更模板
```

M0 已加入隔离环境脚本、业务 API 基础骨架与测试，后续按架构文档逐步扩展。此目录独立进行 Git 版本管理，不改写旧项目工作树，也不把文档混进 Twenty 上游代码。

## 如何持续维护

每个开发任务结束时同步更新进度与当日日志；行为、模型或范围改变时同步更新规格与变更记录；重大取舍追加决策。完成状态必须有验证证据，待验证内容明确标记。记录不含凭据或真实客户资料。详见 [AGENTS.md](AGENTS.md)。

文档修改后，在本目录运行 `python3 scripts/check-docs.py` 检查本地链接、代码行号、文档锚点及常见凭据模式；提交前运行 `git diff --check`（已暂存内容使用 `git diff --cached --check`）。这些检查不替代业务测试。
