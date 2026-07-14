/**
 * candidate.js — logic for /candidate/<id>. Fetches profile + evaluation
 * extras (matched/missing skills, strengths, weaknesses, ranking summary,
 * full LLM evaluation JSON) and renders the category radar chart, score
 * ring, and breakdown panels.
 */
document.addEventListener("DOMContentLoaded", loadCandidateDetail);

async function loadCandidateDetail() {
  const { resumeId, evalId } = CANDIDATE_CTX;
  const params = new URLSearchParams();
  if (evalId) params.set("eval_id", evalId);

  try {
    const res = await fetch(`/api/candidate/${resumeId}?${params.toString()}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    renderEvaluation(data.evaluation || {});
  } catch (err) {
    ATSToast.warning("Could not load evaluation details for this candidate.");
  }
}

function renderEvaluation(evaluation) {
  const fullEval = evaluation.full_evaluation_json || {};
  const catScores = fullEval.category_scores_for_ats || {};
  const score = evaluation.weighted_final_ats_score;

  // Score ring (drawn as a simple canvas arc — lighter than pulling in a gauge library)
  drawScoreRing(document.getElementById("scoreRing"), score || 0);
  document.getElementById("ringScoreValue").textContent = score != null ? fmtScore(score) : "—";

  const bandBox = document.getElementById("candBandPill");
  if (evaluation.score_band_recommendation) {
    const cls = bandPillClassLocal(evaluation.score_band_recommendation);
    bandBox.innerHTML = `<span class="pill ${cls}">${escapeHtml(evaluation.score_band_recommendation)}</span>`;
  }

  // Category radar
  const labels = Object.keys(catScores).map((k) => k.replace("_score", "").replace(/_/g, " "));
  const values = Object.values(catScores);
  if (labels.length) {
    ATSCharts.categoryRadar(document.getElementById("categoryRadar").getContext("2d"), labels, values);
  }

  // Matched / missing skills
  renderSkillBox("matchedSkillsBox", evaluation.matched_skills, "skill-pill-match");
  renderSkillBox("missingSkillsBox", evaluation.missing_skills, "skill-pill-missing");

  // Risk
  const riskFlags = (fullEval.risk_analysis && fullEval.risk_analysis.risk_flags) || [];
  const riskBox = document.getElementById("riskBox");
  if (riskFlags.length) {
    riskBox.innerHTML = riskFlags
      .map((f) => `<div class="risk-flag-row"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(typeof f === "string" ? f : JSON.stringify(f))}</div>`)
      .join("");
  } else {
    riskBox.innerHTML = `<span class="text-muted-ats">No risk flags identified.</span>`;
  }

  // Strengths / weaknesses
  fillList("strengthsList", evaluation.top_strengths);
  fillList("weaknessesList", evaluation.top_weaknesses);

  // LLM explanation
  const explanationBox = document.getElementById("llmExplanationBox");
  const reasoning = (fullEval.hiring_recommendation && fullEval.hiring_recommendation.reasoning) || evaluation.ranking_summary;
  if (reasoning) {
    explanationBox.innerHTML = `
      <p>${escapeHtml(reasoning)}</p>
      ${evaluation.llm_recommendation ? `<span class="pill ${bandPillClassLocal(evaluation.llm_recommendation)}">${escapeHtml(evaluation.llm_recommendation)}</span>` : ""}
    `;
  }
}

function renderSkillBox(id, skills, pillClass) {
  const box = document.getElementById(id);
  if (!skills || !skills.length) {
    box.innerHTML = `<span class="text-muted-ats">None recorded.</span>`;
    return;
  }
  box.innerHTML = skills.map((s) => `<span class="${pillClass}">${escapeHtml(s)}</span>`).join("");
}

function fillList(id, items) {
  const el = document.getElementById(id);
  if (!items || !items.length) {
    el.innerHTML = `<li class="text-muted-ats">None recorded.</li>`;
    return;
  }
  el.innerHTML = items.map((i) => `<li class="mb-1">${escapeHtml(i)}</li>`).join("");
}

function bandPillClassLocal(band) {
  const b = (band || "").toLowerCase();
  if (b.includes("strong hire") || b === "hire") return "pill-green";
  if (b === "maybe") return "pill-amber";
  return "pill-red";
}

function drawScoreRing(canvas, score) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 58;
  const pct = Math.max(0, Math.min(100, score)) / 100;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#5ec8f8");
  gradient.addColorStop(1, "#7c5cff");

  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.lineWidth = 12;
  ctx.strokeStyle = gradient;
  ctx.lineCap = "round";
  ctx.stroke();
}
