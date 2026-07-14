/**
 * evaluate.js — logic for /evaluate. Calls /api/evaluate/one once per
 * staged resume, in sequence, updating the overall progress bar, the
 * pipeline step list, and a live log. This drives the "Extracting…
 * Comparing… Running AI… Calculating ATS… Saving…" experience without
 * needing a background job queue or websockets.
 */
const STEP_ORDER = ["extract", "read", "compare", "ai", "ats", "rank", "save", "done"];


window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const jdId = ATSState.getJdId();
  const jdTitle = ATSState.getJdTitle();
  const resumes = ATSState.getResumes();

  resetSteps();
  document.getElementById("evalOverallBar").style.width = "0%";
  document.getElementById("evalOverallProgressWrap").style.display = "none";
  document.getElementById("evalOverallText").textContent = "";

  document.getElementById("evalLog").innerHTML = `
  <div class="empty-state py-4">
  <i class="fa-solid fa-hourglass-half"></i>
  Waiting to start…
  </div>`;

  document.getElementById("evalJdTitle").textContent = jdId ? `#${jdId} — ${jdTitle}` : "None selected";
  document.getElementById("evalResumeCount").textContent = resumes.length;

  if (!jdId || !resumes.length) {
    document.getElementById("evaluateBtn").disabled = true;
    document.getElementById("evalLog").innerHTML = `
      <div class="empty-state py-4">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Parse a job description and upload at least one resume before evaluating.
      </div>`;
  }
});

function setStep(stepKey, state) {
  const el = document.querySelector(`.step-item[data-step="${stepKey}"]`);
  if (!el) return;
  el.classList.remove("active", "done");
  if (state) el.classList.add(state);
  const icon = el.querySelector(".step-dot i");
  icon.className = state === "done" ? "fa-solid fa-check" : "fa-solid fa-circle";
  if (state !== "done") icon.style.fontSize = "6px";
  else icon.style.fontSize = "10px";
}

function resetSteps() {
  STEP_ORDER.forEach((s) => setStep(s, null));
}

function logLine(html) {
  const log = document.getElementById("evalLog");
  if (log.querySelector(".empty-state")) log.innerHTML = "";
  const row = document.createElement("div");
  row.className = "upload-mini-row";
  row.innerHTML = html;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

async function runEvaluation() {
  const jdId = ATSState.getJdId();
  const resumes = ATSState.getResumes();
  if (!jdId || !resumes.length) return;

  const btn = document.getElementById("evaluateBtn");
  const progressWrap = document.getElementById("evalOverallProgressWrap");
  const bar = document.getElementById("evalOverallBar");
  const text = document.getElementById("evalOverallText");

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Evaluating…';
  progressWrap.style.display = "block";
  document.getElementById("evalLog").innerHTML = "";
  resetSteps();

  setStep("extract", "active");
  setStep("read", "active");
  await sleep(250);
  setStep("extract", "done");
  setStep("read", "done");
  setStep("compare", "active");

  let ok = 0;
  let failed = 0;
  const total = resumes.length;

  for (let i = 0; i < total; i++) {
    const r = resumes[i];
    text.textContent = `Evaluating ${i + 1} / ${total} — ${r.name || r.filename}`;
    setStep("ai", "active");

    try {
      const res = await fetch("/api/evaluate/one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_id: r.resume_id, jd_id: jdId }),
      });
      const data = await res.json();

      if (data.ok) {
        ok++;
        logLine(`
          <i class="fa-solid fa-circle-check upload-mini-icon" style="color: var(--success);"></i>
          <span class="upload-mini-name">${escapeHtml(r.name || r.filename)}</span>
          <span class="text-muted-ats" style="font-size:0.76rem;">Evaluated</span>
        `);
      } else {
        failed++;
        logLine(`
          <i class="fa-solid fa-circle-xmark upload-mini-icon" style="color: var(--danger);"></i>
          <span class="upload-mini-name">${escapeHtml(r.name || r.filename)}</span>
          <span class="text-muted-ats" style="font-size:0.76rem;">${escapeHtml(data.error || "Failed")}</span>
        `);
      }
    } catch (err) {
      failed++;
      logLine(`
        <i class="fa-solid fa-circle-xmark upload-mini-icon" style="color: var(--danger);"></i>
        <span class="upload-mini-name">${escapeHtml(r.name || r.filename)}</span>
        <span class="text-muted-ats" style="font-size:0.76rem;">${escapeHtml(err.message)}</span>
      `);
    }

    bar.style.width = `${Math.round(((i + 1) / total) * 90)}%`;
  }

  setStep("compare", "done");
  setStep("ai", "done");
  setStep("ats", "active");
  await sleep(200);
  setStep("ats", "done");
  setStep("rank", "active");
  await sleep(200);
  setStep("rank", "done");
  setStep("save", "active");
  await sleep(150);
  setStep("save", "done");
  setStep("done", "done");

  bar.style.width = "100%";
  text.textContent = `Completed — ${ok} evaluated, ${failed} failed.`;

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-bolt me-1"></i> Evaluate Candidates';

  if (ok > 0) {
    ATSToast.success(`Evaluated ${ok}/${total} resumes. Ready to view the ranking.`);
    ATSState.clearAll();
    logLine(`
      <div class="w-100 text-center mt-2">
        <a href="/ranking?jd_id=${jdId}" 
        onclick="sessionStorage.removeItem('ats_state_v1')"
        class="btn btn-ats-primary btn-sm">
          View Ranking <i class="fa-solid fa-arrow-right ms-1"></i>
        </a>
      </div>
    `);
  } else {
    ATSToast.error("No resumes could be evaluated. Check the log above.");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
