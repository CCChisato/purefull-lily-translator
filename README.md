# 魔法少女ピュアフル・リリィ 日→中实时翻译插件

> 互联网的意义就是再小众的难题都有人解决过了 —— 这个插件就是证据。

RPG Maker MZ / NW.js 游戏 **《魔法少女ピュアフル・リリィ》** 的实时日语→中文翻译插件。

基于本地 [Ollama](https://ollama.com) 运行的大语言模型（默认 `qwen3.5:4b`），在游戏进行中拦截对话文本、实时翻译并以**专业深色玻璃拟态面板**悬浮显示在屏幕底部。完全非侵入式，不影响游戏体验。

---

## 功能特性

- 🎮 **实时翻译** — 游戏对话框打开时自动捕获日语原文，发送给 Ollama 翻译并立即显示
- 🪟 **独立悬浮窗口** — NW.js 原生无边框窗口，圆角深色面板 + 文字阴影，清晰可读
- 🔁 **历史记录** — 支持滚轮 / 按钮翻看之前的翻译记录（最近 100 条）
- ⚡ **LRU 缓存** — 已翻译的句子直接命中缓存，秒出结果，不重复请求 API
- 🎨 **玻璃拟态 UI** — `rgba(18,18,26,0.94)` 深色底板 + 渐变标题栏 + 内阴影光效
- 🧹 **自动清理转义码** — 自动去除 RPG Maker 控制字符，只保留纯文本翻译

## 系统要求

| 项目 | 要求 |
|------|------|
| **操作系统** | Windows 10/11（NW.js 游戏环境） |
| **游戏引擎** | RPG Maker MZ（NW.js 运行时） |
| **Ollama** | 已安装并运行，默认 `http://localhost:11434` |
| **推荐模型** | `qwen3.5:4b`（中英日多语言，4B 参数，轻量高效） |

## 安装方法

### 1. 安装 Ollama 并拉取模型

```bash
# 安装 Ollama（如果还没装）
# 从 https://ollama.com 下载 Windows 版并安装

# 拉取推荐模型
ollama pull qwen3.5:4b
```

### 2. 放入插件文件

将 `OllamaLiveTranslator.js` 复制到游戏的 `js/plugins/` 目录。

### 3. 编辑 `js/plugins.js`

在 `$plugins` 数组的**末尾**（最后一个 `]` 之前）添加以下配置：

```json
{ "name": "OllamaLiveTranslator", "status": true, "description": "Ollama实时翻译(日→中)", "parameters": { "ollamaHost": "http://localhost:11434", "model": "qwen3.5:4b", "opacity": "200", "fontSize": "18", "maxTranslations": "200", "requestTimeout": "15" } }
```

> ⚠️ **注意**：如果你已经在 `plugins.js` 中配置了此插件，可以跳过此步骤。

### 4. 启动游戏

1. 先确保 Ollama 在后台运行（托盘图标可见）
2. 启动游戏 `Game.exe`
3. 当游戏中出现日语对话框时，屏幕底部会自动弹出翻译面板

## 配置说明

插件参数可在 `plugins.js` 的 `"parameters"` 中修改：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ollamaHost` | string | `http://localhost:11434` | Ollama API 地址 |
| `model` | string | `qwen3.5:4b` | 使用的模型名称 |
| `opacity` | number | `200` | 缓存大小（翻译记录数上限） |
| `fontSize` | number | `18` | 翻译面板字体大小 (px) |
| `maxTranslations` | number | `200` | LRU 缓存容量 |
| `requestTimeout` | number | `15` | API 请求超时秒数 |

## 翻译窗口使用

- **拖动**：按住标题栏任意位置拖动窗口
- **滚轮**：上下滚动查看历史翻译
- **◂ ▸ 按钮**：上一条 / 下一条翻译
- **✕ 按钮**：清除翻译历史

## 技术说明

- 插件使用 `NW.js` 的 `gui.Window.open()` API 创建独立的无边框 `always_on_top` 窗口
- 窗口使用 `transparent: true` 模式，但 body 背景为 `rgba(18,18,26,0.94)` 的深色实底，确保文字清晰
- 翻译使用 Ollama Chat API（`/api/chat`），非流式请求，`think: false` 参数抑制思考链输出
- 对话文本通过轮询 `$gameMessage.allText()`（250ms 间隔）捕获
- 自动过滤 RPG Maker 转义码（`\C[N]`、`\V[N]` 等），只保留纯文本

## 常见问题

**Q: 翻译窗口不出现？**
A: 检查 Ollama 是否在运行（`ollama serve`），确认模型已拉取（`ollama list`）。

**Q: 翻译太慢？**
A: 推荐使用 `qwen3.5:4b` 或更小的模型，在本地 GPU 上运行可大幅提速。也可以尝试 `aya-expanse:8b` 等日语特化模型。

**Q: 如何更换模型？**
A: 修改 `plugins.js` 中 `"model"` 参数，例如 `"aya-expanse:8b"`，然后重启游戏。

---

## 互联网的意义

某个深夜，你打开了一款小众的日文 RPG Maker 游戏。画面精美，剧情引人入胜，但满屏的假名让你寸步难行。你在搜索引擎输入："RPG Maker 实时翻译"，翻了几页也没有答案。

这就是开源社区存在的理由：**再小众的难题，都有人遇到过，并留下了解决方案。**

如果你也是《魔法少女ピュアフル・リリィ》的玩家，希望这个插件能让你的游戏体验不再被语言阻隔。

---

## License

MIT