/**
 * ranking.js — logic for /ranking. Loads the JD list into a selector
 * (pre-selecting from ?jd_id= or ATSState), fetches ranked candidates from
 * /api/rank with server-side score/risk filters, then applies client-side
 * search, sorting, and pagination over the returned set.
 */
let allRanked = [];
let filteredRanked = [];
let currentSort = { key: "rank", dir: "asc" };
let currentPage = 1;
const PAGE_SIZE = 15;
let currentJdId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentJdId = urlParams.get("jd_id") ? Number(urlParams.get("jd_id")) : ATSState.getJdId();

  await loadJdSelect();
  if (currentJdId) {
    reloadRanking();
  }
});

async function loadJdSelect() {
  const select = document.getElementById("jdSelect");
  try {
    const res = await fetch("/api/jd/list");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    if (!data.jds.length) {
      select.innerHTML = `<option value="">No job descriptions yet</option>`;
      return;
    }

    select.innerHTML = data.jds
      .map((jd) => `<option value="${jd.id}">#${jd.id} — ${escapeHtml(jd.job_title)} (${escapeHtml(jd.department || "—")})</option>`)
      .join("");

    if (currentJdId) {
      select.value = String(currentJdId);
    } else {
      currentJdId = Number(select.value);
    }
  } catch (err) {
    select.innerHTML = `<option value="">Failed to load</option>`;
  }
}

function onJdChange() {
  currentJdId = Number(document.getElementById("jdSelect").value);
  reloadRanking();
}

async function reloadRanking() {
  if (!currentJdId) return;

  const minScore = document.getElementById("minScoreInput").value || 0;
  const hireOnly = document.getElementById("hireOnlyCheck").checked;

  const tbody = document.getElementById("rankingTbody");
  tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted-ats">Loading…</td></tr>`;
  document.getElementById("rankingEmptyState").style.display = "none";

  try {
    const params = new URLSearchParams({
      jd_id: currentJdId,
      min_score: minScore,
      only_hire_or_better: hireOnly,
    });
    const res = await fetch(`/api/rank?${params.toString()}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    allRanked = data.ranked || [];
    renderTierSummary(data.tier_summary || {});
    currentPage = 1;
    applyFilters();
  } catch (err) {
    tbody.innerHTML = "";
    document.getElementById("rankingEmptyState").style.display = "block";
    ATSToast.error(`Could not load ranking: ${escapeHtml(err.message)}`);
  }
}

function renderTierSummary(tiers) {
  const row = document.getElementById("tierSummaryRow");
  const entries = Object.entries(tiers);
  if (!entries.length) {
    row.innerHTML = "";
    return;
  }
  row.innerHTML = entries
    .map(
      ([tier, count]) => `
    <div class="col">
      <div class="tier-summary-card">
        <div class="tier-count">${count}</div>
        <div class="tier-name">Tier ${escapeHtml(tier)}</div>
      </div>
    </div>`
    )
    .join("");
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  filteredRanked = allRanked.filter((c) => {
    if (!q) return true;
    return (c.candidate_name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
  });
  sortRows();
  currentPage = 1;
  renderTable();
}

function sortBy(key) {
  if (currentSort.key === key) {
    currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
  } else {
    currentSort = { key, dir: "asc" };
  }
  sortRows();
  renderTable();
}

function sortRows() {
  const { key, dir } = currentSort;
  filteredRanked.sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const tbody = document.getElementById("rankingTbody");
  const emptyState = document.getElementById("rankingEmptyState");
  const countLabel = document.getElementById("resultCountLabel");
  const paginationRow = document.getElementById("paginationRow");

  countLabel.textContent = `${filteredRanked.length} candidate(s)`;

  if (!filteredRanked.length) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
    paginationRow.style.display = "none";
    return;
  }
  emptyState.style.display = "none";

  const totalPages = Math.max(1, Math.ceil(filteredRanked.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredRanked.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageRows.map(rowHtml).join("");

  paginationRow.style.display = totalPages > 1 ? "flex" : "none";
  document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
}

function rowHtml(c) {
  const initials = (c.candidate_name || "?").trim().charAt(0).toUpperCase();
  const tierClass = "tier-" + (c.tier || "D").replace("+", "plus");
  const bandClass = bandPillClass(c.score_band);
  const matched = (c.matched_skills || []).slice(0, 4);
  const missing = (c.missing_skills || []).slice(0, 4);

  return `
    <tr>
      <td>#${c.rank}</td>
      <td>
        <div class="candidate-name-cell">
          <div class="candidate-avatar-sm">${escapeHtml(initials)}</div>
          <div>
            <div class="cname">${escapeHtml(c.candidate_name)}</div>
            <div class="cid">Resume #${c.resume_id} <span class="tier-badge ${tierClass} ms-1">${escapeHtml(c.tier || "")}</span></div>
          </div>
        </div>
      </td>
      <td class="text-muted-ats">${escapeHtml(c.email || "—")}</td>
      <td><span class="score-cell">${fmtScore(c.display_score)}</span></td>
      <td>${fmtScore(c.final_rank_score)}</td>
      <td><span class="pill ${bandClass}">${escapeHtml(c.score_band || "—")}</span></td>
      <td>${(c.risk_flags || []).length ? `<span class="pill pill-red">${(c.risk_flags || []).length} flag(s)</span>` : `<span class="pill pill-muted">None</span>`}</td>
      <td>${matched.map((s) => `<span class="skill-pill-match">${escapeHtml(s)}</span>`).join("") || "—"}</td>
      <td>${missing.map((s) => `<span class="skill-pill-missing">${escapeHtml(s)}</span>`).join("") || "—"}</td>
      <td><a href="/candidate/${c.resume_id}?jd_id=${currentJdId}&eval_id=${c.eval_id}" class="btn btn-ats-ghost btn-sm">View <i class="fa-solid fa-arrow-right ms-1"></i></a></td>
    </tr>
  `;
}

function bandPillClass(band) {
  const b = (band || "").toLowerCase();
  if (b.includes("strong hire") || b === "hire") return "pill-green";
  if (b === "maybe") return "pill-amber";
  return "pill-red";
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
}
function nextPage() {
  const totalPages = Math.max(1, Math.ceil(filteredRanked.length / PAGE_SIZE));
  if (currentPage < totalPages) {
    currentPage++;
    renderTable();
  }
}

function exportFile(kind) {
  if (!currentJdId) return;
  const minScore = document.getElementById("minScoreInput").value || 0;
  const hireOnly = document.getElementById("hireOnlyCheck").checked;
  const params = new URLSearchParams({ jd_id: currentJdId, min_score: minScore, only_hire_or_better: hireOnly });
  const path = kind === "excel" ? `/export/excel?${params}` : `/export/${kind}?${params}`;
  window.location.href = path;
}
