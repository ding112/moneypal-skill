# 办公 Agent 的连接器配置

在 Qoder、QoderWork、WorkBuddy 等办公宿主需要添加、启用或修复 MoneyPal 连接器时读取。先说明：“记账程序已经准备好；接下来要在这个应用的连接器里接通它，我会告诉你每个字段怎么填。”安装 npm 包、添加连接器和工具可调用是三个不同状态。

## 先准备，再带用户操作

- 复用已知宿主信息；不明确时只问当前使用的应用及界面入口。Qoder 办公版、QoderWork 与 Qoder IDE / CLI 的配置入口不同，不混用。
- 先按 [启动检查](bootstrap.md) 完成本地准备。doctor 与 setup 不检查实际分发来源：只有已确认安装专家包时，才能依赖其 MCP 声明；否则按当前连接器界面检查或导入。安装、doctor 与 setup 都不读取或修改任何宿主配置。
- 先准备好可直接粘贴的配置。普通全局安装的唯一标准启动方式是命令 `mcp-moneypal`、参数留空；JSON 结构使用下方的 [MoneyPal 标准配置](#moneypal-标准配置)。账本目录由每次工具调用从当前 Agent 任务取得，不写入新连接器配置。
- 不要把公共命令拆成 Node 可执行文件与包内 JavaScript 入口，不要从宿主的沙箱、内置运行时、npm 缓存或 `node_modules` 拼接路径。这些是非稳定内部路径，不是已安装连接器的配置依据。只有用户明确在开发本仓库源码时，才按仓库开发文档使用 `node` 加已构建入口；不要把该开发配置提供给普通安装用户。
- 先在连接器列表中找已有 MoneyPal 条目，包括专家包导入的条目。已有时编辑或启用原条目，不重复添加。旧条目若包含 `MONEYPAL_LEDGER_WORKSPACE`，保留用于兼容，不主动增删改。
- 只在包内声明未自动加载，或报告提示需要人工设置时，才指导用户在界面导入标准 JSON；不为任何宿主手工创建或改写配置文件。
- 优先按宿主的连接器界面指导用户。每次只给当前动作、填写内容和完成标志；用户正在操作界面时等待结果。助手具备已授权的界面操作能力时可代为填写；否则提供步骤，不声称已经保存或启用。
- 页面文字与下方路径不一致时，以实际界面或对应版本官方文档核实下一步；不能操作界面时请用户描述当前选项，不凭空指定按钮。

## 按当前宿主进入

### WorkBuddy

已确认安装的 WorkBuddy 专家包自带 MCP 声明，正常情况下重载后即可加载，无需修改用户级配置。独立 Skill 或来源未确认时，按下面的界面步骤检查或导入标准 JSON；不要手工编辑 `~/.workbuddy` 下的任何文件。

1. 请用户打开左侧“连接器”，检查是否已有 MoneyPal；需要新增时点击右上角“自定义连接器”。完成标志：进入自定义 MCP 配置界面。
2. 按下面的字段配置；界面使用 JSON 编辑器时，优先提供准备好的完整配置。编辑包含其他服务的配置时仅合并 `moneypal` 条目，保留其他服务。
3. 保存后检查 MoneyPal 的连接状态并启用。若当前版本展示旧版入口，可按官方 MCP 指南进入“插件 → MCP 服务器 → 配置 MCP”。状态异常时读取具体错误，回到启动检查对应阶段。

入口依据：[WorkBuddy 连接器](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Connector)、[WorkBuddy MCP](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)。

重载或重启 WorkBuddy 后才会生效；重载属于用户操作，助手不自动重启宿主。

### Qoder 办公版

1. 打开左侧“扩展（Extensions）→ 连接器（Connectors）”，检查已有条目；新增时进入“添加连接器（Add Connector）→ 自定义 MCP（Add custom MCP）”。
2. 有表单与 JSON 两种方式：表单按下方字段填写；JSON 使用已准备的完整配置。核对后点击“Add MCP”。
3. 检查连接器是否可用及工具列表是否加载，再回到对话做只读验收。

入口依据：[Qoder Connectors](https://docs.qoder.com/qoder/connectors)。此入口不适用于 Qoder IDE / CLI。

### QoderWork 界面

1. 打开“扩展 → 连接器”，点击右上角“＋ Add”。选择“Paste JSON Config”导入准备好的 JSON，或“Fill in Config Manually”按下方字段填写。
2. 导入或添加后，在“Installed → Custom”找到 MoneyPal，确认已启用并展开查看工具。
3. QoderWork 官方说明，切换连接器启用状态后需新建对话才能生效。让用户在新对话粘贴交接说明，不要求旧对话反复重试或重新安装。

入口与生效规则依据：[QoderWork Connector](https://docs.qoder.com/qoderwork/connectors)。

## MoneyPal 标准配置

界面支持 JSON 时，优先给出这一份完整配置，不增加 `args`、账本路径或其他字段：

```json
{
  "mcpServers": {
    "moneypal": { "command": "mcp-moneypal" }
  }
}
```

手动表单使用简短列表逐项给出，避免表格在聊天界面中错行：

- 名称：`moneypal`，或沿用已有条目名称
- 类型：本地进程 `STDIO`
- 命令：`mcp-moneypal`
- 参数：留空
- 自定义 Python：仅在已有配置使用时，保留环境变量 `MONEYPAL_PYTHON` 及其已验证的绝对路径；托管运行时无需填写

展示配置前先自检：命令必须是 `mcp-moneypal`，参数必须为空。不能把 `init`、`setup-runtime`、账本路径、`node.exe` 或 `mcp-main.js` 填入普通用户配置。

只有宿主明确报“找不到命令”时才处理 PATH：POSIX 用 `command -v mcp-moneypal`，Windows PowerShell 用 `(Get-Command mcp-moneypal -ErrorAction Stop).Source`。绝对路径兜底只能使用该命令实际返回并经过执行验证的公共启动器，例如 Windows 的 `mcp-moneypal.cmd`；不得推断或改写为宿主内置的 `node.exe` 和包内脚本路径。如果宿主不能执行已验证的公共启动器，保留具体报错并核实宿主兼容方式，不自行发明替代启动链。

MoneyPal 是本地 stdio 服务，无需填写服务 URL、API Key、OAuth 登录或新的账本环境变量。启动命令不带子命令时才运行 MCP 服务。界面如果只显示 URL 输入，先检查是否选成了远程传输类型，不编造本地 HTTP 地址。

## 保存后的验收与交接

连接器显示已连接或工具列表已出现，只是连接证据。接着按启动检查调用账户列表并校验账本，通过后才进入首次查询；宿主级工具权限提示由用户按当前操作处理，连接授权不替代交易预览后的确认。

需要重载、重启或新对话时，给出按事实填写的简短交接说明：

> 继续 MoneyPal 首次引导。已完成：〔实际完成的安装、运行时、账本准备〕。宿主：〔应用〕，连接器：〔名称〕，当前状态：〔已保存/已启用/待重载〕。下一步：发现 MoneyPal 工具，查询账户并校验账本，通过后继续首次查询。请检查当前状态，不重复安装或初始化；尚未确认任何交易写入。

仅在确实没有待处理交易时使用最后一句；若恢复中已有预览或提交，按真实状态交接并遵循 skill 的写入恢复规则。新任务从宿主取得任务根工作区，不在交接文本中复制账本内容。

以上界面指引于 2026-09-10 根据官方文档核对；宿主版本变化时按实际界面复核。

首版的本地准备、`doctor` 与 `setup` 支持 `--host workbuddy`、`--host qoder` 与 `--host qoderwork`。三种宿主共用同一套安装、运行时准备与 MCP stdio 自检；宿主参数只决定接入指引，命令不会读取或修改任何宿主配置。报告中的 `hostValidation.configurationSource` 为 `unknown`，不能据此推断专家包已经安装。
