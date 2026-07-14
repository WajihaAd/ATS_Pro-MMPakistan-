/**
 * app-state.js — replaces Streamlit's st.session_state for a plain
 * multi-page Flask app. Holds the "active JD" and "staged resumes" in
 * sessionStorage so they survive navigation between Upload JD → Upload
 * Resumes → Evaluate → Ranking, without a server-side session.
 */
(function () {
  const KEY = "ats_state_v1";

  function read() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  }

  function write(state) {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  }

  window.ATSState = {
    get() {
      return read();
    },
    setJd(jdId, jdTitle) {
      const s = read();
      s.jdId = jdId;
      s.jdTitle = jdTitle;
      write(s);
    },
    getJdId() {
      return read().jdId || null;
    },
    getJdTitle() {
      return read().jdTitle || "";
    },
    addResumes(resumeEntries) {
      const s = read();
      s.resumes = s.resumes || [];
      const seen = new Set(s.resumes.map((r) => r.resume_id));
      resumeEntries.forEach((r) => {
        if (r.ok && !seen.has(r.resume_id)) {
          s.resumes.push(r);
          seen.add(r.resume_id);
        }
      });
      write(s);
    },
    getResumes() {
      return read().resumes || [];
    },
    clearResumes() {
      const s = read();
      s.resumes = [];
      write(s);
    },
    clearAll() {
      sessionStorage.removeItem(KEY);
    },
  };
})();
