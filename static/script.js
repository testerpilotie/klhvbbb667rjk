// === STATE MANAGEMENT ===
const state = {
    userInfo: {
        weight_kg: 80,
        height_cm: 180,
        age: 30,
        gender: 'male'
    },
    drinks: []
};

// === DOM ELEMENTS ===
// Caching DOM elements for performance
const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');

// === API COMMUNICATION ===
async function fetchCalculation() {
    try {
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        updateDisplay(data);
    } catch (error) {
        console.error("Could not fetch calculation:", error);
    }
}

// === UI ACTIONS ===
function addDrink() {
    state.drinks.push({
        alcohol_grams: 14,
        timestamp: new Date().toISOString()
    });
    fetchCalculation();
}

function resetSession() {
    state.drinks = [];
    fetchCalculation();
}

// === SETTINGS MODAL LOGIC ===
function openSettings() {
    // Populate form with current state
    document.getElementById('weight').value = state.userInfo.weight_kg;
    document.getElementById('height').value = state.userInfo.height_cm;
    document.getElementById('age').value = state.userInfo.age;
    document.getElementById('gender').value = state.userInfo.gender;
    // Show the modal
    settingsModal.style.display = 'block';
}

function closeSettings() {
    settingsModal.style.display = 'none';
}

function handleSettingsSave(event) {
    event.preventDefault(); // Prevent page reload
    // Update state from form
    state.userInfo.weight_kg = parseFloat(document.getElementById('weight').value);
    state.userInfo.height_cm = parseFloat(document.getElementById('height').value);
    state.userInfo.age = parseInt(document.getElementById('age').value, 10);
    state.userInfo.gender = document.getElementById('gender').value;

    // Save to localStorage
    localStorage.setItem('optihol-userInfo', JSON.stringify(state.userInfo));

    closeSettings();
    fetchCalculation(); // Recalculate with new info
}

// === LOCALSTORAGE LOGIC ===
function loadStateFromStorage() {
    const savedUserInfo = localStorage.getItem('optihol-userInfo');
    if (savedUserInfo) {
        state.userInfo = JSON.parse(savedUserInfo);
        console.log('Loaded user info from localStorage:', state.userInfo);
    } else {
        console.log('No saved user info found, using defaults.');
    }
}

// === UI RENDERING ===
function updateDisplay(data) {
    if (!data) return;
    document.getElementById('bac-value').textContent = data.bac.toFixed(3);
    document.getElementById('pending-value').textContent = data.pending.toFixed(3);
    document.getElementById('peak-value').textContent = data.peak_bac.toFixed(3);
    document.getElementById('drink-count').textContent = data.drink_count;
    
    const statusEl = document.getElementById('status');
    statusEl.className = data.status;
    
    const statusText = {
        'below': 'Below Zone',
        'optimal': '🎯 Optimal Zone!',
        'above': 'Above Zone'
    };
    statusEl.textContent = statusText[data.status] || 'Unknown';
    
    if (data.next_drink) {
        document.getElementById('next-drink-text').textContent = data.next_drink.message;
    }
    
    if (data.zone_limits) {
        const minZone = data.zone_limits.min.toFixed(1);
        const maxZone = data.zone_limits.max.toFixed(1);
        document.getElementById('zone-display').textContent = `${minZone}‰ - ${maxZone}‰`;
    }
    
    if (data.timeline && data.zone_limits) {
        updateChart(data.timeline, data.zone_limits);
    }
}

function updateChart(timeline, zoneLimits) {
    const svg = document.getElementById('bac-chart');
    if (!svg) return;

    const width = 700;
    const height = 300;
    const margin = { top: 20, right: 50, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxBAC = 1.0;

    const xScale = (minutes) => margin.left + ((minutes + 180) / 540) * chartWidth;
    const yScale = (bac) => {
        const clampedBAC = Math.max(0, Math.min(maxBAC, bac));
        return margin.top + chartHeight - (clampedBAC / maxBAC) * chartHeight;
    };

    let pathData = timeline.map((point, index) => {
        const x = xScale(point[0]);
        const y = yScale(point[1]);
        return (index === 0) ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }).join('');

    const currentPoint = timeline.find(point => point[0] === 0);
    const currentX = currentPoint ? xScale(0) : margin.left;
    const currentY = currentPoint ? yScale(currentPoint[1]) : margin.top + chartHeight;

    svg.innerHTML = `
        <defs>
            <linearGradient id="zoneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:rgba(76,175,80,0.2)" />
                <stop offset="100%" style="stop-color:rgba(76,175,80,0.1)" />
            </linearGradient>
        </defs>
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#eee" stroke-width="1"/>
        <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="#eee" stroke-width="1"/>
        <rect x="${margin.left}" y="${yScale(zoneLimits.max)}" width="${chartWidth}" height="${yScale(zoneLimits.min) - yScale(zoneLimits.max)}" fill="url(#zoneGradient)" />
        <line x1="${margin.left}" y1="${yScale(zoneLimits.min)}" x2="${margin.left + chartWidth}" y2="${yScale(zoneLimits.min)}" stroke="#4caf50" stroke-width="1" stroke-dasharray="2,3"/>
        <line x1="${margin.left}" y1="${yScale(zoneLimits.max)}" x2="${margin.left + chartWidth}" y2="${yScale(zoneLimits.max)}" stroke="#4caf50" stroke-width="1" stroke-dasharray="2,3"/>
        <path d="${pathData}" fill="none" stroke="#4bc0c0" stroke-width="2"/>
        <line x1="${currentX}" y1="${margin.top}" x2="${currentX}" y2="${margin.top + chartHeight}" stroke="#ff6384" stroke-width="1" stroke-dasharray="4,4" />
        <circle cx="${currentX}" cy="${currentY}" r="5" fill="#ff6384" stroke="#fff" stroke-width="1.5"/>
        ${[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(bac => `<text x="${margin.left - 8}" y="${yScale(bac) + 4}" text-anchor="end" fill="#666" font-size="12">${bac.toFixed(1)}</text>`).join('')}
        ${[-180, -120, -60, 0, 60, 120, 180, 240, 300, 360].map(min => `<text x="${xScale(min)}" y="${margin.top + chartHeight + 20}" text-anchor="middle" fill="#666" font-size="12">${min === 0 ? 'Now' : min/60+'h'}</text>`).join('')}
    `;
    updateBACTimeline(timeline);
}

function updateBACTimeline(timeline) {
    const tbody = document.getElementById('bac-timeline-body');
    if (!tbody) return;
    
    let html = timeline
        .filter(p => p[0] >= 0 && p[0] <= 120)
        .filter((p, i) => i % 2 === 0) // Take every other point (20 min intervals)
        .map(point => {
            const bac = point[1];
            const timeStr = point[0] === 0 ? 'NOW' : `${point[0]}min`;
            return `<tr><td style="border: 1px solid #ccc; padding: 5px;">${timeStr}</td><td style="border: 1px solid #ccc; padding: 5px;">${bac.toFixed(3)}</td></tr>`;
        })
        .join('');

    tbody.innerHTML = html || `<tr><td colspan="2" style="text-align: center; padding: 10px;">No data</td></tr>`;
}

// === INITIALIZATION ===
function initialize() {
    loadStateFromStorage();
    fetchCalculation();
    // Add event listeners
    settingsForm.addEventListener('submit', handleSettingsSave);
    // Close modal if user clicks outside of the modal content
    window.onclick = function(event) {
        if (event.target == settingsModal) {
            closeSettings();
        }
    }
    // Set up a periodic refresh
    setInterval(fetchCalculation, 30000);
}

document.addEventListener('DOMContentLoaded', initialize);