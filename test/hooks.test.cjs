"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
function session(t) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "xgs-zcode-test-"));
  t.after(() => fs.rmSync(data, { recursive: true, force: true }));
  return (event, fields = {}) => {
    const result = spawnSync(process.execPath, [path.join(ROOT, "hooks/hook.js")], {
      input: JSON.stringify({ hook_event_name: event, session_id: "test-session", ...fields }),
      encoding: "utf8", env: { ...process.env, ZCODE_PLUGIN_ROOT: ROOT, ZCODE_PLUGIN_DATA: data },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };
}
test("ZCode snake_case SessionStart injects the frame with the requested names", t => {
  const run = session(t);
  const output = run("SessionStart");
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(output.hookSpecificOutput.additionalContext, /小怪兽/);
  assert.match(output.hookSpecificOutput.additionalContext, /Elmhome/);
});
test("wake words request one exact acknowledgement and then stop", t => {
  const run = session(t);
  run("UserPromptSubmit", { prompt: "XGS！" });
  const output = run("Stop", { last_assistant_message: "Hello" });
  assert.equal(output.decision, "block");
  assert.match(output.reason, /Elmhome I'm here，干什么你直说。/);
  assert.equal(run("Stop", { stop_hook_active: true, last_assistant_message: "Elmhome I'm here，干什么你直说。" }), null);
});
test("normal responses end immediately; recovery is capped across repeated Stop events and resets for a new prompt", t => {
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
test("missing prompt IDs do not cause full-frame delivery on every tool call", t => {
  const run = session(t);
  run("UserPromptSubmit", { prompt: "Inspect these files" });
  assert.match(run("PreToolUse").hookSpecificOutput.additionalContext, /xgs-operating-frame priority/);
  assert.equal(run("PostToolUse"), null);
  assert.equal(run("PreToolUse"), null);
  assert.match(run("PostToolUse").hookSpecificOutput.additionalContext, /xgs-operating-frame-refresh/);
});
