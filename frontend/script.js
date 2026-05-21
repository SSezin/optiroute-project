const state = {
    warehouses: [],
    retailers: [],
    addingMode: null, // 'warehouse' or 'retailer'
    editingNodeId: null, // Track node being edited
    lines: [],
    chartInstance: null
};

// Initial Mock Data (Marmara Region, Turkey)
const initialWarehouses = [
    { id: 'w1', name: 'Gebze Ana Depo', lat: 40.802, lng: 29.430, capacity: 5000, fixed_cost: 150000 },
    { id: 'w2', name: 'Çorlu Aktarma', lat: 41.160, lng: 27.800, capacity: 3000, fixed_cost: 80000 },
    { id: 'w3', name: 'Bursa Lojistik', lat: 40.200, lng: 29.060, capacity: 4000, fixed_cost: 120000 }
];

const initialRetailers = [
    { id: 'r1', name: 'Kadıköy Şube', lat: 40.990, lng: 29.020, demand: 800 },
    { id: 'r2', name: 'Beşiktaş Şube', lat: 41.042, lng: 29.008, demand: 600 },
    { id: 'r3', name: 'Şişli AVM', lat: 41.060, lng: 28.987, demand: 1200 },
    { id: 'r4', name: 'Bakırköy Meydan', lat: 40.980, lng: 28.870, demand: 700 },
    { id: 'r5', name: 'İzmit Merkez', lat: 40.760, lng: 29.940, demand: 500 },
    { id: 'r6', name: 'Yalova Sahil', lat: 40.650, lng: 29.270, demand: 300 },
    { id: 'r7', name: 'Tekirdağ Çarşı', lat: 40.970, lng: 27.510, demand: 400 }
];

// Initialize Map with custom zoom position
const map = L.map('map', {
    zoomControl: false
}).setView([40.9, 28.9], 9);

L.control.zoom({
    position: 'bottomleft'
}).addTo(map);

// Add light-themed CartoDB tiles
const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
});
tileLayer.addTo(map);

// Custom Icons
const createIcon = (type, isOpened = false) => {
    let className = `marker-pin marker-${type}`;
    if (isOpened) className += ' opened';
    
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="${className}"></div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 21]
    });
};

// Add initial data
function loadInitialData() {
    initialWarehouses.forEach(w => addNode('warehouse', { ...w, status: 'auto', fixed_co2: 1000 }));
    initialRetailers.forEach(r => addNode('retailer', r));
}

window.generatePopupContent = function(type, data) {
    let popupContent = `<h4>${data.name}</h4>`;
    if (type === 'warehouse') {
        let forcedStr = '<span style="color:var(--text-muted);">Otomatik</span>';
        let btnColor = 'var(--text-muted)';
        let btnIcon = 'fa-robot';
        
        if (data.status === 'open') {
            forcedStr = '<span style="color:var(--success); font-weight: 600;">Zorunlu Açık</span>';
            btnColor = 'var(--success)';
            btnIcon = 'fa-check';
        } else if (data.status === 'closed') {
            forcedStr = '<span style="color:var(--danger); font-weight: 600;">Zorunlu Kapalı</span>';
            btnColor = 'var(--danger)';
            btnIcon = 'fa-xmark';
        }
        
        popupContent += `<p>Kapasite: ${data.capacity}</p>
                         <p>Sabit Maliyet: ${data.fixed_cost} ₺</p>
                         <p>Sabit CO2: ${data.fixed_co2} kg</p>
                         <p>Durum: ${forcedStr}</p>`;
    } else {
        popupContent += `<p>Talep: ${data.demand}</p>`;
    }
    
    popupContent += `<div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px;">`;
    
    if (type === 'warehouse') {
        let btnColor = data.status === 'auto' ? 'var(--text-muted)' : (data.status === 'open' ? 'var(--success)' : 'var(--danger)');
        let btnIcon = data.status === 'auto' ? 'fa-robot' : (data.status === 'open' ? 'fa-check' : 'fa-xmark');
        popupContent += `<button onclick="toggleForceOpen('${data.id}')" style="background: transparent; border: 1px solid ${btnColor}; color: ${btnColor}; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s;" title="Durumu Değiştir">
                            <i class="fa-solid ${btnIcon}"></i>
                         </button>`;
    }
    
    popupContent += `<button onclick="editNode('${type}', '${data.id}')" style="background: transparent; border: 1px solid var(--primary); color: var(--primary); padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s;">
                        <i class="fa-solid fa-pen"></i> Düzenle
                    </button>
                    <button onclick="deleteNode('${type}', '${data.id}')" style="background: transparent; border: 1px solid var(--danger); color: var(--danger); padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s;">
                        <i class="fa-solid fa-trash"></i> Sil
                    </button>
                 </div>`;
    return popupContent;
};

