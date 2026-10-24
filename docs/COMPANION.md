# Orca Companion

独立的 Orca 分支，加入桌面原生「伙伴」侧栏、身份、长期记忆、待办和基于文件夹的云同步。不是 Cindy 官方客户端，也不是 Orca 官方发行版。

## 使用

1. 打开 Orca Companion，配置 Codex 账号，添加或选择一个本机工作区。
2. 左侧点击「伙伴」，设置名字和协作方式，点击「保存资料」。
3. 点击「与伙伴聊天」。新聊天会读取已有记忆；助手可以通过随包 CLI 保存偏好、进展和摘要。只有实际写入后才算保存，模型并不保证自动记录每件事。
4. 在「记忆」「待办」里添加或删除条目；在「对话」里查看绑定聊天的文字副本。
5. 在两台设备上选择同一个云盘文件夹，应用每 30 秒交换 `OrcaCompanion-v1/events`。可以使用 iCloud Drive 或其他已安装的云盘客户端。选择普通本地目录只会实现文件交换，不会自动获得云存储。

同步包含伙伴资料、记忆、待办、摘要和绑定聊天的用户/助手文字；不包含账号凭据、工具输出、思考、附件或工作区文件。云盘客户端负责实际上传下载。「上次文件交换」不代表云端上传完成。首次启动同步默认关闭。

并发修改保留多个版本，在面板中选定版本后收敛。删除使用删除标记，历史内容仍在事件文件中；断开同步也不会清除副本。同步目录中的 JSON 是可读文本，不额外加密。聊天文字按 30 秒轮询采集，关机前可点「立即同步」。原始聊天仍由 Orca 保存。跨设备恢复的是文字上下文，不是完整工具执行会话。

当前伙伴入口仅用于桌面本机原生聊天。远程主机、手机端不提供这个面板；不会因它们缺少 Companion API 而影响原有界面。独立包需单独配置账号，不迁移官方应用的加密凭据。

## 数据和构建

macOS 正式数据目录：`~/Library/Application Support/orca-companion`；开发默认目录：`orca-companion-dev`。伙伴文件位于其中的 `companion/`。应用 ID 为 `com.rozen630.orca-companion`。官方应用的自动更新被禁用，避免覆盖分支功能。

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
