import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { validateSkillRelease } from "../scripts/check-release.mjs";

async function skillFixture(t, metadata, extraFiles = {}) {
  const root = await mkdtemp(join(tmpdir(), "moneypal-skill-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skillDirectory = join(root, "moneypal");
  await mkdir(join(skillDirectory, "references"), { recursive: true });
  await writeFile(join(skillDirectory, "SKILL.md"), [
    "---",
    "name: moneypal",
    "metadata:",
    "  author: mengzai",
    metadata,
    "---",
    "",
    "# MoneyPal",
    "",
  ].join("\n"));
  for (const [path, content] of Object.entries(extraFiles)) {
    const target = join(skillDirectory, path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, content);
  }
  return skillDirectory;
}

test("发布校验接受 Skill 版本 1.0.7 和对应 tag", async (t) => {
  const skillDirectory = await skillFixture(t, '  version: "1.0.7"', {
    "references/bootstrap.md": "安装说明",
  });
  assert.deepEqual(await validateSkillRelease({ skillDirectory, tag: "v1.0.7" }), {
    version: "1.0.7",
    tag: "v1.0.7",
    files: 2,
  });
});

test("发布校验拒绝 tag 版本不匹配", async (t) => {
  const skillDirectory = await skillFixture(t, '  version: "1.0.7"');
  await assert.rejects(validateSkillRelease({ skillDirectory, tag: "v1.0.0" }), /tag 必须为 v1\.0\.7/u);
});

test("发布校验拒绝版本占位符", async (t) => {
  const skillDirectory = await skillFixture(t, '  version: "1.0.7"', {
    "references/bootstrap.md": "$" + "{MONEYPAL_VERSION}",
  });
  await assert.rejects(validateSkillRelease({ skillDirectory, tag: "v1.0.7" }), /残留版本占位符/u);
});

test("发布校验拒绝缺失、重复或无效的 metadata.version", async (t) => {
  const missingVersion = await skillFixture(t, "  author: mengzai");
  await assert.rejects(validateSkillRelease({ skillDirectory: missingVersion, tag: "v1.0.7" }), /metadata\.version/u);

  const duplicateVersion = await skillFixture(t, '  version: "1.0.7"\n  version: "1.0.8"');
  await assert.rejects(validateSkillRelease({ skillDirectory: duplicateVersion, tag: "v1.0.7" }), /metadata\.version/u);

  const invalidVersion = await skillFixture(t, '  version: "01.0.7"');
  await assert.rejects(validateSkillRelease({ skillDirectory: invalidVersion, tag: "v1.0.7" }), /有效的语义版本/u);
});

