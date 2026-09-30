# CLI 调用参考

仅在 [主 Skill](../SKILL.md#选择流程) 已选择 CLI 通道后读取。本文件不决定是否进入首次教学，也不替代主 Skill 的写入确认、日期和账户规则。

## 命令与参数

| 命令 | 用途与输入 | 返回 |
| --- | --- | --- |
| `mcp-moneypal tools` | 本任务首次使用 CLI 时执行一次，无参数 | JSON 对象中的 `tools` 数组，包含 `name`、`description`、`inputSchema` |
| `mcp-moneypal call <工具名> --input <文件或->` | 文件或标准输入中的 JSON 对象，字段以本次 Schema 为准 | 工具结果 JSON；业务错误包含 `code`、`message`，可带 `diagnostics` |
| `mcp-moneypal batch-status <batchId>` | 真实预览返回的批次 ID | `status`、`canCommit`、`expiresAt` 等；pending 可带 `preview` |

查询、校验和预览都传绝对 `ledgerWorkspace`，取自当前任务根目录，不从临时工作目录或 `pwd` 推断。提交只传 `batchId`，不传工作区。不要自行寻找托管 Node 或包内入口；公共命令不可启动时进入 [启动检查](bootstrap.md)。

```bash
mcp-moneypal tools
```

复用返回的 Schema，不为每个调用重复执行。财务工具成功响应中的 `serverToday` 用于日期换算，`workspaceSource` 正常应为 `argument`；不要把批次状态查询当作账本或宿主连接验收。

## 参数文件与余额查询

以下示例查询整个账本余额，不预先获取全量账户。需要查询特定账户或期间时，按 Schema 增加真实账户与绝对日期参数。示例路径必须替换为当前任务已确定的账本工作区。

### POSIX

使用已有 Node.js 序列化对象，重新读取解析后才调用 CLI。子 Shell 保证临时目录退出时清理；变量通过参数传给 Node，不插入 JavaScript 源码。

```bash
(
  set -eu
  ledger_workspace='/absolute/path/to/ledger'
  request_dir=$(mktemp -d)
  trap 'rm -rf -- "$request_dir"' EXIT
  input_file="$request_dir/input.json"
  node --input-type=module - "$ledger_workspace" "$input_file" <<'JS'
import { writeFileSync, readFileSync } from 'node:fs';
const [ledgerWorkspace, inputFile] = process.argv.slice(2);
const request = { ledgerWorkspace };
writeFileSync(inputFile, JSON.stringify(request), 'utf8');
JSON.parse(readFileSync(inputFile, 'utf8'));
JS
  mcp-moneypal call finance_get_balance --input "$input_file"
)
```

### Windows PowerShell

使用对象序列化、无 BOM 编码和随机临时文件；解析或调用失败均清理文件。

```powershell
$ErrorActionPreference = 'Stop'
$ledgerWorkspace = 'C:/ledger'
$inputFile = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
try {
    $request = @{ ledgerWorkspace = $ledgerWorkspace }
    $json = $request | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($inputFile, $json, [System.Text.UTF8Encoding]::new($false))
    $null = [System.IO.File]::ReadAllText($inputFile) | ConvertFrom-Json
    & mcp-moneypal call finance_get_balance --input $inputFile
    if ($LASTEXITCODE -ne 0) { throw 'CLI 调用失败，请按上方实际错误恢复。' }
} finally {
    if (Test-Path -LiteralPath $inputFile) { Remove-Item -LiteralPath $inputFile }
}
```

优先生成无 BOM UTF-8；现有 CLI 可接受单个 UTF-8 BOM，不能仅因存在 BOM 就认定失败。`--input -` 也可使用，但更换传入方式不能修复错误 JSON。解析失败先检查内容、转义和编码，修正后只重试一次；再次失败报告具体错误并诊断，不轮换 Shell 或原样重试。

## 预览示例

以下只是参数语法示例，不代表用户真实交易，也不能为演示写入正式账本。实际日期、说明、金额必须来自用户；账户须替换为真实已声明账户，必要时才查询账户列表。

```json
{
  "ledgerWorkspace": "/absolute/path/to/ledger",
  "transactions": [
    {
      "date": "2026-09-01",
      "description": "午餐",
      "postings": [
        { "account": "Expenses:Food", "amount": "20 CNY" },
        { "account": "Assets:Cash", "amount": "-20 CNY" }
      ]
    }
  ]
}
```

按上方对应平台示例，把 `request` 对象替换为真实候选交易对象，将命令中的 `finance_get_balance` 替换为 `finance_preview_transactions`。保留序列化、回读验证和清理步骤，不手写拼接 JSON 字符串。

返回预览后，按 [主 Skill 的写入协议](../SKILL.md#写入协议人在写入前有最终决定权) 完整展示并等待用户明确确认。预览和提交不得放在同一个自动连续执行脚本中。

## 确认后提交

只有用户已经确认本次真实预览，才生成新的参数文件。其对象仅含真实预览返回的 `batchId`：

```json
{ "batchId": "<本次真实预览返回的批次 ID>" }
```

按上述平台示例序列化该对象，将工具名替换为 `finance_commit_transactions` 后调用。占位符不是可执行的批次 ID。成功后使用预览时的同一工作区查询流水复核；不能把提交成功当作复核完成。

同一任务中已展示并确认的 pending 批次可通过 CLI 承接；新任务按 [CLI 承接批次](../SKILL.md#cli-承接批次) 重新完整展示并确认。`canCommit` 只表示批次状态允许提交，不表示用户已经授权。

## 提交响应丢失时恢复

先执行只读状态查询，参数替换为真实批次 ID：

```text
mcp-moneypal batch-status <batchId>
```

| 状态 | 唯一下一步 |
| --- | --- |
| `pending` | 仅在具备当前预览的有效确认时提交；状态本身不代表授权 |
| `submitted` | 查询流水复核，不再提交 |
| `committing` / `outcome_uncertain` | 只读查询并报告不确定性，交由用户决定，不自动补记 |
| `expired` / `replaced` / `commit_failed` / `missing` | 旧批次不可提交；继续记账需新预览和新确认 |

状态查询自身失败时保留具体错误，不据此推断交易未写入。其他参数、账本和业务错误回到 [主 Skill 的错误恢复](../SKILL.md#错误恢复)，不因错误切换通道或重装。
