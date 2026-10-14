#!/usr/bin/env node
// 包外引导程序：只保证当前用户可以启动 mcp-moneypal，然后委托包内 doctor。
// 不做版本匹配，也绝不自动运行 setup —— 需要修复时由调用方读取 doctor 报告后显式运行。
//
// 输出约定：stdout 只有一个 JSON 报告；npm 与过程输出一律写 stderr。
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants, existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, isAbsolute, join } from "node:path";

const SUPPORTED_HOSTS = ["workbuddy", "qoder", "qoderwork"];
const REQUIRED_NODE = { major: 22, minor: 9 };
const PACKAGE_NAME = "mcp-moneypal";
const COMMAND_NAME = "mcp-moneypal";
const NPM_MIRROR = "https://registry.npmmirror.com";
const NPM_OFFICIAL = "https://registry.npmjs.org";

main().catch(() => {
  // 任何未预期异常都收敛为固定失败报告，不泄露原始异常文本。
  const report = baseReport("workbuddy");
  fail(report, "package", "bootstrap_failed", "引导程序未能完成；请重试或改用包内 doctor 命令。");
  emitReport(report, undefined, 1);
});

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    const report = baseReport("workbuddy");
    fail(report, "arguments", error.code ?? "invalid_arguments", error.message ?? "参数无效。");
    emitReport(report, undefined, 1);
    return;
  }

  const report = baseReport(options.host);

  const nodeVersion = process.versions.node;
  report.node = { available: true, version: nodeVersion, compatible: nodeAtLeast(nodeVersion) };
  if (!report.node.compatible) {
    fail(report, "node", "node_incompatible", `需要 Node.js ${REQUIRED_NODE.major}.${REQUIRED_NODE.minor}.0+，当前为 ${nodeVersion}。`);
    emitReport(report, options.report, 1);
    return;
  }

  const executable = resolveCommand(COMMAND_NAME, searchDirectories());
  report.program = { command: COMMAND_NAME, found: executable !== undefined, installed: false };

  if (executable !== undefined) {
    // 旧版程序可能没有 doctor；直接探测 doctor 能力，不依赖 version 命令。
    const result = await runDoctor(executable, options);
    if (result.kind === "available") {
      emitChild(result.result);
      return;
    }
  }

  if (options.checkOnly) {
    report.package = { name: PACKAGE_NAME, action: executable === undefined ? "install_required" : "upgrade_required" };
    report.nextAction = executable === undefined
      ? "取得安装授权后，去掉 --check-only 重新运行引导脚本以安装 mcp-moneypal。"
      : "取得升级授权后，去掉 --check-only 重新运行引导脚本以恢复 doctor。";
    emitReport(report, undefined, 2);
    return;
  }

  const npmCommand = resolveCommand("npm", searchDirectories());
  if (npmCommand === undefined) {
    fail(report, "npm", "npm_missing", "未找到 npm；请先安装 npm 后重试。");
    emitReport(report, options.report, 1);
    return;
  }
  const npmVersion = await run(npmCommand, ["--version"]);
  if (npmVersion.code !== 0 || !npmVersion.stdout.trim()) {
    fail(report, "npm", "npm_unusable", "npm 不可调用；请检查 npm 安装后重试。");
    emitReport(report, options.report, 1);
    return;
  }
  report.npm = { available: true, version: npmVersion.stdout.trim() };

  let registry;
  try { registry = npmRegistry(); } catch {
    fail(report, "package", "invalid_registry", "npm 镜像地址必须是有效的 HTTP(S) 地址。");
    emitReport(report, options.report, 1);
    return;
  }
  process.stderr.write(`正在通过${registry.kind}安装 ${PACKAGE_NAME}……\n`);
  let install = await installPackage(npmCommand, registry.url);
  if (install.code !== 0 && registry.fallback && isRetryableNpmFailure(install.stderr)) {
    process.stderr.write("国内镜像暂时不可用，正在尝试官方源……\n");
    install = await installPackage(npmCommand, NPM_OFFICIAL);
  }
  report.package = { name: PACKAGE_NAME, action: install.code === 0 ? "installed" : "install_failed" };
  if (install.code !== 0) {
    fail(report, "package", "package_install_failed", "安装 mcp-moneypal 失败；请检查 npm 输出后重试。");
    emitReport(report, options.report, 1);
    return;
  }

  const installed = resolveCommand(COMMAND_NAME, await commandSearchDirectories(npmCommand));
  report.program.found = installed !== undefined;
  report.program.installed = true;
  if (installed === undefined) {
    fail(report, "package", "package_command_missing", "已安装 mcp-moneypal，但当前环境无法解析其命令；请检查 npm 全局 bin 是否在 PATH 中。");
    emitReport(report, options.report, 1);
    return;
  }

  // 安装成功不等于流程成功：最终结论只来自安装后执行的 doctor。
  const retried = await runDoctor(installed, options);
  if (retried.kind !== "available") {
    fail(report, "package", "doctor_unusable", "mcp-moneypal doctor 未返回有效报告。");
    emitReport(report, options.report, 1);
    return;
  }
  emitChild(retried.result);
}

