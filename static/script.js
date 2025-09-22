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

    // Clear existing SVG content safely
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }

    const svgNS = "http://www.w3.org/2000/svg";
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

    // Create elements
    const defs = document.createElementNS(svgNS, 'defs');
    const linearGradient = document.createElementNS(svgNS, 'linearGradient');
    linearGradient.setAttribute('id', 'zoneGradient');
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '0%');
    linearGradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('style', 'stop-color:rgba(76,175,80,0.2)');
    const stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('style', 'stop-color:rgba(76,175,80,0.1)');

    linearGradient.appendChild(stop1);
    linearGradient.appendChild(stop2);
    defs.appendChild(linearGradient);
    svg.appendChild(defs);

    // Axes lines
    const yAxisLine = document.createElementNS(svgNS, 'line');
    yAxisLine.setAttribute('x1', String(margin.left));
    yAxisLine.setAttribute('y1', String(margin.top));
    yAxisLine.setAttribute('x2', String(margin.left));
    yAxisLine.setAttribute('y2', String(margin.top + chartHeight));
    yAxisLine.setAttribute('stroke', '#eee');
    yAxisLine.setAttribute('stroke-width', '1');
    svg.appendChild(yAxisLine);

    const xAxisLine = document.createElementNS(svgNS, 'line');
    xAxisLine.setAttribute('x1', String(margin.left));
    xAxisLine.setAttribute('y1', String(margin.top + chartHeight));
    xAxisLine.setAttribute('x2', String(margin.left + chartWidth));
    xAxisLine.setAttribute('y2', String(margin.top + chartHeight));
    xAxisLine.setAttribute('stroke', '#eee');
    xAxisLine.setAttribute('stroke-width', '1');
    svg.appendChild(xAxisLine);

    // Zone rectangle
    const zoneRect = document.createElementNS(svgNS, 'rect');
    zoneRect.setAttribute('x', String(margin.left));
    zoneRect.setAttribute('y', String(yScale(zoneLimits.max)));
    zoneRect.setAttribute('width', String(chartWidth));
    zoneRect.setAttribute('height', String(yScale(zoneLimits.min) - yScale(zoneLimits.max)));
    zoneRect.setAttribute('fill', 'url(#zoneGradient)');
    svg.appendChild(zoneRect);

    // Zone limit lines
    const minZoneLine = document.createElementNS(svgNS, 'line');
    minZoneLine.setAttribute('x1', String(margin.left));
    minZoneLine.setAttribute('y1', String(yScale(zoneLimits.min)));
    minZoneLine.setAttribute('x2', String(margin.left + chartWidth));
    minZoneLine.setAttribute('y2', String(yScale(zoneLimits.min)));
    minZoneLine.setAttribute('stroke', '#4caf50');
    minZoneLine.setAttribute('stroke-width', '1');
    minZoneLine.setAttribute('stroke-dasharray', '2,3');
    svg.appendChild(minZoneLine);

    const maxZoneLine = document.createElementNS(svgNS, 'line');
    maxZoneLine.setAttribute('x1', String(margin.left));
    maxZoneLine.setAttribute('y1', String(yScale(zoneLimits.max)));
    maxZoneLine.setAttribute('x2', String(margin.left + chartWidth));
    maxZoneLine.setAttribute('y2', String(yScale(zoneLimits.max)));
    maxZoneLine.setAttribute('stroke', '#4caf50');
    maxZoneLine.setAttribute('stroke-width', '1');
    maxZoneLine.setAttribute('stroke-dasharray', '2,3');
    svg.appendChild(maxZoneLine);

    // BAC path
    let pathData = timeline.map((point, index) => {
        const x = xScale(point[0]);
        const y = yScale(point[1]);
        return (index === 0) ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }).join(' ');

    const bacPath = document.createElementNS(svgNS, 'path');
    bacPath.setAttribute('d', pathData);
    bacPath.setAttribute('fill', 'none');
    bacPath.setAttribute('stroke', '#4bc0c0');
    bacPath.setAttribute('stroke-width', '2');
    svg.appendChild(bacPath);

    // "Now" line and circle
    const currentPoint = timeline.find(point => point[0] === 0);
    const currentX = currentPoint ? xScale(0) : margin.left;
    const currentY = currentPoint ? yScale(currentPoint[1]) : margin.top + chartHeight;

    const nowLine = document.createElementNS(svgNS, 'line');
    nowLine.setAttribute('x1', String(currentX));
    nowLine.setAttribute('y1', String(margin.top));
    nowLine.setAttribute('x2', String(currentX));
    nowLine.setAttribute('y2', String(margin.top + chartHeight));
    nowLine.setAttribute('stroke', '#ff6384');
    nowLine.setAttribute('stroke-width', '1');
    nowLine.setAttribute('stroke-dasharray', '4,4');
    svg.appendChild(nowLine);

    const nowCircle = document.createElementNS(svgNS, 'circle');
    nowCircle.setAttribute('cx', String(currentX));
    nowCircle.setAttribute('cy', String(currentY));
    nowCircle.setAttribute('r', '5');
    nowCircle.setAttribute('fill', '#ff6384');
    nowCircle.setAttribute('stroke', '#fff');
    nowCircle.setAttribute('stroke-width', '1.5');
    svg.appendChild(nowCircle);

    // Y-axis labels
    [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(bac => {
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', String(margin.left - 8));
        text.setAttribute('y', String(yScale(bac) + 4));
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('fill', '#666');
        text.setAttribute('font-size', '12');
        text.textContent = bac.toFixed(1);
        svg.appendChild(text);
    });

    // X-axis labels
    [-180, -120, -60, 0, 60, 120, 180, 240, 300, 360].forEach(min => {
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', String(xScale(min)));
        text.setAttribute('y', String(margin.top + chartHeight + 20));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#666');
        text.setAttribute('font-size', '12');
        text.textContent = min === 0 ? 'Now' : min / 60 + 'h';
        svg.appendChild(text);
    });

    updateBACTimeline(timeline);
}

function updateBACTimeline(timeline) {
    const tbody = document.getElementById('bac-timeline-body');
    if (!tbody) return;
    
    // Clear existing content safely
    tbody.innerHTML = '';

    const filteredTimeline = timeline
        .filter(p => p[0] >= 0 && p[0] <= 120)
        .filter((p, i) => i % 2 === 0); // Take every other point (20 min intervals)

    if (filteredTimeline.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 2;
        td.textContent = 'No data';
        td.style.textAlign = 'center';
        td.style.padding = '10px';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    filteredTimeline.forEach(point => {
        const bac = point[1];
        const timeStr = point[0] === 0 ? 'NOW' : `${point[0]}min`;

        const tr = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.textContent = timeStr;
        timeCell.style.border = '1px solid #ccc';
        timeCell.style.padding = '5px';

        const bacCell = document.createElement('td');
        bacCell.textContent = bac.toFixed(3);
        bacCell.style.border = '1px solid #ccc';
        bacCell.style.padding = '5px';

        tr.appendChild(timeCell);
        tr.appendChild(bacCell);
        tbody.appendChild(tr);
    });
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
