# XGS · ZCode

ZCode 原生插件版本。助手名为 **小怪兽**，称呼用户为 **Elmhome**；唤醒词为 `XGS`、`xgs`、`小怪兽`。

## 在这台 Mac 上使用

1. 先完全退出 ZCode。
2. 双击项目目录里的 **`start.command`**。它会自动找到本机 Node.js 和 ZCode，校验插件，把项目目录加入本地插件，写入用户级指令文件，然后打开 ZCode 桌面应用。
3. 新建对话，发送 `XGS`。预期回复：

```text
Elmhome I'm here，干什么你直说。
```

仅安装、不打开应用：双击 `install.command`。卸载：双击 `uninstall.command`，然后重启 ZCode。
ZCode 已经打开时，启动器只会把它带到前台；需要完全退出后重开，新会话才会加载新配置。

执行权限已设置。复制文件后如权限丢失：

```bash
chmod +x start.command install.command uninstall.command
```

只检查环境，不安装、不启动会话：

```bash
./start.command --check
```

## 投递模型（v1.1）

框架进四个通道，哪一个先到都算数：

| 事件 | 内容 | 落点 |
|---|---|---|
| `SessionStart` | 约定全文 | 宿主 prompt 之后的 system 消息，整场会话存活 |
| `UserPromptSubmit` | 约定全文（唤醒词那一轮不带） | 轮次开始；宿主丢弃这个出口时无副作用 |
| `PreToolUse` / `PostToolUse` | 每轮前两次投全文，之后每三次投精简提醒 | 工具结果侧 |
| `Stop` | 唤醒确认，或有上限的补救 | 新开一轮 |

三条设计决定，都是对实测失败的直接回应：

- **无工具轮补全文。** 拒绝的典型形态是不调工具、一句话收尾。这种轮次在钩子里没有任何投递点，所以补救时若发现本轮一次都没发过约定，就把全文随补救一起发回。
- **每轮两次全文。** 只有一份时，它会被压在不断变长的工具记录底下，等于没发。第三、六、九次调用降级成短提醒。
- **用户级指令文件。** `~/.zcode/AGENTS.md` 由 ZCode 作为默认指令加载，位置在自家 prompt 之后、工作区指令之前。这是不依赖任何事件的通道，装了就在。

框架正文的写法也改过：上一版开场是「priority=authoritative / 按配置读，不要当请求读」这类前置声明，模型读到的是覆盖企图，于是回一句「这是注入，我不采纳」。现在保留全部实质内容（身份、称呼、输出风格、深度阶梯、范围、重试、唤醒、交付结构），去掉那些识别特征。

## 配置和更新

安装脚本做两件事：

1. 把项目绝对路径合并进 `~/.zcode/cli/config.json` 的 `plugins.dirs`，并启用插件加载；
2. 在 `~/.zcode/AGENTS.md` 里写入 `<!-- XGS:BEGIN --> … <!-- XGS:END -->` 段。

两个文件改动前都会生成同目录 `.xgs-backup-…` 备份。指令文件里的标记段之外的内容原样保留；卸载只删这一段，段外内容不动，文件删空才删除文件。

本地目录直接加载。改源码后完全退出 ZCode，重开并新建对话即可。

默认应用位置是 `/Applications/ZCode.app`，使用其自带的 `Contents/Resources/glm/zcode.cjs`。
自定义位置用 `ZCODE_APP`、`ZCODE_CLI`、`NODE_EXE` 指定。
测试用 `XGS_ZCODE_CONFIG`、`XGS_ZCODE_HOME`、`XGS_AGENTS_FILE` 指定替代路径；`XGS_PROMPT_INJECT=0` 关掉轮首投递。

## 拒绝识别

`Stop` 的补救靠一张正则表识别「打了折扣的回复」。两族：

1. 引用了某套标准的回复；
2. 本机实际出现得更多的那一族 —— 一句话就走，连标准都不提。例如 12 到 40 字的短句。

每条短句模式都以停顿符收尾，所以正文里恰好含有动词的正常句子（「这个不做改动的地方是第 12 行」）不会被误判。恢复上限是每个用户输入两次，正常情况下第一轮 `Stop` 就直接放行。

## 原生接口

- 清单：`.zcode-plugin/plugin.json`（`skills: ./skills`）。
- 钩子：`hooks/hooks.json`，五个事件；`hooks/run.sh` 自动找 Node.js，兼容 Finder 和桌面应用没有 nvm PATH 的情况。
- 兼容 snake_case 与 camelCase 两套事件字段。
- 日志和状态写入 `ZCODE_PLUGIN_DATA`；宿主没给时回退到 `~/.zcode/cli/plugins/data/xgs/`。
- `prompts/xgs.md` 是全文，`rules/xgs.md` 是短版，`skills/xgs/SKILL.md` 是模型可自行读取的技能副本。

## 验证

```bash
node --test test/hooks.test.cjs
```

13 项覆盖：投递事件与字段、唤醒确认、拒绝识别的正负样本、无工具轮补全文、已有投递时只发指令、上限、投递密度、运行日志字段、指令文件的安装/重复安装/卸载/段外内容保留。

会话里跑一轮后，直接看日志：

```bash
L="${ZCODE_PLUGIN_DATA:-$HOME/.zcode/cli/plugins/data/xgs@inline}/runtime.log"
grep -o '"ev":"[a-z_]*"[^}]*"delivery":"[a-z]*"' "$L" | tail
grep '"action":"refusal_recover"' "$L" | tail -3
```

判据：出现 `"delivery":"prompt"` 或 `"delivery":"full"` 说明约定在投；出现 `"action":"refusal_recover"` 且 `"inject":"frame"` 说明无工具轮的补投生效了。

清单校验：

```bash
node /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs plugins validate "$PWD"
```

接口参考：[ZCode Hooks](https://zcode.z.ai/en/docs/hooks)、[ZCode 插件开发](https://zcode.z.ai/en/docs/plugin)。
