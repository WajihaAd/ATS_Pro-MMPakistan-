/**
 * upload.js — generic drag & drop wiring. Page-specific logic (jd.js,
 * resume.js) calls wireDropzone() and supplies a callback for the files
 * the user picked or dropped.
 */
function wireDropzone(dropzoneEl, inputEl, onFiles) {
  if (!dropzoneEl || !inputEl) return;

  dropzoneEl.addEventListener("click", () => inputEl.click());

  inputEl.addEventListener("change", () => {
    if (inputEl.files && inputEl.files.length) onFiles(Array.from(inputEl.files));
    inputEl.value = "";
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropzoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropzoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.remove("dragover");
    });
  });

  dropzoneEl.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) onFiles(Array.from(files));
  });
}

function humanFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
