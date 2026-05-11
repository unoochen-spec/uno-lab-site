#!/usr/bin/env node
// =============================================================================
// Uno's Portfolio — Figma full-resolution exporter
//
// 用 Figma 官方 REST API 拉取每个页面 / hero / 头像 / 卡片图的满分辨率原图，
// 写到 ../assets/ 里，覆盖低分辨率的截图占位。
//
// 用法：
//   1. 浏览器打开 https://www.figma.com/settings → Personal access tokens
//      → Generate new token，把生成的 figd_xxxxxx 复制下来。
//   2. 在终端里跑：
//        cd uno-lab-site
//        FIGMA_TOKEN=figd_xxxxxx node tools/export-figma.mjs
//      （可选）调整缩放：SCALE=2 …… 默认 SCALE=3（@3x 切图）。
//      （可选）干跑模式：DRY=1 ...   只打印不下载。
//      （可选）只导某些 ID：ONLY=page-home,hero-jianying ... 用文件名前缀过滤。
//
// 依赖：Node ≥ 18（自带 fetch + AbortController）。无第三方包。
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const BACKUP_DIR = path.join(ROOT, "assets", ".backup");

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY || "G3hpMffTwNfHLGYbQo5BhQ";
const SCALE = Number(process.env.SCALE || 3);
const FORMAT = (process.env.FORMAT || "png").toLowerCase();
const DRY = process.env.DRY === "1" || process.env.DRY === "true";
const ONLY = (process.env.ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
/** 逗号分隔：不上传、不覆盖（本地已替换的资源） */
const SKIP_ASSETS = new Set(
  (process.env.SKIP_ASSETS || "contact-qr.png,brand-uno-logo.png")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// ---------------------------------------------------------------------------
// MANIFEST — 想加新切图就往这里追加 { id, file, label }
// id 来自 Figma 链接 node-id，冒号形式（234:1234）
// ---------------------------------------------------------------------------
const MANIFEST = [
  // 8 个顶级页面（Frame）
  { id: "234:2631", file: "page-home.png", label: "Home 整页" },
  { id: "234:3725", file: "page-ability.png", label: "Ability 整页" },
  { id: "234:2829", file: "page-xiaoying.png", label: "Work · 剪小映 整页" },
  { id: "234:3072", file: "page-jianying.png", label: "Work · 剪映 整页" },
  { id: "234:3323", file: "page-smart-edit.png", label: "Work · Smart Edit 整页" },
  { id: "234:5355", file: "page-capcut.png", label: "Work · CapCut 整页" },
  { id: "234:3524", file: "page-dianjing.png", label: "Work · 企鹅电竞 整页" },
  { id: "234:4915", file: "page-trovo.png", label: "Work · Trovo 整页" },

  // Hero 海报（视频第一帧 / 静态预览；1280×720 设计尺寸）
  { id: "234:2916", file: "hero-xiaoying.png", label: "剪小映 Hero" },
  { id: "234:3161", file: "hero-jianying.png", label: "剪映 Hero" },
  { id: "234:3412", file: "hero-smart-edit.png", label: "Smart Edit Hero" },
  { id: "245:6033", file: "hero-dianjing.png", label: "企鹅电竞 Hero" },
  { id: "245:6040", file: "hero-trovo.png", label: "Trovo Hero" },

  // Home
  { id: "234:2738", file: "portrait.png", label: "Home About 头像" },
  // Home · "近期项目" 标题旁的 12×12 跳转箭头
  { id: "234:2679", file: "home-cat-arrow.png", label: "首页类目 跳转箭头" },
  // Home · 近期项目卡片右上角 24×24 品牌标（Grid 6）
  { id: "234:2685", file: "home-cat-01.png", label: "首页类目 剪小映角标" },
  { id: "234:2692", file: "home-cat-02.png", label: "首页类目 剪映角标" },
  { id: "234:2699", file: "home-cat-03.png", label: "首页类目 CapCut 角标" },
  { id: "234:2706", file: "home-cat-04.png", label: "首页类目 Smart Edit 角标" },
  { id: "246:57845", file: "home-cat-05.png", label: "首页类目 企鹅电竞角标" },
  { id: "246:57847", file: "home-cat-06.png", label: "首页类目 Trovo 角标" },

  // Ability（Cover 内图片层 + 底部双图）
  { id: "379:60768", file: "ability-cover-1.png", label: "Ability 卡片 1 底图" },
  { id: "379:60766", file: "ability-cover-2.png", label: "Ability 卡片 2 底图" },
  { id: "379:60764", file: "ability-cover-3.png", label: "Ability 卡片 3 底图" },
  { id: "234:3774", file: "ab-mid-1.png", label: "Ability 中部左" },
  { id: "379:60909", file: "ab-mid-2.png", label: "Ability 中部右" },

  // Logos（导出组合 Frame）
  { id: "324:60053", file: "logo-xiaoying.png", label: "剪小映 Logo" },
  { id: "234:3156", file: "logo-jianying.png", label: "剪映 Logo" },
  { id: "234:3409", file: "logo-smart-edit.png", label: "Smart Edit Logo" },
  { id: "234:5439", file: "logo-capcut.png", label: "CapCut Logo" },

  // Work · 剪小映 — Process / Gallery
  { id: "234:2959", file: "xy-s1-1.png", label: "剪小映 阶段一 图1" },
  { id: "234:2968", file: "xy-s1-2.png", label: "剪小映 阶段一 图2" },
  { id: "234:2975", file: "xy-s1-3.png", label: "剪小映 阶段一 图3" },
  { id: "234:2977", file: "xy-s1-4.png", label: "剪小映 阶段一 图4" },
  { id: "234:3009", file: "xy-s2-1.png", label: "剪小映 阶段二 图1" },
  { id: "234:3018", file: "xy-s2-2.png", label: "剪小映 阶段二 图2" },
  { id: "234:3025", file: "xy-s2-3.png", label: "剪小映 阶段二 图3" },
  { id: "234:3027", file: "xy-s2-4.png", label: "剪小映 阶段二 图4" },
  { id: "234:3050", file: "xy-s3-1.png", label: "剪小映 阶段三 图1" },
  { id: "234:3059", file: "xy-s3-2.png", label: "剪小映 阶段三 图2" },

  // Work · 剪映
  { id: "234:4312", file: "jy-s1-1.png", label: "剪映 Block1 左（上层图）" },
  { id: "234:3217", file: "jy-s1-2.png", label: "剪映 Block1 右" },
  { id: "234:4322", file: "jy-s1-3.png", label: "剪映 Block2 左" },
  { id: "234:4331", file: "jy-s1-4.png", label: "剪映 Block2 右" },
  { id: "234:3260", file: "jy-s2-1.png", label: "剪映专业版 Agent · 布局规则 配图" },
  { id: "234:3269", file: "jy-s2-2.png", label: "剪映专业版 Agent · 场景梳理 配图" },
  { id: "234:3287", file: "jy-s3-1.png", label: "剪映 Web 左" },
  { id: "234:3296", file: "jy-s3-2.png", label: "剪映 Web 右" },

  // Work · Smart Edit
  { id: "234:3459", file: "se-s1-1.png", label: "SE GUI/CUI 左" },
  { id: "234:3468", file: "se-s1-2.png", label: "SE GUI/CUI 右" },
  { id: "234:3486", file: "se-s2-1.png", label: "SE 视觉基因 左" },
  { id: "234:3495", file: "se-s2-2.png", label: "SE 动效 右" },
  { id: "234:3502", file: "se-s3.png", label: "SE 双端延展（整宽）" },

  // Work · CapCut
  { id: "234:5485", file: "cc-s1-1.png", label: "CapCut 左" },
  { id: "246:57837", file: "cc-s1-2.png", label: "CapCut 右" },
  { id: "234:5505", file: "cc-s2.png", label: "CapCut 全宽" },
];

// ---------------------------------------------------------------------------
function fmt(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function color(s, c) {
  const map = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, gray: 90 };
  return process.stdout.isTTY ? `\x1b[${map[c] || 0}m${s}\x1b[0m` : s;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function backupExisting(file) {
  try {
    const src = path.join(ASSETS_DIR, file);
    await fs.access(src);
    await ensureDir(BACKUP_DIR);
    const dst = path.join(BACKUP_DIR, file);
    await fs.copyFile(src, dst);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Figma GET images：分批 + 间隔，避免 @3x 大批量渲染 timeout */
async function fetchAllRenderUrls(items, token) {
  const BATCH = Number(process.env.FETCH_BATCH || 12);
  const pauseMs = Number(process.env.FETCH_PAUSE_MS || 800);
  const merged = {};
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const idList = chunk.map((m) => m.id).join(",");
    const apiUrl = new URL(`https://api.figma.com/v1/images/${FILE_KEY}`);
    apiUrl.searchParams.set("ids", idList);
    apiUrl.searchParams.set("format", FORMAT);
    apiUrl.searchParams.set("scale", String(SCALE));

    const apiRes = await fetch(apiUrl, {
      headers: { "X-Figma-Token": token },
    });

    if (!apiRes.ok) {
      const body = await apiRes.text();
      throw new Error(`Figma API ${apiRes.status}: ${body.slice(0, 240)}`);
    }

    const apiData = await apiRes.json();
    if (apiData.err) throw new Error(apiData.err);
    Object.assign(merged, apiData.images || {});
    if (i + BATCH < items.length && pauseMs > 0) await sleep(pauseMs);
  }
  return merged;
}

async function main() {
  console.log(color("\n  Uno's Portfolio — Figma export\n", "cyan"));

  if (!FIGMA_TOKEN) {
    console.error(color("  ✗  缺少 FIGMA_TOKEN 环境变量。", "red"));
    console.error(color("     去 https://www.figma.com/settings 生成一个 Personal Access Token，然后：", "gray"));
    console.error(color("     FIGMA_TOKEN=figd_xxx node tools/export-figma.mjs\n", "gray"));
    process.exit(1);
  }

  // 用文件名前缀过滤
  let queue = MANIFEST.filter((m) => !SKIP_ASSETS.has(m.file));
  if (ONLY.length) {
    queue = queue.filter((m) =>
      ONLY.some((prefix) => m.file === prefix || m.file.startsWith(prefix))
    );
    if (!queue.length) {
      console.error(color(`  ✗  ONLY=${ONLY.join(",")} 没匹配到任何切图。`, "red"));
      process.exit(1);
    }
  }

  const skipped = MANIFEST.filter((m) => SKIP_ASSETS.has(m.file));
  console.log(`  文件: ${color(FILE_KEY, "blue")}`);
  console.log(`  缩放: ${color("@" + SCALE + "x", "blue")}    格式: ${color(FORMAT.toUpperCase(), "blue")}`);
  console.log(`  目标: ${color(path.relative(process.cwd(), ASSETS_DIR), "blue")}/`);
  console.log(`  数量: ${color(queue.length + " 张", "blue")}`);
  if (skipped.length) {
    console.log(color(`  跳过（SKIP_ASSETS）: ${skipped.map((s) => s.file).join(", ")}`, "yellow"));
  }
  if (DRY) console.log(color("  模式: DRY RUN（只打印，不下载）", "yellow"));
  console.log();

  console.log(color("  → 请求 Figma 渲染队列（分批）…", "gray"));
  let images;
  try {
    images = await fetchAllRenderUrls(queue, FIGMA_TOKEN);
  } catch (e) {
    console.error(color(`  ✗  ${e.message || e}`, "red"));
    process.exit(1);
  }

  console.log(color(`  ✓ Figma 渲染就绪 (${Object.keys(images).filter((k) => images[k]).length} 张)\n`, "green"));

  if (DRY) {
    queue.forEach((m) => {
      const url = images[m.id];
      console.log(`  ${url ? color("●", "green") : color("✗", "red")} ${m.file.padEnd(28)} ${color(m.label, "gray")}`);
      if (url) console.log(`     ${color(url, "gray")}`);
    });
    console.log(color("\n  DRY RUN 完成，未写入任何文件。", "yellow"));
    return;
  }

  await ensureDir(ASSETS_DIR);

  let totalBytes = 0;
  let okCount = 0;
  let failCount = 0;
  const failures = [];

  // 并发下载（限制 6 个并发，避免被限流）
  const concurrency = 6;
  const tasks = [...queue];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (tasks.length) {
        const item = tasks.shift();
        const url = images[item.id];
        if (!url) {
          console.log(`  ${color("✗", "red")} ${item.file.padEnd(28)} ${color("Figma 未返回 URL（节点可能为空 / 不存在）", "red")}`);
          failures.push({ file: item.file, reason: "no URL from Figma" });
          failCount += 1;
          continue;
        }
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          await backupExisting(item.file);
          await fs.writeFile(path.join(ASSETS_DIR, item.file), buf);
          totalBytes += buf.length;
          okCount += 1;
          console.log(
            `  ${color("✓", "green")} ${item.file.padEnd(28)} ${color(fmt(buf.length).padStart(9), "blue")}    ${color(item.label, "gray")}`
          );
        } catch (e) {
          console.log(`  ${color("✗", "red")} ${item.file.padEnd(28)} ${color(e.message, "red")}`);
          failures.push({ file: item.file, reason: e.message });
          failCount += 1;
        }
      }
    })
  );

  console.log();
  console.log(color(`  ✓ ${okCount} 张已替换`, "green") + `   总计 ${color(fmt(totalBytes), "blue")}`);
  if (failCount) {
    console.log(color(`  ✗ ${failCount} 张失败`, "red"));
    failures.forEach((f) => console.log(`     • ${f.file} — ${f.reason}`));
  }
  console.log(color(`  ↳ 旧文件备份在 ${path.relative(process.cwd(), BACKUP_DIR)}/\n`, "gray"));
}

main().catch((e) => {
  console.error(color("\n  ✗ 异常退出: ", "red") + (e && e.message ? e.message : e));
  if (e && e.stack) console.error(color(e.stack, "gray"));
  process.exit(1);
});