function npmRegistry() {
  const value = process.env.MONEYPAL_NPM_REGISTRY ?? process.env.npm_config_registry ?? process.env.NPM_CONFIG_REGISTRY;
  if (value?.trim()) return { url: checkedHttpUrl(value), kind: "自定义源", fallback: false };
  return { url: NPM_MIRROR, kind: "国内镜像", fallback: true };
}

async function installPackage(npmCommand, registry) {
  const env = { ...process.env, npm_config_registry: registry, NPM_CONFIG_REGISTRY: registry, npm_config_fetch_timeout: "30000", npm_config_fetch_retries: "2", npm_config_fetch_retry_mintimeout: "1000", npm_config_fetch_retry_maxtimeout: "5000" };
  return run(npmCommand, ["install", "-g", PACKAGE_NAME], { forwardStderr: true, env, timeoutMs: 300000 });
}

function checkedHttpUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid url");
  return url.href.replace(/\/$/u, "");
}

function isRetryableNpmFailure(stderr) {
  const text = stderr.toUpperCase();
  if (/(CERT|UNAUTHORIZED|EACCES|EPERM|FORBIDDEN|401|403)/u.test(text)) return false;
  return /(ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|E404|ETARGET|429|5\d\d)/u.test(text);
}

/** 运行 doctor 并把 stdout 解析为报告；报告无效时返回 `unavailable`。 */
async function runDoctor(executable, options) {
  const args = ["doctor", "--host", options.host, ...(options.report === undefined ? [] : ["--report", options.report])];
  const result = await run(executable, args, { forwardStderr: true });
  const document = parseReport(result.stdout, options.host, result.code);
  if (document === undefined) return { kind: "unavailable" };
  return { kind: "available", result: { code: result.code, document } };
}

/** 归一化 Windows 与 POSIX 入口的参数；两侧 shell 只做转发，判断集中在此处。 */
function parseArguments(argv) {
  let host;
  let report;
  let checkOnly = false;
  const failWith = (code, message) => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };
  const valueOf = (flag, index) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) failWith("invalid_arguments", `${flag} 缺少参数值。`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--host") {
      if (host !== undefined) failWith("invalid_arguments", "--host 只能出现一次。");
      host = valueOf(flag, index);
      index += 1;
    } else if (flag === "--report") {
      if (report !== undefined) failWith("invalid_arguments", "--report 只能出现一次。");
      report = valueOf(flag, index);
      index += 1;
    } else if (flag === "--check-only") {
      if (checkOnly) failWith("invalid_arguments", "--check-only 只能出现一次。");
      checkOnly = true;
    } else {
      failWith("invalid_arguments", `未知参数：${flag}。`);
    }
  }
  if (host === undefined) failWith("invalid_arguments", "必须显式提供 --host。");
  if (!SUPPORTED_HOSTS.includes(host)) failWith("unsupported_host", `不支持的宿主：${host}；受支持的宿主为 ${SUPPORTED_HOSTS.join("、")}。`);
  if (report !== undefined && !isAbsolute(report)) failWith("invalid_arguments", "--report 必须是绝对路径。");
  if (checkOnly && report !== undefined) failWith("invalid_arguments", "--check-only 不支持 --report。");
  return { host, report, checkOnly };
}

function baseReport(host) {
  return {
    schemaVersion: 1,
    command: "bootstrap",
    host,
    status: "changes_required",
    node: { available: false, compatible: false },
    npm: { available: false },
    program: { command: COMMAND_NAME, found: false, installed: false },
    package: { name: PACKAGE_NAME, action: "none" },
    nextAction: "",
    errors: [],
  };
}

function fail(report, stage, code, message) {
  report.status = "failed";
  report.errors.push({ stage, code, message });
  report.nextAction = nextActionFor(stage);
  return report;
}

