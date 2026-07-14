/**
 * dashboard.js — loads /api/dashboard/stats and populates the executive
 * dashboard: stat cards, score histogram, hiring mix, latest JD and top
 * candidate panels, recent uploads list.
 */
document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
});

async function loadDashboard() {
  const loading = document.getElementById("dashLoading");
  const content = document.getElementById("dashContent");

  try {
    const res = await fetch("/api/dashboard/stats");
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Failed to load dashboard stats.");
    }

    renderDashboard(data.stats);
    loading.style.display = "none";
    content.style.display = "block";
  } catch (err) {
    loading.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>
      <div>${escapeHtml(err.message)}</div>
      <div class="text-muted-ats mt-2" style="font-size:0.8rem;">Check that PostgreSQL is running and DB_PASSWORD is set in .env.</div>
    `;
  }
}

function renderDashboard(stats) {
  document.getElementById("statTotalCandidates").textContent = stats.total_candidates ?? 0;
  document.getElementById("statHired").textContent = stats.total_hired ?? 0;
  document.getElementById("statMaybe").textContent = stats.total_maybe ?? 0;
  document.getElementById("statNoHire").textContent = stats.total_no_hire ?? 0;
  document.getElementById("statAvgAts").textContent = fmtScore(stats.avg_ats_score);
  document.getElementById("statAvgFinal").textContent = fmtScore(stats.avg_final_score);
  document.getElementById("statTotalJds").textContent = stats.total_jds ?? 0;

  // Score histogram
  const distCtx = document.getElementById("scoreDistChart");
  if (distCtx) {
    ATSCharts.scoreHistogram(distCtx.getContext("2d"), stats.score_distribution || []);
  }

  // Hiring mix
  const mixCtx = document.getElementById("hireMixChart");
  if (mixCtx) {
    ATSCharts.hiringMixDoughnut(
      mixCtx.getContext("2d"),
      stats.total_hired || 0,
      stats.total_maybe || 0,
      stats.total_no_hire || 0
    );
  }

  // Latest JD
  const jdBox = document.getElementById("latestJdBox");
  if (stats.latest_jd) {
    jdBox.innerHTML = `
      <div class="jd-mini-title">${escapeHtml(stats.latest_jd.job_title)}</div>
      <div class="jd-mini-meta">${escapeHtml(stats.latest_jd.department || "—")} · JD #${stats.latest_jd.id}</div>
      <a href="/ranking?jd_id=${stats.latest_jd.id}" class="btn btn-ats-outline btn-sm">View Ranking <i class="fa-solid fa-arrow-right ms-1"></i></a>
    `;
  }

  // Top candidate
  const topBox = document.getElementById("topCandidateBox");
  if (stats.top_candidate) {
    const initials = (stats.top_candidate.name || "?").trim().charAt(0).toUpperCase();
    topBox.innerHTML = `
      <div class="top-candidate-card">
        <div class="top-candidate-avatar">${initials}</div>
        <div class="flex-grow-1">
          <div class="top-candidate-name">${escapeHtml(stats.top_candidate.name)}</div>
          <div class="jd-mini-meta mb-0">${escapeHtml(stats.top_candidate.job_title || "")}</div>
        </div>
        <div class="top-candidate-score">${fmtScore(stats.top_candidate.score)}</div>
      </div>
    `;
  }

  // Recent uploads
  const list = document.getElementById("recentUploadsList");
  if (stats.recent_uploads && stats.recent_uploads.length) {
    list.innerHTML = stats.recent_uploads
      .map(
        (u) => `
      <div class="upload-mini-row">
        <i class="fa-solid fa-file-circle-check upload-mini-icon"></i>
        <span class="upload-mini-name">${escapeHtml(u.name)}</span>
        <span class="upload-mini-time">${u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</span>
      </div>`
      )
      .join("");
  } else {
    list.innerHTML = `<div class="empty-state py-4"><i class="fa-solid fa-inbox"></i>No resumes uploaded yet.</div>`;
  }
}
