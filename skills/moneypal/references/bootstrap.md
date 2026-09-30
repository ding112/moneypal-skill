# MCP 与 MoneyPal 启动检查

本文件用于首次准备环境，或主 Skill 已确认 CLI 无法使用、运行时不可用时的恢复。日常请求仅因 MCP 不可见，不进入本文件，先按主 Skill 使用官方 CLI。账本错误只参考本文件的账本说明，不触发环境准备。

安装只有一个入口：包外的 `install.ps1` / `install.sh`；诊断与修复使用包内 `mcp-moneypal doctor` 与 `mcp-moneypal setup`。助手完成可执行且已授权的操作；每阶段简述目的、实际结果和下一步。

宿主相关命令必须显式带 `--host`，可用值为 `workbuddy`、`qoder`、`qoderwork`。宿主参数只决定接入指引，不证明实际安装来源；命令本身不会读取或修改任何宿主配置。

## 选择起点与授权

| 当前证据 | 从哪里继续 |
| --- | --- |
| MoneyPal `finance_*` 工具已经可调用 | 直接完成首次验收或当前请求 |
| 首次准备时工具不可调用，或日常请求已确认 CLI 不可用、运行时不可用 | 先运行第 2 节无副作用检查；不要先请求安装授权 |
| 检查报告要求安装或升级 | 说明实际动作；缺少授权才请求授权，再运行安装入口 |
| 已得到报告 | 第 3 节：按报告结果执行唯一下一步 |

- 全局安装或创建运行时前，说明具体命令、目标位置和影响；缺少授权时先请求授权。启动准备的授权不替代交易预览后的写入确认。
- 没有命令执行能力时，给出当前这一步可复制的命令与验收方式，等待用户提供结果后继续；不声称已经执行。
- 每次报告只引导一个动作；不要一次倾倒全部命令。

## 1. 确认工具是否可调用

目的：确认宿主能否调用 MoneyPal 的 MCP 服务。

1. 已有可调用的 MoneyPal `finance_*` 工具时，MCP 已连接，直接跳到第 4 节验收；不要因为新建了对话就重新安装。
2. 在上述适用范围内，工具不可调用时进入第 2 节；不要现场编写探测脚本或手工查找包内 `node_modules` 入口。日常请求仅缺 MCP 工具时返回主 Skill 的 CLI 路径。
3. 调用返回 `runtime_unavailable` 时从第 2 节开始，让固定脚本给出结构化判断。`invalid_workspace`、`invalid_ledger_layout` 只按第 4 节账本说明处理，不重新检查安装或运行 setup。

## 2. 运行固定引导脚本

目的：先确认当前用户能否启动 `mcp-moneypal`，且不修改环境。

脚本位于当前技能包的 `scripts/` 目录；`<host>` 换成当前宿主：

```powershell
./install.ps1 -Host <host> -CheckOnly
```

```bash
./install.sh --host <host> --check-only
```

1. 检查模式不调用 npm、不运行 setup、不写报告文件。命令存在且 doctor 报告有效时，原样返回该报告；命令缺失时返回 `install_required`，doctor 不可用时返回 `upgrade_required`，两者退出码均为 2。
2. 需要安装或升级时，说明 `npm install -g mcp-moneypal` 会写入 npm 全局目录，取得授权后去掉检查开关重新运行入口。脚本检查 Node 与 npm，必要时安装后只重试一次 doctor；不使用 sudo、不修改 npm prefix、不比较版本。
3. 引导脚本不会自动运行 `setup`。需要修复运行时时先读 doctor 报告，再显式运行 `mcp-moneypal setup`。

完成标准：拿到一份结构化报告。stdout 只有这一个 JSON 文档，过程输出在 stderr。

## 3. 按报告执行唯一下一步

先读 `command` 与 `status`，再读 `errors[].stage`；不要只看退出码。退出码 0 只表示本地已就绪，不代表宿主已连接。

| 报告结果 | 唯一动作 |
| --- | --- |
| bootstrap `changes_required` / `install_required` | 取得安装授权后去掉检查开关运行入口 |
| bootstrap `changes_required` / `upgrade_required` | 取得升级授权后去掉检查开关运行入口 |
| bootstrap `failed` | 展示 `errors` 对应阶段的错误并按其修复，不运行 `setup` |
| doctor `ready` | 用 CLI 完成第 4 节首次验收或处理当前请求 |
| doctor `changes_required` | 运行 `mcp-moneypal setup --host <host>` |
| doctor `failed` | 展示 `errors` 中对应阶段的错误，不运行 `setup` |
| setup `ready` | 用 CLI 完成第 4 节首次验收或处理当前请求 |
| setup `failed` / `runtime` | 按运行时阶段错误修复，不重复安装 npm 包 |
| setup `failed` / `mcp` | 报告 MCP 自检错误；已成功准备的运行时会被保留 |
| setup `failed` / `report` | 检查 `--report` 目标目录是否可写后重试 |

