/**
 * reports.js — loads /api/reports/summary and renders the analytics page.
 */
document.addEventListener("DOMContentLoaded", loadReports);

async function loadReports() {
  const loading = document.getElementById("reportsLoading");
  const content = document.getElementById("reportsContent");

  try {
    const res = await fetch("/api/reports/summary");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    renderReports(data.stats, data.recent_jds);
    loading.style.display = "none";
    content.style.display = "block";
  } catch (err) {
    loading.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>
      <div>${escapeHtml(err.message)}</div>
    `;
  }
}

function renderReports(stats, jds) {
  document.getElementById("rptTotalJds").textContent = stats.total_jds ?? 0;
  document.getElementById("rptTotalCandidates").textContent = stats.total_candidates ?? 0;
  document.getElementById("rptAvgAts").textContent = fmtScore(stats.avg_ats_score);

  const totalEvals = (stats.total_hired || 0) + (stats.total_maybe || 0) + (stats.total_no_hire || 0);
  const hireRate = totalEvals ? Math.round(((stats.total_hired || 0) / totalEvals) * 100) : 0;
  document.getElementById("rptHireRate").textContent = `${hireRate}%`;

  ATSCharts.scoreHistogram(document.getElementById("rptScoreChart").getContext("2d"), stats.score_distribution || []);
  ATSCharts.hiringMixDoughnut(
    document.getElementById("rptMixChart").getContext("2d"),
    stats.total_hired || 0,
    stats.total_maybe || 0,
    stats.total_no_hire || 0
  );

  const list = document.getElementById("rptJdList");
  if (jds && jds.length) {
    list.innerHTML = jds
      .map(
        (jd) => `
      <div class="jd-list-item">
        <div class="flex-grow-1">
          <div class="jd-item-title">${escapeHtml(jd.job_title)}</div>
          <div class="jd-item-meta">${escapeHtml(jd.department || "—")} · JD #${jd.id}</div>
        </div>
        <a href="/ranking?jd_id=${jd.id}" class="btn btn-ats-ghost btn-sm">View Ranking <i class="fa-solid fa-arrow-right ms-1"></i></a>
      </div>`
      )
      .join("");
  } else {
    list.innerHTML = `<div class="empty-state py-4"><i class="fa-solid fa-inbox"></i>No job descriptions yet.</div>`;
  }
}
