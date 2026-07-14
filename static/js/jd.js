/**
 * jd.js — logic for /upload_job: paste vs file input mode, extracting
 * preview text from an uploaded JD file, parsing via /api/jd/parse, and
 * listing previously parsed JDs for reuse.
 */
let jdMode = "paste";
let jdExtractedText = "";

document.addEventListener("DOMContentLoaded", () => {
  const textArea = document.getElementById("jdTextArea");
  textArea.addEventListener("input", updateCharCount);

  wireDropzone(document.getElementById("jdDropzone"), document.getElementById("jdFileInput"), handleJdFile);

  loadJdList();
});

function setJdMode(mode) {
  jdMode = mode;
  document.getElementById("jdPasteMode").style.display = mode === "paste" ? "block" : "none";
  document.getElementById("jdFileMode").style.display = mode === "file" ? "block" : "none";
  document.getElementById("modePasteBtn").classList.toggle("active", mode === "paste");
  document.getElementById("modeFileBtn").classList.toggle("active", mode === "file");
  updateCharCount();
}

function updateCharCount() {
  const text = jdMode === "paste" ? document.getElementById("jdTextArea").value : jdExtractedText;
  document.getElementById("jdCharCount").textContent = `${text.length} characters`;
}

async function handleJdFile(files) {
  const file = files[0];
  const formData = new FormData();
  formData.append("file", file);

  document.getElementById("jdFilePreviewWrap").style.display = "block";
  document.getElementById("jdFilePreview").value = "Extracting text…";

  try {
    const res = await fetch("/api/jd/extract", { method: "POST", body: formData });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    jdExtractedText = data.text;
    document.getElementById("jdFilePreview").value = data.text.slice(0, 3000);
    updateCharCount();
    ATSToast.success(`Extracted text from ${escapeHtml(file.name)}.`);
  } catch (err) {
    document.getElementById("jdFilePreview").value = "";
    ATSToast.error(`Could not extract text: ${escapeHtml(err.message)}`);
  }
}

async function parseJd() {
  const text = jdMode === "paste" ? document.getElementById("jdTextArea").value.trim() : jdExtractedText.trim();

  if (text.length < 30) {
    ATSToast.warning("Job description text is too short to parse (minimum 30 characters).");
    return;
  }

  const btn = document.getElementById("parseJdBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Parsing with Gemini…';

  try {
    const res = await fetch("/api/jd/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd_text: text }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    ATSState.setJd(data.jd_id, data.jd.job_title);
    renderJdResult(data.jd, data.message);
    ATSToast.success(data.message);
    loadJdList();
  } catch (err) {
    ATSToast.error(`Parse failed: ${escapeHtml(err.message)}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Parse Job Description';
  }
}

function renderJdResult(jd, message) {
  const card = document.getElementById("jdResultCard");
  const body = document.getElementById("jdResultBody");
  const skills = (jd.required_skills || []).slice(0, 20);

  body.innerHTML = `
    <div class="row g-3 mb-2">
      <div class="col-md-4"><div class="text-muted-ats" style="font-size:0.78rem;">Job Title</div><div class="fw-bold">${escapeHtml(jd.job_title || "—")}</div></div>
      <div class="col-md-4"><div class="text-muted-ats" style="font-size:0.78rem;">Department</div><div class="fw-bold">${escapeHtml(jd.department || "—")}</div></div>
      <div class="col-md-4"><div class="text-muted-ats" style="font-size:0.78rem;">Experience Required</div><div class="fw-bold">${jd.required_experience_years || 0} yrs</div></div>
    </div>
    <div class="text-muted-ats mb-1" style="font-size:0.8rem;">Required Skills</div>
    <div>${skills.length ? skills.map((s) => `<span class="skill-pill-match">${escapeHtml(s)}</span>`).join("") : '<span class="text-muted-ats">None extracted</span>'}</div>
  `;
  card.style.display = "block";
}

async function loadJdList() {
  const box = document.getElementById("jdListBox");
  try {
    const res = await fetch("/api/jd/list");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    if (!data.jds.length) {
      box.innerHTML = `<div class="empty-state py-4"><i class="fa-solid fa-inbox"></i>No job descriptions yet.</div>`;
      return;
    }

    box.innerHTML = data.jds
      .map(
        (jd) => `
      <div class="jd-list-item">
        <div class="flex-grow-1">
          <div class="jd-item-title">${escapeHtml(jd.job_title)}</div>
          <div class="jd-item-meta">${escapeHtml(jd.department || "—")} · JD #${jd.id}</div>
        </div>
        <button class="btn btn-ats-ghost btn-sm" onclick="useExistingJd(${jd.id}, '${escapeHtml(jd.job_title).replace(/'/g, "\\'")}')">
          Use <i class="fa-solid fa-arrow-right ms-1"></i>
        </button>
      </div>`
      )
      .join("");
  } catch (err) {
    box.innerHTML = `<div class="empty-state py-4"><i class="fa-solid fa-triangle-exclamation"></i>${escapeHtml(err.message)}</div>`;
  }
}

function useExistingJd(jdId, title) {
  ATSState.setJd(jdId, title);
  ATSToast.success(`Active JD set to #${jdId} — ${title}`);
  window.location.href = "/upload_resume";
}
