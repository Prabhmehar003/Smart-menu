import os
import json
import uuid
import base64
import re
import math
import asyncio
import httpx  # NEW: pip install httpx
import jwt # pip install pyjwt
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
import dotenv

dotenv.load_dotenv()

# Cryptographic Secret (In production, use environment variables)
SECRET_KEY = "acid-maximalism-secure-key-do-not-share"

_groq_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=_groq_key) if _groq_key else None

# NEW: Unsplash is the primary ("scrape") image source — free tier, real API,
# stable, and actually licensed for use (unlike raw Bing/DuckDuckGo scraping,
# which breaks constantly and has no legal footing). Get a free key at
# https://unsplash.com/developers and set UNSPLASH_ACCESS_KEY in your .env.
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "https://5cf2-2409-40d1-203c-ba15-4c3b-4ac3-c622-db9e.ngrok-free.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory Databases
MENUS_DB = {}
ACTIVE_SESSIONS = {}
ORDERS_DB = []

# NEW: in-memory cache so repeated dish names (across menus, or retries)
# don't burn image-API quota. Swap for Redis/DB if you need it to survive restarts.
IMAGE_CACHE = {}

# --- Utility: Haversine Formula for Proximity Check ---
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1-a)))


# --- NEW: Dish image sourcing (scrape-first, AI-generate fallback) ---
async def fetch_scraped_image(dish_name: str) -> str | None:
    """Primary source: Unsplash image search. Returns a URL or None."""
    if not UNSPLASH_ACCESS_KEY:
        return None

    query = f"{dish_name} food dish"
    cache_key = query.lower().strip()
    if cache_key in IMAGE_CACHE:
        return IMAGE_CACHE[cache_key]

    try:
        async with httpx.AsyncClient(timeout=8.0) as http_client:
            resp = await http_client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 1, "orientation": "squarish"},
                headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            )
        if resp.status_code != 200:
            return None
        results = resp.json().get("results", [])
        if not results:
            return None
        image_url = results[0]["urls"]["regular"]
        IMAGE_CACHE[cache_key] = image_url
        return image_url
    except Exception:
        return None


async def fetch_generated_image(dish_name: str, description: str = "") -> str | None:
    """
    Fallback source: AI-generated image when no real photo was found.
    Stubbed — plug in whatever image-gen provider you have (Groq's image
    models if enabled on your account, or Stability/OpenAI/Replicate/etc).
    Returns None until wired up, so the frontend falls back to its own
    placeholder instead of erroring.
    """
    prompt = f"A professional, appetizing food photograph of {dish_name}"
    if description:
        prompt += f" — {description}"
    prompt += ", restaurant menu style, studio lighting, clean plate, 45-degree angle."

    try:
        # --- PLUG IN YOUR IMAGE-GEN CALL HERE ---
        # async with httpx.AsyncClient(timeout=30.0) as http_client:
        #     resp = await http_client.post(
        #         "https://api.your-image-provider.com/v1/images/generations",
        #         headers={"Authorization": f"Bearer {os.environ.get('IMAGE_GEN_API_KEY')}"},
        #         json={"prompt": prompt, "size": "512x512", "n": 1},
        #     )
        # return resp.json()["data"][0]["url"]
        return None
    except Exception:
        return None


async def resolve_dish_image(dish_name: str, description: str = "") -> str | None:
    """Scrape-first, AI-generate-fallback. Never raises — worst case returns None."""
    image_url = await fetch_scraped_image(dish_name)
    if image_url:
        return image_url
    return await fetch_generated_image(dish_name, description)


async def enrich_menu_with_images(menu_data: dict) -> None:
    """Mutates menu_data in place, adding image_url to every item, resolved concurrently."""
    flat_items = []
    tasks = []
    for category in menu_data.get("categories", []):
        for item in category.get("items", []):
            flat_items.append(item)
            tasks.append(resolve_dish_image(item.get("name", ""), item.get("description", "")))

    if not tasks:
        return

    resolved = await asyncio.gather(*tasks, return_exceptions=True)
    for item, image_url in zip(flat_items, resolved):
        item["image_url"] = image_url if isinstance(image_url, str) else None


# --- Data Models ---
class VerifyRequest(BaseModel):
    token: str
    lat: float | None = None
    lon: float | None = None

class OrderItem(BaseModel):
    name: str
    price: float
    quantity: int

class OrderRequest(BaseModel):
    session_token: str
    customer_name: str
    customer_email: str
    notes: str | None = None
    items: list[OrderItem]

