"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "..");
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
  catch (error) { if (error.code === "ENOENT" && fallback !== undefined) return fallback; throw error; }
}
function writeJSON(file, data) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (before !== null && JSON.stringify(JSON.parse(before.replace(/^\uFEFF/, ""))) === JSON.stringify(data)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const mode = before === null ? 0o600 : fs.statSync(file).mode & 0o777;
  if (before !== null) {
    const backup = file + ".xgs-backup-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex");
    fs.copyFileSync(file, backup);
    fs.chmodSync(backup, mode);
    console.log("已备份：" + backup);
  }
  const temporary = file + ".xgs-" + crypto.randomBytes(6).toString("hex");
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n", { mode });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function canonical(file) { try { return fs.realpathSync(file); } catch { return path.resolve(file); } }
function object(value, description) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(description + " 必须是对象");
  return value;
}

function main() {
  const action = process.argv[2] || "check";
  if (!["check", "install", "uninstall"].includes(action)) throw new Error("未知操作：" + action);
  const file = process.env.XGS_ZCODE_CONFIG || path.join(os.homedir(), ".zcode", "cli", "config.json");
  const config = object(readJSON(file, {}), "ZCode 配置");
  const plugins = object(config.plugins || {}, "plugins");
  const dirs = plugins.dirs === undefined ? [] : plugins.dirs;
  if (!Array.isArray(dirs) || dirs.some(dir => typeof dir !== "string")) throw new Error("plugins.dirs 必须是路径数组");
  const ours = dir => canonical(dir.startsWith("~/") ? path.join(os.homedir(), dir.slice(2)) : dir) === canonical(ROOT);
  if (action === "check") {
    console.log("配置可读取：" + file);
    console.log("插件：xgs；身份：小怪兽；用户称呼：Elmhome");
    return;
  }
  if (action === "install") {
    plugins.enabled = true;
    plugins.dirs = dirs.some(ours) ? dirs : [...dirs, ROOT];
    config.plugins = plugins;
    writeJSON(file, config);
    console.log("XGS 已配置为 ZCode 本地插件。完全退出应用后重开，新建对话生效。");
  } else {
    if (!dirs.some(ours)) { console.log("当前配置未引用此插件，无需卸载。"); return; }
    plugins.dirs = dirs.filter(dir => !ours(dir));
    config.plugins = plugins;
    writeJSON(file, config);
    console.log("已移除此 XGS 插件目录；其他插件和配置保留。请重启 ZCode。");
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
