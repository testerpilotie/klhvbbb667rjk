// === DOM ELEMENTS ===
// Caching DOM elements for performance
const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');
const addDrinkModal = document.getElementById('addDrinkModal');
const addDrinkForm = document.getElementById('addDrinkForm');
const drinkTypeSelect = document.getElementById('drinkType');
const drinkSizeContainer = document.getElementById('drinkSizeContainer');
const drinkSizeSelect = document.getElementById('drinkSize');

const DRINK_DEFINITIONS = {
    Beer: { abv: 5.0, sizes: { '330ml': 330, '500ml': 500 } },
    Wine: { abv: 12.5, sizes: { '12cl': 120, '16cl': 160 } },
    Spirits: { abv: 40.0, default_grams: 14 },
    Other: { abv: 0, default_grams: 14 } // Default to 14g for 'Other'
};

// === API COMMUNICATION ===
async function fetchCalculation() {
    try {
        const userInfo = await window.db.getProfile();
        let drinks = await window.db.getDrinksForPeriod(0, Date.now());

        // Convert timestamps to ISO strings before sending to the backend
        drinks = drinks.map(drink => ({
            ...drink,
            timestamp: new Date(drink.timestamp).toISOString()
        }));

        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userInfo, drinks })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        updateDisplay(data);
    } catch (error) {
        console.error("Could not fetch calculation:", error);
    }
}

// === UI ACTIONS ===
function openAddDrinkModal() {
    updateDrinkSizeOptions(); // Initial population of size options
    addDrinkModal.style.display = 'block';
}

function closeAddDrinkModal() {
    addDrinkModal.style.display = 'none';
}

function updateDrinkSizeOptions() {
    const selectedType = drinkTypeSelect.value;
    const definition = DRINK_DEFINITIONS[selectedType];

    if (definition && definition.sizes) {
        drinkSizeContainer.style.display = 'block';
        drinkSizeSelect.innerHTML = ''; // Clear existing options
        for (const sizeLabel in definition.sizes) {
            const option = document.createElement('option');
            option.value = definition.sizes[sizeLabel];
            option.textContent = sizeLabel;
            drinkSizeSelect.appendChild(option);
        }
    } else {
        drinkSizeContainer.style.display = 'none';
    }
}

async function handleDrinkSubmit(event) {
    event.preventDefault();
    const drinkType = drinkTypeSelect.value;
    const minutesAgo = parseInt(document.querySelector('input[name="drinkTime"]:checked').value, 10);
    const timestamp = Date.now() - (minutesAgo * 60 * 1000);

    const definition = DRINK_DEFINITIONS[drinkType];
    let alcohol_grams;
    let size = null;

    if (definition.sizes) {
        const volume_ml = parseFloat(drinkSizeSelect.value);
        const sizeLabel = drinkSizeSelect.options[drinkSizeSelect.selectedIndex].text;
        alcohol_grams = volume_ml * (definition.abv / 100) * 0.789;
        size = sizeLabel;
    } else {
        alcohol_grams = definition.default_grams;
    }

    await window.db.addDrink({
        drinkType: drinkType,
        alcohol_grams: alcohol_grams,
        timestamp: timestamp,
        size: size
    });

    closeAddDrinkModal();
    fetchCalculation();
}

async function resetSession() {
    await window.db.clearAllData();
    // Also clear the user profile from the form
    const defaultProfile = {
        weight_kg: 80,
        height_cm: 180,
        age: 30,
        gender: 'male'
    };
    await window.db.saveProfile(defaultProfile);
    fetchCalculation();
}

// === SETTINGS MODAL LOGIC ===
async function openSettings() {
    const userInfo = await window.db.getProfile();
    if (userInfo) {
        document.getElementById('weight').value = userInfo.weight_kg;
        document.getElementById('height').value = userInfo.height_cm;
        document.getElementById('age').value = userInfo.age;
        document.getElementById('gender').value = userInfo.gender;
    }
    settingsModal.style.display = 'block';
}

function closeSettings() {
    settingsModal.style.display = 'none';
}

