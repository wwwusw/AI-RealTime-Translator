# AI RealTime Translator

一个基于 Electron 的本地文件字幕翻译 MVP，当前重点是把桌面工作区、任务状态和字幕时间轴演示页先跑通。

## 当前能力

- 导入本地媒体文件并展示任务工作区
- 展示基础任务状态、最近修订摘要和 Provider 配置摘要
- 在 renderer 中演示最小可用的字幕时间轴
- `draft` 字幕显示“处理中”，`final` 字幕显示“已稳定”
- 修订过的字幕有单独高亮样式，中文主显示、英文辅显示

## 技术栈

- Electron
- React
- TypeScript
- ffmpeg-static
- DeepSeek API（用于翻译与纠错，采用 OpenAI 兼容格式）

## 配置说明

- `baseUrl`：OpenAI 兼容接口地址，可指向 DeepSeek API
- `apiKey`：翻译与纠错请求使用的密钥
- `model`：翻译与纠错模型名称

## 运行方式

```bash
npm install
npm run dev
```

## 已知限制

- 第一阶段只支持本地文件输入
- 系统音频实时采集将在下一阶段实现

## 后续说明

如果后续引入别的框架，或复用历史代码片段、脚手架和实现策略，会在 README 里继续追加说明。
