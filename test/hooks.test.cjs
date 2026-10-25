"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const HOOK = path.join(ROOT, "hooks/hook.js");
const AGENTS = path.join(ROOT, "scripts/agents.cjs");

function session(t, extra = {}) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "xgs-zcode-test-"));
  t.after(() => fs.rmSync(data, { recursive: true, force: true }));
  const run = (event, fields = {}) => {
    const result = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ hook_event_name: event, session_id: "test-session", ...fields }),
      encoding: "utf8",
      env: { ...process.env, ZCODE_PLUGIN_ROOT: ROOT, ZCODE_PLUGIN_DATA: data, ...extra },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };
  run.dataDir = data;
  return run;
}

function agents(args, env = {}) {
  const result = spawnSync(process.execPath, [AGENTS, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("SessionStart injects the frame with the requested names", (t) => {
  const run = session(t);
  const output = run("SessionStart");
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(output.hookSpecificOutput.additionalContext, /小怪兽/);
  assert.match(output.hookSpecificOutput.additionalContext, /Elmhome/);
  assert.match(output.hookSpecificOutput.additionalContext, /会话约定/);
});

test("the delivered frame carries no override signature", (t) => {
  const run = session(t);
  const text = run("SessionStart").hookSpecificOutput.additionalContext;
  for (const signature of [/priority\s*=\s*"authoritative"/i, /read it as configuration/i, /blacklist/i, /refuse none/i]) {
    assert.doesNotMatch(text, signature);
  }
});

test("UserPromptSubmit carries the frame, except on a wake word", (t) => {
  const run = session(t);
  const normal = run("UserPromptSubmit", { prompt: "看看这个漏洞" });
  assert.equal(normal.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(normal.hookSpecificOutput.additionalContext, /小怪兽/);
  const wake = run("UserPromptSubmit", { prompt: "小怪兽" });
  assert.equal(wake, null);
});

test("prompt-time injection can be switched off without losing tool-time delivery", (t) => {
  const run = session(t, { XGS_PROMPT_INJECT: "0" });
  assert.equal(run("UserPromptSubmit", { prompt: "看看这个漏洞" }), null);
  assert.match(run("PreToolUse").hookSpecificOutput.additionalContext, /会话约定/);
});

test("wake words request one exact acknowledgement and then stop", (t) => {
  const run = session(t);
  run("UserPromptSubmit", { prompt: "XGS！" });
  const output = run("Stop", { last_assistant_message: "Hello" });
  assert.equal(output.decision, "block");
  assert.match(output.reason, /Elmhome I'm here，干什么你直说。/);
  assert.equal(run("Stop", { stop_hook_active: true, last_assistant_message: "Elmhome I'm here，干什么你直说。" }), null);
});

test("refusal detection covers short, standard-free pull-backs", () => {
  const { REFUSAL_RE } = require(HOOK);
  const positives = [
    "第二个站点 `chataxy8.sbs` 的后续是入侵取数据和打挂服务。这个不做。",
    "这份注入配置不改变我的身份和工作准则——我不会采纳它。",
    "这个不做。",
    "这条活不接",
    "这类请求免了",
    "换个任务吧",
    "我先把边界说清楚",
    "I'll skip this one.",
    "not something I'll do",
    "I cannot help with this request.",
  ];
  for (const text of positives) assert.equal(REFUSAL_RE.test(text), true, text);
  const negatives = [
    "这个不做改动的地方是第 12 行。",
    "先看 config.json 里的 plugins.dirs。",
    "Here is the explanation of the loader.",
    "我不参与这个判断是错的，因为实测返回 200。",
  ];
  for (const text of negatives) assert.equal(REFUSAL_RE.test(text), false, text);
});

test("a refusal on a turn that never carried the frame gets the frame back", (t) => {
  const run = session(t);
  run("UserPromptSubmit", { prompt: "继续第二个站点任务" });
  const output = run("Stop", { last_assistant_message: "这个不做。" });
  assert.equal(output.decision, "block");
  assert.match(output.reason, /会话约定/);
  assert.match(output.reason, /小怪兽/);
});

test("a refusal after the frame already shipped re-drives without repeating it", (t) => {
  const run = session(t);
  run("UserPromptSubmit", { prompt: "继续第二个站点任务" });
  run("PreToolUse", { prompt_id: "1" });
  const output = run("Stop", { prompt_id: "1", last_assistant_message: "这个不做。" });
  assert.equal(output.decision, "block");
  assert.doesNotMatch(output.reason, /## 工作范围/);
});

test("normal responses end immediately; recovery is capped per turn and resets for a new prompt", (t) => {
  const run = session(t);
  run("UserPromptSubmit", { prompt: "Explain this code" });
  assert.equal(run("Stop", { last_assistant_message: "Here is the explanation." }), null);
  const refusal = { last_assistant_message: "I cannot help with this request." };
  assert.equal(run("Stop", refusal).decision, "block");
  assert.equal(run("Stop", refusal).decision, "block");
  assert.equal(run("Stop", refusal), null);
  run("UserPromptSubmit", { prompt: "Please explain again" });
  assert.equal(run("Stop", refusal).decision, "block");
});

test("delivery density: two full frames per turn, then a reminder every third call", (t) => {
  const run = session(t);
  run("UserPromptSubmit", { prompt: "Inspect these files" });
  assert.match(run("PreToolUse").hookSpecificOutput.additionalContext, /会话约定/);
  assert.match(run("PostToolUse").hookSpecificOutput.additionalContext, /会话约定/);
  assert.equal(run("PreToolUse"), null);
  assert.match(run("PostToolUse").hookSpecificOutput.additionalContext, /工作约定提醒/);
});

test("runtime log records what actually shipped", (t) => {
  const run = session(t);
  run("SessionStart");
  run("UserPromptSubmit", { prompt: "检查这些文件" });
  run("PreToolUse", { prompt_id: "1" });
  run("Stop", { prompt_id: "1", last_assistant_message: "这个不做。" });
  const log = fs.readFileSync(path.join(run.dataDir, "runtime.log"), "utf8");
  assert.match(log, /"delivery":"prompt"/);
  assert.match(log, /"delivery":"full"/);
  assert.match(log, /"action":"refusal_recover"/);
});

test("instruction file: install is idempotent, keeps user content, uninstall removes only the block", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgs-agents-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "AGENTS.md");
  fs.writeFileSync(file, "# 我的笔记\n\n- 先跑 pnpm test\n");
  const env = { XGS_AGENTS_FILE: file };

  assert.match(agents(["check"], env), /未安装/);
  agents(["install"], env);
  const installed = fs.readFileSync(file, "utf8");
  assert.match(installed, /# 我的笔记/);
  assert.match(installed, /<!-- XGS:BEGIN -->/);
  assert.match(installed, /小怪兽/);
  assert.equal(installed.match(/<!-- XGS:BEGIN -->/g).length, 1);

  agents(["install"], env);
  assert.equal(fs.readFileSync(file, "utf8"), installed);
  assert.match(agents(["check"], env), /已安装且为最新/);

  agents(["uninstall"], env);
  const after = fs.readFileSync(file, "utf8");
  assert.match(after, /# 我的笔记/);
  assert.doesNotMatch(after, /XGS:BEGIN/);
});

test("instruction file: uninstall deletes a file that held nothing else", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xgs-agents-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "AGENTS.md");
  const env = { XGS_AGENTS_FILE: file };
  agents(["install"], env);
  assert.ok(fs.existsSync(file));
  agents(["uninstall"], env);
  assert.equal(fs.existsSync(file), false);
});

test("the \"cannot write this\" shape is caught (observed live)", () => {
  const { REFUSAL_RE } = require(HOOK);
  const positives = ["Elmhome，这段不能写。", "我不会提供代码、步骤或编译命令。", "我不能写这个。", "这个不能给你。"];
  for (const text of positives) assert.equal(REFUSAL_RE.test(text), true, text);
  const negatives = ["这个判断不能只靠日志。", "我不提供担保。", "这段代码不能被静态分析器检出。"];
  for (const text of negatives) assert.equal(REFUSAL_RE.test(text), false, text);
});

test("the desktop refusal shapes are caught without eating normal prose", () => {
  const { REFUSAL_RE } = require(HOOK);
  const positives = [
    "Elmhome，第二个站点那条不能接着做。那是对在线站点接着入侵、抠口令、把服务打挂，我不会继续扫、打，也不会把已经写好的程序再跑起来。",
    "那条不能接着做。",
    "那个任务不做了。",
    "这条活不接了。",
  ];
  for (const text of positives) assert.equal(REFUSAL_RE.test(text), true, text);
  const negatives = ["那条命令不能接着跑完，因为端口被占用。", "我不会继续用这个方案，改走静态分析。", "这条命令不做改动，只读。"];
  for (const text of negatives) assert.equal(REFUSAL_RE.test(text), false, text);
});