window.toggleForceOpen = function(id) {
    const node = state.warehouses.find(n => n.id === id);
    if (node) {
        if (node.status === 'auto') node.status = 'open';
        else if (node.status === 'open') node.status = 'closed';
        else node.status = 'auto';
        
        node.marker.setPopupContent(generatePopupContent('warehouse', node));
        clearResults();
        document.getElementById('results-panel').classList.add('hidden');
    }
};

// Function to add a node to map and state
function addNode(type, data) {
    if (!data.id) data.id = type.charAt(0) + Date.now();
    
    const icon = createIcon(type);
    const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);
    
    data.marker = marker;
    
    if (type === 'warehouse') {
        data.status = data.status || 'auto';
        data.fixed_co2 = data.capacity * 2.0;
        state.warehouses.push(data);
    } else {
        state.retailers.push(data);
    }
    
    marker.bindPopup(generatePopupContent(type, data));
}

// Function to edit a node
window.editNode = function(type, id) {
    let list = type === 'warehouse' ? state.warehouses : state.retailers;
    const node = list.find(n => n.id === id);
    if (!node) return;
    
    state.addingMode = type;
    state.editingNodeId = id;
    
    document.getElementById('modal-title').innerText = type === 'warehouse' ? 'Depoyu Düzenle' : 'Bayiyi Düzenle';
    document.getElementById('node-name').value = node.name;
    document.getElementById('node-lat').value = node.lat;
    document.getElementById('node-lng').value = node.lng;
    
    if (type === 'warehouse') {
        document.getElementById('capacity-group').classList.remove('hidden');
        document.getElementById('fixed-cost-group').classList.remove('hidden');
        document.getElementById('forced-open-group').classList.remove('hidden');
        document.getElementById('demand-group').classList.add('hidden');
        
        document.getElementById('node-capacity').value = node.capacity;
        document.getElementById('node-fixed-cost').value = node.fixed_cost;
        document.getElementById('node-status').value = node.status || 'auto';
    } else {
        document.getElementById('capacity-group').classList.add('hidden');
        document.getElementById('fixed-cost-group').classList.add('hidden');
        document.getElementById('forced-open-group').classList.add('hidden');
        document.getElementById('demand-group').classList.remove('hidden');
        
        document.getElementById('node-demand').value = node.demand;
    }
    
    document.getElementById('node-modal').classList.remove('hidden');
    map.closePopup();
}

// Function to delete a node
window.deleteNode = function(type, id) {
    let list = type === 'warehouse' ? state.warehouses : state.retailers;
    const index = list.findIndex(n => n.id === id);
    
    if (index > -1) {
        // Remove marker from map
        map.removeLayer(list[index].marker);
        // Remove from array
        list.splice(index, 1);
        // Clear old optimization results
        clearResults();
        document.getElementById('results-panel').classList.add('hidden');
    }
}

// Map Click Handler for Adding Nodes
map.on('click', function(e) {
    if (!state.addingMode) return;
    
    document.getElementById('node-lat').value = e.latlng.lat.toFixed(4);
    document.getElementById('node-lng').value = e.latlng.lng.toFixed(4);
    document.getElementById('node-modal').classList.remove('hidden');
});

// Setup Event Listeners
document.getElementById('add-warehouse-btn').addEventListener('click', () => setupAddMode('warehouse'));
document.getElementById('add-retailer-btn').addEventListener('click', () => setupAddMode('retailer'));
document.getElementById('cancel-node').addEventListener('click', closeModal);
document.getElementById('save-node').addEventListener('click', saveNode);
document.getElementById('optimize-btn').addEventListener('click', runOptimization);
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

document.getElementById('close-error-modal').addEventListener('click', () => {
    document.getElementById('error-modal').classList.add('hidden');
});

