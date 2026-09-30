# 包外引导入口（Windows）：只做定位与转发，业务判断全部在 bootstrap.mjs，避免两套平台逻辑漂移。
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [Alias("Host")]
  [string]$HostName,

  [string]$Report,

  [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {
  [Console]::Error.WriteLine("需要 Node.js 22.18+；请先安装 Node 后重新运行本脚本。")
  exit 1
}

$arguments = @((Join-Path $PSScriptRoot "bootstrap.mjs"), "--host", $HostName)
if ($Report) { $arguments += @("--report", $Report) }
if ($CheckOnly) { $arguments += "--check-only" }

& $node.Source @arguments
if ($null -eq $LASTEXITCODE) { exit 1 }
exit $LASTEXITCODE
