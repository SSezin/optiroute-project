# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import List, Dict, Any
import math
import pulp
import urllib.request
import json

app = FastAPI(title="Lojistik Dağıtım Ağı Optimizasyonu")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Warehouse(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    capacity: float
    fixed_cost: float
    fixed_co2: float = 1000.0
    status: str = 'auto'

class Retailer(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    demand: float

class OptimizationRequest(BaseModel):
    warehouses: List[Warehouse]
    retailers: List[Retailer]
    unit_transport_cost: float  # Maliyet per km per birim
    objective: str = 'cost'
    unit_co2_emission: float = 0.0

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 # Dünya yarıçapı (km)
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance

def get_driving_distances(W, R):
    coords = [f"{w.lng},{w.lat}" for w in W] + [f"{r.lng},{r.lat}" for r in R]
    coords_string = ";".join(coords)
    sources = ";".join(map(str, range(len(W))))
    destinations = ";".join(map(str, range(len(W), len(W) + len(R))))
    
    url = f"http://router.project-osrm.org/table/v1/driving/{coords_string}?sources={sources}&destinations={destinations}&annotations=distance"
    
    distances = {}
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'LogisticsOptimizer/1.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            if data.get("code") == "Ok":
                matrix = data["distances"]
                for i, w in enumerate(W):
                    distances[w.id] = {}
                    for j, r in enumerate(R):
                        dist_km = matrix[i][j] / 1000.0
                        distances[w.id][r.id] = dist_km
                return distances
    except Exception as e:
        print(f"OSRM API hatası: {e}. Kuş uçuşu (Haversine) mesafeye dönülüyor...")
        pass
        
    # Fallback to approximated road distance (Haversine * 1.3)
    for w in W:
        distances[w.id] = {}
        for r in R:
            dist = haversine_distance(w.lat, w.lng, r.lat, r.lng)
            distances[w.id][r.id] = dist * 1.3 # Karayolu katsayısı
            
    return distances

@app.post("/optimize")
def optimize_network(req: OptimizationRequest):
    W = req.warehouses
    R = req.retailers
    
    # Gerçek karayolu mesafelerini al (OSRM API)
    distances = get_driving_distances(W, R)
    
    # Maliyet matrisini oluştur
    costs = {}
    for w in W:
        costs[w.id] = {}
        for r in R:
            costs[w.id][r.id] = distances[w.id][r.id] * req.unit_transport_cost

    # Model oluşturma
    model = pulp.LpProblem("Capacitated_Facility_Location", pulp.LpMinimize)

    # Karar değişkenleri
    # y[w]: w deposu açılırsa 1, aksi halde 0 (Binary)
    y = pulp.LpVariable.dicts("y", [w.id for w in W], 0, 1, pulp.LpBinary)
    
    # x[w][r]: w deposundan r noktasına gönderilen miktar (Continuous)
    x = pulp.LpVariable.dicts("x", ([w.id for w in W], [r.id for r in R]), 0, None, pulp.LpContinuous)

    # Amaç Fonksiyonu
    if req.objective == 'co2':
        model += (
            pulp.lpSum([w.fixed_co2 * y[w.id] for w in W]) +
            pulp.lpSum([distances[w.id][r.id] * req.unit_co2_emission * x[w.id][r.id] for w in W for r in R])
        )
    else:
        model += (
            pulp.lpSum([w.fixed_cost * y[w.id] for w in W]) +
            pulp.lpSum([costs[w.id][r.id] * x[w.id][r.id] for w in W for r in R])
        )

    # Kısıt 1: Her perakende noktasının talebi karşılanmalı
    for r in R:
        model += pulp.lpSum([x[w.id][r.id] for w in W]) == r.demand, f"Demand_Constraint_{r.id}"

    # Kısıt 2: Depo kapasitesi aşılmamalı ve açılmamış depodan gönderim yapılmamalı
    for w in W:
        model += pulp.lpSum([x[w.id][r.id] for r in R]) <= w.capacity * y[w.id], f"Capacity_Constraint_{w.id}"

    # Kısıt 3: Zorunlu depo durumları (Açık/Kapalı)
    for w in W:
        if w.status == 'open':
            model += y[w.id] == 1, f"Force_Open_{w.id}"
        elif w.status == 'closed':
            model += y[w.id] == 0, f"Force_Closed_{w.id}"

    # Modeli Çöz
    model.solve()

    status = pulp.LpStatus[model.status]
    
    if status != "Optimal":
        return {"status": status, "message": "Optimal çözüm bulunamadı. Lütfen kapasiteleri ve talepleri kontrol edin."}

    opened_warehouses = [w.id for w in W if pulp.value(y[w.id]) > 0.5]
    
    assignments = []
    total_transport_cost = 0
    total_transport_co2 = 0
    
    for w in W:
        for r in R:
            amount = pulp.value(x[w.id][r.id])
            if amount is not None and amount > 0:
                cost = amount * costs[w.id][r.id]
                co2 = distances[w.id][r.id] * req.unit_co2_emission * amount
                total_transport_cost += cost
                total_transport_co2 += co2
                assignments.append({
                    "warehouse_id": w.id,
                    "retailer_id": r.id,
                    "amount": round(amount, 2),
                    "cost": round(cost, 2),
                    "co2": round(co2, 2),
                    "distance": round(distances[w.id][r.id], 2)
                })

    total_fixed_cost = sum(w.fixed_cost for w in W if w.id in opened_warehouses)
    total_cost = total_fixed_cost + total_transport_cost
    
    total_fixed_co2 = sum(w.fixed_co2 for w in W if w.id in opened_warehouses)
    total_co2 = total_fixed_co2 + total_transport_co2
    trees_needed = int(total_co2 / 22.0) if total_co2 > 0 else 0

    return {
        "status": status,
        "total_cost": round(total_cost, 2),
        "total_fixed_cost": round(total_fixed_cost, 2),
        "total_transport_cost": round(total_transport_cost, 2),
        "total_co2": round(total_co2, 2),
        "total_fixed_co2": round(total_fixed_co2, 2),
        "total_transport_co2": round(total_transport_co2, 2),
        "trees_needed": trees_needed,
        "opened_warehouses": opened_warehouses,
        "assignments": assignments
    }
