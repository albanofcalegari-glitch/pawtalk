import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from ..auth import get_current_user
from ..models import User

router = APIRouter(prefix="/api/places", tags=["places"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "PawTalk/1.0 (pawtalk.com.ar)"}
SEARCH_RADIUS = 3000

CATEGORY_QUERIES = {
    "petshop": '[shop=pet]',
    "veterinaria": '[amenity=veterinary]',
    "urgencias": '[amenity=veterinary][opening_hours~"24"]',
}

CURATED_PLACES: dict[str, list[dict]] = {
    "urgencias": [
        {
            "name": "Leocan Veterinaria 24hs",
            "address": "Palermo, CABA",
            "housenumber": "",
            "phone": "",
            "website": "",
            "opening_hours": "24/7",
            "lat": -34.5809,
            "lon": -58.4236,
            "curated": True,
        },
    ],
}


async def geocode(query: str) -> tuple[float, float]:
    params = {"q": query, "format": "json", "limit": 1, "countrycodes": "ar"}
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        resp = await client.get(NOMINATIM_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    if not data:
        raise HTTPException(status_code=404, detail="No se encontró la ubicación")
    return float(data[0]["lat"]), float(data[0]["lon"])


async def search_overpass(lat: float, lon: float, category: str) -> list[dict]:
    osm_filter = CATEGORY_QUERIES.get(category)
    if not osm_filter:
        raise HTTPException(status_code=400, detail="Categoría no válida")

    query = f"""
    [out:json][timeout:10];
    (
      node{osm_filter}(around:{SEARCH_RADIUS},{lat},{lon});
      way{osm_filter}(around:{SEARCH_RADIUS},{lat},{lon});
    );
    out center tags;
    """

    async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        data = resp.json()

    results = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        lat_el = el.get("lat") or el.get("center", {}).get("lat")
        lon_el = el.get("lon") or el.get("center", {}).get("lon")
        if not lat_el or not tags.get("name"):
            continue
        results.append({
            "name": tags.get("name", ""),
            "address": tags.get("addr:street", ""),
            "housenumber": tags.get("addr:housenumber", ""),
            "phone": tags.get("phone", tags.get("contact:phone", "")),
            "website": tags.get("website", tags.get("contact:website", "")),
            "opening_hours": tags.get("opening_hours", ""),
            "lat": lat_el,
            "lon": lon_el,
        })

    results.sort(key=lambda p: ((p["lat"] - lat) ** 2 + (p["lon"] - lon) ** 2))
    return results


@router.get("/search")
async def search_places(
    category: str = Query(..., pattern="^(petshop|veterinaria|urgencias)$"),
    user: User = Depends(get_current_user),
):
    if not user.neighborhood:
        raise HTTPException(status_code=400, detail="Configurá tu barrio primero")

    lat, lon = await geocode(f"{user.neighborhood}, Argentina")
    places = await search_overpass(lat, lon, category)

    for curated in CURATED_PLACES.get(category, []):
        dist_sq = (curated["lat"] - lat) ** 2 + (curated["lon"] - lon) ** 2
        max_dist_sq = (SEARCH_RADIUS / 111_000) ** 2
        already = any(p["name"].lower() == curated["name"].lower() for p in places)
        if not already and dist_sq <= max_dist_sq:
            places.append(curated)

    places.sort(key=lambda p: ((p["lat"] - lat) ** 2 + (p["lon"] - lon) ** 2))
    return {"results": places, "center": {"lat": lat, "lon": lon}, "radius": SEARCH_RADIUS}


@router.get("/geocode")
async def geocode_neighborhood(
    q: str = Query(..., min_length=2),
    _user: User = Depends(get_current_user),
):
    lat, lon = await geocode(f"{q}, Argentina")
    return {"lat": lat, "lon": lon, "query": q}
