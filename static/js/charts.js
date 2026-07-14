/**
 * charts.js — small Chart.js wrappers with the app's dark theme baked in,
 * shared between dashboard.js and reports.js.
 */

window.ATSCharts = (function () {
  const gridColor = "rgba(255,255,255,0.06)";
  const tickColor = "#9aa4b8";

  function baseOptions(extra = {}) {
    return Object.assign(
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tickColor, font: { family: "Inter" } } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor } },
        },
      },
      extra
    );
  }

  function scoreHistogram(ctx, scores) {
    const buckets = [0, 0, 0, 0, 0]; // 0-20,20-40,40-60,60-80,80-100
    scores.forEach((s) => {
      const idx = Math.min(4, Math.floor(s / 20));
      buckets[idx]++;
    });
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["0-20", "20-40", "40-60", "60-80", "80-100"],
        datasets: [
          {
            label: "Candidates",
            data: buckets,
            backgroundColor: "rgba(94, 200, 248, 0.65)",
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: baseOptions({ plugins: { legend: { display: false } } }),
    });
  }

  function hiringMixDoughnut(ctx, hired, maybe, noHire) {
    return new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Hire", "Maybe", "No Hire"],
        datasets: [
          {
            data: [hired, maybe, noHire],
            backgroundColor: ["#4ee08a", "#f6d860", "#f15c5c"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: tickColor } } },
      },
    });
  }

  function categoryRadar(ctx, labels, values) {
    return new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Category scores",
            data: values,
            backgroundColor: "rgba(124, 92, 255, 0.25)",
            borderColor: "#7c5cff",
            pointBackgroundColor: "#7c5cff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: { color: tickColor, font: { size: 10 } },
            ticks: { display: false, backdropColor: "transparent" },
            suggestedMin: 0,
            suggestedMax: 100,
          },
        },
      },
    });
  }

  function barChart(ctx, labels, values, label = "Value") {
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label, data: values, backgroundColor: "rgba(94, 200, 248, 0.65)", borderRadius: 6 }],
      },
      options: baseOptions({ plugins: { legend: { display: false } }, indexAxis: "y" }),
    });
  }

  return { scoreHistogram, hiringMixDoughnut, categoryRadar, barChart };
})();
