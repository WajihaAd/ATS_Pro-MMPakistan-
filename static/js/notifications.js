/**
 * notifications.js — lightweight toast system (no Bootstrap Toast dependency
 * so it works identically on every page without extra markup per-toast).
 */
(function () {
  const ICONS = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    warning: "fa-triangle-exclamation",
    info: "fa-circle-info",
  };

  function toast(message, type = "info", timeout = 4200) {
    const stack = document.getElementById("toastStack");
    if (!stack) return;

    const el = document.createElement("div");
    el.className = `ats-toast ${type}`;
    el.innerHTML = `
      <i class="fa-solid ${ICONS[type] || ICONS.info}"></i>
      <div>${message}</div>
    `;
    stack.appendChild(el);

    setTimeout(() => {
      el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }

  window.ATSToast = {
    success: (msg, t) => toast(msg, "success", t),
    error: (msg, t) => toast(msg, "error", t),
    warning: (msg, t) => toast(msg, "warning", t),
    info: (msg, t) => toast(msg, "info", t),
  };
})();
