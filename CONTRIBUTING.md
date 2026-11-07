# 参与贡献

感谢愿意帮忙！这个项目刻意保持「小」：零依赖、零构建、单页应用。
提 PR 之前，先看一眼下面几条约定，能省下不少来回。

## 基本原则

- **不加运行时依赖**。前端只用浏览器原生 API，测试只用 `node:test`。
- **算法和界面分离**。能算的东西写进 `src/tools/`，UI 只做取值与渲染。
- **不发起网络请求**。这个工具的卖点就是数据不出浏览器。
- **保持可离线**。不要引入 CDN 字体、图标库或远程脚本。

## 本地开发

```bash
npm test            # 全部单元测试
npm run test:watch  # 监听模式
npm run check       # 检查每个模块是否正常导出
npm start           # http://127.0.0.1:4173
```

Node.js 18 及以上即可，不需要 `npm install`。

## 新增一个工具

1. **写逻辑**：在 `src/tools/` 新建模块，导出纯函数，返回 `{ ok: true, ... }` 或 `{ ok: false, error: "..." }`，不要碰 DOM。
2. **写测试**：在 `test/` 新建 `*.test.js`，至少覆盖正常输入、边界情况、非法输入三类。
3. **接界面**：在 `assets/app.js` 写 `renderXxx()`，然后在 `TOOLS` 数组里登记 `{ id, name, group, badge, desc, keywords, render }`。
4. **自检**：`npm test && npm run check`，再本地打开确认深浅色、窄屏都不塌。

## 代码风格

- 2 空格缩进、双引号、语句结尾带分号（有 `.editorconfig`，编辑器会自动对齐）；
- 提交前不要把格式化工具的差异混进功能改动里；
- 中文文案用全角标点，英文与数字两侧留空格；
- 函数名用动词开头，`isXxx` / `hasXxx` 返回布尔值。

## 提交信息

采用简化版 Conventional Commits，中英文都行：

```
feat(cidr): 支持 IPv6 前缀计算
fix(cron): 修正夏令时边界下的下一次触发时间
docs: 补充 GitHub Pages 部署说明
test(json): 增加非法 JSON 定位用例
```

## Pull Request

- 一个 PR 只做一件事，描述里写清楚「为什么」而不只是「改了什么」；
- 涉及界面改动时，贴一张改动后的截图；
- 确保 CI 通过（`.github/workflows/ci.yml` 会在 Node 18 / 20 / 22 上跑测试）。

## 报告问题

用仓库的 Issue 模板提交，尽量附上：输入内容、期望结果、实际结果、浏览器版本。
注意别把真实的生产日志、密钥或 token 贴进 Issue，可以先把敏感字段替换掉。