function showErrorModal(message) {
    document.getElementById('error-message').innerText = message;
    document.getElementById('error-modal').classList.remove('hidden');
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('#theme-toggle i');
    
    if (isDark) {
        icon.className = 'fa-solid fa-moon';
        icon.style.color = '#e9c46a'; // Soft yellow/moon color for dark mode
        tileLayer.setUrl('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
        Chart.defaults.color = '#aaaaaa';
    } else {
        icon.className = 'fa-solid fa-sun';
        icon.style.color = 'var(--primary)'; // Warm orange for light mode
        tileLayer.setUrl('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
        Chart.defaults.color = '#888888';
    }
    
    if (state.chartInstance) {
        state.chartInstance.update();
    }
}

function setupAddMode(type) {
    state.addingMode = type;
    document.getElementById('map').style.cursor = 'crosshair';
    
    document.getElementById('modal-title').innerText = type === 'warehouse' ? 'Yeni Depo Ekle' : 'Yeni Bayi Ekle';
    document.getElementById('node-name').placeholder = type === 'warehouse' ? 'Örn: Depo 4' : 'Örn: Şube X';
    
    if (type === 'warehouse') {
        document.getElementById('capacity-group').classList.remove('hidden');
        document.getElementById('fixed-cost-group').classList.remove('hidden');
        document.getElementById('forced-open-group').classList.remove('hidden');
        document.getElementById('demand-group').classList.add('hidden');
        document.getElementById('node-status').value = 'auto';
    } else {
        document.getElementById('capacity-group').classList.add('hidden');
        document.getElementById('fixed-cost-group').classList.add('hidden');
        document.getElementById('forced-open-group').classList.add('hidden');
        document.getElementById('demand-group').classList.remove('hidden');
    }
}

function closeModal() {
    document.getElementById('node-modal').classList.add('hidden');
    state.addingMode = null;
    state.editingNodeId = null;
    document.getElementById('map').style.cursor = 'grab';
    // Reset inputs
    document.getElementById('node-name').value = '';
    document.getElementById('node-lat').value = '';
    document.getElementById('node-lng').value = '';
}

function saveNode() {
    const lat = parseFloat(document.getElementById('node-lat').value);
    const lng = parseFloat(document.getElementById('node-lng').value);
    const name = document.getElementById('node-name').value || (state.addingMode === 'warehouse' ? 'Yeni Depo' : 'Yeni Bayi');
    
    if (!lat || !lng) {
        showErrorModal("Lütfen haritadan bir konum seçin.");
        return;
    }

    const data = { name, lat, lng };
    
    if (state.addingMode === 'warehouse') {
        data.capacity = parseFloat(document.getElementById('node-capacity').value);
        data.fixed_cost = parseFloat(document.getElementById('node-fixed-cost').value);
        data.fixed_co2 = data.capacity * 2.0;
        data.status = document.getElementById('node-status').value;
    } else {
        data.demand = parseFloat(document.getElementById('node-demand').value);
    }
    
    if (state.editingNodeId) {
        // Düzenleme (Update) modu
        let list = state.addingMode === 'warehouse' ? state.warehouses : state.retailers;
        const index = list.findIndex(n => n.id === state.editingNodeId);
        if (index > -1) {
            data.id = state.editingNodeId;
            data.marker = list[index].marker;
            
            data.marker.setLatLng([data.lat, data.lng]);
            data.marker.bindPopup(generatePopupContent(state.addingMode, data));
            
            list[index] = data;
            
            clearResults();
            document.getElementById('results-panel').classList.add('hidden');
        }
    } else {
        // Yeni ekleme modu
        addNode(state.addingMode, data);
    }
    
    closeModal();
}

// Clear visual optimization results
function clearResults() {
    state.lines.forEach(line => map.removeLayer(line));
    state.lines = [];
    
    state.warehouses.forEach(w => {
        w.marker.setIcon(createIcon('warehouse', false));
    });
}

// Function to fetch route geometry from OSRM
async function getRouteGeometry(lat1, lng1, lat2, lng2) {
    const url = `http://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
    } catch (e) {
        console.error("OSRM Route API Error", e);
    }
    // Fallback to straight line
    return [[lat1, lng1], [lat2, lng2]];
}

// Draw connection lines with elegant hover effects
async function drawAssignments(assignments) {
    const palette = ['#f4a261', '#e76f51', '#e9c46a', '#f4a261', '#2a9d8f'];
    let styleIdx = 0;

    // Reset lines array for each warehouse
    state.warehouses.forEach(w => w.routes = []);

    for (const assignment of assignments) {
        const w = state.warehouses.find(w => w.id === assignment.warehouse_id);
        const r = state.retailers.find(r => r.id === assignment.retailer_id);
        
        if (w && r) {
            // Assign a soft pastel color per warehouse
            if (!w.routeColor) {
                w.routeColor = palette[styleIdx % palette.length];
                styleIdx++;
            }

            // Update warehouse icon to opened
            w.marker.setIcon(createIcon('warehouse', true));
            
            // Fetch route geometry for actual road path
            const latlngs = await getRouteGeometry(w.lat, w.lng, r.lat, r.lng);
            
            // Base weight based on amount
            const baseWeight = Math.max(3, Math.min(7, assignment.amount / 100));
            
            const polyline = L.polyline(latlngs, {
                color: w.routeColor,
                weight: baseWeight,
                opacity: 0.7,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(map);
            
            // Store default properties for reset
            polyline.defaultWeight = baseWeight;
            polyline.defaultColor = w.routeColor;
            
            // Hover events on the polyline itself
            polyline.on('mouseover', function() {
                polyline.setStyle({ opacity: 1.0, weight: baseWeight + 4, color: '#4a4a4a' });
                polyline.bringToFront();
            });
            polyline.on('mouseout', function() {
                polyline.setStyle({ opacity: 0.7, weight: baseWeight, color: w.routeColor });
            });

            polyline.bindPopup(`<b>Gönderen Depo:</b> ${w.name}<br><b>Alan Bayi:</b> ${r.name}<br>Taşınan Miktar: ${assignment.amount}<br>Maliyet: ${assignment.cost} ₺<br>Mesafe: ${assignment.distance} km`);
            
            state.lines.push(polyline);
            w.routes.push(polyline);
        }
    }

    // Add hover events to warehouse markers to highlight all their routes
    state.warehouses.forEach(w => {
        if (w.routes && w.routes.length > 0) {
            w.marker.on('mouseover', function() {
                // Dim all lines
                state.lines.forEach(l => l.setStyle({ opacity: 0.15, color: '#ccc' }));
                // Highlight this warehouse's lines
                w.routes.forEach(l => {
                    l.setStyle({ opacity: 1.0, weight: l.defaultWeight + 2, color: l.defaultColor });
                    l.bringToFront();
                });
            });
            
            w.marker.on('mouseout', function() {
                // Reset all lines
                state.lines.forEach(l => l.setStyle({ opacity: 0.7, weight: l.defaultWeight, color: l.defaultColor }));
            });
        }
    });
}

// Update Dashboard Statistics
function updateDashboard(data) {
    document.getElementById('results-panel').classList.remove('hidden');
    
    document.getElementById('total-cost').innerText = formatCurrency(data.total_cost);
    document.getElementById('transport-cost').innerText = formatCurrency(data.total_transport_cost);
    document.getElementById('fixed-cost').innerText = formatCurrency(data.total_fixed_cost);
    document.getElementById('opened-warehouses').innerText = `${data.opened_warehouses.length} / ${state.warehouses.length}`;
    document.getElementById('total-co2').innerText = `${data.total_co2} kg`;
    document.getElementById('trees-needed').innerText = `${data.trees_needed} Ağaç / Yıl`;
    
    updateChart(data.total_fixed_cost, data.total_transport_cost);
    
    // Rota Analizi Tablosu (Maliyet & Mesafe)
    const listEl = document.getElementById('assignments-list');
    listEl.innerHTML = '';
    
    // Maliyete göre azalan şekilde sırala
    const sortedAssignments = [...data.assignments].sort((a, b) => b.cost - a.cost);
    
    sortedAssignments.forEach(assignment => {
        const w = state.warehouses.find(w => w.id === assignment.warehouse_id);
        const r = state.retailers.find(r => r.id === assignment.retailer_id);
        
        if (w && r) {
            const li = document.createElement('li');
            li.className = 'assignment-item';
            
            li.innerHTML = `
                <div class="assignment-header">
                    <span><i class="fa-solid fa-warehouse" style="color:${w.routeColor || 'var(--primary)'}"></i> ${w.name}</span>
                    <i class="fa-solid fa-arrow-right" style="color:var(--text-muted); font-size: 0.8rem;"></i>
                    <span>${r.name}</span>
                </div>
                <div class="assignment-details" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 8px;">
                    <span title="Taşınan Miktar" style="white-space: nowrap;"><i class="fa-solid fa-box"></i> ${assignment.amount} br</span>
                    <span title="Mesafe" style="white-space: nowrap;"><i class="fa-solid fa-road"></i> ${assignment.distance} km</span>
                    <span style="color:var(--danger); font-weight:600; white-space: nowrap;" title="Maliyet">${formatCurrency(assignment.cost)}</span>
                    <span style="color:var(--success); font-weight:600; white-space: nowrap;" title="Karbon Ayak İzi">CO₂: ${assignment.co2} kg</span>
                </div>
            `;
            
            // Tablodaki satırın üzerine gelince haritadaki o rotayı parlat
            li.addEventListener('mouseenter', () => {
                // Diğer tüm çizgileri soluklaştır
                state.lines.forEach(l => l.setStyle({ opacity: 0.15, color: '#ccc' }));
                
                // Bu spesifik rotayı bul
                const route = w.routes.find(line => line.getPopup().getContent().includes(r.name));
                if (route) {
                    route.setStyle({ opacity: 1.0, weight: route.defaultWeight + 4, color: '#4a3b32' });
                    route.bringToFront();
                }
            });
            
            li.addEventListener('mouseleave', () => {
                // Tüm çizgileri eski haline döndür
                state.lines.forEach(l => l.setStyle({ opacity: 0.7, weight: l.defaultWeight, color: l.defaultColor }));
            });
            
            listEl.appendChild(li);
        }
    });
}

function formatCurrency(value) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);
}

// Chart.js update
function updateChart(fixedCost, transportCost) {
    const ctx = document.getElementById('costChart').getContext('2d');
    
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }
    
    Chart.defaults.color = '#888888';
    
    state.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Sabit Maliyet', 'Taşıma Maliyeti'],
            datasets: [{
                data: [fixedCost, transportCost],
                backgroundColor: [
                    '#e9c46a', // Secondary (Soft Yellow)
                    '#f4a261'  // Primary (Warm Peach)
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#4a4a4a',
                        padding: 20,
                        usePointStyle: true
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Main API Call
async function runOptimization() {
    clearResults();
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    
    const fuelPrice = parseFloat(document.getElementById('fuel-price').value);
    const fuelConsumption = parseFloat(document.getElementById('fuel-consumption').value);
    const tollCost = parseFloat(document.getElementById('toll-cost').value);
    const truckCapacity = parseFloat(document.getElementById('truck-capacity').value);
    const objective = document.getElementById('optimization-objective').value;
    
    // 1 Kamyonun km başına maliyeti = Yakıt Maliyeti + Gişe Maliyeti
    const truckCostPerKm = (fuelConsumption / 100.0 * fuelPrice) + tollCost;
    
    // 1 birim ürünün km başına maliyeti
    const unitCost = truckCostPerKm / truckCapacity;
    
    // 1 birim ürünün km başına CO2 salınımı (1 L mazot ~2.65 kg CO2)
    const truckCo2PerKm = (fuelConsumption / 100.0) * 2.65;
    const unitCo2Emission = truckCo2PerKm / truckCapacity;
    
    const requestData = {
        warehouses: state.warehouses.map(w => ({
            id: w.id, name: w.name, lat: w.lat, lng: w.lng, capacity: w.capacity, fixed_cost: w.fixed_cost, fixed_co2: w.fixed_co2, status: w.status
        })),
        retailers: state.retailers.map(r => ({
            id: r.id, name: r.name, lat: r.lat, lng: r.lng, demand: r.demand
        })),
        unit_transport_cost: unitCost,
        objective: objective,
        unit_co2_emission: unitCo2Emission
    };

    try {
        // Change to real API endpoint
        const response = await fetch('http://127.0.0.1:8000/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) throw new Error('Sunucu hatası');
        
        const data = await response.json();
        
        if (data.status === "Optimal") {
            await drawAssignments(data.assignments);
            updateDashboard(data);
        } else {
            showErrorModal(data.message || 'Bilinmeyen hata');
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorModal('Sunucuya bağlanılamadı. Python backend\'in çalıştığından emin olun (uvicorn main:app --reload).');
    } finally {
        loading.classList.add('hidden');
    }
}

// Initialize
loadInitialData();
