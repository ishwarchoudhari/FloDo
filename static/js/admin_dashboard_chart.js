// static/js/admin_dashboard_chart.js
// Initialize the Admin index visitors chart (dummy data until API is wired)
(function(){
  try {
    var canvas = document.getElementById('gaVisitorsChart');
    if (!canvas || typeof Chart === 'undefined') return;
    var data = {
      labels: ["-6d","-5d","-4d","-3d","-2d","-1d","Today"],
      datasets: [{
        label: 'Users',
        data: [12, 19, 7, 15, 22, 18, 25],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        tension: 0.35,
      }]
    };
    new Chart(canvas, {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { display: false } }
      }
    });
  } catch(_) { /* no-op */ }
})();
