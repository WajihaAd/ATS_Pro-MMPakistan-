/**
 * animations.js — shared chrome behavior: AOS init, sidebar collapse,
 * mobile sidebar drawer, and light/dark theme toggle (persisted in
 * sessionStorage since this is a plain multi-page app, not an SPA).
 */
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    if (window.AOS) {
      AOS.init({ duration: 500, once: true, offset: 30 });
    }

    // ---- Theme toggle ----
    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = sessionStorage.getItem("ats_theme");
    if (savedTheme === "light") {
      document.body.classList.add("light-mode");
      if (themeToggle) themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        const isLight = document.body.classList.contains("light-mode");
        sessionStorage.setItem("ats_theme", isLight ? "light" : "dark");
        themeToggle.innerHTML = isLight
          ? '<i class="fa-solid fa-sun"></i>'
          : '<i class="fa-solid fa-moon"></i>';
      });
    }

    // ---- Sidebar toggle (desktop collapse / mobile drawer) ----
    const sidebar = document.getElementById("sidebar");
    const sidebarToggle = document.getElementById("sidebarToggle");
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener("click", () => {
        if (window.innerWidth <= 992) {
          sidebar.classList.toggle("mobile-open");
        } else {
          sidebar.classList.toggle("collapsed");
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 992 && sidebar && sidebar.classList.contains("mobile-open")) {
        if (!sidebar.contains(e.target) && e.target !== sidebarToggle && !sidebarToggle.contains(e.target)) {
          sidebar.classList.remove("mobile-open");
        }
      }
    });
  });

  // ---- Small reusable helper: format a number as a friendly score ----
  window.fmtScore = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : "—";
  };

  window.escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  // ---- Topbar user menu (logout dropdown, added for authentication) ----
  document.addEventListener("DOMContentLoaded", () => {
    const userWrap = document.getElementById("topbarUser");
    const trigger = document.getElementById("topbarUserTrigger");
    if (!userWrap || !trigger) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      userWrap.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!userWrap.contains(e.target)) userWrap.classList.remove("open");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") userWrap.classList.remove("open");
    });
  });
})();
