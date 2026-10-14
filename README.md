# MoneyPal Skill

**让你的 AI 助手真正会记账。**

支付宝、微信和各大银行账单自动导入，告别逐笔录入。把导出的账单文件交给 AI，自动整理交易，预览确认后记入账本；再用自然语言查余额、查流水、看收支报表。

基于 Beancount，本地优先，账本以标准文本保存在自己的电脑上。

**[MoneyPal 产品主页](https://github.com/ding112/MoneyPal)** · [账单导入文字示例](https://github.com/ding112/MoneyPal#账单导入示例)

本仓库是 MoneyPal 的通用 Skill 分发入口，交付完整的 `moneypal` 技能目录，包括使用规则、参考资料和安装辅助脚本；WorkBuddy 已上架该技能，可在应用内直接安装。执行查询和记账需要本机的 `mcp-moneypal` 程序；安装 Skill 后，助手可以引导你准备程序、运行时和账本。

## 选择你的安装方式

| 使用环境 | 安装入口 |
| --- | --- |
| DeepSeek Harness Web | [安装 DSH 插件 `dsh-moneypal`](https://github.com/ding112/MoneyPal#install-dsh) |
| WorkBuddy | [一键安装「恰恰账本」](#install-skill) · [导入 Skill 包](#install-skill-import) · [WorkBuddy 连接器指引](skills/moneypal/references/connectors.md#workbuddy) |
| Qoder / QoderWork | [导入 Skill 包](#install-skill-import) · [Qoder 办公版](skills/moneypal/references/connectors.md#qoder-办公版) / [QoderWork 连接器指引](skills/moneypal/references/connectors.md#qoderwork-界面) |
| 其他本地 MCP Agent | [npm 包 `mcp-moneypal`](https://www.npmjs.com/package/mcp-moneypal) · [环境要求](#first-use) · [MCP 配置](#connect-mcp) |

DSH 使用原生确认框确认写入；本 Skill 在对话中展示预览，收到你的明确确认后再提交。

<a id="install-skill"></a>

## 1. 安装 Skill

### WorkBuddy：在应用内直接安装

WorkBuddy 5.8.0 及以上版本可以从分享链接直接安装已上架的 MoneyPal 技能，市场名称为「恰恰账本」：

1. 在电脑上打开 [MoneyPal 技能分享页](https://www.workbuddy.cn/share/asset?shareCode=LXDusOqTxlpNtjc5ysZs4R&sig=-BMa9_6pld-yRcbQ)。
2. 点击页面底部的「在WorkBuddy打开」，WorkBuddy 会跳到该技能的详情页。
3. 在详情页点击「安装」，完成后技能出现在「技能 → 已安装」列表中。

也可以在 WorkBuddy 的「技能」面板中搜索「恰恰账本」安装。分享页暂不支持手机端安装，请在电脑上操作；WorkBuddy 版本低于 5.8.0 时分享页会提示升级，先更新应用再安装。

这种方式安装的是已发布版本，不需要下载 ZIP，也不需要手工放置目录。安装后按[第 2 步](#first-use)让助手引导准备程序和账本。

<a id="install-skill-import"></a>

### 其他应用：导入 Skill 包

从 [GitHub Releases](https://github.com/ding112/moneypal-skill/releases) 下载对应版本的 `moneypal.zip`，解压后得到完整的 `moneypal/` 目录；也可以获取本仓库，使用 `skills/moneypal/`。将整个 `moneypal` 目录导入应用的技能管理界面，或复制到应用官方规定的 Skill 目录。

需要保留以下完整结构，不能只复制 `SKILL.md`：

```text
moneypal/
├── SKILL.md
├── references/
│   ├── onboarding.md
│   ├── bootstrap.md
│   ├── connectors.md
│   └── cli.md
└── scripts/
    ├── bootstrap.mjs
    ├── install.sh
    └── install.ps1
```

不同应用的技能导入入口和目录不同，请按当前应用的说明操作。本仓库提供目录形式的通用 Skill；应用若要求专用市场包或其他格式，需要先确认其导入要求。

安装后，检查应用是否能识别 `moneypal` 技能。若需要刷新技能列表或新建任务，完成后再使用。安装 Skill 不等于 MCP 连接已经完成。

<a id="first-use"></a>

## 2. 首次使用：让助手带你完成准备

先选择准备保存账本的目录，在应用中将该目录设为当前任务的根工作区，再发送：

> 请使用 MoneyPal 引导我首次使用，检查环境，帮助我准备账本并完成一次余额查询。安装程序或创建账本前请说明具体操作，记账前先给我预览。

助手会检查现有环境，复用已安装的程序和已有账本，按需要引导安装或修复。首次验收包括查询账户、校验账本，以及一次余额查询。你可以只完成查询，跳过记账练习。

使用前需要：

- 支持 Skill 且能执行本机命令的 Agent 应用；使用 MCP 时需要支持本地 `STDIO` 服务。
- Node.js 22.18 或更高版本及 npm。
- 首次准备托管运行时时需要 Python 3.11 或更高版本，支持 `venv` 和 `pip`，并能下载 Python 依赖。
- 一个用于保存正式账本的工作区。宿主不能提供任务根目录时，明确告诉助手该工作区的绝对路径。

如果助手已经能调用 MoneyPal 工具，可以直接检查账本；否则由助手检查可用方式并引导完成准备。

## 3. 账单自动导入

完成首次准备后，可以导入支付宝、微信和各大银行的账单：

1. 从支付宝、微信或银行导出账单文件。
2. 将文件提供给助手，或告知助手可读取的文件位置。
3. 发送以下导入请求，让助手读取文件并整理候选交易。
4. 核对完整交易明细、账户、收支汇总、写入文件、预览有效期和疑似重复提醒；需要调整时先修改预览。
5. 确认无误后，在对话中回复“确认记账”；助手提交后查询流水复核，报告实际写入结果。

> 请导入这份账单，先整理交易并展示记账预览，提示可能重复的记录，等我确认后再写入。

提供账单文件后，助手会先展示预览，此时尚未写入账本。疑似重复记录会提示，由你决定保留或丢弃。预览过期、账本变化或交易修改后，重新预览并确认。

账本文件保存在本地，但账单内容、查询结果和交易信息可能进入宿主配置的模型上下文。

<a id="connect-mcp"></a>

## 4. 可选：连接 MCP

本 Skill 是独立技能，MCP 连接需要在应用的连接器管理界面配置。已有 MoneyPal 条目时，检查并启用原条目，避免重复添加。

应用支持导入 JSON 配置时使用：

```json
{
  "mcpServers": {
    "moneypal": {
      "command": "mcp-moneypal"
    }
  }
}
```

手动表单填写：

| 字段 | 内容 |
| --- | --- |
| 名称 | `moneypal` |
| 类型 | 本地进程 / `STDIO` |
| 命令 | `mcp-moneypal` |
| 参数 | 留空 |

账本工作区由每次工具调用传入，不填入新连接器配置。此服务无需 URL、API Key 或 OAuth 登录。保存并启用后，按应用要求重载或新建对话，再发送账户查询和账本校验请求。

WorkBuddy、Qoder 办公版和 QoderWork 的接入说明见[连接器指引](skills/moneypal/references/connectors.md)。界面名称可能随版本变化，请以实际应用界面为准。

## 5. 日常怎么用

完成准备后，直接向助手描述需求，无需每次重复安装或首次引导。

| 需求 | 示例说法 |
| --- | --- |
| 导入账单 | “请导入这份账单，先展示预览，等我确认后再写入。” |
| 查看账户 | “列出账本中的可用账户。” |
| 查询余额 | “现金账户现在的账面余额是多少？” |
| 查询流水 | “列出 2026 年 9 月的餐饮支出。” |
| 查看收支 | “生成 2026 年 9 月损益表。” |
| 查看资产负债 | “查看截至 2026-09-30 的资产负债表。” |
| 记录交易 | “记录一笔 2026-09-30 的午餐，35 元，现金支付，先给我预览。” |
| 维护账户 | “帮我新增一个支付宝资产账户，先展示要修改的内容。” |

这些是表达方式示例；只有真实发生的交易才应写入正式账本。金额、日期、用途或账户不清楚时，助手会补问缺失信息。

日期参数使用 `YYYY-MM-DD`。“今天”“昨天”等相对日期由助手根据财务工具返回的 `serverToday` 换算。查询区间包含开始日期，不包含结束日期。余额与报表按币种分别展示，不自动换汇。

账户使用账本中已声明的完整名称。例如中文账户 `Assets:C-现金` 的 `C-` 是名称的一部分，不能省略；助手会使用实际账户列表匹配你的付款方式。

### 记账：预览、确认、提交、复核

1. 助手整理候选交易并生成预览；此时尚未写入账本。
2. 你核对交易日期、金额、账户、汇总、重复提醒、写入文件和预览有效期。
3. 确认无误后回复“确认记账”。需要调整时直接说明修改内容，助手会重新预览；也可以取消。
4. 助手提交后再次查询流水复核，报告实际写入结果。

预览默认 30 分钟过期。过期、账本发生变化或交易被修改后，需要新预览和新确认。账户维护也会先展示具体文件变更，取得确认后执行；账户维护确认不代替交易写入确认。

若提交没有返回明确结果，先让助手查询批次状态和账本流水，确认是否已写入，再决定下一步，避免重复记账。

## 6. 常见问题

| 问题 | 处理方法 |
| --- | --- |
| 应用找不到 Skill | 检查是否导入了完整 `moneypal` 目录，并按应用要求刷新或新建任务；WorkBuddy 可重新打开[技能分享页](#install-skill)安装 |
| 分享页提示升级或打不开 | 在电脑上打开分享页，并把 WorkBuddy 升级到 5.8.0 或更高版本 |
| 找不到 `node` 或 `npm` | 安装满足版本要求的 Node.js，并确认当前终端能执行这两个命令 |
| 找不到 `mcp-moneypal` | 请助手检查程序安装状态和命令是否可用 |
| `runtime_unavailable` | 请助手检查运行时，并按实际报告引导修复 |
| `invalid_workspace` | 确认任务根工作区是包含 `default/` 的目录，工具传入非空绝对路径 |
| `invalid_ledger_layout` | 检查主账本、账户文件、年度文件和 include，不要覆盖或重新初始化已有账本 |
| `undeclared_account` | 查询实际账户名称；需要新建时先确认账户维护方案 |
| 预览过期或 `preview_stale` | 重新查询、生成预览并确认 |
| `ledger_locked` | 检查是否还有其他写入操作；遗留锁需要排查，不直接删除锁文件 |
| 已提交但复核失败 | 继续查询核对，避免再次提交同一交易 |

遇到环境或连接问题时，可向助手说明具体错误，让它按[启动检查](skills/moneypal/references/bootstrap.md)引导恢复。

## 7. 更新、卸载与数据位置

更新 Skill 时，完整替换已安装的 `moneypal` 目录，包括参考资料和辅助脚本，再按应用要求重新加载。WorkBuddy 不需要手工替换目录：重新打开[技能分享页](#install-skill)安装当前发布版本即可。

更新本机程序：

```bash
npm install -g mcp-moneypal
```

需要升级托管运行时时：

```bash
mcp-moneypal setup-runtime --upgrade
mcp-moneypal runtime-status
```

程序更新后重启或重载使用它的 MCP 宿主。Skill 和本机程序分别更新。

卸载时，在应用中移除 Skill 和不再使用的 MoneyPal 连接器；如需卸载本机程序，执行：

```bash
npm uninstall -g mcp-moneypal
```

正式账本保存在你选择的账本工作区，卸载程序不会自动删除账本或共享运行时。账本文件保存在本地，但账单内容、查询结果和交易信息可能进入宿主配置的模型上下文。MoneyPal 不会自动执行账本的 Git 暂存或提交；请自行安排账本备份。


## 8. 发布 Skill ZIP

将 tag 推送到 GitHub 仓库后，GitHub Actions 会自动打包该 tag 对应提交中的 `skills/moneypal/`，生成 `moneypal.zip` 并上传到同名 GitHub Release。所有 tag 都会触发，普通分支推送不会触发。

先提交需要发布的内容（包括 `.github/workflows/release.yml`），再创建并推送 tag。例如发布 `v1.0.0`：

```bash
git tag v1.0.0
git push github v1.0.0
```

这里的 `github` 是本仓库指向 GitHub 的 remote；仅推送到私有 `origin` 不会触发 GitHub Actions。若使用其他 remote 名称，请替换为指向 GitHub 的名称。

ZIP 顶层为 `moneypal/`，包含完整的 `SKILL.md`、`references/` 和 `scripts/`，只打包 tag 对应提交中已跟踪的 Skill 文件。工作流使用 GitHub 自动提供的 `GITHUB_TOKEN`，无需额外配置发布密钥。同一 tag 重跑工作流时，会更新已有 Release 中的同名 ZIP 附件。