- `runtime` 阶段：`missing` 或 `incompatible` 由 `setup` 修复；`busy` 表示运行时正被占用，稍后重试；`failed` 表示外部 `MONEYPAL_PYTHON` 不可用或不兼容，由用户修复外部环境，`setup` 不修改它，也不会改用托管运行时。
- `mcp` 阶段：`passed` 表示包内服务通过 stdio 自检。这只是“本地已就绪”，不是“宿主已连接”。
- `localReady` 只在运行时就绪且 MCP 自检通过时为 `true`。
- `hostValidation.status`：WorkBuddy 与 Qoder 本地就绪时为 `pending`，QoderWork 为 `manual_setup_required`；它表示 MCP 接入待办，不阻止 CLI 使用。

## 4. 宿主验收

目的：完成首次账本验收。优先以当前可用通道调用 `finance_list_accounts` 与 `finance_validate_journal`，并完成一次余额查询；CLI 通过即完成首次初始化。只有用户要求 MCP 或 CLI 无法使用时，再按对应宿主接入：

**WorkBuddy**

1. 已确认安装专家包时，重载或重启 WorkBuddy，确认 MoneyPal 工具已加载。
2. 在当前任务内调用 `finance_list_accounts` 与 `finance_validate_journal`。
3. 两次调用都成功、校验无错误，且 `workspaceSource` 为 `argument`。

**Qoder**

1. 已确认安装专家包时，优先执行 `/mcp reload`；不支持时重启 Qoder，确认 MoneyPal 工具已加载。
2. 执行与 WorkBuddy 相同的两次工具调用和结果检查。

**QoderWork**

1. 进入“扩展 → 连接器”，导入标准 MoneyPal MCP JSON 并启用连接器。
2. 新建对话，让新会话加载 MoneyPal。
3. 在新会话内执行相同的两次工具调用和结果检查。

共同要求：`serverToday` 必须是有效的绝对日期（YYYY-MM-DD），后续日期换算以它为准。CLI 验收通过时报告当前通过 CLI 使用；只有以上 MCP 步骤完成，才能报告“MCP 已连接并通过账本验收”。

账本仍按原有约定处理：账本工作区是当前任务根工作区，其 `default/` 是唯一正式账本。`invalid_ledger_layout` 表示该任务没有可用账本；此时让用户明确给出绝对路径或明确改为新建，绝不在用户目录中搜索账本，也不自动创建空账本。

## 禁止事项

- 不现场生成 Python 或其他语言的 MCP 探测脚本；探测由包内 `doctor` 的 stdio 自检完成。
- 不读取、创建、备份或编辑 WorkBuddy、Qoder、QoderWork 的任何用户级、项目级或内部配置；只按各宿主连接器界面导入标准 JSON。
- 不手工查找包内 `node_modules` 入口，也不把宿主内置 `node.exe` 与包内脚本路径写进连接器配置。
- 不比较 Skill、专家包与 MCP 包的版本，也不按版本差异重装。
- 不扫描用户目录寻找账本，不自动创建空账本。
- 不根据账户数、备份数或文件修改时间判断哪个是正式账本。
- 不根据历史信任记录或连接器状态缓存判断当前连接状态；历史成功通道只能帮助选择尝试路径，必须以本次调用结果为准。
- 不把退出码 0 单独当作成功，必须读取报告内容。
- 不因 MCP 尚未接入而阻塞 CLI 查询；日常明确请求不额外执行首次验收。
- 不把包内 stdio 自检称为“宿主已连接”。

## 失败与中断

- 同一准备命令因相同原因连续失败两次时停止重试，报告具体命令、错误、仍缺少的条件及可执行的下一步。
- 每次修复后复验受影响阶段。运行时可用但工具仍不可调用时检查宿主连接；配置或账本错误不通过重装软件、重建运行时解决。
- 用户暂停时简述已完成阶段、当前阻塞和下一步；新对话的明确请求直接走日常快速路径，只有 CLI 失败时才按第 1、2 节重新取得当前状态。
