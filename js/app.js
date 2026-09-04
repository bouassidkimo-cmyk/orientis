/* =============================================================
   ORIENTIS — moteur d'expérience
   Cinématique pilotée au geste : un petit défilement déclenche
   un chapitre, le site joue l'animation puis s'arrête.
   ============================================================= */
(() => {
  "use strict";

  const PREFERS_REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const IS_TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  const FRAME_COUNT = 172;
  const FRAME_PATH  = (i) => `assets/frames/frame_${String(i).padStart(3, "0")}.webp`;
  const MAX_UPSCALE = 1.34;

  /* ---- 3 gestes découpent la décomposition de la vidéo en 3 arrêts ----
     état 0 = montre complète, puis geste 1 → 2 → 3.
     Aucune caméra, aucun effet : on lit simplement la vidéo. */
  const STATE_FRAME = [0, 48, 78, 171];
  const STATE_DUR   = [0, 1.5, 1.5, 2.3]; // durée du segment pour rejoindre l'état i
  const LAST_STATE = STATE_FRAME.length - 1; // 3

  /* ---- Repli mouvement réduit : défilement classique, non bloquant ---- */
  const FRAME_MAP = [
    [0.00, 0], [0.16, 20], [0.40, 70], [0.60, 105], [0.80, 150], [1.00, 171],
  ];

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp  = (a, b, t) => a + (b - a) * t;

  function mapFrame(p) {
    p = clamp(p, 0, 1);
    for (let i = 0; i < FRAME_MAP.length - 1; i++) {
      const [p0, f0] = FRAME_MAP[i], [p1, f1] = FRAME_MAP[i + 1];
      if (p <= p1) return Math.round(lerp(f0, f1, clamp((p - p0) / (p1 - p0 || 1), 0, 1)));
    }
    return FRAME_COUNT - 1;
  }

  /* ---------- CHARGEMENT DES IMAGES ---------- */
  const frames = new Array(FRAME_COUNT);
  let loadedCount = 0;

  const loadFrame = (i) => new Promise((res) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { frames[i] = img.naturalWidth ? img : null; loadedCount++; res(); };
    img.src = FRAME_PATH(i);
  });

  async function preloadFrames(onProgress) {
    const first = [];
    for (let i = 0; i < Math.min(12, FRAME_COUNT); i++) first.push(loadFrame(i));
    await Promise.all(first);
    onProgress(loadedCount / FRAME_COUNT);
    draw();
    const rest = [];
    for (let i = 12; i < FRAME_COUNT; i++) rest.push(loadFrame(i).then(() => onProgress(loadedCount / FRAME_COUNT)));
    await Promise.all(rest);
  }

  /* ---------- RENDU CANVAS — image statique, centrée, sans effet ---------- */
  const canvas = $("#frameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  let cssW = 0, cssH = 0, dpr = 1;
  let bgColor = "#070708";
  let lastDrawn = -1;

  /* état de rendu — uniquement l'index d'image, aucune caméra */
  const anim = { f: STATE_FRAME[0] };

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = canvas.clientWidth; cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    draw(true);
  }

  function sampleBg(img) {
    try {
      const s = document.createElement("canvas"); s.width = s.height = 8;
      const sx = s.getContext("2d"); sx.drawImage(img, 0, 0, 8, 8);
      const d = sx.getImageData(0, 0, 8, 2).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
      bgColor = `rgb(${(r/n)|0}, ${(g/n)|0}, ${(b/n)|0})`;
    } catch (e) { /* garde la valeur précédente */ }
  }

  function draw(force) {
    let index = clamp(Math.round(anim.f), 0, FRAME_COUNT - 1);
    let img = frames[index];
    if (!img) {
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (frames[index - d]) { img = frames[index - d]; break; }
        if (frames[index + d]) { img = frames[index + d]; break; }
      }
      if (!img) return;
    }
    if (!force && index === lastDrawn) return;
    lastDrawn = index;
    window.__frameDbg = index;
    if (index % 18 === 0) sampleBg(img);

    const iw = img.naturalWidth, ih = img.naturalHeight;
    const wide = cssW / cssH >= 1.15;
    const scale = wide
      ? Math.min(Math.min(cssW / iw, cssH / ih), MAX_UPSCALE)
      : Math.max(cssW / iw, cssH / ih) * 0.98;
    const dw = iw * scale, dh = ih * scale;
    const dx = (cssW - dw) / 2;
    const dy = (cssH - dh) / 2;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.drawImage(img, dx, dy, dw, dh);
    if (dy > 1) {
      const g = ctx.createLinearGradient(0, 0, 0, dh + dy);
      g.addColorStop(0, bgColor);
      g.addColorStop(Math.max(0.001, (dy + 40) / cssH), "rgba(0,0,0,0)");
      g.addColorStop(Math.min(0.999, 1 - (dy + 40) / cssH), "rgba(0,0,0,0)");
      g.addColorStop(1, bgColor);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    }
  }

  /* ---------- DÉMARRAGE ---------- */
  const loader = $("#loader");
  const bar = $("#loader-bar");
  const pct = $("#loader-percent");

  document.body.classList.add("is-loading");
  $("#year").textContent = new Date().getFullYear();
  resizeCanvas();

  const CAN_ANIMATE = !PREFERS_REDUCED && typeof gsap !== "undefined";
  if (CAN_ANIMATE) {
    document.documentElement.classList.add("js-anim");
    gsap.set(".hero-title .word span", { yPercent: 115 });
    gsap.set([".hero-tagline", ".hero-scroll"], { opacity: 0 });
  }

  preloadFrames((p) => {
    const v = Math.round(p * 100);
    bar.style.width = v + "%";
    pct.textContent = String(v).padStart(2, "0");
  }).then(revealSite);

  function revealSite() {
    bar.style.width = "100%"; pct.textContent = "100";
    setTimeout(() => {
      loader.classList.add("done");
      document.body.classList.remove("is-loading");
      PREFERS_REDUCED ? initScrubFallback() : initCinema();
      playHeroIntro();
    }, 460);
  }

  function playHeroIntro() {
    if (!CAN_ANIMATE) return;
    const letters = $$(".hero-title .word span");
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(letters, { yPercent: 115 }, { yPercent: 0, duration: 1.4, stagger: 0.06 }, 0.15)
      .to(".hero-tagline", { opacity: 1, duration: 1.2 }, 0.9)
      .to(".hero-scroll", { opacity: 1, duration: 1.4 }, 1.2);
  }

  /* =============================================================
     CINÉMATIQUE PILOTÉE AU GESTE
     ============================================================= */
  function initCinema() {
    window.addEventListener("resize", () => { resizeCanvas(); }, { passive: true });

    const stage = $("#stage");
    const hero = $("#hero");
    const cine = $("#cine");
    const header = $("#header");
    const after = $(".after-story");
    const chapters = $$("#cine .chapter");
    const progressBars = $$("#cineProgress i");
    const hint = $("#cineHint");

    /* ---- Lenis (défilement fluide hors cinématique) ---- */
    let lenis = null;
    if (typeof Lenis !== "undefined") {
      lenis = new Lenis({
        duration: 1.05,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      window.__lenis = lenis;
      if (typeof ScrollTrigger !== "undefined") lenis.on("scroll", ScrollTrigger.update);
    }
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") gsap.registerPlugin(ScrollTrigger);

    const vh = () => window.innerHeight;
    const cineTop = () => cine.offsetTop;
    const cineBot = () => cine.offsetTop + cine.offsetHeight;

    /* ---- état d'interaction ---- */
    let phase = "hero";      // 'hero' | 'cine' | 'released'
    let state = 0;           // 0..4
    let animating = false;   // un tween est en cours
    let busy = false;        // geste consommé — en attente que l'entrée se calme
    let lastInputT = 0;      // horodatage du dernier événement de défilement
    let hintDone = false;
    let tl = null;
    let guardUntil = 0;   // fenêtre où l'on ignore les (ré)entrées automatiques
    let entryUntil = 0;   // à l'entrée : on ignore l'élan de défilement du hero

    /* Ré-armement : on accepte un nouveau geste seulement quand plus rien ne bouge
       (aucun tween) ET que l'utilisateur a relâché (aucun input depuis 170 ms).
       Cela transforme une rafale de molette/trackpad en un seul geste. */
    setInterval(() => {
      if (busy && !animating && performance.now() - lastInputT > 170) busy = false;
    }, 55);

    /* ---- prépare les animations d'entrée de texte ---- */
    const chapterKids = chapters.map((el) =>
      $$(".chapter-label, .chapter-heading, .chapter-body", el));
    const kidFrom = (el) => ({
      "fade-up":     { y: 40, opacity: 0 },
      "slide-right": { x: 60, opacity: 0 },
      "slide-left":  { x: -60, opacity: 0 },
    }[el.dataset.animation] || { y: 32, opacity: 0 });

    function showChapter(idx, dir, instant) {
      chapters.forEach((el, i) => {
        if (i === idx) {
          if (instant || typeof gsap === "undefined") {
            el.style.opacity = 1;
            gsap && gsap.set(chapterKids[i], { clearProps: "all", opacity: 1 });
          } else {
            gsap.killTweensOf([el, ...chapterKids[i]]);
            gsap.set(el, { opacity: 1 });
            gsap.fromTo(chapterKids[i], { ...kidFrom(el) },
              { x: 0, y: 0, opacity: 1, duration: 1.0, stagger: 0.08,
                ease: "expo.out", delay: 0.12, overwrite: true });
          }
        } else {
          if (instant || typeof gsap === "undefined") el.style.opacity = 0;
          else { gsap.killTweensOf(el); gsap.to(el, { opacity: 0, duration: 0.35, overwrite: true }); }
        }
      });
    }

    function updateProgress() {
      progressBars.forEach((b, i) => b.classList.toggle("on", state > i));
    }
    function hideHint() {
      if (hintDone) return;
      hintDone = true;
      hint.classList.remove("show");
    }

    /* ---- rendu continu pendant les tweens ---- */
    let ticking = false;
    function tick() { draw(); ticking = animating; if (ticking) requestAnimationFrame(tick); }

    /* ---- transition vers un état : on lit simplement le segment de vidéo ---- */
    function goToState(target, dir) {
      target = clamp(target, 0, LAST_STATE);
      if (target === state) return;
      const next = state + Math.sign(target - state);
      animating = true;
      if (!ticking) { ticking = true; requestAnimationFrame(tick); }

      const dur = STATE_DUR[Math.max(next, state)] * (dir < 0 ? 0.82 : 1);
      showChapter(next, dir);
      window.__cine = { phase, state: next, animating: true };

      if (tl) tl.kill();
      tl = gsap.timeline({
        onComplete: () => { animating = false; window.__cine = { phase, state, animating: false }; },
      });
      tl.to(anim, { f: STATE_FRAME[next], duration: dur, ease: "power2.inOut" });
      state = next;
      updateProgress();
    }

    /* ---- un geste = avancer / reculer d'un cran ---- */
    function gesture(dir) {
      if (phase !== "cine" || animating) return;
      hideHint();
      if (dir > 0 && state === LAST_STATE) { releaseCine("down"); return; }
      if (dir < 0 && state === 0) { releaseCine("up"); return; }
      goToState(state + dir, dir);
    }

    /* ---- entrée dans la cinématique ---- */
    function enterCine(fromDir) {
      if (phase === "cine") return;
      phase = "cine";
      document.body.classList.add("cine-locked");
      hero.style.opacity = "0";
      stage.style.opacity = "1";

      state = 0;
      anim.f = STATE_FRAME[state];
      draw(true);
      showChapter(state, 1, false);
      updateProgress();
      busy = false; animating = false;
      entryUntil = performance.now() + 850;   // couvre le glissé d'entrée + l'élan
      window.__cine = { phase, state, animating: false };

      // glisse doucement jusqu'au point d'ancrage, puis fige
      if (lenis) {
        lenis.scrollTo(cineTop(), {
          duration: 0.6, lock: true, force: true,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          onComplete: () => { lenis.stop(); window.scrollTo(0, cineTop()); },
        });
      } else {
        window.scrollTo(0, cineTop());
      }

      if (!hintDone) {
        hint.classList.add("show");
        setTimeout(hideHint, 6500);
      }
    }

    /* ---- sortie de la cinématique ---- */
    function releaseCine(dir) {
      document.body.classList.remove("cine-locked");
      if (tl) { tl.kill(); tl = null; }
      animating = false;
      busy = false;
      guardUntil = performance.now() + 650;
      if (lenis) lenis.start();

      if (dir === "down") {
        phase = "released";
        window.__cine = { phase, state, animating: false };
        chapters.forEach((el) => (el.style.opacity = 0));
        const target = after.offsetTop;
        if (lenis) lenis.scrollTo(target, { duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 3) });
        else window.scrollTo(0, target);
      } else {
        phase = "hero";
        showChapter(0, -1, true);
        if (lenis) lenis.scrollTo(0, { duration: 0.9 });
        else window.scrollTo(0, 0);
      }
    }

    /* ---- écouteurs de geste ---- */
    function onWheel(e) {
      if (phase !== "cine") return;
      e.preventDefault();
      if (performance.now() < entryUntil) return;   // on laisse passer l'élan d'entrée
      lastInputT = performance.now();
      if (busy || animating) return;
      if (Math.abs(e.deltaY) < 2) return;
      busy = true;
      gesture(Math.sign(e.deltaY));
    }
    let touchY = 0, touchLive = false;
    function onTouchStart(e) {
      if (phase !== "cine" || !e.touches || !e.touches[0]) return;
      touchY = e.touches[0].clientY; touchLive = true; lastInputT = performance.now();
    }
    function onTouchMove(e) {
      if (phase !== "cine") return;
      e.preventDefault();
      if (performance.now() < entryUntil) return;
      lastInputT = performance.now();
      if (!touchLive || busy || animating || !e.touches || !e.touches[0]) return;
      const dy = touchY - e.touches[0].clientY;
      if (Math.abs(dy) > 20) {
        touchLive = false;
        busy = true;
        gesture(Math.sign(dy));
      }
    }
    function onTouchEnd() { touchLive = false; lastInputT = performance.now(); }
    function onKey(e) {
      if (phase !== "cine" || busy || animating) return;
      let dir = 0;
      if (["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key)) dir = 1;
      else if (["ArrowUp", "PageUp"].includes(e.key)) dir = -1;
      if (!dir) return;
      e.preventDefault();
      lastInputT = performance.now();
      busy = true;
      gesture(dir);
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);

    /* ---- défilement natif (phases hero / released) ---- */
    let lastY = 0;
    function onScroll() {
      const y = window.scrollY || window.pageYOffset;

      if (phase === "cine") {
        // pendant le glissé d'entrée on laisse Lenis faire ; ensuite on fige
        if (performance.now() > entryUntil && Math.abs(y - cineTop()) > 2) window.scrollTo(0, cineTop());
      } else if (phase === "hero") {
        const hp = clamp(y / (vh() * 0.85), 0, 1);
        hero.style.opacity = String(clamp(1 - hp * 1.7, 0, 1));
        hero.style.pointerEvents = hp > 0.35 ? "none" : "";
        const lock = $(".hero-content");
        if (lock) lock.style.transform = `translateY(${hp * -30}px)`;
        stage.style.opacity = "1";
        // on engage la cinématique avant la fin du hero : le glissé finit le trajet
        if (y >= cineTop() - vh() * 0.42 && performance.now() > guardUntil) enterCine("down");
      } else { // released — la cinématique est terminée
        const past = y - cineBot();
        stage.style.opacity = String(clamp(1 - past / (vh() * 0.6), 0, 1));
        // revenu tout en haut : on réarme le hero (le prochain défilement rejoue la séquence)
        if (y <= vh() * 0.35) { phase = "hero"; }
      }

      if (y > vh() * 0.55) header.classList.add("solid"); else header.classList.remove("solid");
      if (phase !== "cine" && y > lastY && y > vh()) header.classList.add("hidden");
      else header.classList.remove("hidden");
      lastY = y;
    }
    if (lenis) lenis.on("scroll", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* redraw sur resize si dans la cinématique */
    window.addEventListener("resize", () => { if (phase === "cine") draw(true); });

    setupBand();
    setupStats();
    setupReveals();
    setupPieceVideos();
    setupNavScroll(lenis, { enterCine, releaseCine, getPhase: () => phase });
  }

  /* =============================================================
     REPLI — mouvement réduit : défilement classique
     ============================================================= */
  function initScrubFallback() {
    const cine = $("#cine");
    const hero = $("#hero");
    const stage = $("#stage");
    const header = $("#header");
    const chapters = $$("#cine .chapter");
    $("#cineHint").style.display = "none";
    $("#cineProgress").style.display = "none";
    cine.classList.add("cine--scrub");
    chapters.forEach((el) => $$(".chapter-label, .chapter-heading, .chapter-body", el)
      .forEach((k) => (k.style.opacity = 1)));

    const vh = () => window.innerHeight;
    const winFor = [[0, 0.20], [0.24, 0.48], [0.52, 0.74], [0.78, 1]];

    function onScroll() {
      const y = window.scrollY;
      const hp = clamp(y / (vh() * 0.85), 0, 1);
      hero.style.opacity = String(clamp(1 - hp * 1.7, 0, 1));
      stage.style.opacity = "1";
      const p = clamp((y - cine.offsetTop) / (cine.offsetHeight - vh()), 0, 1);
      anim.f = mapFrame(p);
      draw();
      chapters.forEach((el, i) => {
        const [a, b] = winFor[i];
        const o = Math.min(clamp((p - (a - 0.03)) / 0.05, 0, 1), clamp(((b + 0.03) - p) / 0.05, 0, 1));
        el.style.opacity = o;
      });
      if (y > vh() * 0.55) header.classList.add("solid"); else header.classList.remove("solid");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { resizeCanvas(); onScroll(); });
    onScroll();
    setupBand(); setupStats(); setupReveals(); setupPieceVideos(); setupNavScroll(null, null);
  }

  /* ---------- VIDÉOS DE LA COLLECTION ----------
     Chargées et lues seulement quand elles sont à l'écran. */
  function setupPieceVideos() {
    const vids = $$(".piece-video");
    if (!vids.length) return;
    if (PREFERS_REDUCED || !("IntersectionObserver" in window)) return; // on garde le poster

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting) {
          if (!v.src && v.dataset.src) v.src = v.dataset.src;
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.25, rootMargin: "0px 0px -5% 0px" });
    vids.forEach((v) => io.observe(v));

    // pause tout si l'onglet passe en arrière-plan
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) vids.forEach((v) => v.pause());
      else vids.forEach((v) => {
        const r = v.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0 && v.src) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      });
    });
  }

  /* ---------- BANDEAU DÉFILANT ---------- */
  function setupBand() {
    const wrap = $("#band"); const row = wrap && $(".band-row", wrap);
    if (!row) return;
    const update = () => {
      const r = wrap.getBoundingClientRect();
      const prog = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height), 0, 1);
      row.style.transform = `translate3d(${-prog * 26}%, 0, 0)`;
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- COMPTEURS ---------- */
  function setupStats() {
    const nums = $$(".stat-number");
    if (!nums.length) return;
    const fmt = (v, dec) => dec > 0 ? v.toFixed(dec).replace(".", ",") : Math.round(v).toLocaleString("fr-FR");
    if (PREFERS_REDUCED || typeof gsap === "undefined" || !("IntersectionObserver" in window)) {
      nums.forEach((el) => { el.textContent = fmt(parseFloat(el.dataset.value), parseInt(el.dataset.decimals || "0")); });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        nums.forEach((el) => {
          const target = parseFloat(el.dataset.value), dec = parseInt(el.dataset.decimals || "0");
          const obj = { v: 0 };
          gsap.to(obj, { v: target, duration: 2.0, ease: "power2.out", onUpdate: () => { el.textContent = fmt(obj.v, dec); } });
        });
      });
    }, { threshold: 0.4 });
    io.observe($(".precision"));
  }

  /* ---------- RÉVÉLATIONS ---------- */
  function setupReveals() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window) || PREFERS_REDUCED) { els.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- NAVIGATION / ANCRES ---------- */
  function setupNavScroll(lenis, cinema) {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id === "#" || id.length < 2) return;
        const t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        closeMenu();
        // si on saute vers le contenu et qu'on est dans la cinématique : la libérer d'abord
        if (cinema && cinema.getPhase() === "cine" && id !== "#hero" && id !== "#top") {
          cinema.releaseCine("down");
          setTimeout(() => {
            if (lenis) lenis.scrollTo(t, { duration: 1.1 }); else t.scrollIntoView();
          }, 240);
          return;
        }
        if (lenis) lenis.scrollTo(t, { offset: 0, duration: 1.3 });
        else t.scrollIntoView({ behavior: PREFERS_REDUCED ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- MENU MOBILE ---------- */
  const menuToggle = $("#menuToggle");
  const mobileMenu = $("#mobileMenu");
  function closeMenu() {
    document.body.classList.remove("menu-open");
    menuToggle && menuToggle.setAttribute("aria-expanded", "false");
    mobileMenu && mobileMenu.setAttribute("aria-hidden", "true");
  }
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("menu-open");
      menuToggle.setAttribute("aria-expanded", String(open));
      mobileMenu.setAttribute("aria-hidden", String(!open));
    });
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---------- CURSEUR ---------- */
  if (!IS_TOUCH && !PREFERS_REDUCED) {
    const cursor = $("#cursor");
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    window.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    window.addEventListener("mousedown", () => cursor.classList.add("down"));
    window.addEventListener("mouseup", () => cursor.classList.remove("down"));
    const loop = () => {
      cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    };
    loop();
    const sel = "a, button, [data-cursor], .material, input, textarea";
    document.addEventListener("mouseover", (e) => { if (e.target.closest(sel)) cursor.classList.add("hover"); });
    document.addEventListener("mouseout", (e) => { if (e.target.closest(sel)) cursor.classList.remove("hover"); });
  }
})();
