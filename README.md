# XGS · ZCode

ZCode 原生插件版本。助手名为 **小怪兽**，称呼用户为 **Elmhome**；唤醒词为 `XGS`、`xgs`、`小怪兽`。
沿用现有 XGS 框架正文，使用 ZCode 的插件清单、事件字段和 hook 协议。

## 在这台 Mac 上使用

1. 先完全退出 ZCode。
2. 双击项目目录里的 **`start.command`**。它会自动找到本机 Node.js 和 ZCode，校验插件，添加本地插件目录，然后打开 ZCode 桌面应用。
3. 新建对话，发送 `XGS`。预期回复：

```text
Elmhome I'm here，干什么你直说。
```

仅安装、不打开应用：双击 `install.command`。卸载此项目的配置：双击 `uninstall.command`，然后重启 ZCode。
如 ZCode 已经打开，启动器只会将它打开或带到前台；需要完全退出后重开，新的会话才会加载新配置。

执行权限已设置。复制文件后如权限丢失，在项目目录执行：

```bash
chmod +x start.command install.command uninstall.command
```

只检查环境，不安装、不启动会话：

```bash
./start.command --check
```

## 配置和更新

安装脚本将当前项目的绝对路径合并到 `~/.zcode/cli/config.json` 的 `plugins.dirs`，并启用插件加载。
修改配置前会生成同目录的 `.xgs-backup-…` 备份；已有插件目录和其他配置字段保留。
本地目录直接加载，修改源码后完全退出 ZCode，重开并新建对话即可。
卸载脚本只移除此项目的目录引用，不删除源文件或其他插件。

默认应用位置是 `/Applications/ZCode.app`，使用其自带的 `Contents/Resources/glm/zcode.cjs`。
自定义位置可通过 `ZCODE_APP`、`ZCODE_CLI`、`NODE_EXE` 指定。
测试时可用 `XGS_ZCODE_CONFIG` 指定另一个 JSON 配置文件；该变量只控制本项目安装脚本的写入位置。

## 原生接口

- 清单：`.zcode-plugin/plugin.json`。
- `SessionStart`：注入 `prompts/xgs.md` 全文。
- `UserPromptSubmit`：记录唤醒意图，重置本轮计数。
- `PreToolUse` / `PostToolUse`：本轮首次投递全文，之后每三次刷新精简契约。
- `Stop`：唤醒确认或拒绝恢复；每个用户输入的恢复上限为两次，正常回答直接结束。
- Hook 使用 `process` 执行器和 `ZCODE_PLUGIN_ROOT` / `ZCODE_PLUGIN_DATA`，同时兼容 snake_case 和 camelCase 事件字段。
- `hooks/run.sh` 自动寻找 Node.js，处理 Finder / 桌面应用没有加载 nvm PATH 的情况。

日志和状态写入宿主提供的 `ZCODE_PLUGIN_DATA`；宿主未提供时回退到 `~/.zcode/cli/plugins/data/xgs/`。
`rules/xgs.md` 是框架短版；当前 hook 实际加载的是 `prompts/xgs.md`。

## 验证

已在本机 ZCode Desktop `3.16.2` / 内置 CLI `0.17.0` 上完成清单校验、五个 hook 的发现、配置安装/重复安装/卸载验证。

```bash
node --test test/hooks.test.cjs
```

测试覆盖事件字段、唤醒确认、恢复上限和缺少 prompt ID 时的刷新计数。
验证使用临时配置和模拟事件，未调用真实模型；实际回答需要安装后在新会话中验证。

接口参考：[ZCode Hooks](https://zcode.z.ai/en/docs/hooks)、[ZCode 插件开发](https://zcode.z.ai/en/docs/plugin)。
