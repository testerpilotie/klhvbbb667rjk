let bacChart;

function initializeChart() {
    const ctx = document.getElementById('bacChart').getContext('2d');
    bacChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'BAC (%)',
                data: [],
                borderColor: '#4bc0c0',
                borderWidth: 2,
                fill: false,
                tension: 0.4, // Makes the line smooth
                pointRadius: 0 // No points on the line
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'BAC (%)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

function updateChart(timeline, zoneLimits) {
    if (!bacChart) {
        initializeChart();
    }

    const labels = timeline.map(point => {
        const minutes = point[0];
        if (minutes === 0) return 'Now';

        const absMinutes = Math.abs(minutes);
        const hours = Math.floor(absMinutes / 60);
        const remainingMinutes = absMinutes % 60;

        let label = '';
        if (hours > 0) {
            label += `${hours}h`;
        }
        if (remainingMinutes > 0) {
            label += `${remainingMinutes}m`;
        }

        if (minutes < 0) {
            return `-${label}`;
        } else {
            return `in ${label}`;
        }
    });

    const data = timeline.map(point => point[1]);

    bacChart.data.labels = labels;
    bacChart.data.datasets[0].data = data;

    // Add annotation for optimal zone
    bacChart.options.plugins.annotation = {
        annotations: {
            box1: {
                type: 'box',
                yMin: zoneLimits.min,
                yMax: zoneLimits.max,
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderColor: 'rgba(76, 175, 80, 0.3)',
                borderWidth: 1
            }
        }
    };

    bacChart.update();
}

document.addEventListener('DOMContentLoaded', initializeChart);
