# Orca Companion

独立的 Orca 分支，加入原生「伙伴」侧栏、多伙伴、群聊、长期记忆、待办、例行任务和可选文件夹同步。不是 Cindy 官方客户端，也不是 Orca 官方发行版。

## 使用

1. 打开 Orca Companion，配置 Codex 账号。无需添加项目或选择工作区。
2. 左侧「伙伴」标题右侧点击「+」添加伙伴，填写名字和协作方式。每个伙伴独立显示在侧栏；点击名字打开其聊天，点击旁边设置按钮修改资料。原有伙伴和聊天会保留。
3. 点击「与伙伴聊天」。应用自动建立本机「伙伴的家」工作区，持久绑定原生聊天；关闭标签或重启后恢复同一条会话。聊天服务暂不可达时不会自动创建替代聊天。助手通过专属目录的 AGENTS.md 和随包 CLI 读取、搜索、保存偏好、进展和摘要。只有实际写入后才算保存，模型并不保证自动记录每件事。
4. 在「记忆」「待办」里添加、搜索、编辑或删除条目；记忆支持分类和冲突处理，待办支持完成状态、期限、来源及下一步。在「对话」里查看绑定聊天的文字副本。每次修改长期资料后自动重建 MEMORY.md 索引，原始事件仍是存储依据。
5. 「群聊」可选 2–6 位伙伴，按顺序或并行回复；群聊执行使用每位伙伴自己的会话，与私聊分开保存。可暂停、归档群聊。群内消息会发给参与者；每位伙伴的私有记忆不会自动发给其他伙伴。
6. 在伙伴资料中可设头像、模型、置顶、隐藏、暂停、归档或移入回收站；可复制伙伴。在「技能」中编辑该伙伴的指令和技能文件。在「例行任务」中设定时间或用户更新触发，也可手动执行和停止；「整理记忆」会生成可撤销的变更和待确认的技能候选。后台任务使用单独会话并保留结果。语音聊天使用 Orca 已配置的语音转写，确认文字后发送，可用系统本机声音朗读新回复。
7. 云盘文件同步是可选功能，默认收起。本机使用不需要配置。若需要文件同步，在两台设备上选择同一个云盘文件夹，应用每 30 秒交换 `OrcaCompanion-v1/events`。云盘客户端负责实际上传下载。

同步包含伙伴资料、记忆、待办、摘要和绑定聊天的用户/助手文字；不包含账号凭据、工具输出、思考、附件或工作区文件。云盘客户端负责实际上传下载。「上次文件交换」不代表云端上传完成。首次启动同步默认关闭。

并发修改保留多个版本，在面板中选定版本后收敛。删除使用删除标记，历史内容仍在事件文件中；断开同步也不会清除副本。同步目录中的 JSON 是可读文本，不额外加密。聊天文字按 30 秒轮询采集，关机前可点「立即同步」。原始聊天仍由 Orca 保存。跨设备恢复的是文字上下文，不是完整工具执行会话。

已配对的 Orca 手机端提供伙伴列表、记忆与待办查看、打开私聊及发送群消息；手机端暂不提供创建或编辑伙伴。手机入口需要连接运行中的桌面主机。独立包需单独配置账号，不迁移官方应用的加密凭据。

## 数据和构建

macOS 正式数据目录：`~/Library/Application Support/orca-companion`；开发默认目录：`orca-companion-dev`。原有伙伴文件位于其中的 `companion/`；新增伙伴位于 `companion-homes/<id>/`，名单保存在 `companion-roster.json`。应用 ID 为 `com.rozen630.orca-companion`。官方应用的自动更新被禁用，避免覆盖分支功能。

`companion/` 同时是专属工作区根目录。普通工作文件放 `workspace/`，长期资料在 `events/`，`MEMORY.md` 是可重建索引，`AGENTS.md` 提供记忆维护说明，`tools/` 是本地 CLI。启动上下文优先保留伙伴身份，超出摘要范围的旧记忆仍可通过 `search` / `list` 查询。

支持多个伙伴，各自绑定独立聊天、资料和记忆；默认不会自动共享其他伙伴的记忆。这是数据与上下文分离，并非对完全访问模式的文件系统安全沙箱。新增伙伴的可选文件同步使用各自 ID 子目录，伙伴名单、群聊、例行任务及技能文件目前不跨设备同步。账号云同步按用户要求暂缓。已绑定的长期聊天若被真正删除，不会悄悄新建替代聊天。

```sh
pnpm install --frozen-lockfile
pnpm --dir mobile install --frozen-lockfile
pnpm run build:native
pnpm run build:desktop:assets
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --config config/electron-builder.config.cjs --mac dmg zip --arm64 --publish never
```

本地构建为 Apple Silicon 开发包，未做 Apple 公证。若本机 `swift-package` 因工具链不兼容无法启动，可设置 `ORCA_SWIFT_DIRECT=1` 使用 `swiftc` 构建 computer-use helper。必要时用 `SDKROOT` 指向本机已安装且匹配的 macOS SDK。不要覆盖原来的 Orca.app。

## 同步 Orca 上游

`origin` 指向个人 fork，`upstream` 指向 `https://github.com/stablyai/orca.git`。伙伴开发分支为 `companion/main`。更新不会自动安装，需要合并、验证和重新打包。

在工作区没有未提交修改时，先建立更新分支：

```sh
git switch companion/main
git fetch upstream
git switch -c companion/update-upstream-YYYYMMDD
git merge upstream/main
```

解决冲突时保留独立应用身份、数据目录、Companion IPC/侧栏和更新隔离。特别检查上游聊天启动、会话 journal、preload API 和打包入口的变化。不要直接用上游分支覆盖伙伴分支。

```sh
node --test resources/companion/store.test.mjs
pnpm exec tsc --noEmit -p config/tsconfig.node.json --composite false
pnpm exec tsc --noEmit -p config/tsconfig.tc.web.json --composite false
ORCA_BACKGROUND_LAUNCH=1 pnpm exec vitest run --config config/vitest.config.ts src/main/startup/dev-instance-identity.test.ts src/shared/local-build-compatibility.test.ts
```

随后按构建步骤打包，用独立测试数据目录验证侧栏、记忆保存、聊天绑定、双目录同步及删除冲突。验证完成再合并回 `companion/main`，推送个人 fork。上游更新可能有冲突，不能保证无人工介入。