function nextActionFor(stage) {
  switch (stage) {
    case "arguments":
      return "按 install.sh --host workbuddy / install.ps1 -Host workbuddy 重新运行。";
    case "node":
      return "先安装 Node.js 22.9.0+，再重新运行引导脚本；引导程序不会自行安装 Node。";
    case "npm":
      return "先修复 npm（Node.js 自带 npm，或使用 Node 版本管理器），再重新运行引导脚本。";
    default:
      return "检查 npm 全局安装权限与网络后重新运行引导脚本；引导程序不使用 sudo，也不会修改 npm prefix。";
  }
}

function nodeAtLeast(version) {
  const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  return major > REQUIRED_NODE.major || (major === REQUIRED_NODE.major && minor >= REQUIRED_NODE.minor);
}

function searchDirectories() {
  return (process.env.PATH ?? "").split(delimiter).filter((entry) => entry.length > 0);
}

/** PATH 之外补充 npm 报告的全局 bin 目录，避免刚装完的命令不在当前 PATH 中。 */
async function commandSearchDirectories(npmCommand) {
  const directories = searchDirectories();
  const prefix = await run(npmCommand, ["prefix", "-g"]);
  const value = prefix.stdout.trim();
  if (prefix.code === 0 && value) directories.push(process.platform === "win32" ? value : join(value, "bin"));
  return directories;
}

function resolveCommand(name, directories) {
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((entry) => entry.length > 0)
    : [""];
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      if (!existsSync(candidate)) continue;
      if (process.platform === "win32") return candidate;
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // 目录里存在同名但不可执行的文件时继续查找。
      }
    }
  }
  return undefined;
}

/**
 * 只接受本次调用对应的完整 doctor 报告。旧版或损坏命令即使输出任意 JSON，
 * 也不能被误判为已具备统一诊断能力。
 */
function parseReport(stdout, expectedHost, exitCode) {
  if (!stdout.trim()) return undefined;
  let document;
  try {
    document = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (!isDoctorReport(document, expectedHost, exitCode)) return undefined;
  return document;
}

function isDoctorReport(document, expectedHost, exitCode) {
  if (!isObject(document)) return false;
  if (document.schemaVersion !== 1 || document.command !== "doctor" || document.host !== expectedHost) return false;
  if (typeof document.localReady !== "boolean" || !Array.isArray(document.errors)) return false;
  if (!isObject(document.package) || !isObject(document.runtime) || !isObject(document.mcp) || !isObject(document.hostValidation)) return false;
  const expectedExitCode = { ready: 0, changes_required: 2, failed: 1 }[document.status];
  return expectedExitCode !== undefined && exitCode === expectedExitCode;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnCommand(command, args, options.env);
    } catch {
      resolve({ code: -1, stdout: "", stderr: "" });
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      if (options.forwardStdout) process.stderr.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      if (options.forwardStderr) process.stderr.write(chunk);
    });
    let settled = false;
    const finish = (code) => { if (settled) return; settled = true; if (timer) clearTimeout(timer); resolve({ code, stdout, stderr }); };
    const timer = options.timeoutMs === undefined ? undefined : setTimeout(() => { child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 2000).unref(); }, options.timeoutMs);
    child.on("error", () => finish(-1));
    child.on("close", (code) => finish(code === null ? -1 : code));
  });
}

function spawnCommand(command, args, env) {
  if (process.platform === "win32" && /\.(?:cmd|bat)$/iu.test(command)) {
    // .cmd/.bat 无法被 CreateProcess 直接执行；转成一次受限的 cmd.exe 调用并自行加引号。
    const line = [quoteWindowsArgument(command), ...args.map(quoteWindowsArgument)].join(" ");
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${line}"`], { env, stdio: ["ignore", "pipe", "pipe"], windowsVerbatimArguments: true });
  }
  return spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
}

function quoteWindowsArgument(value) {
  if (value.length > 0 && !/[\s"^&|<>()%!]/u.test(value)) return value;
  return `"${value.replace(/"/gu, '""')}"`;
}

function emitReport(report, reportPath, code) {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath !== undefined) {
    try {
      writeReportFile(reportPath, text);
    } catch {
      process.stderr.write("无法写入 --report 指定的报告文件。\n");
      code = 1;
    }
  }
  process.stdout.write(text);
  process.exitCode = code;
}

function emitChild(child) {
  process.stdout.write(`${JSON.stringify(child.document, null, 2)}\n`);
  process.exitCode = child.code;
}

function writeReportFile(target, text) {
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, text, "utf8");
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}
