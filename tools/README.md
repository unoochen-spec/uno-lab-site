# Figma 切图导出脚本

把 Figma 设计稿里的所有切图（页面、Hero、头像、卡片）满分辨率导出到 `../assets/`，覆盖现有的低分辨率截图占位。

## 一次性准备：拿一个 Figma Personal Access Token

1. 打开 <https://www.figma.com/settings>
2. 滚到 **Personal access tokens** 区块
3. 点 **Generate new token** → Scope 选 **File content (read)** 即可 → 起个名字（例如 `uno-export`）
4. 复制生成的 `figd_xxxxxxxxxxxx` 字符串。**只会出现一次**，关掉就再也看不到了。

## 跑

```bash
cd "/Users/bytedance/Documents/Uno Lab/uno-lab-site"

# 默认 @3x PNG（SKIP_ASSETS 中的本地替换文件会自动跳过）
FIGMA_TOKEN=figd_你的token node tools/export-figma.mjs
```

跑完会看到类似输出：

```
  ✓ page-home.png                 1.42 MB    Home 整页
  ✓ hero-jianying.png             480 KB     剪映 Hero
  ...
  ✓ 17 张已替换   总计 23.4 MB
  ↳ 旧文件备份在 assets/.backup/
```

## 可选环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `FIGMA_TOKEN` | — | **必填**。Personal Access Token |
| `FIGMA_FILE_KEY` | `G3hpMffTwNfHLGYbQo5BhQ` | 文件 key（URL 里 `/design/` 后那段） |
| `SCALE` | `3` | 渲染倍数。1 / 2 / 3 / 4。默认 **@3x**；可用 `SCALE=2` 减小体积 |
| `SKIP_ASSETS` | `contact-qr.png,brand-uno-logo.png` | 逗号分隔文件名，不下载不覆盖（你已手动替换的资源） |
| `FORMAT` | `png` | `png` / `jpg` / `svg`。SVG 仅对矢量节点有效 |
| `DRY` | — | `DRY=1` 干跑：只打印将下载哪些 URL，不写文件 |
| `ONLY` | — | 只导某几张，按文件名前缀过滤。例：`ONLY=page-home,hero-` |

例：

```bash
# 干跑，看看会发生什么
FIGMA_TOKEN=figd_xxx DRY=1 node tools/export-figma.mjs

# 只重导所有 hero 视频图，3x 高清
FIGMA_TOKEN=figd_xxx SCALE=3 ONLY=hero- node tools/export-figma.mjs

# 只导 Home 页
FIGMA_TOKEN=figd_xxx ONLY=page-home node tools/export-figma.mjs
```

## 想加新切图？

打开 `tools/export-figma.mjs`，在 `MANIFEST` 数组里追加一行：

```js
{ id: "234:5478", file: "process-capcut-1.png", label: "CapCut 流程图 1" },
```

`id` 怎么找：在 Figma 里右键节点 → Copy/Paste as → Copy link，链接里 `?node-id=234-5478` 这一段，把 `-` 换成 `:` 就是 `234:5478`。

## 出错排查

- **403** —— Token 没有读这个文件的权限，或 Token 过期了。重新生成。
- **404** —— `FIGMA_FILE_KEY` 错了，或者节点 ID 不在这个文件里。
- **某张返回空 / 不存在** —— 设计稿里那个矩形没设图片填充（比如 Smart Edit 的 Hero 占位就是空的）。属于正常。
- **下载慢** —— 走代理：`HTTPS_PROXY=http://127.0.0.1:7890 node tools/export-figma.mjs`

## 跑完之后

资源已就位，刷新 `http://127.0.0.1:5173/` 就能看到清晰版本，HTML/CSS 不用改一行。
