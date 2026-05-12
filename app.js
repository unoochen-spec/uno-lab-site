// Uno's Portfolio — tab routing + interactivity
(() => {
  const TOPNAV = document.getElementById("topnav");
  const BACK_TO_TOP = document.getElementById("backToTop");
  const WORK_TAB = document.querySelector('.tab[data-tab="work"]');
  const SUBNAV_EL = document.getElementById("subnav");

  /** 向下滚动超过该值后收起 Work 二级导航；悬停 Work 时仍可展开 */
  const SUBNAV_SCROLL_HIDE_Y = 48;
  /** 进入 Work / 鼠标移开后，二级栏自动隐藏的延时（ms） */
  const SUBNAV_AUTO_HIDE_DELAY = 3000;
  /** 鼠标在 Work tab 与 subnav 之间移动时的关闭防抖（ms） */
  const SUBNAV_HOVER_GRACE = 180;
  let subnavHoverCloseTimer = null;
  let subnavAutoHideTimer = null;
  const APP_LAYOUT_BREAKPOINT = 900;

  const TABS = Array.from(document.querySelectorAll(".tab"));
  const SUBTABS = Array.from(document.querySelectorAll(".subtab"));
  const PAGES = Array.from(document.querySelectorAll(".page"));
  const PAGE_HOME = document.getElementById("page-home");
  const HOME_HERO_HEADLINE = document.querySelector(".home-hero__headline");
  /** 由 Home 氛围脚本挂载：路由切换时启停粒子画布 */
  let syncHomeAmbientRoute = () => {};

  /** Home 主标题：两行整块同时播放入场（CSS animation，无拆字） */
  function revealHomeHeroHeadline() {
    if (!HOME_HERO_HEADLINE) return;
    if (parseHash().page !== "home") return;
    window.requestAnimationFrame(() => {
      HOME_HERO_HEADLINE.classList.add("home-hero__headline--split-visible");
    });
  }

  const WORK_PROJECTS = [
    "xiaoying", "jianying", "smart-edit", "capcut", "dianjing", "trovo",
  ];
  const DEFAULT_WORK = "xiaoying";

  /** 视口 ≤900px 一律走 app-layout（与 styles 中 html.app-layout 一致），避免手机 Safari 等细指针设备仍套桌面顶栏/双栏 */
  function shouldUseAppLayout() {
    return window.innerWidth <= APP_LAYOUT_BREAKPOINT;
  }

  function applyAppLayoutClass() {
    const wasApp = document.documentElement.classList.contains("app-layout");
    const on = shouldUseAppLayout();
    document.documentElement.classList.toggle("app-layout", on);
    document.body.classList.toggle("app-layout", on);
    /* 仅在首次进入窄屏 app 布局时展开二级，避免每次 resize 清掉 scroll-hide */
    if (on && !wasApp && TOPNAV.classList.contains("is-work")) {
      TOPNAV.classList.remove("is-subnav-hidden", "is-subnav-hover");
    }
    syncWorkTabAriaExpanded();
    if (TOPNAV.classList.contains("is-work")) {
      requestAnimationFrame(() => updateWorkSubnavScrollState());
    }
  }

  function isAppLayout() {
    return document.documentElement.classList.contains("app-layout");
  }

  /** Subnav 视为展开时同步 Work tab 的 aria-expanded（配合 chevron 状态） */
  function syncWorkTabAriaExpanded() {
    if (!WORK_TAB || !TOPNAV) return;
    const onWork = TOPNAV.classList.contains("is-work");
    const hoverPeek = TOPNAV.classList.contains("is-subnav-hover");
    const expanded =
      hoverPeek ||
      (onWork && !TOPNAV.classList.contains("is-subnav-hidden"));
    WORK_TAB.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  // ---------- Routing ----------
  function parseHash() {
    const raw = (location.hash || "#home").replace(/^#/, "");
    if (raw === "" || raw === "home" || raw === "top") return { tab: "home", page: "home" };
    if (raw === "ability") return { tab: "ability", page: "ability" };
    if (raw === "work") return { tab: "work", page: `work-${DEFAULT_WORK}` };
    if (raw.startsWith("work-")) {
      const proj = raw.slice(5);
      if (WORK_PROJECTS.includes(proj)) return { tab: "work", page: `work-${proj}` };
      return { tab: "work", page: `work-${DEFAULT_WORK}` };
    }
    return { tab: "home", page: "home" };
  }

  function setActiveTab(tab) {
    TABS.forEach((t) => {
      const isActive = t.dataset.tab === tab;
      t.classList.toggle("is-active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    const enteringWork = tab === "work";
    const wasWork = TOPNAV.classList.contains("is-work");
    TOPNAV.classList.toggle("is-work", enteringWork);
    if (enteringWork) {
      clearSubnavAutoHideTimer();
      /* 桌面：进入 Work 后二级默认收起，仅 hover（或点击 Work 暂显）时出现；同 tab 下切换子项目不重置。
         不在此清 is-subnav-hover：否则从其它 tab 点进 Work 时鼠标仍在 Work 上也会被当成未 hover。 */
      if (!wasWork) {
        clearSubnavHoverTimer();
        if (isAppLayout()) {
          TOPNAV.classList.remove("is-subnav-hidden");
        } else {
          TOPNAV.classList.add("is-subnav-hidden");
          /* click 可能先于 mouseenter，路由已切到 Work 后补一层与 :hover 一致的状态 */
          requestAnimationFrame(() => {
            if (!TOPNAV.classList.contains("is-work")) return;
            const overWork =
              WORK_TAB &&
              (WORK_TAB.matches(":hover") ||
                (SUBNAV_EL && SUBNAV_EL.matches(":hover")));
            if (overWork) TOPNAV.classList.add("is-subnav-hover");
          });
        }
      }
    } else if (wasWork) {
      TOPNAV.classList.remove("is-subnav-hidden", "is-subnav-hover");
      clearSubnavAutoHideTimer();
      clearSubnavHoverTimer();
    }
    syncWorkTabAriaExpanded();
    /* 已在 Work 内仅换 hash（如 #work-jianying → #work）：用当前滚动位置同步二级显隐 */
    if (enteringWork && isAppLayout() && wasWork) {
      updateWorkSubnavScrollState();
    }
  }

  function setActiveSubtab(project) {
    SUBTABS.forEach((s) => {
      s.classList.toggle("is-active", s.dataset.subtab === project);
    });
  }

  function setActivePage(pageId) {
    PAGES.forEach((p) => {
      p.classList.toggle("is-active", p.dataset.page === pageId);
    });
    const active = PAGES.find((p) => p.dataset.page === pageId);
    if (active) {
      active.querySelectorAll("img[loading='lazy']").forEach((img) => {
        img.loading = "eager";
      });
    }
  }

  function pauseHeroVideo(hero, { resetTime = false } = {}) {
    if (!hero || hero.classList.contains("hero-video--static")) return;
    const video = hero.querySelector("video.hero-video__media");
    hero.classList.remove("is-playing");
    if (!video) return;
    try {
      video.pause();
      video.controls = false;
      if (resetTime) video.currentTime = 0;
    } catch (_) {}
  }

  function pauseAllHeroVideos(opts) {
    document.querySelectorAll(".hero-video").forEach((h) => pauseHeroVideo(h, opts));
  }

  function applyRoute({ scroll = "top" } = {}) {
    pauseAllHeroVideos({ resetTime: true });
    const { tab, page } = parseHash();
    setActiveTab(tab);
    setActivePage(page);
    if (page.startsWith("work-")) {
      setActiveSubtab(page.slice(5));
    } else {
      setActiveSubtab(null);
    }
    document.title = pageTitle(page);
    if (PAGE_HOME && page !== "home") {
      PAGE_HOME.classList.remove("home-ambient--hover");
    }
    if (HOME_HERO_HEADLINE && page !== "home") {
      HOME_HERO_HEADLINE.classList.remove("home-hero__headline--split-visible");
    }
    syncHomeAmbientRoute(page);
    revealHomeHeroHeadline();
    if (scroll === "top") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
        /* 先滚到顶再同步顶栏/二级：避免仍用旧 scrollY 把移动端二级立刻打成 hidden */
        requestAnimationFrame(() => {
          onScroll();
        });
      });
    } else {
      onScroll();
    }
  }

  function pageTitle(page) {
    const map = {
      "home": "首页 — Uno’s Portfolio",
      "ability": "能力 — Uno’s Portfolio",
      "work-xiaoying": "项目 · 剪小映 — Uno’s Portfolio",
      "work-jianying": "项目 · 剪映 — Uno’s Portfolio",
      "work-smart-edit": "项目 · Smart Edit — Uno’s Portfolio",
      "work-capcut": "项目 · CapCut — Uno’s Portfolio",
      "work-dianjing": "项目 · 企鹅电竞 — Uno’s Portfolio",
      "work-trovo": "项目 · Trovo — Uno’s Portfolio",
    };
    return map[page] || "Uno’s Portfolio";
  }

  // Initial render
  applyAppLayoutClass();
  if (!location.hash) {
    history.replaceState(null, "", "#home");
  }
  applyRoute({ scroll: "top" });

  // hashchange — handles back/forward and clicks on hash links
  window.addEventListener("hashchange", () => applyRoute({ scroll: "top" }));
  window.addEventListener("resize", applyAppLayoutClass);
  window.addEventListener("orientationchange", applyAppLayoutClass);

  // ---------- Work subnav: auto-hide + scroll-hide + hover-reveal ----------
  function clearSubnavAutoHideTimer() {
    if (subnavAutoHideTimer) {
      clearTimeout(subnavAutoHideTimer);
      subnavAutoHideTimer = null;
    }
  }

  function clearSubnavHoverTimer() {
    if (subnavHoverCloseTimer) {
      clearTimeout(subnavHoverCloseTimer);
      subnavHoverCloseTimer = null;
    }
  }

  function scheduleSubnavAutoHide(delay = SUBNAV_AUTO_HIDE_DELAY) {
    clearSubnavAutoHideTimer();
    /* 移动端二级仅由滚动控制显隐，不用 3s 定时收起 */
    if (isAppLayout()) return;
    if (!TOPNAV.classList.contains("is-work")) return;
    subnavAutoHideTimer = window.setTimeout(() => {
      TOPNAV.classList.add("is-subnav-hidden");
      subnavAutoHideTimer = null;
      syncWorkTabAriaExpanded();
    }, delay);
  }

  function openWorkSubnavHover() {
    clearSubnavHoverTimer();
    clearSubnavAutoHideTimer();
    TOPNAV.classList.add("is-subnav-hover");
    syncWorkTabAriaExpanded();
  }

  function scheduleCloseWorkSubnavHover(ev) {
    const next = ev && ev.relatedTarget;
    if (next && WORK_TAB && SUBNAV_EL) {
      if (WORK_TAB.contains(next) || WORK_TAB === next) return;
      if (SUBNAV_EL.contains(next) || SUBNAV_EL === next) return;
    }
    clearSubnavHoverTimer();
    subnavHoverCloseTimer = window.setTimeout(() => {
      TOPNAV.classList.remove("is-subnav-hover");
      subnavHoverCloseTimer = null;
      syncWorkTabAriaExpanded();
      // 鼠标离开后：若仍在 Work 路由，3s 后自动隐藏（除非已被 scroll-hide 隐藏）
      if (TOPNAV.classList.contains("is-work") &&
          !TOPNAV.classList.contains("is-subnav-hidden")) {
        scheduleSubnavAutoHide(SUBNAV_AUTO_HIDE_DELAY);
      }
    }, SUBNAV_HOVER_GRACE);
  }

  if (WORK_TAB && SUBNAV_EL) {
    /* pointer*：兼容触控笔/部分浏览器；mouse*：传统鼠标 */
    WORK_TAB.addEventListener("pointerenter", openWorkSubnavHover);
    WORK_TAB.addEventListener("pointerleave", scheduleCloseWorkSubnavHover);
    WORK_TAB.addEventListener("mouseenter", openWorkSubnavHover);
    WORK_TAB.addEventListener("mouseleave", scheduleCloseWorkSubnavHover);
    SUBNAV_EL.addEventListener("pointerenter", openWorkSubnavHover);
    SUBNAV_EL.addEventListener("pointerleave", scheduleCloseWorkSubnavHover);
    SUBNAV_EL.addEventListener("mouseenter", openWorkSubnavHover);
    SUBNAV_EL.addEventListener("mouseleave", scheduleCloseWorkSubnavHover);
    // 点击「项目」：默认动作会改 hash，click 先于 hashchange，需延后一帧再判 is-work
    function revealWorkSubnavAfterClick() {
      if (!TOPNAV.classList.contains("is-work")) return;
      clearSubnavHoverTimer();
      TOPNAV.classList.remove("is-subnav-hidden");
      TOPNAV.classList.add("is-subnav-hover");
      scheduleSubnavAutoHide(SUBNAV_AUTO_HIDE_DELAY);
      syncWorkTabAriaExpanded();
    }
    WORK_TAB.addEventListener("click", () => {
      revealWorkSubnavAfterClick();
      window.setTimeout(revealWorkSubnavAfterClick, 0);
    });
  }

  function updateWorkSubnavScrollState() {
    if (!TOPNAV.classList.contains("is-work")) return;
    const y = window.scrollY;
    if (isAppLayout()) {
      /* 首屏（顶部附近）展开二级；上滑离开首屏即收起；滚回顶部再展开 */
      if (y <= SUBNAV_SCROLL_HIDE_Y) {
        TOPNAV.classList.remove("is-subnav-hidden");
      } else {
        TOPNAV.classList.add("is-subnav-hidden");
        /* 去掉悬停预览 class，否则 2831 条在 hidden 时仍会把 .subnav 设为 display:block，上滑收起形同失效 */
        TOPNAV.classList.remove("is-subnav-hover");
        clearSubnavAutoHideTimer();
      }
      syncWorkTabAriaExpanded();
      return;
    }
    if (y > SUBNAV_SCROLL_HIDE_Y) {
      TOPNAV.classList.add("is-subnav-hidden");
      clearSubnavAutoHideTimer();
    }
    syncWorkTabAriaExpanded();
  }

  function onScroll() {
    const y = window.scrollY;
    TOPNAV.classList.toggle("is-scrolled", y > 8);
    BACK_TO_TOP.classList.toggle("is-visible", y > 600);
    updateWorkSubnavScrollState();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAllHeroVideos({ resetTime: true });
  });

  // Back-to-top button
  BACK_TO_TOP.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Footer "Back to top ↑" links — smooth-scroll without navigating
  document.querySelectorAll('[data-action="back-to-top"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Top-nav「联系我」— smooth-scroll to Home's #contact section.
  // 若当前不在 Home，先切到 Home 再滚到联系方式区块。
  function scrollToContact() {
    const el = document.getElementById("contact");
    if (!el) return;
    const navH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-h"),
      10
    ) || 88;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - 8;
    window.scrollTo({ top, behavior: "smooth" });
  }

  document.querySelectorAll('[data-action="scroll-to-contact"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const { tab } = parseHash();
      if (tab !== "home") {
        // 切回 Home，等 hashchange + applyRoute(scroll:"top") 完成后再滚动
        const onChange = () => {
          window.removeEventListener("hashchange", onChange);
          requestAnimationFrame(() => requestAnimationFrame(scrollToContact));
        };
        window.addEventListener("hashchange", onChange);
        location.hash = "#home";
      } else {
        scrollToContact();
      }
    });
  });

  // ---------- Hero video play interaction ----------
  // 真正驱动 <video> 播放：点击 play 按钮或卡片空白区 → 调用 video.play() 并打开原生 controls；
  // 视频结束 → 复位回到带封面/播放按钮的状态。仅有 <img> 时退化为视觉切换。
  const heroVideoScrollIo =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) return;
              const hero = entry.target;
              const v = hero.querySelector("video.hero-video__media");
              if (v && !v.paused) pauseHeroVideo(hero, { resetTime: false });
            });
          },
          { root: null, threshold: 0, rootMargin: "0px" }
        )
      : null;

  document.querySelectorAll(".hero-video").forEach((hero) => {
    if (hero.classList.contains("hero-video--static")) return;
    const play = hero.querySelector(".hero-video__play");
    const video = hero.querySelector("video.hero-video__media");
    if (heroVideoScrollIo) heroVideoScrollIo.observe(hero);

    function startPlayback() {
      if (!video) {
        hero.classList.toggle("is-playing");
        return;
      }
      video.controls = true;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // 播放被拒绝（如自动播放策略），仍切到 is-playing 让原生控件显示
          hero.classList.add("is-playing");
        });
      }
    }

    if (play) {
      play.addEventListener("click", (e) => {
        e.stopPropagation();
        startPlayback();
      });
    }

    hero.addEventListener("click", (e) => {
      if (e.target.closest(".hero-video__play")) return;
      // 已在播放：把点击交给原生 controls / video 自身，不再触发外层逻辑
      if (hero.classList.contains("is-playing")) return;
      startPlayback();
    });

    if (video) {
      video.addEventListener("play", () => hero.classList.add("is-playing"));
      video.addEventListener("ended", () => {
        hero.classList.remove("is-playing");
        video.controls = false;
        try { video.currentTime = 0; } catch (_) {}
      });
    }
  });

  // ---------- Cat-card jump (Home → Work sub-page) ----------
  // The native href="#work-xxx" already triggers hashchange,
  // but we add subtle micro-interactions here.
  document.querySelectorAll(".cat-card").forEach((card) => {
    card.addEventListener("mouseenter", () => card.classList.add("is-hover"));
    card.addEventListener("mouseleave", () => card.classList.remove("is-hover"));
  });

  // ---------- Home ambient: 柔光 + Canvas 粒子（底色不变；hover 时粒子变亮并受指针排斥，参考 vibe-lab 交互感） ----------
  (function initHomeAmbient() {
    if (!PAGE_HOME) return;
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mqReduce.matches) return;

    const canvas = PAGE_HOME.querySelector(".home-ambient__particles");
    const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

    let tx = 50;
    let ty = 42;
    let cx = 50;
    let cy = 42;
    let spotlightRaf = null;

    let mouseX = 0;
    let mouseY = 0;

    function tickSpotlight() {
      spotlightRaf = null;
      if (!PAGE_HOME.classList.contains("is-active")) return;
      if (!PAGE_HOME.classList.contains("home-ambient--hover")) return;

      const k = 0.13;
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      PAGE_HOME.style.setProperty("--spot-x", `${cx}%`);
      PAGE_HOME.style.setProperty("--spot-y", `${cy}%`);

      if (Math.abs(tx - cx) > 0.12 || Math.abs(ty - cy) > 0.12) {
        spotlightRaf = window.requestAnimationFrame(tickSpotlight);
      }
    }

    function queueSpotlight() {
      if (!spotlightRaf) spotlightRaf = window.requestAnimationFrame(tickSpotlight);
    }

    // ---- DotGrid（柔和静态版：圆点更小、无位移/无回弹，仅指针邻近做颜色与透明度的平滑过渡） ----
    const DOT_SIZE = 1.6;
    const GAP = 30;
    const PROXIMITY = 160;
    const BASE_RGB = [214, 210, 200];
    const ACTIVE_RGB = [180, 174, 160];
    const BASE_ALPHA = 0.3;
    const HOVER_ALPHA_GAIN = 0.26;

    let dpr = 1;
    let pw = 0;
    let ph = 0;
    let dots = [];
    let particleRaf = 0;

    function resizeParticles() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      pw = window.innerWidth;
      ph = window.innerHeight;
      canvas.width = Math.floor(pw * dpr);
      canvas.height = Math.floor(ph * dpr);
      canvas.style.width = `${pw}px`;
      canvas.style.height = `${ph}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedParticles() {
      dots = [];
      const cols = Math.ceil(pw / GAP) + 1;
      const rows = Math.ceil(ph / GAP) + 1;
      const offX = (pw - (cols - 1) * GAP) / 2;
      const offY = (ph - (rows - 1) * GAP) / 2;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          dots.push({
            cx: offX + i * GAP,
            cy: offY + j * GAP,
            ox: 0, oy: 0,
          });
        }
      }
    }

    function stopParticles() {
      if (particleRaf) {
        window.cancelAnimationFrame(particleRaf);
        particleRaf = 0;
      }
      if (ctx && canvas && pw > 0) {
        ctx.clearRect(0, 0, pw, ph);
      }
    }

    // hover 时：邻近点被指针"挤"开（位移），同时叠加柔和呼吸；hover 不再放大点
    const BREATH_PERIOD = 3200;          // ms
    const BREATH_RIPPLE_SPEED = 0.0042;
    const BREATH_ALPHA_AMP = 0.09;
    const PUSH_MAX = 14;                 // 邻近点最大被挤开距离 (px)
    const PUSH_LERP = 0.18;              // 平滑系数（不弹回，仅缓动到位）

    function frameParticles(now) {
      if (!PAGE_HOME.classList.contains("is-active") || document.hidden) {
        particleRaf = 0;
        return;
      }

      const hover = PAGE_HOME.classList.contains("home-ambient--hover");

      ctx.clearRect(0, 0, pw, ph);

      const PROX2 = PROXIMITY * PROXIMITY;
      const tau = Math.PI * 2;
      const baseBreath = (Math.sin(now * (tau / BREATH_PERIOD)) + 1) * 0.5;

      for (const d of dots) {
        let tx = 0;
        let ty = 0;

        let r = BASE_RGB[0];
        let g = BASE_RGB[1];
        let b = BASE_RGB[2];
        let alpha = BASE_ALPHA;
        let radius = DOT_SIZE;

        if (hover) {
          const dx = d.cx - mouseX;
          const dy = d.cy - mouseY;
          const d2 = dx * dx + dy * dy;
          if (d2 < PROX2 && d2 > 0.01) {
            const dist = Math.sqrt(d2);
            const k = 1 - dist / PROXIMITY;
            const w = k * k * (3 - 2 * k);

            // 挤开效果：沿"远离指针"方向位移
            const push = w * PUSH_MAX;
            tx = (dx / dist) * push;
            ty = (dy / dist) * push;

            r = Math.round(BASE_RGB[0] + (ACTIVE_RGB[0] - BASE_RGB[0]) * w);
            g = Math.round(BASE_RGB[1] + (ACTIVE_RGB[1] - BASE_RGB[1]) * w);
            b = Math.round(BASE_RGB[2] + (ACTIVE_RGB[2] - BASE_RGB[2]) * w);
            alpha = Math.min(0.68, BASE_ALPHA + w * HOVER_ALPHA_GAIN);

            // 呼吸：仅在 alpha 上做轻微涨落，不再额外放大点
            const ripple = (Math.sin(now * (tau / BREATH_PERIOD) - dist * BREATH_RIPPLE_SPEED) + 1) * 0.5;
            const breath = (baseBreath * 0.4 + ripple * 0.6) * w;
            alpha = Math.min(0.74, alpha + breath * BREATH_ALPHA_AMP);
          }
        }

        // 平滑缓动到目标位移（指针离开后自然回到原位，不弹跳）
        d.ox += (tx - d.ox) * PUSH_LERP;
        d.oy += (ty - d.oy) * PUSH_LERP;

        ctx.beginPath();
        ctx.arc(d.cx + d.ox, d.cy + d.oy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }

      particleRaf = window.requestAnimationFrame(frameParticles);
    }

    function startParticles() {
      if (!ctx || !canvas) return;
      resizeParticles();
      seedParticles();
      stopParticles();
      particleRaf = window.requestAnimationFrame(frameParticles);
    }

    syncHomeAmbientRoute = (page) => {
      if (!ctx || !canvas) return;
      if (page !== "home") {
        stopParticles();
        return;
      }
      startParticles();
    };

    PAGE_HOME.addEventListener(
      "pointermove",
      (e) => {
        if (!PAGE_HOME.classList.contains("is-active")) return;
        mouseX = e.clientX;
        mouseY = e.clientY;
        tx = (e.clientX / window.innerWidth) * 100;
        ty = (e.clientY / window.innerHeight) * 100;
        PAGE_HOME.classList.add("home-ambient--hover");
        queueSpotlight();
      },
      { passive: true }
    );

    PAGE_HOME.addEventListener("pointerleave", () => {
      PAGE_HOME.classList.remove("home-ambient--hover");
    });

    mqReduce.addEventListener("change", () => {
      if (mqReduce.matches) PAGE_HOME.classList.remove("home-ambient--hover");
    });

    window.addEventListener(
      "resize",
      () => {
        if (!PAGE_HOME.classList.contains("is-active")) return;
        const { page } = parseHash();
        if (page === "home") {
          resizeParticles();
          seedParticles();
        }
      },
      { passive: true }
    );

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && parseHash().page === "home") {
        startParticles();
      }
    });

    syncHomeAmbientRoute(parseHash().page);
  })();

  // ---------- Process / ability media — entrance reveal on scroll ----------
  // Use a body class so CSS rules only apply when JS is present (no FOUC fallback).
  document.body.classList.add("js-reveal");
  /* Section-level blur reveal（对齐 React Bits · ScrollReveal 观感；本站无 React / shadcn 栈） */
  const SCROLL_REVEAL_SELECTOR = [
    ".cat-entries",
    ".about",
    ".contact",
    ".process",
    ".quote-block",
    ".next-link",
    ".ability-3up",
    ".ability-multi",
    ".overview",
    ".work-hero",
    ".footer",
    ".footer-mini",
  ].join(", ");

  document.querySelectorAll(SCROLL_REVEAL_SELECTOR).forEach((el) => {
    el.classList.add("scroll-reveal");
  });

  const mqScrollRevealReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollRevealEls = Array.from(document.querySelectorAll(".scroll-reveal"));
  if ("IntersectionObserver" in window && !mqScrollRevealReduce.matches) {
    const scrollIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-reveal--visible");
            scrollIo.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );
    scrollRevealEls.forEach((el) => scrollIo.observe(el));
  } else {
    scrollRevealEls.forEach((el) => el.classList.add("scroll-reveal--visible"));
  }

  /* 图块轻量入场（section 级 ScrollReveal 与下列节点叠加：仅保留无外层包裹的媒体） */
  const REVEAL_SELECTOR = ".process__media, .ability-multi__media-item";
  const revealEls = Array.from(document.querySelectorAll(REVEAL_SELECTOR));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-revealed"));
  }

  // ---------- Keyboard navigation (Work pages) ----------
  document.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const { tab, page } = parseHash();
    if (tab !== "work") return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    e.preventDefault();
    const proj = page.startsWith("work-") ? page.slice(5) : DEFAULT_WORK;
    const idx = WORK_PROJECTS.indexOf(proj);
    if (idx < 0) return;

    const nextIdx = e.key === "ArrowRight"
      ? (idx + 1) % WORK_PROJECTS.length
      : (idx - 1 + WORK_PROJECTS.length) % WORK_PROJECTS.length;
    location.hash = `#work-${WORK_PROJECTS[nextIdx]}`;
  });
})();