async function quickAddBeer() {
    const beerDefinition = DRINK_DEFINITIONS.Beer;
    const volume_ml = 500; // Default to 500ml
    const alcohol_grams = volume_ml * (beerDefinition.abv / 100) * 0.789;

    await window.db.addDrink({
        drinkType: 'Beer',
        alcohol_grams: alcohol_grams,
        timestamp: Date.now(),
        size: '500ml'
    });
    fetchCalculation();
}

async function handleSettingsSave(event) {
    event.preventDefault();
    const userInfo = {
        weight_kg: parseFloat(document.getElementById('weight').value),
        height_cm: parseFloat(document.getElementById('height').value),
        age: parseInt(document.getElementById('age').value, 10),
        gender: document.getElementById('gender').value
    };

    await window.db.saveProfile(userInfo);

    closeSettings();
    fetchCalculation();
}



function updateDisplay(data) {
    if (!data) return;
    document.getElementById('bac-value').textContent = data.bac.toFixed(3);
    document.getElementById('pending-value').textContent = data.pending.toFixed(3);
    document.getElementById('peak-value').textContent = data.peak_bac.toFixed(3);

    const statusEl = document.getElementById('status');
    statusEl.className = data.status;

    const statusText = {
        'below': 'Below Zone',
        'optimal': '🎯 Optimal Zone!',
        'above': 'Above Zone'
    };
    statusEl.textContent = statusText[data.status] || 'Unknown';

    if (data.zone_limits) {
        const minZone = data.zone_limits.min.toFixed(1);
        const maxZone = data.zone_limits.max.toFixed(1);
        document.getElementById('zone-display').textContent = `${minZone}‰ - ${maxZone}‰`;
    }

    // Update the chart with the new timeline data
    if (data.timeline && data.zone_limits) {
        updateChart(data.timeline, data.zone_limits);
    }

    // Render the drinks log
    renderDrinksLog(data.drinks);
}

function renderDrinksLog(drinks) {
    const tbody = document.getElementById('drinks-log-body');
    const caption = document.getElementById('drinks-log-caption');
    if (!tbody || !caption) return;

    tbody.innerHTML = ''; // Clear existing content
    caption.textContent = ''; // Clear existing content

    if (!drinks || drinks.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.textContent = 'No drinks added yet.';
        td.style.textAlign = 'center';
        td.style.padding = '10px';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    caption.textContent = `Total Drinks: ${drinks.length}`;

    // Reverse the drinks array to show the latest drink first
    drinks.slice().reverse().forEach(drink => {
        const tr = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.textContent = new Date(drink.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timeCell.style.border = '1px solid #ccc';
        timeCell.style.padding = '5px';

        const typeCell = document.createElement('td');
        typeCell.textContent = drink.drinkType;
        typeCell.style.border = '1px solid #ccc';
        typeCell.style.padding = '5px';

        const sizeCell = document.createElement('td');
        sizeCell.textContent = drink.size || ''; // Display size or empty string if not available
        sizeCell.style.border = '1px solid #ccc';
        sizeCell.style.padding = '5px';

        tr.appendChild(timeCell);
        tr.appendChild(typeCell);
        tr.appendChild(sizeCell);
        tbody.appendChild(tr);
    });
}

// === INITIALIZATION ===
async function initialize() {
    let userInfo = await window.db.getProfile();
    if (!userInfo) {
        // If no profile exists, create a default one
        userInfo = {
            id: 1,
            weight_kg: 80,
            height_cm: 180,
            age: 30,
            gender: 'male'
        };
        await window.db.saveProfile(userInfo);
    }

    fetchCalculation();

    // Add event listeners
    settingsForm.addEventListener('submit', handleSettingsSave);
    addDrinkForm.addEventListener('submit', handleDrinkSubmit);
    drinkTypeSelect.addEventListener('change', updateDrinkSizeOptions);

    // Close modal if user clicks outside of the modal content
    window.onclick = function(event) {
        if (event.target == settingsModal || event.target == addDrinkModal) {
            closeSettings();
            closeAddDrinkModal();
        }
    }

    // Set up a periodic refresh
    setInterval(fetchCalculation, 30000);
}

document.addEventListener('DOMContentLoaded', initialize);
