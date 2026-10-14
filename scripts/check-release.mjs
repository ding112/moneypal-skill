import { lstat, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIRECTORY = "skills/moneypal";
const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const VERSION_PLACEHOLDER = "$" + "{MONEYPAL_VERSION}";

export async function validateSkillRelease({ skillDirectory, tag } = {}) {
  if (typeof skillDirectory !== "string" || !isAbsolute(skillDirectory)) {
    throw new Error("--skill-dir 必须是 Skill 目录的绝对路径。");
  }
  if (typeof tag !== "string" || !tag) throw new Error("必须提供 --tag <v版本>。");
  const resolvedSkillDirectory = await resolve(skillDirectory);
  const skillInfo = await lstat(resolvedSkillDirectory);
  if (!skillInfo.isDirectory() || skillInfo.isSymbolicLink()) throw new Error("Skill 目录必须是普通目录。");
  const skillFile = join(resolvedSkillDirectory, "SKILL.md");
  const skillText = await readFile(skillFile, "utf8");
  const version = readSkillVersion(skillText);
  if (tag !== "v" + version) throw new Error("发布 tag 必须为 v" + version + "，当前为 " + tag + "。");
  const files = await collectFiles(resolvedSkillDirectory);
  for (const path of files) {
    if ((await readFile(path, "utf8")).includes(VERSION_PLACEHOLDER)) {
      throw new Error("Skill 发布内容残留版本占位符：" + path);
    }
  }
  return { version, tag, files: files.length };
}

function readSkillVersion(document) {
  const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!frontmatter) throw new Error("SKILL.md 缺少有效 frontmatter。");
  const lines = frontmatter[1].split(/\r?\n/u);
  const metadataSections = lines.filter((line) => line === "metadata:");
  if (metadataSections.length !== 1) throw new Error("SKILL.md 必须且只能有一个 metadata 区段。");
  const metadataIndex = lines.indexOf("metadata:");
  const metadataEnd = lines.findIndex((line, index) => index > metadataIndex && line.length > 0 && !/^[ \t]/u.test(line));
  const metadataLines = lines.slice(metadataIndex + 1, metadataEnd < 0 ? undefined : metadataEnd);
  const versions = metadataLines.filter((line) => /^  version:/u.test(line));
  if (versions.length !== 1) throw new Error("SKILL.md 的 metadata.version 必须且只能出现一次。");
  const scalar = versions[0].match(/^  version: (?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*$/u);
  const version = scalar && (scalar[1] ?? scalar[2] ?? scalar[3]);
  if (!version || !VERSION_PATTERN.test(version)) throw new Error("SKILL.md 的 metadata.version 必须是有效的语义版本。");
  return version;
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error("Skill 目录不允许符号链接：" + path);
    if (info.isDirectory()) files.push(...await collectFiles(path));
    else if (info.isFile()) files.push(path);
    else throw new Error("Skill 目录包含非普通文件：" + path);
  }
  return files;
}

function parseArguments(argv) {
  let skillDirectory;
  let tag;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--skill-dir" && skillDirectory === undefined) skillDirectory = argv[++index];
    else if (argument === "--tag" && tag === undefined) tag = argv[++index];
    else throw new Error("未知或重复参数：" + argument);
  }
  if (skillDirectory === undefined) throw new Error("必须提供 --skill-dir <绝对路径>。");
  if (tag === undefined) throw new Error("必须提供 --tag <v版本>。");
  return { skillDirectory, tag };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = await validateSkillRelease(parseArguments(process.argv.slice(2)));
    console.log("Skill 发布校验通过：" + result.tag + "（" + result.files + " 个文件）。");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

