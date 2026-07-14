/**
 * resume.js — logic for /upload_resume: stage files locally, upload them
 * as a batch to /api/resume/upload, show per-file success/reused/failed
 * status, and keep ATSState in sync with what's ready for evaluation.
 */
let stagedFiles = [];

// document.addEventListener("DOMContentLoaded", () => {
//   renderActiveJd();
//   renderStagedResumesList();

//   wireDropzone(document.getElementById("resumeDropzone"), document.getElementById("resumeFileInput"), addStagedFiles);
// });
document.addEventListener("DOMContentLoaded", () => {

  if (!ATSState.get().resumeSessionStarted) {
    ATSState.clearResumes();

    const state = ATSState.get();
    state.resumeSessionStarted = true;
    sessionStorage.setItem("ats_state_v1", JSON.stringify(state));
  }

  renderActiveJd();
  renderStagedResumesList();

  wireDropzone(
    document.getElementById("resumeDropzone"),
    document.getElementById("resumeFileInput"),
    addStagedFiles
  );
});

function renderActiveJd() {
  const jdId = ATSState.getJdId();
  const jdTitle = ATSState.getJdTitle();
  if (jdId) {
    document.getElementById("activeJdTitle").textContent = `#${jdId} — ${jdTitle}`;
  }
}

function addStagedFiles(files) {
  const existingNames = new Set(stagedFiles.map((f) => f.name + f.size));
  files.forEach((f) => {
    if (!existingNames.has(f.name + f.size)) {
      stagedFiles.push(f);
    }
  });
  renderFileList();
}

function removeStagedFile(index) {
  stagedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  const list = document.getElementById("resumeFileList");
  const count = document.getElementById("resumeFileCount");
  const uploadBtn = document.getElementById("uploadResumesBtn");

  count.textContent = `${stagedFiles.length} file(s) staged`;
  uploadBtn.disabled = stagedFiles.length === 0;

  list.innerHTML = stagedFiles
    .map(
      (f, i) => `
    <div class="file-row">
      <i class="fa-solid fa-file-lines file-icon"></i>
      <span class="file-name">${escapeHtml(f.name)}</span>
      <span class="text-muted-ats" style="font-size:0.76rem;">${humanFileSize(f.size)}</span>
      <i class="fa-solid fa-xmark file-remove" onclick="removeStagedFile(${i})"></i>
    </div>`
    )
    .join("");
}

async function uploadStagedResumes() {
  if (!stagedFiles.length) return;

  const btn = document.getElementById("uploadResumesBtn");
  const progressWrap = document.getElementById("resumeUploadProgress");
  const progressBar = document.getElementById("resumeProgressBar");
  const progressText = document.getElementById("resumeProgressText");

  btn.disabled = true;
  progressWrap.style.display = "block";
  progressBar.style.width = "15%";
  progressText.textContent = "Uploading files…";

  const formData = new FormData();
  stagedFiles.forEach((f) => formData.append("files", f));

  try {
    progressBar.style.width = "45%";
    progressText.textContent = "Extracting text and running AI parsing…";

    const res = await fetch("/api/resume/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Upload failed.");

    progressBar.style.width = "100%";
    progressText.textContent = "Done.";

    ATSState.addResumes(data.results);
    renderStagedResumesList();

    const s = data.summary;
    ATSToast.success(`Resumes ready — ${s.succeeded} parsed, ${s.reused} reused, ${s.failed} failed.`);

    data.results
      .filter((r) => !r.ok)
      .forEach((r) => ATSToast.error(`${escapeHtml(r.filename)}: ${escapeHtml(r.error)}`));

    stagedFiles = [];
    renderFileList();
  } catch (err) {
    ATSToast.error(`Upload failed: ${escapeHtml(err.message)}`);
  } finally {
    btn.disabled = stagedFiles.length === 0;
    setTimeout(() => {
      progressWrap.style.display = "none";
      progressBar.style.width = "0%";
    }, 1200);
  }
}

function renderStagedResumesList() {
  const box = document.getElementById("stagedResumesList");
  const goBtn = document.getElementById("goEvaluateBtn");
  const resumes = ATSState.getResumes();

  if (!resumes.length) {
    box.innerHTML = `<div class="empty-state py-4"><i class="fa-solid fa-inbox"></i>No resumes staged yet.</div>`;
    goBtn.style.display = "none";
    return;
  }

  box.innerHTML = resumes
    .map(
      (r) => `
    <div class="jd-list-item">
      <div class="flex-grow-1">
        <div class="jd-item-title">${escapeHtml(r.name || r.filename)}</div>
        <div class="jd-item-meta">${r.reused ? "Reused existing record" : "Newly parsed"} · Resume #${r.resume_id}</div>
      </div>
    </div>`
    )
    .join("");
  goBtn.style.display = "block";
}
