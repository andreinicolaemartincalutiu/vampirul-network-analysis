/* ==========================================================================
   Undead Networks — shared behaviour for every page (public pages and
   visualizers): privacy notice, anonymous visitor statistics, and, on the
   public pages, the mobile menu, "back to top" button, table-of-contents
   highlighting and citation copy buttons.
   ========================================================================== */
(function () {
    "use strict";

    const NOTICE_KEY = "un-privacy-notice-v1";
    // Vercel Web Analytics script. The dashboard (Analytics → framework "HTML")
    // may give a project-specific path instead; if so, put it here.
    const ANALYTICS_SRC = "/_vercel/insights/script.js";
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

    function store(get, value) {
        try {
            if (get) return localStorage.getItem(NOTICE_KEY);
            localStorage.setItem(NOTICE_KEY, value);
        } catch (e) { /* storage blocked: the notice simply shows again */ }
        return null;
    }

    // ---- Anonymous statistics: Vercel Web Analytics (no cookies) ----------
    // Enabled in the Vercel dashboard (Project → Analytics). Not loaded locally.
    if (!isLocal) {
        window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
        const s = document.createElement("script");
        s.defer = true;
        s.src = ANALYTICS_SRC;
        document.head.appendChild(s);
    }

    // ---- Shared styles for the notice and the top button ------------------
    // Self-contained so they look right on both the light public pages and
    // the dark visualizers.
    const css = `
#un-consent{position:fixed;left:20px;bottom:20px;z-index:9999;max-width:420px;
  background:#151925;color:#e8eaed;border:1px solid rgba(255,255,255,.14);border-radius:14px;
  padding:18px 18px 16px;box-shadow:0 20px 50px rgba(0,0,0,.35);font:14px/1.55 Inter,"Helvetica Neue",Helvetica,Arial,sans-serif;
  animation:unUp .35s ease both}
#un-consent strong{display:block;font-weight:600;font-size:15px;color:#fff;margin-bottom:6px}
#un-consent p{margin:0 0 14px;color:#b9bfcc;font-size:14px;line-height:1.55}
#un-consent .un-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#un-consent a{color:#d4af37}
#un-consent button{font:inherit;cursor:pointer;border-radius:999px;padding:8px 18px;
  background:#d4af37;border:1px solid #d4af37;color:#0a0e1a}
#un-consent button:hover{background:#dbb958}
#un-totop{position:fixed;right:20px;bottom:20px;z-index:9998;width:46px;height:46px;border-radius:50%;
  border:1px solid rgba(255,255,255,.15);background:#151925;color:#fff;cursor:pointer;
  display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(10,14,26,.3);
  opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .25s,transform .25s,bottom .25s}
#un-totop.show{opacity:1;transform:none;pointer-events:auto}
#un-totop:hover{background:#0a0e1a}
#un-totop svg{width:20px;height:20px}
@keyframes unUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (max-width:600px){#un-consent{left:12px;right:12px;bottom:12px;max-width:none}}
@media (prefers-reduced-motion:reduce){#un-consent{animation:none}#un-totop{transition:none}}
@media print{#un-consent,#un-totop{display:none!important}}`;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    function ready(fn) {
        if (document.readyState !== "loading") fn();
        else document.addEventListener("DOMContentLoaded", fn);
    }

    ready(function () {
        // ---- Privacy notice (informative: there are no cookies to accept) --
        let notice = null;
        if (!store(true)) {
            notice = document.createElement("div");
            notice.id = "un-consent";
            notice.setAttribute("role", "region");
            notice.setAttribute("aria-label", "Privacy notice");
            notice.innerHTML =
                "<strong>No cookies here</strong>" +
                "<p>We count visits anonymously, without cookies or personal profiles, " +
                "and keep only this notice's dismissal in your browser. Automated " +
                "scraping and AI training on this site are not permitted.</p>" +
                "<div class='un-row'><button type='button'>Got it</button>" +
                "<a href='/privacy'>Privacy &amp; terms</a></div>";
            document.body.appendChild(notice);
            notice.querySelector("button").addEventListener("click", function () {
                store(false, new Date().toISOString());
                notice.remove();
                notice = null;
                placeTop();
            });
        }

        // ---- Back to top (public pages only) ------------------------------
        let topBtn = null;
        function placeTop() {
            if (!topBtn) return;
            const narrow = window.matchMedia("(max-width: 600px)").matches;
            topBtn.style.bottom = (notice && narrow) ? (notice.offsetHeight + 24) + "px" : "20px";
        }
        if (document.body.hasAttribute("data-totop")) {
            topBtn = document.createElement("button");
            topBtn.id = "un-totop";
            topBtn.type = "button";
            topBtn.setAttribute("aria-label", "Back to top");
            topBtn.title = "Back to top";
            topBtn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' " +
                "stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 19V5M5 12l7-7 7 7'/></svg>";
            document.body.appendChild(topBtn);
            topBtn.addEventListener("click", function () {
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
            const onScroll = function () { topBtn.classList.toggle("show", window.scrollY > 500); };
            window.addEventListener("scroll", onScroll, { passive: true });
            window.addEventListener("resize", placeTop);
            onScroll();
            placeTop();
        }

        // ---- Year ----------------------------------------------------------
        document.querySelectorAll("[data-year]").forEach(function (el) {
            el.textContent = new Date().getFullYear();
        });

        // ---- Mobile menu ---------------------------------------------------
        const toggle = document.querySelector(".nav-toggle");
        const nav = document.getElementById("site-nav");
        if (toggle && nav) {
            toggle.addEventListener("click", function () {
                const open = nav.classList.toggle("open");
                toggle.setAttribute("aria-expanded", open);
                toggle.textContent = open ? "Close" : "Menu";
            });
            nav.addEventListener("click", function (e) {
                if (e.target.closest("a")) {
                    nav.classList.remove("open");
                    toggle.setAttribute("aria-expanded", "false");
                    toggle.textContent = "Menu";
                }
            });
        }

        // ---- Table of contents highlighting --------------------------------
        const links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
        if (links.length && "IntersectionObserver" in window) {
            const byId = {};
            links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
            const obs = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    links.forEach(function (a) { a.classList.remove("active"); });
                    const link = byId[entry.target.id];
                    if (link) link.classList.add("active");
                });
            }, { rootMargin: "-30% 0px -60% 0px" });
            document.querySelectorAll(".prose section[id]").forEach(function (s) { obs.observe(s); });
        }

        // ---- Copy buttons (citation) --------------------------------------
        document.querySelectorAll("[data-copy]").forEach(function (btn) {
            const label = btn.textContent;
            btn.addEventListener("click", function () {
                const target = document.getElementById(btn.getAttribute("data-copy"));
                if (!target || !navigator.clipboard) { btn.textContent = "Select and copy manually"; return; }
                navigator.clipboard.writeText(target.innerText.trim()).then(function () {
                    btn.textContent = "Copied ✓";
                    setTimeout(function () { btn.textContent = label; }, 1800);
                }, function () { btn.textContent = "Select and copy manually"; });
            });
        });
    });
})();