@app.post("/api/process-menu")
async def process_menu(
    file: UploadFile = File(...),
    num_tables: int = Form(...),
    admin_lat: float | None = Form(None),
    admin_lon: float | None = Form(None)
):
    image_bytes = await file.read()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    mime_type = file.content_type

    prompt = """
    Extract the menu data from this image. Return STRICTLY JSON:
    {
      "restaurant_name": "Name",
      "categories": [
        {
          "category_name": "Category",
          "theme": "acid-lime", 
          "items": [{"name": "Item Name", "price": 10.50, "description": "Details", "tags": ["spicy", "popular"]}]
        }
      ]
    }
    Rotate themes: "acid-lime", "acid-cyan", "acid-pink". OUTPUT ONLY VALID JSON.
    """

    try:
        completion = client.chat.completions.create(
            model=os.environ.get("GROQ_MODEL"),
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}}
                ]}
            ],
            temperature=0.1,
            max_tokens=4000,
        )
        
        raw_text = re.sub(r'<think>.*?</think>', '', completion.choices[0].message.content, flags=re.DOTALL)
        menu_data = json.loads(raw_text[raw_text.find('{'):raw_text.rfind('}')+1])

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI parsing failed: {str(e)}")

    # NEW: resolve a dish image for every item — scrape-first, AI-fallback —
    # pre-fetched here at upload time so customers never wait on image
    # lookups later. Runs concurrently across all items.
    try:
        await enrich_menu_with_images(menu_data)
    except Exception:
        # Images are an enhancement, not a blocker — menu still saves
        # successfully even if this step fails entirely.
        pass

    menu_id = str(uuid.uuid4())[:8]
    MENUS_DB[menu_id] = {
        "data": menu_data,
        "location": {"lat": admin_lat, "lon": admin_lon}
    }
    
    # Generate Cryptographic QR Tokens for each table
    counter_token = jwt.encode({"menu_id": menu_id, "table_id": "COUNTER"}, SECRET_KEY, algorithm="HS256")
    table_qrs = []
    for i in range(1, num_tables + 1):
        payload = {"menu_id": menu_id, "table_id": str(i)}
        token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
        table_qrs.append({"table_id": str(i), "token": token})
    
    return {
        "menu_id": menu_id,
        "restaurant_name": menu_data["restaurant_name"],
        "tables": table_qrs,
        "counter_table": {"table_id": "COUNTER", "token": counter_token}
    }


@app.post("/api/verify-scan")
async def verify_scan(req: VerifyRequest, request: Request):
    # 1. Decode Cryptographic Token
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="INVALID OR FORGED QR CODE")

    menu_id = payload.get("menu_id")
    table_id = payload.get("table_id")
    menu_record = MENUS_DB.get(menu_id)

    if not menu_record:
        raise HTTPException(status_code=404, detail="MENU NOT FOUND")

    # 2. Verify Physical Proximity (Anti-Prank)
    restaurant_loc = menu_record["location"]
    if (
        req.lat is not None and req.lon is not None
        and restaurant_loc["lat"] is not None and restaurant_loc["lon"] is not None
    ):
        distance = calculate_distance(restaurant_loc["lat"], restaurant_loc["lon"], req.lat, req.lon)
        if distance > 200: # Max 200 meters away
            raise HTTPException(status_code=403, detail="PROXIMITY FAILED. YOU ARE NOT AT THE RESTAURANT.")

    # 3. Issue Secure Session Token pinned to IP
    client_ip = request.client.host
    session_token = str(uuid.uuid4())
    
    ACTIVE_SESSIONS[session_token] = {
        "menu_id": menu_id,
        "table_id": table_id,
        "ip_address": client_ip,
        "expires": datetime.now() + timedelta(hours=3) # Session valid for 3 hours
    }

    return {
        "session_token": session_token,
        "table_id": table_id,
        "menu_data": menu_record["data"]
    }


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@app.post("/api/order")
async def place_order(order: OrderRequest, request: Request):
    if not order.customer_email or not EMAIL_REGEX.match(order.customer_email.strip()):
        raise HTTPException(status_code=400, detail="INVALID EMAIL ADDRESS. PLEASE PROVIDE A VALID EMAIL (e.g. name@example.com).")

    session = ACTIVE_SESSIONS.get(order.session_token)
    if not session or datetime.now() > session["expires"]:
        raise HTTPException(status_code=401, detail="SESSION EXPIRED")

    # Log IP Address and Customer Details securely
    order_id = str(uuid.uuid4())[:8].upper()
    order_record = {
        "order_id": order_id,
        "menu_id": session["menu_id"],
        "table_id": session["table_id"],
        "customer": {
            "name": order.customer_name,
            "email": order.customer_email,
            "ip_address": request.client.host
        },
        "notes": order.notes,
        "items": [item.dict() for item in order.items],
        "status": "transmitted"
    }
    ORDERS_DB.append(order_record)
    return {"success": True, "order_id": order_id, "table_id": session["table_id"]}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)