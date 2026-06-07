# AI 实时翻译

采集 Windows 系统声音，实时生成并持续纠正中文字幕的桌面应用。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 36 |
| 前端 | React 19 + TypeScript 5.8 |
| 构建 | electron-vite + Vite 6 |
| 状态管理 | Zustand 5 |
| 配置校验 | Zod |
| 配置持久化 | electron-store |
| 音频处理 | ffmpeg-static |
| 实时翻译 | 通义千问 Live Translate（Qwen3.5，WebSocket） |
| 精校翻译 | DeepSeek（OpenAI 兼容 API） |
| 测试 | Vitest + jsdom |

## 实时翻译工作流

```
系统音频采集 (16kHz PCM)
    │
    ▼
通义千问 Live Translate WebSocket
    │  实时源语言识别 + 目标语言翻译
    │
    ├─→ 字幕块管理（按 blockDurationMs 分块）
    │
    └─→ 积累到一定数量后触发精校
         │
         ▼
    DeepSeek API 精校翻译
         │  结合上下文修正翻译质量
         ▼
    字幕状态流转：live → pending_refine → refined
         │
         ▼
    渲染进程实时更新字幕时间线
```

- **实时翻译**：通义千问 Live Translate 通过 WebSocket 双向流式处理，同时完成语音识别和实时翻译
- **精校修正**：每积累若干条实时翻译结果后，调用 DeepSeek 结合上下文重新精校，修正早期翻译偏差
- **字幕状态**：每条字幕经历 `live`（实时）→ `pending_refine`（待精校）→ `refined`（已精校）三个状态

## 功能特性

- 采集 Windows 系统音频，实时语音识别和翻译
- 实时字幕纵轴滚动展示，新内容自动贴底
- 悬浮窗模式：可独立显示简洁字幕窗口，不遮挡其他应用
- 滑动窗口精校：反向修正近期字幕，提升翻译一致性
- 本地文件处理：支持导入音视频文件，通过 ffmpeg 归一化后流转（开发中）

## 演示视频

[📺 在小红书查看 Demo 演示视频](https://www.xiaohongshu.com/explore/6a25754100000000210206d0?xsec_token=ABHOZZ-CFG9s_fkpVetDSlACLrPCMdY3W_7wJNACtXhTw=&xsec_source=pc_user)

## 开始使用

```bash
# 安装依赖
npm install

# 启动开发模式（支持热重载）
npm run dev

# 运行测试
npm test

# 生产构建
npm run build
```

### 配置

应用启动后，在设置面板中填入以下密钥：

| 配置项 | 说明 |
|--------|------|
| 通义密钥 | 阿里云 DashScope API Key，用于 Qwen Live Translate 实时翻译 |
| DeepSeek 密钥 | DeepSeek API Key，用于翻译结果精校 |

### 使用步骤

1. 在设置面板填入 API 密钥，点击保存
2. 点击「开始采集系统声音」
3. 实时字幕会出现在下方字幕区域
4. 点击「⊞ 悬浮窗」可打开独立的简洁字幕窗口

## 系统要求

- Windows 10 / 11
- Node.js 20+
- 阿里云 DashScope API 访问权限
- DeepSeek API 访问权限

> **macOS 限制**：系统音频采集依赖 Windows 的 loopback 音频捕获。macOS 不提供原生系统音频捕获，需要额外安装虚拟音频驱动（如 BlackHole）并手动配置路由。

## 项目结构

```
src/
├── shared/          # 纯 TypeScript 契约层（config / pipeline / events）
├── main/            # Electron 主进程
│   ├── index.ts     # 窗口管理、IPC 注册
│   ├── ipc/         # IPC 处理器
│   └── services/    # 业务逻辑（ffmpeg / 翻译 / 字幕会话）
├── preload/         # 预加载脚本（contextBridge）
└── renderer/src/    # React 渲染进程
    ├── App.tsx      # 主界面
    ├── FloatingApp.tsx  # 悬浮窗界面
    ├── features/    # 功能组件（字幕 / 工作区 / 状态栏 / 设置）
    └── state/       # Zustand 状态管理
```
