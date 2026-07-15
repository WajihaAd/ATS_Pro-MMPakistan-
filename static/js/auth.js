/**
 * auth.js — behavior for login.html and signup.html.
 * Vanilla JS, no framework, matches the plain multi-page pattern the rest
 * of the ATS frontend already uses (see dashboard.js, upload.js, etc.).
 */
(function () {
  "use strict";

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function showAlert(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = "auth-alert " + type;
    // force reflow so the shake animation can re-trigger on repeat errors
    void el.offsetWidth;
    el.classList.add("show");
    if (type === "error") el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 420);
  }

  function hideAlert(el) {
    if (!el) return;
    el.classList.remove("show");
  }

  function setFieldError(input, msgEl, message) {
    if (message) {
      input.classList.add("invalid");
      input.classList.remove("valid");
      if (msgEl) { msgEl.textContent = message; msgEl.classList.add("show"); }
      return false;
    }
    input.classList.remove("invalid");
    input.classList.add("valid");
    if (msgEl) { msgEl.classList.remove("show"); }
    return true;
  }

  function wireVisibilityToggle(root) {
    qsa(".auth-toggle-visibility", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPw = input.type === "password";
        input.type = isPw ? "text" : "password";
        btn.innerHTML = isPw
          ? '<i class="fa-solid fa-eye-slash"></i>'
          : '<i class="fa-solid fa-eye"></i>';
      });
    });
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle("loading", loading);
    btn.disabled = loading;
  }

  async function postForm(url, data) {
    const body = new URLSearchParams(data);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body,
    });
    let payload;
    try {
      payload = await res.json();
    } catch (e) {
      payload = { ok: false, error: "Unexpected server response." };
    }
    return { status: res.status, payload };
  }

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function scorePassword(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.max(1, Math.min(4, score));
  }

  const STRENGTH_LABELS = { 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong" };

  /* ------------------------------------------------------- Login page */
  function initLogin() {
    const form = qs("#loginForm");
    if (!form) return;

    wireVisibilityToggle(form);
    const alertEl = qs("#loginAlert");
    const emailInput = qs("#email", form);
    const pwInput = qs("#password", form);
    const submitBtn = qs("#loginSubmit", form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert(alertEl);

      const email = emailInput.value.trim();
      const password = pwInput.value;

      let valid = true;
      valid = setFieldError(emailInput, qs("#emailError"), EMAIL_RE.test(email) ? "" : "Enter a valid email address.") && valid;
      valid = setFieldError(pwInput, qs("#passwordError"), password ? "" : "Password is required.") && valid;
      if (!valid) return;

      setLoading(submitBtn, true);
      try {
        const nextUrl = qs("input[name='next']", form)?.value || "";
        const { payload } = await postForm(form.action, { email, password, next: nextUrl });
        if (payload.ok) {
          showAlert(alertEl, "Welcome back — redirecting to your dashboard…", "success");
          window.location.href = payload.redirect || "/dashboard";
        } else {
          showAlert(alertEl, payload.error || "Invalid email or password.", "error");
          setLoading(submitBtn, false);
        }
      } catch (err) {
        showAlert(alertEl, "Could not reach the server. Please try again.", "error");
        setLoading(submitBtn, false);
      }
    });
  }

  /* ------------------------------------------------------ Signup page */
  function initSignup() {
    const form = qs("#signupForm");
    if (!form) return;

    wireVisibilityToggle(form);
    const alertEl = qs("#signupAlert");
    const nameInput = qs("#full_name", form);
    const emailInput = qs("#email", form);
    const pwInput = qs("#password", form);
    const confirmInput = qs("#confirm_password", form);
    const submitBtn = qs("#signupSubmit", form);
    const strengthWrap = qs("#pwStrength");
    const strengthLabel = qs("#pwStrengthLabel");

    pwInput.addEventListener("input", () => {
      const score = scorePassword(pwInput.value);
      if (!pwInput.value) {
        strengthWrap.dataset.level = "0";
        strengthLabel.textContent = "At least 8 characters";
      } else {
        strengthWrap.dataset.level = String(score);
        strengthLabel.textContent = STRENGTH_LABELS[score] || "Weak";
      }
      if (confirmInput.value) validateConfirm();
    });

    function validateConfirm() {
      return setFieldError(
        confirmInput,
        qs("#confirmError"),
        confirmInput.value === pwInput.value ? "" : "Passwords do not match."
      );
    }
    confirmInput.addEventListener("input", validateConfirm);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert(alertEl);

      const full_name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const password = pwInput.value;
      const confirm_password = confirmInput.value;

      let valid = true;
      valid = setFieldError(nameInput, qs("#nameError"), full_name.length >= 2 ? "" : "Enter your full name.") && valid;
      valid = setFieldError(emailInput, qs("#emailError"), EMAIL_RE.test(email) ? "" : "Enter a valid email address.") && valid;
      valid = setFieldError(pwInput, qs("#passwordError"), password.length >= 8 ? "" : "Use at least 8 characters.") && valid;
      valid = validateConfirm() && valid;
      if (!valid) return;

      setLoading(submitBtn, true);
      try {
        const { payload } = await postForm(form.action, { full_name, email, password, confirm_password });
        if (payload.ok) {
          showAlert(alertEl, "Account created — taking you to your dashboard…", "success");
          window.location.href = payload.redirect || "/dashboard";
        } else {
          showAlert(alertEl, payload.error || "Could not create the account.", "error");
          setLoading(submitBtn, false);
        }
      } catch (err) {
        showAlert(alertEl, "Could not reach the server. Please try again.", "error");
        setLoading(submitBtn, false);
      }
    });
  }

  /* ------------------------------------------------ Ambient hero canvas
     Lightweight animated "AI network" backdrop for the hero panel —
     nodes drift and connect when close, on a transparent <canvas>. Pure
     decoration; skipped entirely if the panel isn't on the page (mobile
     hides .auth-hero via CSS, but we still avoid running work for it). */
  function initHeroCanvas() {
    const canvas = qs("#authHeroCanvas");
    if (!canvas || !canvas.getContext) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    let w, h, nodes;
    const COUNT = 34;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      w = canvas.width = rect.width;
      h = canvas.height = rect.height;
    }

    function makeNodes() {
      nodes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 1,
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.strokeStyle = `rgba(94, 200, 248, ${0.16 * (1 - dist / 130)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(124, 92, 255, 0.55)";
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }

    resize();
    makeNodes();
    tick();
    window.addEventListener("resize", () => { resize(); });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLogin();
    initSignup();
    initHeroCanvas();
  });
})();
