import os
import json
import uuid
import secrets
import base64
import re
import math
import asyncio
import logging
import httpx
import jwt
from datetime import datetime, timedelta, date, timezone
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Response, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from groq import Groq
import dotenv
import firebase_admin
from firebase_admin import auth as fb_auth, credentials
from cryptography.x509 import load_pem_x509_certificate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from db import (
    init_db, db_cursor, row_to_dict,
    get_user_by_uid, get_user_by_email, upsert_user,
    update_user_profile, upsert_provider_profile,
    save_dining_session, get_dining_session, update_dining_sessions_plan,
    get_cached_dish_image, set_cached_dish_image
)

dotenv.load_dotenv()

SECRET_KEY = os.environ.get(
    "ACID_SECRET_KEY", "acid-maximalism-secure-key-do-not-share"
)

_groq_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=_groq_key) if _groq_key else None
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY") or "vcbKY4KAfaLUO7PRGtKMyZEODdDmsepLON-pBn9RZ7I"
CLOUDFLARE_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

# ---------------------------------------------------------------------------
# Firebase Admin Initialization
# ---------------------------------------------------------------------------
if not firebase_admin._apps:
    cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"Warning: could not initialize firebase_admin with {cred_path}: {e}")
    else:
        try:
            firebase_admin.initialize_app()
        except Exception:
            # Fallback to Google Tokeninfo HTTP verification is enabled
            pass

app = FastAPI()

allowed_origins = [
    "https://smart-menu-sigma-beige.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Avatars upload directory
UPLOADS_DIR = Path(__file__).parent / "uploads"
AVATARS_DIR = UPLOADS_DIR / "avatars"
AVATARS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/avatars", StaticFiles(directory=str(AVATARS_DIR)), name="avatars")

DISHES_DIR = UPLOADS_DIR / "dishes"
DISHES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/dishes", StaticFiles(directory=str(DISHES_DIR)), name="dishes")

try:
    init_db()
except Exception as e:
    print(f"Warning: could not initialize database on startup: {e}")

async def _background_db_keepalive():
    """
    Background worker that runs every 10 minutes while backend is running.
    Keeps PostgreSQL connection pool active and registers activity with Supabase
    so the free-tier 7-day inactivity pause never triggers.
    """
    logger.info("Starting internal background DB keepalive worker (10m interval)")
    while True:
        try:
            await asyncio.sleep(600)  # 10 minutes
            with db_cursor() as cur:
                cur.execute("SELECT 1;")
            logger.info("Internal keepalive: Database ping successful")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Internal keepalive: Database ping warning: %s", e)

@app.on_event("startup")
async def on_startup():
    asyncio.create_task(_background_db_keepalive())

@app.get("/api/health")
async def health_check():
    db_status = "ok"
    try:
        with db_cursor() as cur:
            cur.execute("SELECT 1;")
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "database": db_status,
        "service": "Smart-menu backend",
        "commit": "db-auto-fallback-v2",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/keep-alive")
async def keep_alive():
    """
    High-reliability keep-alive endpoint for cron services (GitHub Actions, cron-job.org, UptimeRobot).
    Executes a direct SQL query against Supabase / PostgreSQL to prevent project pausing
    and keep Render instances warm.
    """
    start_time = datetime.now(timezone.utc)
    db_status = "ok"
    db_info = {}
    try:
        with db_cursor() as cur:
            cur.execute("SELECT 1 AS alive, current_database(), current_timestamp;")
            row = cur.fetchone()
            if row:
                if isinstance(row, dict):
                    db_info["database"] = row.get("current_database")
                    db_info["db_timestamp"] = str(row.get("current_timestamp"))
                else:
                    db_info["database"] = row[1]
                    db_info["db_timestamp"] = str(row[2])
    except Exception as e:
        db_status = f"error: {e}"

    duration_ms = round((datetime.now(timezone.utc) - start_time).total_seconds() * 1000, 2)
    return {
        "status": "alive" if db_status == "ok" else "degraded",
        "database": db_status,
        "latency_ms": duration_ms,
        "service": "Smart-menu backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **db_info
    }

# Sessions: in-memory, short-lived (3 hr TTL) backed by PostgreSQL dining_sessions.
ACTIVE_SESSIONS: dict = {}

def get_session(session_token: str) -> dict | None:
    session = ACTIVE_SESSIONS.get(session_token)
    now = datetime.now(timezone.utc)
    if session:
        exp = session.get("expires")
        if isinstance(exp, datetime):
            exp_utc = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
            if now <= exp_utc:
                return session
        else:
            return session

    # Check database fallback
    db_sess = get_dining_session(session_token)
    if db_sess:
        ACTIVE_SESSIONS[session_token] = db_sess
        return db_sess
    return None

# ---------------------------------------------------------------------------
# Real-Time Event Notifier (SSE)
# ---------------------------------------------------------------------------
class OrderEventNotifier:
    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    async def broadcast(self, data: dict) -> None:
        payload = json.dumps(data)
        for q in list(self._subscribers):
            try:
                await q.put(payload)
            except Exception:
                self._subscribers.discard(q)

ORDER_NOTIFIER = OrderEventNotifier()

@app.get("/api/events/orders")
async def stream_order_events(request: Request):
    q = ORDER_NOTIFIER.subscribe()

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            ORDER_NOTIFIER.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

# Dish-image cache
IMAGE_CACHE: dict = {}

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6_371_000  # metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Image sourcing (Unsplash -> Wikipedia Commons -> Pollinations AI fallback)
# ---------------------------------------------------------------------------

def clean_culinary_terms(name: str, category: str = ""):
    corrections = {
        "vennila": "vanilla",
        "panner": "paneer",
        "chikku": "chikoo sapodilla",
        "aanar": "pomegranate",
        "semam": "cantaloupe muskmelon",
        "pipeapple": "pineapple",
        "filed rice": "fried rice",
        "chilly": "chilli",
        "shezwan": "szechwan",
        "schezwan": "szechwan",
        "talooba": "falooda",
    }
    n = (name or "").lower()
    for wrong, right in corrections.items():
        n = re.sub(rf"\b{wrong}\b", right, n)

    clean_name = re.sub(r"\([^)]*\)", "", n)
    # Strip marketing buzzwords ONLY, while PRESERVING essential food identity terms (veg, non-veg, fresh, hot, cold, crispy, dum, etc.)
    clean_name = re.sub(
        r"\b(spl|spl\.|special|family pack|best seller|bestseller|signature|best)\b",
        "",
        clean_name,
        flags=re.IGNORECASE,
    )
    clean_name = re.sub(r"[^a-zA-Z\s]", " ", clean_name)
    clean_name = " ".join(clean_name.split()).strip() or (name or "").strip()

    clean_cat = re.sub(r"[^a-zA-Z\s]", " ", category or "").strip().lower()

    # Formulate precise category-aware query for search engines
    if any(w in clean_cat for w in ["shake", "ice cream", "dessert", "falooda"]):
        search_query = f"{clean_name} milkshake dessert"
    elif any(w in clean_cat for w in ["lime", "juice", "beverage", "drink", "soda"]):
        search_query = f"{clean_name} fresh lime juice cooler"
    elif "parotta" in clean_cat or "bread" in clean_cat or "roti" in clean_cat:
        search_query = f"{clean_name} parotta flatbread"
    elif "fried rice" in clean_cat or "rice" in clean_cat:
        search_query = f"{clean_name} fried rice wok bowl"
    elif "fish" in clean_cat or "seafood" in clean_cat:
        search_query = f"{clean_name} fish seafood dish"
    elif "mutton" in clean_cat:
        search_query = f"{clean_name} mutton meat curry dish"
    elif "chicken" in clean_cat:
        search_query = f"{clean_name} chicken culinary dish"
    elif "chinese" in clean_cat:
        search_query = f"{clean_name} Indo Chinese appetizer dish"
    elif clean_cat:
        search_query = f"{clean_name} {clean_cat} food dish"
    else:
        search_query = f"{clean_name} restaurant dish"

    return clean_name.title(), clean_cat.title(), " ".join(search_query.split())

def make_dish_slug(dish_name: str, category: str = "") -> str:
    clean_name, clean_cat, _ = clean_culinary_terms(dish_name, category)
    combined = f"{clean_cat}_{clean_name}".strip("_")
    return re.sub(r"[^a-zA-Z0-9]+", "_", combined.lower()).strip("_")[:60]

def build_cloudflare_prompt(dish_name: str, category: str = "", description: str = "") -> str:
    clean_name, clean_cat, _ = clean_culinary_terms(dish_name, category)
    name_l = (dish_name or "").strip().lower()
    cat_l = (category or "").strip().lower()
    desc_part = f", {description.strip()[:60]}" if description and len(description.strip()) > 3 else ""

    # Granular dish dictionary for exact culinary styling (prevents style drift)
    if "veg manchurian" in name_l:
        framing = "authentic Indo-Chinese veg manchurian, deep-fried crispy golden vegetable dumplings (manchurian balls) simmered in dark, glossy, savory soya-garlic-ginger gravy with chopped fresh spring onions and cilantro, served in a ceramic bowl"
    elif "gobi manchurian" in name_l:
        framing = "authentic Indo-Chinese gobi manchurian, deep-fried crispy cauliflower florets coated in glossy dark soya garlic chili manchurian sauce with chopped spring onions, ceramic serving bowl"
    elif "chilli gobi" in name_l:
        framing = "crispy cauliflower florets tossed with diced red and green bell peppers, slit green chilies, onions in spicy dark soya chili sauce, restaurant white platter"
    elif "mushroom manchurian" in name_l:
        framing = "authentic Indo-Chinese mushroom manchurian, batter-fried whole button mushrooms tossed in dark savory soya garlic sauce with green chilies and spring onions, white bowl"
    elif "fish manchurian" in name_l:
        framing = "crispy batter-fried boneless fish cubes tossed in tangy dark soya garlic manchurian gravy with chopped scallions"
    elif "chicken manchurian" in name_l:
        framing = "crispy boneless chicken bites simmered in glossy dark soya garlic manchurian gravy with spring onions, white bowl"
    elif "mushroom gravy" in name_l or "mushroom curry" in name_l or "mushroom masala" in name_l:
        framing = "rich Indian mushroom masala gravy curry, sliced button mushrooms cooked in thick spicy onion tomato brown curry, garnished with fresh cilantro, copper handi bowl with naan"
    elif "crispy veg" in name_l:
        framing = "authentic Indo-Chinese crispy fried vegetables starter, golden battered crunchy cauliflower florets baby corn and bell peppers tossed in wok with spring onions, served on a white ceramic plate with sweet chili sauce"
    elif "dragon chicken" in name_l:
        framing = "crispy batter-fried tender chicken strips tossed in fiery sweet-spicy red dragon sauce with roasted cashews and scallions, garnished on an artisan plate"
    elif "chilli chicken" in name_l:
        framing = "crispy golden boneless chicken bites tossed with crunchy bell peppers, onions, green chilies, and savory dark soya chili sauce"
    elif "szechwan chicken" in name_l or "schezwan chicken" in name_l:
        framing = "tender chicken chunks stir-fried in vibrant spicy red Szechwan pepper sauce with fresh vegetables and spring onions"
    elif "ginger chicken" in name_l:
        framing = "tender chicken pieces braised in aromatic fresh ginger garlic gravy with spring onions and fresh herbs"
    elif "shawarma roll" in name_l:
        framing = "tightly rolled warm flatbread shawarma wrap packed with seasoned sliced chicken shawarma, garlic toum sauce, and pickled cucumber, wrapped in paper"
    elif "shawarma plate" in name_l:
        framing = "abundant platter of carved seasoned roasted chicken shawarma meat with pita bread triangles, crispy french fries, creamy garlic dip, and pickles"
    elif "kothu parotta" in name_l:
        framing = "shredded layered flaky parotta stir-fried on a flat iron tava with onions, tomatoes, green chilies, spicy salna gravy and cilantro"
    elif "veechu parotta" in name_l or "open veechu" in name_l:
        framing = "large thin flaky square-folded stretched South Indian veechu parotta flatbread on a banana leaf with salna gravy"
    elif "bun parotta" in name_l:
        framing = "fluffy, thick, golden-crisp bun-shaped multi-layered parotta with aromatic chicken or vegetable salna gravy"
    elif "ceylon parotta" in name_l or "murtabak" in name_l:
        framing = "golden pan-fried stuffed Ceylon parotta filled with minced spiced meat and eggs, sliced neatly on banana leaf"
    elif "parotta" in name_l or "porotta" in name_l:
        framing = f"golden-brown flaky layered spiral South Indian {clean_name} on a fresh banana leaf, served with aromatic salna curry gravy in a small bowl"
    elif "dosa" in name_l:
        framing = f"crisp golden South Indian {clean_name} on a banana leaf served with coconut chutney, sambar, and tomato chutney"
    elif "chappathi" in name_l or "roti" in name_l:
        framing = f"soft hot puffed whole wheat {clean_name} flatbreads on a plate with fragrant curry"
    elif "idliyappam" in name_l or "idiyappam" in name_l:
        framing = "delicate steamed rice string hoppers (idiyappam) served on a banana leaf alongside a fragrant bowl of chicken gravy"
    elif "chicken gravy" in name_l or "chicken curry" in name_l:
        framing = "rich spiced chicken curry in thick onion tomato masala gravy, garnished with fresh cilantro in a serving bowl"
    elif "mutton chukka" in name_l:
        framing = "tender dry-roasted mutton chunks coated in dark roasted pepper, caramelized shallots, and curry leaf masala"
    elif "mutton chops" in name_l:
        framing = "succulent seared mutton bone chops braised in rich thick spicy Indian masala gravy"
    elif "mutton fry" in name_l or "boti fry" in name_l:
        framing = f"crispy spiced pan-fried tender {clean_name} with aromatic whole spices, curry leaves, and coriander"
    elif "fish fry" in name_l:
        framing = "South Indian spicy tava-fried fish steak with crisp red masala crust, served with lemon wedges and raw onion rings on a banana leaf"
    elif "fish curry" in name_l:
        framing = "traditional fish curry in tangy coconut tamarind spicy red gravy in an earthenware clay pot"
    elif "fish 65" in name_l:
        framing = "crispy deep-red spiced boneless fish cubes garnished with fried curry leaves and green chilies"
    elif "prawn" in name_l:
        framing = f"succulent spiced {clean_name} pan-roasted with curry leaves, onions, and aromatic masala"
    elif "schezwan fried rice" in name_l or "szechwan fried rice" in name_l:
        framing = f"spicy wok-tossed red schezwan {clean_name} with chili peppers, vibrant vegetables, and spring onions in a bowl"
    elif "fried rice" in name_l:
        framing = f"fluffy steaming wok-tossed {clean_name} with diced crisp vegetables, spring onions, and light seasoning in a ceramic bowl"
    elif "noodles" in name_l:
        framing = f"stir-fried wok noodles {clean_name} with julienned vegetables, scallions, and savory Asian sauce"
    elif "royal falooda" in name_l or "falooda" in name_l:
        framing = "tall glass of layered royal falooda dessert with rose syrup, basil seeds, silky vermicelli, chilled milk, topped with ice cream, nuts, and cherry"
    elif "spanish delite" in name_l:
        framing = "luxurious Spanish Delite ice cream sundae in a glass tulip coupe with caramel cream, praline crunch, and roasted nuts"
    elif "black current" in name_l or "blackcurrant" in name_l:
        framing = "rich purple blackcurrant milkshake in a tall glass with berry puree swirl, whipped cream, and fresh berries"
    elif "strawberry" in name_l and any(w in cat_l for w in ["shake", "ice cream", "dessert"]):
        framing = "thick frosty strawberry milkshake in a tall glass, vibrant pink color, garnished with a fresh sliced strawberry and whipped cream"
    elif "chocolate" in name_l and any(w in cat_l for w in ["shake", "ice cream", "dessert"]):
        framing = "rich chocolate milkshake in a tall soda glass, chocolate fudge drizzle, cocoa dust, and wafer stick"
    elif "butter scotch" in name_l or "butterscotch" in name_l:
        framing = "caramel butterscotch milkshake in a tall glass with butterscotch crunch praline and golden caramel swirl"
    elif "pista" in name_l and any(w in cat_l for w in ["shake", "ice cream", "dessert"]):
        framing = "creamy pastel green pistachio milkshake in a tall glass garnished with crushed roasted pistachios"
    elif "cashew" in name_l and any(w in cat_l for w in ["shake", "ice cream", "dessert"]):
        framing = "rich creamy cashew nut milkshake in a tall glass with roasted crushed cashews and honey drizzle"
    elif "cherry" in name_l and any(w in cat_l for w in ["shake", "ice cream", "dessert"]):
        framing = "creamy pink cherry milkshake in a tall glass topped with a ruby red maraschino cherry and whipped cream"
    elif "oman" in name_l and any(w in cat_l for w in ["shake", "ice cream", "dessert"]):
        framing = "rich royal Oman date and caramel milkshake blended with roasted nuts and malt, topped with thick cream"
    elif "sharjah" in name_l:
        framing = "thick traditional Sharjah banana milkshake with malt, boost, roasted cashews, and dates"
    elif "oreo" in name_l:
        framing = "creamy cookies and cream Oreo milkshake in a tall glass with crushed Oreo crumbs and a mini Oreo cookie on top"
    elif "snickers" in name_l:
        framing = "peanut caramel chocolate milkshake in a tall glass with crushed peanuts and caramel drizzle"
    elif "kitkat" in name_l:
        framing = "chocolate milkshake in a tall glass garnished with KitKat wafer finger bars and chocolate shavings"
    elif "badam" in name_l:
        framing = "warm golden saffron almond milk (badam milk) in a traditional glass garnished with slivered almonds and saffron strands"
    elif "fresh lime" in name_l or "fresh limes" in name_l:
        framing = "chilled artisan glass of sparkling fresh lime juice with ice cubes, fresh lime wheel, mint sprig, condensation on glass"
    elif "ginger lime" in name_l:
        framing = "chilled spicy ginger lime cooler in a tall glass with fresh crushed ginger, lime wheel, and ice"
    elif "mint lime" in name_l:
        framing = "refreshing green mint lime cooler with fresh muddled mint leaves, lime slices, and crushed ice"
    elif "soda lime" in name_l:
        framing = "bubbly effervescent fresh lime soda in a tall highball glass with ice and lime wheel"
    elif "blue lime" in name_l:
        framing = "vibrant electric blue curacao lime cooler in a frosted glass with lime wheel and ice"
    elif "pepper lime" in name_l:
        framing = "zesty fresh lime soda with a pinch of freshly cracked black pepper and rock salt, garnished with lime"
    elif "fruit salad" in name_l or "fruits salad" in name_l:
        framing = f"vibrant dessert bowl of fresh diced tropical fruits {clean_name} topped with sweet cream and honey"
    # Category fallback
    elif any(w in cat_l for w in ["shake", "ice cream", "dessert", "falooda"]):
        framing = f"cold refreshing dessert, tall glass of {clean_name} milkshake with creamy rich froth, fresh toppings, served with a straw and spoon"
    elif any(w in cat_l for w in ["lime", "juice", "beverage", "drink", "soda", "cooler"]):
        framing = f"chilled artisan glass of {clean_name} citrus drink, ice cubes, fresh lime slice garnish, condensation on glass"
    elif any(w in cat_l for w in ["parotta", "bread", "roti", "naan"]):
        framing = f"golden brown flaky layered {clean_name} on an authentic banana leaf, served with aromatic salna gravy in small bowl"
    elif any(w in cat_l for w in ["fried rice", "rice", "pulav", "biryani"]):
        framing = f"steaming bowl of wok-tossed {clean_name} with vibrant vegetables, spring onions, culinary restaurant plating"
    elif any(w in cat_l for w in ["fish", "seafood", "prawn"]):
        framing = f"gourmet plated {clean_name} seafood dish with lemon wedge and fresh curry leaves, coastal restaurant presentation"
    elif any(w in cat_l for w in ["mutton", "meat"]):
        framing = f"succulent roasted {clean_name} tender meat dish with rich aromatic masala gravy, garnished with coriander"
    elif any(w in cat_l for w in ["chinese", "starter", "appetizer"]):
        framing = f"authentic Indo-Chinese {clean_name} dish tossed in wok with spring onions, garnished on a white ceramic platter"
    elif any(w in cat_l for w in ["chicken"]):
        framing = f"gourmet plated {clean_name} chicken dish with aromatic spices, fresh herbs, restaurant culinary presentation"
    else:
        framing = f"gourmet plated {clean_name} {clean_cat} dish, delicious restaurant culinary presentation, white ceramic plate"

    return f"commercial food photography of {framing}{desc_part}, 4k ultra-detailed, studio food lighting, depth of field, appetizing masterpiece"

_UNSPLASH_EXHAUSTED_UNTIL = 0

async def fetch_scraped_image(dish_name: str, category: str = "") -> str | None:
    global _UNSPLASH_EXHAUSTED_UNTIL
    import time
    if not UNSPLASH_ACCESS_KEY or time.time() < _UNSPLASH_EXHAUSTED_UNTIL:
        return None
    _, _, query = clean_culinary_terms(dish_name, category)
    cache_key = f"unsplash_{re.sub(r'[^a-zA-Z0-9]', '_', query.lower())}"
    if cache_key in IMAGE_CACHE:
        return IMAGE_CACHE[cache_key]
    try:
        async with httpx.AsyncClient(timeout=2.5) as http:
            r = await http.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 1, "orientation": "squarish"},
                headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            )
        if r.status_code == 200:
            results = r.json().get("results", [])
            if results and results[0].get("urls"):
                url = results[0]["urls"].get("small") or results[0]["urls"].get("regular")
                if url:
                    IMAGE_CACHE[cache_key] = url
                    return url
        elif r.status_code in (403, 429):
            _UNSPLASH_EXHAUSTED_UNTIL = time.time() + 900
            logger.info("Unsplash free-tier rate limit (50 req/hr) hit. Auto-backing off for 15m; prioritizing Cloudflare Workers AI.")
    except Exception:
        pass
    return None

async def fetch_cloudflare_image_bytes(dish_name: str, category: str = "", description: str = "") -> bytes | None:
    """
    Tier 2 AI Generator: Uses Cloudflare Workers AI (@cf/bytedance/stable-diffusion-xl-lightning)
    Generates studio-grade culinary photography, strictly customized by category and dish name.
    """
    if not CLOUDFLARE_ACCOUNT_ID or not CLOUDFLARE_API_TOKEN:
        return None

    prompt = build_cloudflare_prompt(dish_name, category, description)
    url = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning"
    headers = {
        "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.post(url, headers=headers, json={"prompt": prompt})
            if r.status_code == 200 and r.content:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(r.content))
                extrema = img.getextrema()
                if all(e[0] == 0 and e[1] == 0 for e in extrema):
                    clean_name, clean_cat, _ = clean_culinary_terms(dish_name, category)
                    r_retry = await client.post(
                        url,
                        headers=headers,
                        json={"prompt": f"delicious {clean_name} {clean_cat} dish, appetizing restaurant food photography"}
                    )
                    if r_retry.status_code == 200 and r_retry.content:
                        img = Image.open(io.BytesIO(r_retry.content))
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                img = img.resize((512, 512), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=84, optimize=True)
                val = buf.getvalue()
                if len(val) > 4000:
                    return val
            else:
                logger.warning("Cloudflare AI generation status %s for '%s' in '%s'", r.status_code, dish_name, category)
    except Exception as e:
        logger.warning("Cloudflare AI generation error for '%s' in '%s': %s", dish_name, category, e)

    return None

async def resolve_dish_image(dish_name: str, category: str = "", description: str = "") -> str | None:
    dish_clean = (dish_name or "").strip()
    if not dish_clean:
        return None
    slug = make_dish_slug(dish_clean, category)
    if slug in IMAGE_CACHE:
        return IMAGE_CACHE[slug]

    # 1. Check persistent DB cache first (0 network latency)
    cached = get_cached_dish_image(slug)
    if cached:
        if cached.get("image_url") and not any(w in cached["image_url"] for w in ["wikimedia", "wikipedia"]):
            IMAGE_CACHE[slug] = cached["image_url"]
            return cached["image_url"]
        if cached.get("image_bytes"):
            url = f"/api/dishes/image?name={urllib.parse.quote(dish_clean)}&category={urllib.parse.quote(category)}&v=2"
            IMAGE_CACHE[slug] = url
            return url

    # 2. Check local disk cache
    out_file = DISHES_DIR / f"{slug}.jpg"
    if out_file.exists() and out_file.stat().st_size > 500:
        url = f"/api/dishes/image?name={urllib.parse.quote(dish_clean)}&category={urllib.parse.quote(category)}&v=2"
        IMAGE_CACHE[slug] = url
        return url

    # 3. Check Tier 1: Unsplash search (for common generic food items)
    url = await fetch_scraped_image(dish_clean, category)
    if url:
        set_cached_dish_image(slug, image_url=url)
        IMAGE_CACHE[slug] = url
        return url

    # Default to high-speed dynamic endpoint (backed by Cloudflare Workers AI + disk/DB cache)
    url = f"/api/dishes/image?name={urllib.parse.quote(dish_clean)}&category={urllib.parse.quote(category)}&v=2"
    IMAGE_CACHE[slug] = url
    return url

async def enrich_menu_with_images(menu_data: dict) -> None:
    flat_items = []
    for cat in menu_data.get("categories", []):
        cat_name = cat.get("category_name", "")
        for item in cat.get("items", []):
            flat_items.append((item, cat_name))
    if not flat_items:
        return

    semaphore = asyncio.Semaphore(10)

    async def _resolve_with_sem(item, cat_name):
        async with semaphore:
            return await resolve_dish_image(item.get("name", ""), cat_name, item.get("description", ""))

    tasks = [_resolve_with_sem(item, cat_name) for item, cat_name in flat_items]
    resolved = await asyncio.gather(*tasks, return_exceptions=True)

    seen_urls = set()
    import urllib.parse
    for (item, cat_name), url in zip(flat_items, resolved):
        if isinstance(url, str) and url.startswith("http") and url not in seen_urls and not any(w in url for w in ["wikimedia", "wikipedia"]):
            seen_urls.add(url)
            item["image_url"] = url
        else:
            item["image_url"] = f"/api/dishes/image?name={urllib.parse.quote(item.get('name', ''))}&category={urllib.parse.quote(cat_name)}&v=2"


@app.get("/api/dishes/image")
async def get_dish_image_stream(
    name: str = Query(...),
    category: str = Query(""),
    description: str = Query(""),
    v: str = Query("")
):
    """
    On-demand dish image endpoint with Category + Name precision.
    1. Local disk cache (0ms)
    2. Neon PostgreSQL DB cache (10ms)
    3. Unsplash match with Category + Name (~100ms)
    4. Cloudflare Workers AI generation with Category + Name prompt (~1.5s)
    """
    slug = make_dish_slug(name, category)
    raw_slug = re.sub(r"[^a-zA-Z0-9]+", "_", f"{category}_{name}".lower()).strip("_")[:60]
    candidate_slugs = [slug] if slug == raw_slug else [slug, raw_slug]

    out_file = DISHES_DIR / f"{slug}.jpg"

    # 1. Local disk cache (0ms)
    for s in candidate_slugs:
        f = DISHES_DIR / f"{s}.jpg"
        if f.exists() and f.stat().st_size > 500:
            return Response(
                content=f.read_bytes(),
                media_type="image/jpeg",
                headers={"Cache-Control": "public, max-age=31536000, immutable"},
            )

    # 2. Check persistent PostgreSQL DB cache (10ms)
    cached = None
    matched_slug = slug
    for s in candidate_slugs:
        cached = get_cached_dish_image(s)
        if cached:
            matched_slug = s
            break

    if cached:
        # Ignore legacy wikipedia/wikimedia entries
        if cached.get("image_url") and not any(w in cached["image_url"] for w in ["wikimedia", "wikipedia"]):
            return Response(
                status_code=302,
                headers={"Location": cached["image_url"], "Cache-Control": "public, max-age=31536000, immutable"},
            )
        if cached.get("image_bytes"):
            raw = bytes(cached["image_bytes"])
            try:
                (DISHES_DIR / f"{matched_slug}.jpg").write_bytes(raw)
            except Exception:
                pass
            return Response(
                content=raw,
                media_type=cached.get("mime_type") or "image/jpeg",
                headers={"Cache-Control": "public, max-age=31536000, immutable"},
            )

    # 3. Check Unsplash with Category + Name (~100ms)
    unsplash_url = await fetch_scraped_image(name, category)
    if unsplash_url:
        set_cached_dish_image(slug, image_url=unsplash_url)
        return Response(
            status_code=302,
            headers={"Location": unsplash_url, "Cache-Control": "public, max-age=31536000, immutable"},
        )

    # 4. Cloudflare Workers AI generation with Category + Name framing (~1.5s)
    cf_bytes = await fetch_cloudflare_image_bytes(name, category, description)
    if cf_bytes:
        try:
            out_file.write_bytes(cf_bytes)
        except Exception:
            pass
        set_cached_dish_image(slug, image_bytes=cf_bytes, mime_type="image/jpeg")
        return Response(
            content=cf_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    raise HTTPException(status_code=404, detail="Image not available")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class VerifyRequest(BaseModel):
    token: str
    lat: float | None = None
    lon: float | None = None
    src: str | None = "qr"

class ResolveTableRequest(BaseModel):
    code: str
    src: str | None = "qr"
    lat: float | None = None
    lon: float | None = None

class TableRenameRequest(BaseModel):
    new_name: str
    menu_id: str | None = None

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

class OrderStatusUpdate(BaseModel):
    status: str

VALID_ORDER_STATUSES = {"transmitted", "preparing", "ready", "served", "cancelled"}

class SettingsUpdate(BaseModel):
    restaurant_name: str | None = None
    lat: float | None = None
    lon: float | None = None
    geofence_enabled: bool | None = None
    geofence_radius: float | None = None
    clear_geofence: bool | None = None
    default_theme: str | None = None
    currency: str | None = None
    tax_rate: float | None = None
    service_charge: float | None = None
    phone: str | None = None
    address: str | None = None
    plan: str | None = None

# ---------------------------------------------------------------------------
# Auth Pydantic Models & Helpers
# ---------------------------------------------------------------------------

class AuthSessionRequest(BaseModel):
    idToken: str
    name: str | None = None
    role: str | None = "client"
    deviceType: str | None = "web"
    deviceName: str | None = None
    mode: str | None = "signin"

class CompleteProfileRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    phoneNumber: str | None = None
    countryCode: str | None = None
    addressLine: str | None = None
    city: str | None = None
    region: str | None = None  # state
    country: str | None = None
    postalCode: str | None = None
    avatarUrl: str | None = None
    # Restaurant details
    restaurantName: str | None = None
    restaurantPhone: str | None = None
    restaurantAddress: str | None = None
    # Billing
    currency: str | None = "USD"
    taxRate: float | None = 0.0
    serviceCharge: float | None = 0.0
    # Plan
    plan: str | None = "basic"
    # Legacy fields
    businessName: str | None = None
    bio: str | None = None
    yearsExperience: int | float | None = None
    hourlyRate: float | None = None
    licenseNumber: str | None = None
    serviceRadiusKm: float | None = None

GOOGLE_CERTS_CACHE = {"certs": {}, "expires_at": 0}

async def verify_firebase_token(id_token: str) -> dict:
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing Firebase idToken.")

    api_key = os.environ.get("VITE_FIREBASE_API_KEY") or os.environ.get("FIREBASE_API_KEY") or "AIzaSyDpjOZ_o7viN21m31lQxQxWsijaiaOiRUU"
    project_id = os.environ.get("VITE_FIREBASE_PROJECT_ID", "smart-menu5588")

    # 1. Google Firebase Identity Toolkit REST API (works directly with Firebase Web API key)
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as http:
                resp = await http.post(
                    f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}",
                    json={"idToken": id_token},
                )
                if resp.status_code == 200:
                    users = resp.json().get("users", [])
                    if users:
                        u = users[0]
                        return {
                            "uid": u.get("localId"),
                            "email": u.get("email", ""),
                            "name": u.get("displayName", ""),
                            "picture": u.get("photoUrl", ""),
                        }
                elif resp.status_code == 400:
                    err_data = resp.json().get("error", {})
                    err_msg = err_data.get("message", "INVALID_ID_TOKEN")
                    if err_msg in ("TOKEN_EXPIRED", "EXPIRED_ID_TOKEN"):
                        raise HTTPException(status_code=401, detail="Firebase session expired. Please sign in again.")
                    # For other cases (e.g. newly provisioned or just-deleted accounts), fall through to cert verification
        except HTTPException:
            raise
        except Exception:
            # Fall through to certificate verification
            pass

    # 2. Cryptographic signature verification using Google's public x509 certs
    try:
        unverified_headers = jwt.get_unverified_header(id_token)
        kid = unverified_headers.get("kid")
        if kid:
            now = datetime.utcnow().timestamp()
            if not GOOGLE_CERTS_CACHE["certs"] or GOOGLE_CERTS_CACHE["expires_at"] < now:
                async with httpx.AsyncClient(timeout=10.0) as http:
                    c_resp = await http.get("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")
                    if c_resp.status_code == 200:
                        GOOGLE_CERTS_CACHE["certs"] = c_resp.json()
                        GOOGLE_CERTS_CACHE["expires_at"] = now + 3600

            certs = GOOGLE_CERTS_CACHE["certs"]
            if kid in certs:
                cert = load_pem_x509_certificate(certs[kid].encode("utf-8"))
                pub_key = cert.public_key()
                payload = jwt.decode(
                    id_token,
                    pub_key,
                    algorithms=["RS256"],
                    audience=project_id,
                    issuer=f"https://securetoken.google.com/{project_id}",
                    options={"verify_exp": True},
                )
                return {
                    "uid": payload.get("sub"),
                    "email": payload.get("email", ""),
                    "name": payload.get("name", ""),
                    "picture": payload.get("picture", ""),
                }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Firebase token has expired. Please sign in again.")
    except HTTPException:
        raise
    except Exception:
        pass

    # 3. Fallback to Firebase Admin SDK if service account is active
    if firebase_admin._apps:
        try:
            decoded = fb_auth.verify_id_token(id_token)
            return {
                "uid": decoded["uid"],
                "email": decoded.get("email", ""),
                "name": decoded.get("name") or decoded.get("displayName", ""),
                "picture": decoded.get("picture", ""),
            }
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token.")


def get_current_user_from_request(request: Request) -> dict:
    # Check cookies first
    token = request.cookies.get("acid_jwt") or request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")

    # 1. Try decoding backend session token (HS256)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        uid = payload.get("uid")
        if uid:
            user = get_user_by_uid(uid)
            if user:
                return user
    except jwt.ExpiredSignatureError:
        pass
    except Exception:
        pass

    # 2. Fallback: try decoding Firebase ID token
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        uid = unverified.get("user_id") or unverified.get("sub")
        if uid:
            user = get_user_by_uid(uid)
            if not user and unverified.get("email"):
                user = get_user_by_email(unverified.get("email"))
            if user:
                return user
            # Auto-provision user record if not present
            name = unverified.get("name") or "Restaurateur"
            email = unverified.get("email") or f"{uid}@firebase.user"
            user = upsert_user(uid=uid, email=email, name=name, role="provider")
            if user:
                return user
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")

# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/session")
async def create_auth_session(body: AuthSessionRequest, response: Response):
    firebase_user = await verify_firebase_token(body.idToken)
    uid = firebase_user["uid"]
    email = firebase_user.get("email") or f"{uid}@firebase.user"
    name = body.name or firebase_user.get("name")
    avatar_url = firebase_user.get("picture")

    # Check if user already exists in database
    existing = get_user_by_uid(uid) or (get_user_by_email(email) if email else None)

    # An account is only truly registered if the user has completed registration (has restaurant setup)
    is_account_created = existing is not None and bool(existing.get("restaurant_name"))

    # If user is trying to SIGN IN, but account has not been created yet:
    if body.mode == "signin" and not is_account_created:
        return {
            "success": False,
            "userExists": False,
            "message": "No account found. Please create an account first.",
            "googleUser": {
                "uid": uid,
                "email": email,
                "name": name,
                "avatarUrl": avatar_url,
            },
        }

    role = existing["role"] if (existing and existing.get("role")) else (body.role or "provider")

    user = upsert_user(
        uid=uid,
        email=email,
        name=name,
        role=role,
        avatar_url=avatar_url or (existing.get("avatar_url") if existing else None),
        device_type=body.deviceType,
        device_name=body.deviceName,
    )

    # Generate session JWT
    exp = datetime.utcnow() + timedelta(days=7)
    token = jwt.encode(
        {"uid": user["uid"], "email": user["email"], "role": user["role"], "exp": exp},
        SECRET_KEY,
        algorithm="HS256",
    )

    # Set HTTP-only cookies (SameSite=None; Secure for modern HTTPS cross-site support)
    is_prod = bool(os.environ.get("RENDER") or os.environ.get("PORT"))
    samesite_val = "none" if is_prod else "lax"
    secure_val = True if is_prod else False

    response.set_cookie(
        key="acid_jwt",
        value=token,
        httponly=True,
        max_age=86400 * 7,
        samesite=samesite_val,
        secure=secure_val,
    )
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=86400 * 7,
        samesite=samesite_val,
        secure=secure_val,
    )

    return {
        "success": True,
        "userExists": True,
        "token": token,
        "user": user,
    }

@app.post("/api/auth/complete-profile")
async def complete_profile(body: CompleteProfileRequest, request: Request):
    user = get_current_user_from_request(request)
    uid = user["uid"]

    profile_data = body.model_dump(exclude_unset=True)
    updated_user = update_user_profile(uid, profile_data)

    if body.plan:
        plan_val = body.plan.lower()
        _set_setting_val("plan", plan_val)
        with db_cursor(commit=True) as cur:
            cur.execute("UPDATE menus SET plan = %s WHERE user_id = %s", (plan_val, uid))
        update_dining_sessions_plan(plan_val, uid)
        for s in ACTIVE_SESSIONS.values():
            if s.get("user_id") == uid:
                s["plan"] = plan_val

    if user.get("role") == "provider" or body.businessName or body.hourlyRate:
        upsert_provider_profile(uid, profile_data)

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "user": updated_user,
    }

@app.post("/api/auth/avatar")
async def upload_avatar(avatar: UploadFile = File(...)):
    if not avatar.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    ext = Path(avatar.filename or "avatar.png").suffix or ".png"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = AVATARS_DIR / safe_name

    contents = await avatar.read()
    dest_path.write_bytes(contents)

    avatar_url = f"/static/avatars/{safe_name}"
    return {
        "success": True,
        "avatarUrl": avatar_url,
    }

@app.get("/api/auth/me")
async def get_me(request: Request):
    user = get_current_user_from_request(request)
    return {"user": user}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="acid_jwt")
    response.delete_cookie(key="session_token")
    return {"success": True, "message": "Logged out successfully."}



# ---------------------------------------------------------------------------
# Settings helpers (DRY)
# ---------------------------------------------------------------------------

def _upsert_setting(cur, key: str, value: str):
    cur.execute(
        "INSERT INTO settings (key, value) VALUES (%s, %s) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, str(value)),
    )

def _get_setting_val(key: str) -> str | None:
    try:
        with db_cursor() as cur:
            cur.execute("SELECT value FROM settings WHERE key = %s", (key,))
            row = cur.fetchone()
            return row["value"] if row else None
    except Exception:
        return None

def _set_setting_val(key: str, value: str) -> None:
    try:
        with db_cursor(commit=True) as cur:
            _upsert_setting(cur, key, str(value))
    except Exception:
        pass

def _build_user_settings_response(user: dict | None, latest_menu: dict | None) -> dict:
    tax = user.get("tax_rate") if user else 0.0
    sc = user.get("service_charge") if user else 0.0
    lat = user.get("lat") if user and user.get("lat") is not None else (latest_menu["lat"] if latest_menu else None)
    lon = user.get("lon") if user and user.get("lon") is not None else (latest_menu["lon"] if latest_menu else None)
    geofence_val = _get_setting_val("geofence_enabled")
    geofence_enabled = geofence_val is not None and geofence_val.lower() in ("true", "1", "yes")
    geofence_radius = float(_get_setting_val("geofence_radius") or 1000)

    return {
        "restaurant_name": (user.get("restaurant_name") if user else None) or (latest_menu["restaurant_name"] if latest_menu else "Smart Menu"),
        "lat": float(lat) if lat is not None else None,
        "lon": float(lon) if lon is not None else None,
        "geofence_enabled": geofence_enabled,
        "geofence_radius": geofence_radius,
        "menu_id": latest_menu["menu_id"] if latest_menu else None,
        "default_theme": (user.get("default_theme") if user else None) or "amber-gold",
        "currency": (user.get("currency") if user else None) or "USD",
        "tax_rate": float(tax) if tax is not None else 0.0,
        "service_charge": float(sc) if sc is not None else 0.0,
        "phone": user.get("restaurant_phone") if user else None,
        "address": user.get("restaurant_address") if user else None,
        "plan": ((user.get("plan") if user else None) or "basic").lower(),
    }


# ---------------------------------------------------------------------------
# Menu upload + QR generation
# ---------------------------------------------------------------------------

def clean_and_parse_json(content: str) -> dict:
    """
    Ultra-resilient JSON parser that handles LLM response quirks:
    - Reasoning/think tags (<think>...</think>)
    - Markdown code fences (```json ... ```)
    - Unescaped internal quotes inside descriptions
    - Trailing commas before brackets/braces
    - Missing commas between consecutive objects or keys
    - Token cutoffs / truncated JSON
    - Fallback regex extraction of dishes
    """
    if not content or not content.strip():
        raise ValueError("AI model returned an empty response.")

    # 1. Strip reasoning and think tags
    text = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    
    # 2. Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE).strip()

    # 3. Locate outermost JSON structure
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end+1]
    elif start != -1:
        candidate = text[start:]
    else:
        candidate = text

    # Pass 1: Direct standard parse
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict) and "categories" in parsed:
            return parsed
    except Exception:
        pass

    # Pass 2: Clean trailing commas
    cleaned = re.sub(r",\s*([\]}])", r"\1", candidate)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "categories" in parsed:
            return parsed
    except Exception:
        pass

    # Pass 3: Fix missing commas between objects / arrays
    cleaned = re.sub(r"}\s*\{", "}, {", cleaned)
    cleaned = re.sub(r"]\s*\[", "], [", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "categories" in parsed:
            return parsed
    except Exception:
        pass

    # Pass 4: Fix unescaped internal quotes inside strings (e.g. 12" Pizza)
    cleaned_quotes = re.sub(r"(?<=[a-zA-Z0-9])\"(?=[a-zA-Z0-9\s])", r"\\\"", cleaned)
    try:
        parsed = json.loads(cleaned_quotes)
        if isinstance(parsed, dict) and "categories" in parsed:
            return parsed
    except Exception:
        pass

    # Helper: Balance JSON brackets and braces using stack
    def _balance_json(s: str) -> str:
        stack = []
        in_str = False
        escaped = False
        for char in s:
            if char == '"' and not escaped:
                in_str = not in_str
            elif not in_str:
                if char in "{[":
                    stack.append("}" if char == "{" else "]")
                elif char in "}]" and stack and stack[-1] == char:
                    stack.pop()
            escaped = (char == "\\" and not escaped)
        res = s + ('"' if in_str else '')
        res = re.sub(r",\s*$", "", res)
        closing = "".join(reversed(stack))
        return res + closing

    # Pass 5: Handle truncated JSON via bracket stack recovery
    last_item_brace = cleaned.rfind("}")
    if last_item_brace != -1:
        prefix = cleaned[:last_item_brace+1]
        repaired = _balance_json(prefix)
        repaired = re.sub(r",\s*([\]}])", r"\1", repaired)
        try:
            parsed = json.loads(repaired)
            if isinstance(parsed, dict) and "categories" in parsed:
                return parsed
        except Exception:
            pass

    # Pass 6: Fallback regex extractor for items & categories
    items = []
    item_matches = re.finditer(r"\"name\"\s*:\s*\"([^\"]+)\"\s*,\s*\"price\"\s*:\s*([0-9.]+)", candidate)
    for m in item_matches:
        name = m.group(1).strip()
        try:
            price = float(m.group(2))
        except Exception:
            price = 0.0
        items.append({"name": name, "price": price, "description": "", "tags": ["popular"]})
    
    if items:
        rest_match = re.search(r"\"restaurant_name\"\s*:\s*\"([^\"]+)\"", candidate)
        rest_name = rest_match.group(1) if rest_match else "Smart Menu"
        return {
            "restaurant_name": rest_name,
            "categories": [
                {
                    "category_name": "Main Menu",
                    "theme": "acid-lime",
                    "items": items
                }
            ]
        }

    raise ValueError(f"Could not parse valid JSON from AI response: {candidate[:150]}...")


@app.post("/api/process-menu")
async def process_menu(
    request: Request,
    file: UploadFile = File(...),
    num_tables: int = Form(...),
    admin_lat: float | None = Form(None),
    admin_lon: float | None = Form(None),
):
    user = get_current_user_from_request(request)

    image_bytes = await file.read()
    mime_type = file.content_type or "image/jpeg"

    # Optimize and resize high-res smartphone photos while preserving small menu typography
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        max_dim = 3000
        if img.width > max_dim or img.height > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=90, optimize=True)
            image_bytes = buf.getvalue()
            mime_type = "image/jpeg"
    except Exception as img_prep_err:
        logger.warning("Image pre-processing notice: %s", img_prep_err)

    base64_image = base64.b64encode(image_bytes).decode()

    system_prompt = (
        "You are an expert restaurant menu digitizer and professional OCR engine. "
        "Your task is to extract 100% of all menu items from the image with complete completeness. "
        "Never omit, summarize, truncate, or drop any dishes, drinks, or sections. "
        "Output strictly valid JSON matching the requested schema."
    )

    prompt = """
    Extract the COMPLETE and EXHAUSTIVE menu data from this image.

    CRITICAL REQUIREMENTS (NO DISHES LEFT BEHIND):
    1. EXHAUSTIVE EXTRACTION (100% of items):
       - Extract EVERY SINGLE food, beverage, combo, appetizer, main, side, bread, and dessert item shown anywhere on the menu.
       - Scan every column (left, center, right), every section, box, header, and footer.
       - DO NOT skip, summarize, or abbreviate any dishes.

    2. CATEGORIZATION:
       - Group every item under its explicit category printed on the menu (e.g., "Starters", "Biryani", "Curries", "Breads", "Desserts", "Beverages", "Milk Shake & Ice Cream").
       - If items are listed without an explicit header, group them logically into an appropriate section.

    3. PRICES & VARIANTS:
       - Extract the numeric price (e.g. 150 from "150/-" or "Rs 150" or "$12.50"). If no price is visible, use 0.0.
       - If multiple sizes are listed (e.g. Half / Full or Small / Large), create a separate entry for each size variation (e.g. "Chicken Biryani (Half)" and "Chicken Biryani (Full)").

    4. TOKEN EFFICIENCY:
       - Keep "description" strictly to what is printed on the menu; if none is printed, use "" (empty string). Do NOT write long generated paragraphs. This guarantees that all dishes on the menu fit within the response without truncation.

    Return STRICTLY valid JSON conforming to this schema:
    {
      "restaurant_name": "Restaurant Name",
      "categories": [
        {
          "category_name": "Category Name",
          "theme": "acid-lime",
          "items": [
            {
              "name": "Exact Dish Name",
              "price": 10.50,
              "description": "",
              "tags": ["popular"]
            }
          ]
        }
      ]
    }
    Rotate themes: "acid-lime", "acid-cyan", "acid-pink".
    OUTPUT STRICTLY VALID JSON.
    """

    try:
        if not client:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured on the server")
        model_name = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
        max_tokens_val = int(os.environ.get("GROQ_MAX_TOKENS", "8192"))

        messages_payload = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_image}"
                        },
                    },
                ],
            },
        ]

        # Try with response_format={"type": "json_object"} first for strict grammar constraint
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=messages_payload,
                temperature=0.05,
                max_tokens=max_tokens_val,
                response_format={"type": "json_object"},
            )
        except Exception as json_format_err:
            logger.info("Retrying completion without response_format constraint: %s", json_format_err)
            completion = client.chat.completions.create(
                model=model_name,
                messages=messages_payload,
                temperature=0.05,
                max_tokens=max_tokens_val,
            )

        content = completion.choices[0].message.content or ""
        menu_data = clean_and_parse_json(content)

        # Ensure minimal required fields exist
        if not isinstance(menu_data, dict):
            menu_data = {"restaurant_name": "Smart Menu", "categories": []}
        if "categories" not in menu_data or not isinstance(menu_data["categories"], list):
            menu_data["categories"] = []

    except Exception as e:
        logger.error("AI menu parsing failed: %s", e)
        raise HTTPException(status_code=500, detail=f"AI parsing failed: {e}")

    try:
        await enrich_menu_with_images(menu_data)
    except Exception as img_err:
        logger.warning("Could not enrich menu with images: %s", img_err)

    menu_id = str(uuid.uuid4())[:8]
    table_qrs = []

    # Use restaurant_name from user profile if set, or parsed from menu
    rest_name = user.get("restaurant_name") or menu_data.get("restaurant_name") or "Smart Menu Restaurant"
    menu_data["restaurant_name"] = rest_name
    user_plan = (user.get("plan") or _get_setting_val("plan") or "basic").lower()

    geofence_setting = _get_setting_val("geofence_enabled")
    is_geofence_enabled = geofence_setting is not None and geofence_setting.lower() in ("true", "1", "yes")
    saved_lat = admin_lat if is_geofence_enabled else None
    saved_lon = admin_lon if is_geofence_enabled else None

    with db_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO menus (menu_id, user_id, restaurant_name, data_json, lat, lon, plan) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (menu_id, user["uid"], rest_name, json.dumps(menu_data),
             saved_lat, saved_lon, user_plan),
        )
        # Service Window / Counter QR code
        counter_code = secrets.token_hex(3)
        counter_token = jwt.encode(
            {"menu_id": menu_id, "table_id": "COUNTER"}, SECRET_KEY, algorithm="HS256"
        )
        cur.execute(
            "INSERT INTO tables (token, menu_id, table_id, short_code, table_name) VALUES (%s, %s, %s, %s, %s)",
            (counter_token, menu_id, "COUNTER", counter_code, "Central Service Window"),
        )

        for i in range(1, num_tables + 1):
            t_code = secrets.token_hex(3)
            token = jwt.encode(
                {"menu_id": menu_id, "table_id": str(i)}, SECRET_KEY, algorithm="HS256"
            )
            cur.execute(
                "INSERT INTO tables (token, menu_id, table_id, short_code, table_name) VALUES (%s, %s, %s, %s, %s)",
                (token, menu_id, str(i), t_code, f"Table {i}"),
            )
            table_qrs.append({
                "table_id": str(i),
                "table_name": f"Table {i}",
                "token": token,
                "short_code": t_code,
            })

    # Sync lat/lon or restaurant_name into user record if user didn't have them
    user_updates = {}
    if admin_lat is not None and user.get("lat") is None:
        user_updates["lat"] = admin_lat
    if admin_lon is not None and user.get("lon") is None:
        user_updates["lon"] = admin_lon
    if not user.get("restaurant_name") and rest_name:
        user_updates["restaurant_name"] = rest_name
    if user_updates:
        try:
            update_user_profile(user["uid"], user_updates)
        except Exception as e:
            logger.warning("Could not sync user profile in process_menu: %s", e)

    return {
        "menu_id": menu_id,
        "restaurant_name": rest_name,
        "tables": table_qrs,
        "counter_table": {
            "table_id": "COUNTER",
            "table_name": "Central Service Window",
            "token": counter_token,
            "short_code": counter_code,
        },
        "menu_data": menu_data,
    }


@app.get("/api/menus/{menu_id}")
async def get_menu_by_id(menu_id: str):
    """
    Public menu retrieval endpoint to fetch up-to-date dish data and image URLs.
    """
    with db_cursor(commit=False) as cur:
        cur.execute(
            "SELECT menu_id, restaurant_name, data_json, plan FROM menus WHERE menu_id = %s LIMIT 1",
            (menu_id,)
        )
        row = row_to_dict(cur.fetchone())
    if not row:
        raise HTTPException(status_code=404, detail="Menu not found")
    return {
        "menu_id": row["menu_id"],
        "restaurant_name": row["restaurant_name"],
        "plan": row.get("plan"),
        "data": json.loads(row["data_json"]),
    }


# ---------------------------------------------------------------------------
# Tables — persist + reset + rename + proxy
# ---------------------------------------------------------------------------

@app.get("/api/tables/current")
async def tables_current(request: Request):
    user = get_current_user_from_request(request)
    with db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT menu_id, restaurant_name FROM menus WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (user["uid"],)
        )
        latest_menu = row_to_dict(cur.fetchone())

        if not latest_menu:
            return {"menu_id": None, "restaurant_name": user.get("restaurant_name"), "tables": [], "counter_table": None}

        cur.execute(
            "SELECT id, table_id, token, short_code, table_name FROM tables WHERE menu_id = %s",
            (latest_menu["menu_id"],),
        )
        all_rows = [row_to_dict(r) for r in cur.fetchall()]

        counter_table = None
        tables = []
        for r in all_rows:
            if not r.get("short_code"):
                r["short_code"] = secrets.token_hex(3)
                r["table_name"] = "Central Service Window" if r["table_id"] == "COUNTER" else f"Table {r['table_id']}"
                cur.execute(
                    "UPDATE tables SET short_code = %s, table_name = COALESCE(table_name, %s) WHERE token = %s",
                    (r["short_code"], r["table_name"], r["token"]),
                )
            if not r.get("table_name"):
                r["table_name"] = "Central Service Window" if r["table_id"] == "COUNTER" else f"Table {r['table_id']}"

            if r["table_id"] == "COUNTER":
                counter_table = r
            else:
                tables.append(r)

        # Sort numeric tables
        tables.sort(key=lambda t: int(t["table_id"]) if t["table_id"].isdigit() else 999)

        # If counter_table missing for an old menu, auto-generate and insert it
        if not counter_table:
            counter_code = secrets.token_hex(3)
            counter_token = jwt.encode(
                {"menu_id": latest_menu["menu_id"], "table_id": "COUNTER"}, SECRET_KEY, algorithm="HS256"
            )
            cur.execute(
                "INSERT INTO tables (token, menu_id, table_id, short_code, table_name) VALUES (%s, %s, %s, %s, %s)",
                (counter_token, latest_menu["menu_id"], "COUNTER", counter_code, "Central Service Window"),
            )
            counter_table = {
                "table_id": "COUNTER",
                "table_name": "Central Service Window",
                "token": counter_token,
                "short_code": counter_code,
            }

    return {
        "menu_id": latest_menu["menu_id"],
        "restaurant_name": latest_menu["restaurant_name"],
        "tables": tables,
        "counter_table": counter_table,
    }

@app.post("/api/tables/reset")
async def tables_reset(request: Request):
    user = get_current_user_from_request(request)
    with db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT menu_id, restaurant_name FROM menus WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (user["uid"],)
        )
        latest_menu = row_to_dict(cur.fetchone())
        if not latest_menu:
            raise HTTPException(status_code=404, detail="NO MENU FOUND")

        menu_id = latest_menu["menu_id"]
        cur.execute(
            "SELECT id, table_id, short_code, table_name FROM tables WHERE menu_id = %s",
            (menu_id,),
        )
        rows = [row_to_dict(r) for r in cur.fetchall()]

        new_tables = []
        counter_table = None
        for row in rows:
            new_token = jwt.encode(
                {"menu_id": menu_id, "table_id": row["table_id"]},
                SECRET_KEY,
                algorithm="HS256",
            )
            short_c = row.get("short_code") or secrets.token_hex(3)
            t_name = row.get("table_name") or ("Central Service Window" if row["table_id"] == "COUNTER" else f"Table {row['table_id']}")
            cur.execute(
                "UPDATE tables SET token = %s, short_code = %s, table_name = %s, created_at = CURRENT_TIMESTAMP WHERE id = %s",
                (new_token, short_c, t_name, row["id"]),
            )
            item = {
                "table_id": row["table_id"],
                "table_name": t_name,
                "token": new_token,
                "short_code": short_c,
            }
            if row["table_id"] == "COUNTER":
                counter_table = item
            else:
                new_tables.append(item)

        new_tables.sort(key=lambda t: int(t["table_id"]) if t["table_id"].isdigit() else 999)

        if not counter_table:
            counter_code = secrets.token_hex(3)
            counter_token = jwt.encode(
                {"menu_id": menu_id, "table_id": "COUNTER"}, SECRET_KEY, algorithm="HS256"
            )
            cur.execute(
                "INSERT INTO tables (token, menu_id, table_id, short_code, table_name) VALUES (%s, %s, %s, %s, %s)",
                (counter_token, menu_id, "COUNTER", counter_code, "Central Service Window"),
            )
            counter_table = {
                "table_id": "COUNTER",
                "table_name": "Central Service Window",
                "token": counter_token,
                "short_code": counter_code,
            }

    return {
        "menu_id": menu_id,
        "restaurant_name": latest_menu["restaurant_name"],
        "tables": new_tables,
        "counter_table": counter_table,
    }

@app.patch("/api/tables/{table_id}/rename")
async def rename_table(table_id: str, body: TableRenameRequest, request: Request):
    user = None
    try:
        user = get_current_user_from_request(request)
    except Exception:
        pass

    new_name = (body.new_name or "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Table name cannot be empty.")

    target_menu_id = body.menu_id if getattr(body, "menu_id", None) else None

    with db_cursor(commit=True) as cur:
        row = None
        # 1. If explicit menu_id was provided, update directly
        if target_menu_id:
            cur.execute(
                "UPDATE tables SET table_name = %s WHERE menu_id = %s AND (table_id = %s OR CAST(table_id AS TEXT) = %s) RETURNING table_id, table_name, short_code",
                (new_name, target_menu_id, str(table_id), str(table_id))
            )
            row = cur.fetchone()

        # 2. Try with user's latest menu
        if not row and user and user.get("uid"):
            cur.execute(
                "SELECT menu_id FROM menus WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
                (user["uid"],)
            )
            m = cur.fetchone()
            if m:
                cur.execute(
                    "UPDATE tables SET table_name = %s WHERE menu_id = %s AND (table_id = %s OR CAST(table_id AS TEXT) = %s) RETURNING table_id, table_name, short_code",
                    (new_name, m["menu_id"], str(table_id), str(table_id))
                )
                row = cur.fetchone()

        # 3. Try with system latest menu
        if not row:
            cur.execute("SELECT menu_id FROM menus ORDER BY created_at DESC LIMIT 1")
            m = cur.fetchone()
            if m:
                cur.execute(
                    "UPDATE tables SET table_name = %s WHERE menu_id = %s AND (table_id = %s OR CAST(table_id AS TEXT) = %s) RETURNING table_id, table_name, short_code",
                    (new_name, m["menu_id"], str(table_id), str(table_id))
                )
                row = cur.fetchone()

        # 4. Fallback: match by table_id directly on the most recent table record
        if not row:
            cur.execute(
                "UPDATE tables SET table_name = %s WHERE id = (SELECT id FROM tables WHERE table_id = %s OR CAST(table_id AS TEXT) = %s ORDER BY created_at DESC LIMIT 1) RETURNING table_id, table_name, short_code",
                (new_name, str(table_id), str(table_id))
            )
            row = cur.fetchone()

        row_dict = row_to_dict(row) or {}

    return {
        "success": True,
        "table_id": table_id,
        "table_name": new_name,
        "table": {
            "table_id": table_id,
            "table_name": new_name,
            "short_code": row_dict.get("short_code"),
        },
    }

# ---------------------------------------------------------------------------
# Dynamic Table Routing & Proxy Resolution
# ---------------------------------------------------------------------------

@app.get("/t/{code}")
async def proxy_redirect_table(code: str, src: str = Query("qr")):
    scan_source = "nfc" if src.lower() == "nfc" else "qr"
    return Response(
        status_code=307,
        headers={"Location": f"/t/{code}?src={scan_source}"}
    )

@app.post("/api/t/resolve")
async def resolve_table_proxy(req: ResolveTableRequest, request: Request):
    code = (req.code or "").strip()
    scan_source = "nfc" if (req.src or "").lower() == "nfc" else "qr"

    with db_cursor() as cur:
        cur.execute(
            """SELECT t.id, t.token, t.menu_id, t.table_id, t.short_code, t.table_name,
                      m.user_id, m.restaurant_name, m.data_json, m.lat, m.lon,
                      COALESCE(u.plan, m.plan, 'basic') AS effective_plan,
                      COALESCE(u.default_theme, 'acid-lime') AS user_theme
               FROM tables t
               JOIN menus m ON t.menu_id = m.menu_id
               LEFT JOIN users u ON m.user_id = u.uid
               WHERE t.short_code = %s OR t.token = %s
               LIMIT 1""",
            (code, code)
        )
        row = row_to_dict(cur.fetchone())

    if not row:
        raise HTTPException(status_code=404, detail="TABLE NOT FOUND OR EXPIRED LINK")

    # Geofence proximity check ONLY if explicitly enabled
    geofence_val = _get_setting_val("geofence_enabled")
    if geofence_val and geofence_val.lower() in ("true", "1", "yes"):
        radius_setting = float(_get_setting_val("geofence_radius") or 1000)
        if (
            req.lat is not None
            and req.lon is not None
            and row.get("lat") is not None
            and row.get("lon") is not None
        ):
            dist = calculate_distance(row["lat"], row["lon"], req.lat, req.lon)
            if dist > radius_setting:
                raise HTTPException(
                    status_code=403,
                    detail="PROXIMITY FAILED. YOU ARE NOT AT THE RESTAURANT.",
                )

    # Log scan tracking in table_scans
    try:
        with db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO table_scans (menu_id, table_id, short_code, scan_source, ip_address, user_agent)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    row["menu_id"],
                    row["table_id"],
                    row.get("short_code"),
                    scan_source,
                    request.client.host if request.client else None,
                    request.headers.get("user-agent", "")[:250],
                )
            )
    except Exception as e:
        logger.warning("Could not log table scan: %s", e)

    global_plan = _get_setting_val("plan")
    user_plan = (global_plan or row.get("effective_plan") or "basic").lower()
    session_token = str(uuid.uuid4())
    session_data = {
        "menu_id": row["menu_id"],
        "table_id": row["table_id"],
        "table_name": row.get("table_name") or f"Table {row['table_id']}",
        "user_id": row.get("user_id"),
        "plan": user_plan,
        "scan_source": scan_source,
        "ip_address": request.client.host if request.client else None,
        "expires": datetime.now(timezone.utc) + timedelta(hours=3),
    }
    ACTIVE_SESSIONS[session_token] = session_data
    save_dining_session(session_token, session_data)

    return {
        "session_token": session_token,
        "table_id": row["table_id"],
        "table_name": row.get("table_name") or f"Table {row['table_id']}",
        "menu_id": row["menu_id"],
        "plan": user_plan,
        "scan_source": scan_source,
        "default_theme": row.get("user_theme") or "acid-lime",
        "menu_data": json.loads(row["data_json"]),
    }


# ---------------------------------------------------------------------------
# Session verification
# ---------------------------------------------------------------------------

@app.post("/api/verify-scan")
async def verify_scan(req: VerifyRequest, request: Request):
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="INVALID OR FORGED QR CODE")

    menu_id = payload.get("menu_id")
    table_id = payload.get("table_id")

    scan_source = "nfc" if (req.src or "").lower() == "nfc" else "qr"

    with db_cursor() as cur:
        cur.execute(
            "SELECT token, short_code, table_name FROM tables WHERE token = %s AND menu_id = %s",
            (req.token, menu_id),
        )
        tbl_row = cur.fetchone()
        if not tbl_row:
            raise HTTPException(
                status_code=403, detail="QR CODE HAS BEEN RESET. PLEASE RESCAN."
            )
        tbl_d = row_to_dict(tbl_row)
        table_name = tbl_d.get("table_name") or f"Table {table_id}"
        short_code = tbl_d.get("short_code")

        cur.execute("""
            SELECT m.*, COALESCE(u.plan, m.plan, 'basic') AS effective_plan, COALESCE(u.default_theme, 'acid-lime') AS user_theme
            FROM menus m
            LEFT JOIN users u ON m.user_id = u.uid
            WHERE m.menu_id = %s
        """, (menu_id,))
        menu_row = row_to_dict(cur.fetchone())

    if not menu_row:
        raise HTTPException(status_code=404, detail="MENU NOT FOUND")

    geofence_val = _get_setting_val("geofence_enabled")
    if geofence_val and geofence_val.lower() in ("true", "1", "yes"):
        radius_setting = float(_get_setting_val("geofence_radius") or 1000)
        if (
            req.lat is not None
            and req.lon is not None
            and menu_row.get("lat") is not None
            and menu_row.get("lon") is not None
        ):
            dist = calculate_distance(
                menu_row["lat"], menu_row["lon"], req.lat, req.lon
            )
            if dist > radius_setting:
                raise HTTPException(
                    status_code=403,
                    detail="PROXIMITY FAILED. YOU ARE NOT AT THE RESTAURANT.",
                )

    # Log scan tracking in table_scans
    try:
        with db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO table_scans (menu_id, table_id, short_code, scan_source, ip_address, user_agent)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    menu_id,
                    table_id,
                    short_code,
                    scan_source,
                    request.client.host if request.client else None,
                    request.headers.get("user-agent", "")[:250],
                )
            )
    except Exception as e:
        logger.warning("Could not log table scan in verify_scan: %s", e)

    global_plan = _get_setting_val("plan")
    user_plan = (global_plan or menu_row.get("effective_plan") or menu_row.get("plan") or "basic").lower()
    session_token = str(uuid.uuid4())
    session_data = {
        "menu_id": menu_id,
        "table_id": table_id,
        "table_name": table_name,
        "user_id": menu_row.get("user_id"),
        "plan": user_plan,
        "scan_source": scan_source,
        "ip_address": request.client.host if request.client else None,
        "expires": datetime.now(timezone.utc) + timedelta(hours=3),
    }
    ACTIVE_SESSIONS[session_token] = session_data
    save_dining_session(session_token, session_data)

    return {
        "session_token": session_token,
        "table_id": table_id,
        "table_name": table_name,
        "menu_id": menu_id,
        "plan": user_plan,
        "scan_source": scan_source,
        "default_theme": menu_row.get("user_theme") or "acid-lime",
        "menu_data": json.loads(menu_row["data_json"]),
    }


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@app.post("/api/order")
async def place_order(order: OrderRequest, request: Request):
    if not order.customer_email or not EMAIL_REGEX.match(order.customer_email.strip()):
        raise HTTPException(status_code=400, detail="INVALID EMAIL ADDRESS. PLEASE PROVIDE A VALID EMAIL (e.g. name@example.com).")

    session = get_session(order.session_token)
    if not session:
        raise HTTPException(status_code=401, detail="SESSION EXPIRED")
    exp = session.get("expires")
    if isinstance(exp, datetime):
        exp_utc = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp_utc:
            raise HTTPException(status_code=401, detail="SESSION EXPIRED")

    # Enforce plan permissions: dynamically resolve latest plan from database & settings
    global_plan = _get_setting_val("plan")
    menu_id = session.get("menu_id")
    with db_cursor() as cur:
        cur.execute("""
            SELECT m.plan AS menu_plan, u.plan AS user_plan
            FROM menus m
            LEFT JOIN users u ON m.user_id = u.uid
            WHERE m.menu_id = %s
        """, (menu_id,))
        p_row = cur.fetchone()

    menu_plan = p_row["menu_plan"] if p_row else None
    user_plan = p_row["user_plan"] if p_row else None

    # Priority check: if any active configuration is 'pro', grant pro ordering capabilities
    effective_plan = "basic"
    for candidate in (global_plan, user_plan, menu_plan, session.get("plan")):
        if candidate and candidate.strip().lower() == "pro":
            effective_plan = "pro"
            break

    session["plan"] = effective_plan
    save_dining_session(order.session_token, session)

    if effective_plan == "basic":
        raise HTTPException(
            status_code=403,
            detail="Direct food ordering is disabled on the Basic Plan. Please ask your server to take your order.",
        )

    order_id = str(uuid.uuid4())[:8].upper()
    total = sum(item.price * item.quantity for item in order.items)

    with db_cursor(commit=True) as cur:
        # Resolve owner user_id from the menu
        cur.execute("SELECT user_id FROM menus WHERE menu_id = %s", (session["menu_id"],))
        menu_row = cur.fetchone()
        menu_user_id = menu_row["user_id"] if menu_row else None

        cur.execute(
            "SELECT customer_id FROM customers WHERE email = %s",
            (order.customer_email,),
        )
        existing = cur.fetchone()
        if existing:
            customer_id = existing["customer_id"]
            cur.execute(
                "UPDATE customers SET name = %s WHERE customer_id = %s",
                (order.customer_name, customer_id),
            )
        else:
            cur.execute(
                "INSERT INTO customers (name, email) VALUES (%s, %s) RETURNING customer_id",
                (order.customer_name, order.customer_email),
            )
            # Postgres needs RETURNING to get the ID back cleanly in psycopg2
            customer_id = cur.fetchone()["customer_id"]

        scan_source = session.get("scan_source") or "qr"

        cur.execute(
            """INSERT INTO orders
               (order_id, user_id, menu_id, table_id, customer_id, ip_address, notes, status, total, session_token, scan_source)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'transmitted', %s, %s, %s)""",
            (
                order_id,
                menu_user_id,
                session["menu_id"],
                session["table_id"],
                customer_id,
                request.client.host,
                order.notes,
                total,
                order.session_token,
                scan_source,
            ),
        )
        for item in order.items:
            cur.execute(
                "INSERT INTO order_items (order_id, name, price, quantity) VALUES (%s, %s, %s, %s)",
                (order_id, item.name, item.price, item.quantity),
            )

    await ORDER_NOTIFIER.broadcast({
        "type": "new_order",
        "order_id": order_id,
        "table_id": session["table_id"],
        "customer_id": customer_id,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "total": total,
        "scan_source": scan_source,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "items": [item.model_dump() for item in order.items],
    })

    return {
        "success": True,
        "order_id": order_id,
        "table_id": session["table_id"],
        "session_token": order.session_token,
        "scan_source": scan_source,
    }


def _serialize_order(row, items_by_order):
    return {
        "order_id": row["order_id"],
        "menu_id": row["menu_id"],
        "table_id": row["table_id"],
        "customer_name": row["customer_name"],
        "customer_email": row["customer_email"],
        "notes": row["notes"],
        "status": row["status"],
        "total": row["total"],
        "scan_source": row.get("scan_source") or "qr",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "session_token": row.get("session_token"),
        "items": items_by_order.get(row["order_id"], []),
    }


@app.get("/api/orders")
async def list_orders(
    request: Request,
    status: str | None = Query(None),
    table_id: str | None = Query(None),
    menu_id: str | None = Query(None),
):
    user = get_current_user_from_request(request)
    uid = user["uid"]
    query = """
        SELECT o.*, c.name AS customer_name, c.email AS customer_email
        FROM orders o JOIN customers c ON o.customer_id = c.customer_id
        WHERE (o.user_id = %s OR o.menu_id IN (SELECT menu_id FROM menus WHERE user_id = %s))
    """
    params = [uid, uid]
    status_val = status if isinstance(status, str) else None
    table_id_val = table_id if isinstance(table_id, str) else None
    menu_id_val = menu_id if isinstance(menu_id, str) else None

    if status_val:
        query += " AND o.status = %s"
        params.append(status_val)
    if table_id_val:
        query += " AND o.table_id = %s"
        params.append(table_id_val)
    if menu_id_val:
        query += " AND o.menu_id = %s"
        params.append(menu_id_val)
    query += " ORDER BY o.created_at DESC"

    with db_cursor() as cur:
        cur.execute(query, tuple(params))
        orders = [row_to_dict(r) for r in cur.fetchall()]

        if not orders:
            return {"orders": []}

        ids = [o["order_id"] for o in orders]
        ph = ",".join(["%s"] * len(ids))
        cur.execute(f"SELECT * FROM order_items WHERE order_id IN ({ph})", tuple(ids))
        items_by_order: dict = {}
        for item_row in cur.fetchall():
            item = row_to_dict(item_row)
            items_by_order.setdefault(item["order_id"], []).append(
                {"name": item["name"], "price": item["price"], "quantity": item["quantity"]}
            )

    return {"orders": [_serialize_order(o, items_by_order) for o in orders]}


@app.get("/api/orders/{order_id}")
async def get_order(order_id: str, session_token: str = Query(...)):
    session = get_session(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="SESSION EXPIRED")
    exp = session.get("expires")
    if isinstance(exp, datetime):
        exp_utc = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp_utc:
            raise HTTPException(status_code=401, detail="SESSION EXPIRED")

    with db_cursor() as cur:
        cur.execute(
            """SELECT o.*, c.name AS customer_name, c.email AS customer_email
               FROM orders o JOIN customers c ON o.customer_id = c.customer_id
               WHERE o.order_id = %s""",
            (order_id,),
        )
        order = row_to_dict(cur.fetchone())

    if not order:
        raise HTTPException(status_code=404, detail="ORDER NOT FOUND")

    if order.get("session_token") and order["session_token"] != session_token:
        raise HTTPException(status_code=403, detail="ORDER NOT YOURS")

    if (
        order["table_id"] != session["table_id"]
        or order["menu_id"] != session["menu_id"]
    ):
        raise HTTPException(status_code=403, detail="ORDER NOT YOURS")

    with db_cursor() as cur:
        cur.execute(
            "SELECT name, price, quantity FROM order_items WHERE order_id = %s",
            (order_id,),
        )
        items = [row_to_dict(r) for r in cur.fetchall()]

    order["items"] = items
    return order


@app.get("/api/session/orders")
async def get_session_orders(session_token: str = Query(...)):
    session = get_session(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="SESSION EXPIRED")
    exp = session.get("expires")
    if isinstance(exp, datetime):
        exp_utc = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp_utc:
            raise HTTPException(status_code=401, detail="SESSION EXPIRED")

    with db_cursor() as cur:
        cur.execute(
            """SELECT o.*, c.name AS customer_name, c.email AS customer_email
               FROM orders o
               LEFT JOIN customers c ON o.customer_id = c.customer_id
               WHERE o.session_token = %s
               ORDER BY o.created_at DESC""",
            (session_token,),
        )
        order_rows = [row_to_dict(r) for r in cur.fetchall()]

        if not order_rows:
            return {"orders": []}

        order_ids = [r["order_id"] for r in order_rows]
        cur.execute(
            """SELECT order_id, name, price, quantity
               FROM order_items
               WHERE order_id = ANY(%s)""",
            (order_ids,),
        )
        items_rows = [row_to_dict(r) for r in cur.fetchall()]

    items_by_order = {}
    for item in items_rows:
        items_by_order.setdefault(item["order_id"], []).append(item)

    for o in order_rows:
        o["items"] = items_by_order.get(o["order_id"], [])

    return {"orders": order_rows}


@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: str, update: OrderStatusUpdate, request: Request):
    user = get_current_user_from_request(request)
    uid = user["uid"]
    if update.status not in VALID_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_ORDER_STATUSES))}",
        )
    with db_cursor(commit=True) as cur:
        cur.execute(
            """UPDATE orders 
               SET status = %s, updated_at = CURRENT_TIMESTAMP 
               WHERE order_id = %s 
                 AND (user_id = %s OR menu_id IN (SELECT menu_id FROM menus WHERE user_id = %s))
               RETURNING order_id""",
            (update.status, order_id, uid, uid),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="ORDER NOT FOUND")

    await ORDER_NOTIFIER.broadcast({
        "type": "order_updated",
        "order_id": order_id,
        "status": update.status,
    })

    return {"success": True, "order_id": order_id, "status": update.status}


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

@app.get("/api/customers")
async def list_customers(request: Request):
    user = get_current_user_from_request(request)
    uid = user["uid"]
    with db_cursor() as cur:
        cur.execute("""
            SELECT c.customer_id, c.name, c.email, c.created_at AS first_seen,
                   COUNT(o.order_id) AS order_count,
                   COALESCE(SUM(o.total), 0) AS lifetime_spend,
                   MAX(o.created_at) AS last_order_at
            FROM customers c
            JOIN orders o ON o.customer_id = c.customer_id
            WHERE (o.user_id = %s OR o.menu_id IN (SELECT menu_id FROM menus WHERE user_id = %s))
            GROUP BY c.customer_id
            ORDER BY last_order_at DESC NULLS LAST
        """, (uid, uid))
        customers = [row_to_dict(r) for r in cur.fetchall()]
    return {"customers": customers}


@app.get("/api/customers/{customer_id}/orders")
async def customer_order_history(customer_id: int, request: Request):
    user = get_current_user_from_request(request)
    uid = user["uid"]
    with db_cursor() as cur:
        cur.execute("SELECT * FROM customers WHERE customer_id = %s", (customer_id,))
        customer = row_to_dict(cur.fetchone())
        if not customer:
            raise HTTPException(status_code=404, detail="CUSTOMER NOT FOUND")

        cur.execute(
            """SELECT * FROM orders 
               WHERE customer_id = %s AND (user_id = %s OR menu_id IN (SELECT menu_id FROM menus WHERE user_id = %s))
               ORDER BY created_at DESC""",
            (customer_id, uid, uid),
        )
        orders = [row_to_dict(r) for r in cur.fetchall()]

        ids = [o["order_id"] for o in orders]
        items_by_order: dict = {}
        if ids:
            ph = ",".join(["%s"] * len(ids))
            cur.execute(
                f"SELECT * FROM order_items WHERE order_id IN ({ph})", tuple(ids)
            )
            for item_row in cur.fetchall():
                item = row_to_dict(item_row)
                items_by_order.setdefault(item["order_id"], []).append(
                    {"name": item["name"], "price": item["price"],
                     "quantity": item["quantity"]}
                )
        for o in orders:
            o["items"] = items_by_order.get(o["order_id"], [])

    return {"customer": customer, "orders": orders}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard")
async def dashboard_stats(request: Request):
    user = get_current_user_from_request(request)
    uid = user["uid"]
    with db_cursor() as cur:
        # Query 1: Consolidated order metrics in ONE query
        cur.execute(
            """SELECT 
                   COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS orders_today,
                   COALESCE(SUM(total) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) AS revenue_today,
                   COUNT(*) FILTER (WHERE status IN ('transmitted', 'preparing')) AS active_orders,
                   COUNT(DISTINCT customer_id) AS total_customers
               FROM orders 
               WHERE (user_id = %s OR menu_id IN (SELECT menu_id FROM menus WHERE user_id = %s))""",
            (uid, uid),
        )
        order_metrics = cur.fetchone() or {}
        orders_today = int(order_metrics.get("orders_today") or 0)
        revenue_today = float(order_metrics.get("revenue_today") or 0.0)
        active_orders = int(order_metrics.get("active_orders") or 0)
        total_customers = int(order_metrics.get("total_customers") or 0)

        # Query 2: Menus & active tables in ONE query
        cur.execute(
            """SELECT 
                   COUNT(DISTINCT m.menu_id) AS menus_processed,
                   COUNT(t.id) AS active_tables
               FROM menus m
               LEFT JOIN tables t ON t.menu_id = m.menu_id
               WHERE m.user_id = %s""",
            (uid,),
        )
        menu_metrics = cur.fetchone() or {}
        menus_processed = int(menu_metrics.get("menus_processed") or 0)
        active_tables = int(menu_metrics.get("active_tables") or 0)

        # Query 3: Recent 8 orders
        cur.execute("""
            SELECT o.order_id, o.table_id, o.status, o.total, o.created_at,
                   c.name AS customer_name
            FROM orders o JOIN customers c ON o.customer_id = c.customer_id
            WHERE (o.user_id = %s OR o.menu_id IN (SELECT menu_id FROM menus WHERE user_id = %s))
            ORDER BY o.created_at DESC LIMIT 8
        """, (uid, uid))
        recent_orders = [row_to_dict(r) for r in cur.fetchall()]

        # Query 4: Latest menu
        cur.execute(
            "SELECT menu_id, restaurant_name, created_at FROM menus WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (uid,),
        )
        latest_menu = row_to_dict(cur.fetchone())

    return {
        "orders_today": orders_today,
        "revenue_today": revenue_today,
        "active_orders": active_orders,
        "menus_processed": menus_processed,
        "active_tables": active_tables,
        "total_customers": total_customers,
        "recent_orders": recent_orders,
        "latest_menu": latest_menu,
    }


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@app.get("/api/settings")
async def get_settings(request: Request):
    try:
        user = get_current_user_from_request(request)
        uid = user.get("uid")
    except HTTPException:
        user = None
        uid = None

    with db_cursor() as cur:
        if uid:
            cur.execute(
                "SELECT menu_id, user_id, restaurant_name, lat, lon FROM menus WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
                (uid,),
            )
        else:
            cur.execute(
                "SELECT menu_id, user_id, restaurant_name, lat, lon FROM menus ORDER BY created_at DESC LIMIT 1"
            )
        latest_menu = row_to_dict(cur.fetchone())
        if not user:
            if latest_menu and latest_menu.get("user_id"):
                cur.execute("SELECT * FROM users WHERE uid = %s", (latest_menu["user_id"],))
            else:
                cur.execute("SELECT * FROM users ORDER BY created_at DESC LIMIT 1")
            owner_row = cur.fetchone()
            if owner_row:
                user = row_to_dict(owner_row)

    resp = _build_user_settings_response(user, latest_menu)
    global_plan = _get_setting_val("plan")
    resp_plan = (global_plan or (user.get("plan") if user else None) or (latest_menu.get("plan") if latest_menu else None) or "basic").lower()
    resp["plan"] = resp_plan
    return resp


@app.patch("/api/settings")
async def update_settings(update: SettingsUpdate, request: Request):
    try:
        user = get_current_user_from_request(request)
        uid = user["uid"]
    except HTTPException:
        user = None
        uid = None
        with db_cursor() as cur:
            cur.execute("SELECT user_id FROM menus WHERE user_id IS NOT NULL ORDER BY created_at DESC LIMIT 1")
            mrow = cur.fetchone()
            if mrow and mrow.get("user_id"):
                uid = mrow["user_id"]
            else:
                cur.execute("SELECT uid FROM users ORDER BY created_at DESC LIMIT 1")
                urow = cur.fetchone()
                if urow:
                    uid = urow["uid"]
        if uid:
            user = get_user_by_uid(uid)

    profile_update = {}
    if update.restaurant_name is not None: profile_update["restaurant_name"] = update.restaurant_name
    if update.phone is not None: profile_update["restaurant_phone"] = update.phone
    if update.address is not None: profile_update["restaurant_address"] = update.address
    if update.currency is not None: profile_update["currency"] = update.currency
    if update.tax_rate is not None: profile_update["tax_rate"] = update.tax_rate
    if update.service_charge is not None: profile_update["service_charge"] = update.service_charge
    if update.plan is not None: profile_update["plan"] = update.plan
    if update.clear_geofence:
        profile_update["lat"] = None
        profile_update["lon"] = None
    else:
        if update.lat is not None: profile_update["lat"] = update.lat
        if update.lon is not None: profile_update["lon"] = update.lon
    if update.default_theme is not None: profile_update["default_theme"] = update.default_theme

    if update.geofence_enabled is not None:
        _set_setting_val("geofence_enabled", "true" if update.geofence_enabled else "false")
    if update.geofence_radius is not None:
        _set_setting_val("geofence_radius", str(update.geofence_radius))

    if uid and profile_update:
        user = update_user_profile(uid, profile_update) or user

    if update.plan is not None:
        plan_val = update.plan.lower()
        _set_setting_val("plan", plan_val)
        update_dining_sessions_plan(plan_val, uid)
        for s in ACTIVE_SESSIONS.values():
            if not uid or s.get("user_id") == uid:
                s["plan"] = plan_val

    with db_cursor(commit=True) as cur:
        if update.plan is not None:
            if uid:
                cur.execute("UPDATE menus SET plan = %s WHERE user_id = %s", (update.plan.lower(), uid))
            else:
                cur.execute("UPDATE menus SET plan = %s", (update.plan.lower(),))

        # Update latest menu details
        if uid:
            cur.execute(
                "SELECT menu_id FROM menus WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
                (uid,),
            )
        else:
            cur.execute("SELECT menu_id FROM menus ORDER BY created_at DESC LIMIT 1")
        latest_menu = row_to_dict(cur.fetchone())

        if update.clear_geofence and latest_menu:
            cur.execute("UPDATE menus SET lat = NULL, lon = NULL WHERE menu_id = %s", (latest_menu["menu_id"],))
            if uid:
                cur.execute("UPDATE menus SET lat = NULL, lon = NULL WHERE user_id = %s", (uid,))
            cur.execute("SELECT menu_id, restaurant_name, lat, lon FROM menus WHERE menu_id = %s", (latest_menu["menu_id"],))
            latest_menu = row_to_dict(cur.fetchone())
        elif latest_menu and (update.restaurant_name is not None or update.lat is not None or update.lon is not None):
            cur.execute(
                """UPDATE menus SET 
                   restaurant_name = COALESCE(%s, restaurant_name),
                   lat = COALESCE(%s, lat),
                   lon = COALESCE(%s, lon)
                   WHERE menu_id = %s""",
                (update.restaurant_name, update.lat, update.lon, latest_menu["menu_id"]),
            )
            cur.execute(
                "SELECT menu_id, restaurant_name, lat, lon FROM menus WHERE menu_id = %s",
                (latest_menu["menu_id"],),
            )
            latest_menu = row_to_dict(cur.fetchone())

    resp = _build_user_settings_response(user, latest_menu)
    if update.plan is not None:
        resp["plan"] = update.plan.lower()
    return resp

# # main.py
# import os
# import json
# import uuid
# import base64
# import re
# import math
# import asyncio
# import httpx
# import jwt
# from datetime import datetime, timedelta, date
# from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Query
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from groq import Groq
# import dotenv

# from db import init_db, db_cursor, row_to_dict

# dotenv.load_dotenv()

# SECRET_KEY = os.environ.get(
#     "ACID_SECRET_KEY", "acid-maximalism-secure-key-do-not-share"
# )

# client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
# UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY")

# app = FastAPI()
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# init_db()

# # Sessions: in-memory, short-lived (3 hr TTL).
# # Losing them on restart just means guests rescan — acceptable failure mode.
# ACTIVE_SESSIONS: dict = {}

# # Dish-image cache — avoids burning API quota on repeated names.
# IMAGE_CACHE: dict = {}

# # ---------------------------------------------------------------------------
# # Utility helpers
# # ---------------------------------------------------------------------------

# def calculate_distance(lat1, lon1, lat2, lon2):
#     R = 6_371_000  # metres
#     phi1, phi2 = math.radians(lat1), math.radians(lat2)
#     d_phi = math.radians(lat2 - lat1)
#     d_lam = math.radians(lon2 - lon1)
#     a = (
#         math.sin(d_phi / 2) ** 2
#         + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
#     )
#     return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# # ---------------------------------------------------------------------------
# # Image sourcing
# # ---------------------------------------------------------------------------

# async def fetch_scraped_image(dish_name: str) -> str | None:
#     if not UNSPLASH_ACCESS_KEY:
#         return None
#     cache_key = f"{dish_name} food dish".lower().strip()
#     if cache_key in IMAGE_CACHE:
#         return IMAGE_CACHE[cache_key]
#     try:
#         async with httpx.AsyncClient(timeout=8.0) as http:
#             r = await http.get(
#                 "https://api.unsplash.com/search/photos",
#                 params={"query": cache_key, "per_page": 1, "orientation": "squarish"},
#                 headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
#             )
#         if r.status_code != 200:
#             return None
#         results = r.json().get("results", [])
#         if not results:
#             return None
#         url = results[0]["urls"]["regular"]
#         IMAGE_CACHE[cache_key] = url
#         return url
#     except Exception:
#         return None


# async def fetch_generated_image(dish_name: str, description: str = "") -> str | None:
#     # Stub — wire up your image-gen provider here.
#     return None


# async def resolve_dish_image(dish_name: str, description: str = "") -> str | None:
#     url = await fetch_scraped_image(dish_name)
#     return url or await fetch_generated_image(dish_name, description)


# async def enrich_menu_with_images(menu_data: dict) -> None:
#     """Concurrently resolve images for every dish. Mutates menu_data in place."""
#     flat_items, tasks = [], []
#     for cat in menu_data.get("categories", []):
#         for item in cat.get("items", []):
#             flat_items.append(item)
#             tasks.append(
#                 resolve_dish_image(item.get("name", ""), item.get("description", ""))
#             )
#     if not tasks:
#         return
#     resolved = await asyncio.gather(*tasks, return_exceptions=True)
#     for item, url in zip(flat_items, resolved):
#         item["image_url"] = url if isinstance(url, str) else None


# # ---------------------------------------------------------------------------
# # Pydantic models
# # ---------------------------------------------------------------------------

# class VerifyRequest(BaseModel):
#     token: str
#     lat: float | None = None
#     lon: float | None = None


# class OrderItem(BaseModel):
#     name: str
#     price: float
#     quantity: int


# class OrderRequest(BaseModel):
#     session_token: str
#     customer_name: str
#     customer_email: str
#     notes: str | None = None
#     items: list[OrderItem]


# class OrderStatusUpdate(BaseModel):
#     status: str


# VALID_ORDER_STATUSES = {"transmitted", "preparing", "ready", "served", "cancelled"}


# class SettingsUpdate(BaseModel):
#     restaurant_name: str | None = None
#     lat: float | None = None
#     lon: float | None = None
#     # New fields
#     default_theme: str | None = None
#     currency: str | None = None
#     tax_rate: float | None = None
#     service_charge: float | None = None
#     phone: str | None = None
#     address: str | None = None


# # ---------------------------------------------------------------------------
# # Settings helpers (DRY)
# # ---------------------------------------------------------------------------

# def _read_settings_overrides(cur) -> dict:
#     cur.execute("SELECT key, value FROM settings")
#     return {r["key"]: r["value"] for r in cur.fetchall()}


# def _upsert_setting(cur, key: str, value: str):
#     cur.execute(
#         "INSERT INTO settings (key, value) VALUES (?, ?) "
#         "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
#         (key, value),
#     )


# def _build_settings_response(overrides: dict, latest_menu: dict | None) -> dict:
#     def _float(key):
#         v = overrides.get(key)
#         return float(v) if v is not None else None

#     return {
#         "restaurant_name": overrides.get("restaurant_name")
#             or (latest_menu["restaurant_name"] if latest_menu else None),
#         "lat": _float("lat") or (latest_menu["lat"] if latest_menu else None),
#         "lon": _float("lon") or (latest_menu["lon"] if latest_menu else None),
#         "menu_id": latest_menu["menu_id"] if latest_menu else None,
#         # New fields
#         "default_theme": overrides.get("default_theme", "acid-lime"),
#         "currency": overrides.get("currency", "USD"),
#         "tax_rate": _float("tax_rate"),
#         "service_charge": _float("service_charge"),
#         "phone": overrides.get("phone"),
#         "address": overrides.get("address"),
#     }


# # ---------------------------------------------------------------------------
# # Menu upload + QR generation
# # ---------------------------------------------------------------------------

# @app.post("/api/process-menu")
# async def process_menu(
#     file: UploadFile = File(...),
#     num_tables: int = Form(...),
#     admin_lat: float | None = Form(None),
#     admin_lon: float | None = Form(None),
# ):
#     image_bytes = await file.read()
#     base64_image = base64.b64encode(image_bytes).decode()
#     mime_type = file.content_type

#     prompt = """
#     Extract the menu data from this image. Return STRICTLY JSON:
#     {
#       "restaurant_name": "Name",
#       "categories": [
#         {
#           "category_name": "Category",
#           "theme": "acid-lime",
#           "items": [{"name": "Item Name", "price": 10.50,
#                      "description": "Details", "tags": ["spicy", "popular"]}]
#         }
#       ]
#     }
#     Rotate themes: "acid-lime", "acid-cyan", "acid-pink". OUTPUT ONLY VALID JSON.
#     """

#     try:
#         completion = client.chat.completions.create(
#             model=os.environ.get("GROQ_MODEL"),
#             messages=[
#                 {
#                     "role": "user",
#                     "content": [
#                         {"type": "text", "text": prompt},
#                         {
#                             "type": "image_url",
#                             "image_url": {
#                                 "url": f"data:{mime_type};base64,{base64_image}"
#                             },
#                         },
#                     ],
#                 }
#             ],
#             temperature=0.1,
#             max_tokens=4000,
#         )
#         raw = re.sub(
#             r"<think>.*?</think>",
#             "",
#             completion.choices[0].message.content,
#             flags=re.DOTALL,
#         )
#         menu_data = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"AI parsing failed: {e}")

#     try:
#         await enrich_menu_with_images(menu_data)
#     except Exception:
#         pass  # images are an enhancement, not a blocker

#     menu_id = str(uuid.uuid4())[:8]
#     table_qrs = []

#     with db_cursor(commit=True) as cur:
#         cur.execute(
#             "INSERT INTO menus (menu_id, restaurant_name, data_json, lat, lon) "
#             "VALUES (?, ?, ?, ?, ?)",
#             (menu_id, menu_data["restaurant_name"], json.dumps(menu_data),
#              admin_lat, admin_lon),
#         )
#         for i in range(1, num_tables + 1):
#             token = jwt.encode(
#                 {"menu_id": menu_id, "table_id": str(i)}, SECRET_KEY, algorithm="HS256"
#             )
#             cur.execute(
#                 "INSERT INTO tables (token, menu_id, table_id) VALUES (?, ?, ?)",
#                 (token, menu_id, str(i)),
#             )
#             table_qrs.append({"table_id": str(i), "token": token})

#     return {
#         "menu_id": menu_id,
#         "restaurant_name": menu_data["restaurant_name"],
#         "tables": table_qrs,
#     }


# # ---------------------------------------------------------------------------
# # Tables — persist + reset
# # ---------------------------------------------------------------------------

# @app.get("/api/tables/current")
# async def tables_current():
#     """
#     Return the table rows (token + table_id) for the most-recently uploaded
#     menu so the TablesPage can reconstruct QR cards after a browser refresh
#     without needing a new upload.
#     """
#     with db_cursor() as cur:
#         cur.execute(
#             "SELECT menu_id, restaurant_name FROM menus ORDER BY created_at DESC LIMIT 1"
#         )
#         latest_menu = row_to_dict(cur.fetchone())

#         if not latest_menu:
#             return {"menu_id": None, "restaurant_name": None, "tables": []}

#         cur.execute(
#             "SELECT table_id, token FROM tables WHERE menu_id = ? ORDER BY CAST(table_id AS INTEGER)",
#             (latest_menu["menu_id"],),
#         )
#         tables = [row_to_dict(r) for r in cur.fetchall()]

#     return {
#         "menu_id": latest_menu["menu_id"],
#         "restaurant_name": latest_menu["restaurant_name"],
#         "tables": tables,
#     }


# @app.post("/api/tables/reset")
# async def tables_reset():
#     """
#     Regenerate tokens for every table in the latest menu, invalidating all
#     existing QRs. Old sessions that were already verified continue to work
#     (they're keyed on session_token, not the QR token), but re-scanning an
#     old printed QR will fail JWT decode because the token is gone.
#     """
#     with db_cursor(commit=True) as cur:
#         cur.execute(
#             "SELECT menu_id, restaurant_name FROM menus ORDER BY created_at DESC LIMIT 1"
#         )
#         latest_menu = row_to_dict(cur.fetchone())
#         if not latest_menu:
#             raise HTTPException(status_code=404, detail="NO MENU FOUND")

#         menu_id = latest_menu["menu_id"]
#         cur.execute(
#             "SELECT id, table_id FROM tables WHERE menu_id = ? ORDER BY CAST(table_id AS INTEGER)",
#             (menu_id,),
#         )
#         rows = [row_to_dict(r) for r in cur.fetchall()]

#         new_tables = []
#         for row in rows:
#             new_token = jwt.encode(
#                 {"menu_id": menu_id, "table_id": row["table_id"]},
#                 SECRET_KEY,
#                 algorithm="HS256",
#             )
#             cur.execute(
#                 "UPDATE tables SET token = ?, created_at = datetime('now') WHERE id = ?",
#                 (new_token, row["id"]),
#             )
#             new_tables.append({"table_id": row["table_id"], "token": new_token})

#     return {
#         "menu_id": menu_id,
#         "restaurant_name": latest_menu["restaurant_name"],
#         "tables": new_tables,
#     }


# # ---------------------------------------------------------------------------
# # Session verification
# # ---------------------------------------------------------------------------

# @app.post("/api/verify-scan")
# async def verify_scan(req: VerifyRequest, request: Request):
#     try:
#         payload = jwt.decode(req.token, SECRET_KEY, algorithms=["HS256"])
#     except jwt.InvalidTokenError:
#         raise HTTPException(status_code=403, detail="INVALID OR FORGED QR CODE")

#     menu_id = payload.get("menu_id")
#     table_id = payload.get("table_id")

#     with db_cursor() as cur:
#         # Confirm token still exists in DB (handles reset case)
#         cur.execute(
#             "SELECT token FROM tables WHERE token = ? AND menu_id = ?",
#             (req.token, menu_id),
#         )
#         if not cur.fetchone():
#             raise HTTPException(
#                 status_code=403, detail="QR CODE HAS BEEN RESET. PLEASE RESCAN."
#             )

#         cur.execute("SELECT * FROM menus WHERE menu_id = ?", (menu_id,))
#         menu_row = row_to_dict(cur.fetchone())

#     if not menu_row:
#         raise HTTPException(status_code=404, detail="MENU NOT FOUND")

#     # Proximity check
#     if (
#         req.lat is not None
#         and req.lon is not None
#         and menu_row["lat"] is not None
#         and menu_row["lon"] is not None
#     ):
#         dist = calculate_distance(
#             menu_row["lat"], menu_row["lon"], req.lat, req.lon
#         )
#         if dist > 200:
#             raise HTTPException(
#                 status_code=403,
#                 detail="PROXIMITY FAILED. YOU ARE NOT AT THE RESTAURANT.",
#             )

#     session_token = str(uuid.uuid4())
#     ACTIVE_SESSIONS[session_token] = {
#         "menu_id": menu_id,
#         "table_id": table_id,
#         "ip_address": request.client.host,
#         "expires": datetime.now() + timedelta(hours=3),
#     }

#     return {
#         "session_token": session_token,
#         "table_id": table_id,
#         "menu_data": json.loads(menu_row["data_json"]),
#     }


# # ---------------------------------------------------------------------------
# # Orders
# # ---------------------------------------------------------------------------

# @app.post("/api/order")
# async def place_order(order: OrderRequest, request: Request):
#     session = ACTIVE_SESSIONS.get(order.session_token)
#     if not session or datetime.now() > session["expires"]:
#         raise HTTPException(status_code=401, detail="SESSION EXPIRED")

#     order_id = str(uuid.uuid4())[:8].upper()
#     total = sum(item.price * item.quantity for item in order.items)

#     with db_cursor(commit=True) as cur:
#         cur.execute(
#             "SELECT customer_id FROM customers WHERE email = ?",
#             (order.customer_email,),
#         )
#         existing = cur.fetchone()
#         if existing:
#             customer_id = existing["customer_id"]
#             cur.execute(
#                 "UPDATE customers SET name = ? WHERE customer_id = ?",
#                 (order.customer_name, customer_id),
#             )
#         else:
#             cur.execute(
#                 "INSERT INTO customers (name, email) VALUES (?, ?)",
#                 (order.customer_name, order.customer_email),
#             )
#             customer_id = cur.lastrowid

#         cur.execute(
#             """INSERT INTO orders
#                (order_id, menu_id, table_id, customer_id, ip_address, notes, status, total)
#                VALUES (?, ?, ?, ?, ?, ?, 'transmitted', ?)""",
#             (
#                 order_id,
#                 session["menu_id"],
#                 session["table_id"],
#                 customer_id,
#                 request.client.host,
#                 order.notes,
#                 total,
#             ),
#         )
#         for item in order.items:
#             cur.execute(
#                 "INSERT INTO order_items (order_id, name, price, quantity) VALUES (?, ?, ?, ?)",
#                 (order_id, item.name, item.price, item.quantity),
#             )

#     return {
#         "success": True,
#         "order_id": order_id,
#         "table_id": session["table_id"],
#         # Return session token so customer can poll their order
#         "session_token": order.session_token,
#     }


# def _serialize_order(row, items_by_order):
#     return {
#         "order_id": row["order_id"],
#         "menu_id": row["menu_id"],
#         "table_id": row["table_id"],
#         "customer_name": row["customer_name"],
#         "customer_email": row["customer_email"],
#         "notes": row["notes"],
#         "status": row["status"],
#         "total": row["total"],
#         "created_at": row["created_at"],
#         "updated_at": row["updated_at"],
#         "items": items_by_order.get(row["order_id"], []),
#     }


# @app.get("/api/orders")
# async def list_orders(
#     status: str | None = Query(None),
#     table_id: str | None = Query(None),
#     menu_id: str | None = Query(None),
# ):
#     query = """
#         SELECT o.*, c.name AS customer_name, c.email AS customer_email
#         FROM orders o JOIN customers c ON o.customer_id = c.customer_id
#         WHERE 1=1
#     """
#     params = []
#     if status:
#         query += " AND o.status = ?"
#         params.append(status)
#     if table_id:
#         query += " AND o.table_id = ?"
#         params.append(table_id)
#     if menu_id:
#         query += " AND o.menu_id = ?"
#         params.append(menu_id)
#     query += " ORDER BY o.created_at DESC"

#     with db_cursor() as cur:
#         cur.execute(query, params)
#         orders = [row_to_dict(r) for r in cur.fetchall()]

#         if not orders:
#             return {"orders": []}

#         ids = [o["order_id"] for o in orders]
#         ph = ",".join("?" * len(ids))
#         cur.execute(f"SELECT * FROM order_items WHERE order_id IN ({ph})", ids)
#         items_by_order: dict = {}
#         for item_row in cur.fetchall():
#             item = row_to_dict(item_row)
#             items_by_order.setdefault(item["order_id"], []).append(
#                 {"name": item["name"], "price": item["price"], "quantity": item["quantity"]}
#             )

#     return {"orders": [_serialize_order(o, items_by_order) for o in orders]}


# # NEW — single-order lookup, session-scoped (customer polling)
# @app.get("/api/orders/{order_id}")
# async def get_order(order_id: str, session_token: str = Query(...)):
#     """
#     Customer-facing single order lookup.
#     Requires a valid, unexpired session_token that belongs to the same
#     table the order was placed from — prevents one guest from watching
#     another table's order.
#     """
#     session = ACTIVE_SESSIONS.get(session_token)
#     if not session or datetime.now() > session["expires"]:
#         raise HTTPException(status_code=401, detail="SESSION EXPIRED")

#     with db_cursor() as cur:
#         cur.execute(
#             """SELECT o.*, c.name AS customer_name, c.email AS customer_email
#                FROM orders o JOIN customers c ON o.customer_id = c.customer_id
#                WHERE o.order_id = ?""",
#             (order_id,),
#         )
#         order = row_to_dict(cur.fetchone())

#     if not order:
#         raise HTTPException(status_code=404, detail="ORDER NOT FOUND")

#     # Scope check: order must belong to this session's table + menu
#     if (
#         order["table_id"] != session["table_id"]
#         or order["menu_id"] != session["menu_id"]
#     ):
#         raise HTTPException(status_code=403, detail="ORDER NOT YOURS")

#     with db_cursor() as cur:
#         cur.execute(
#             "SELECT name, price, quantity FROM order_items WHERE order_id = ?",
#             (order_id,),
#         )
#         items = [row_to_dict(r) for r in cur.fetchall()]

#     order["items"] = items
#     return order


# @app.patch("/api/orders/{order_id}/status")
# async def update_order_status(order_id: str, update: OrderStatusUpdate):
#     if update.status not in VALID_ORDER_STATUSES:
#         raise HTTPException(
#             status_code=400,
#             detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_ORDER_STATUSES))}",
#         )
#     with db_cursor(commit=True) as cur:
#         cur.execute("SELECT order_id FROM orders WHERE order_id = ?", (order_id,))
#         if not cur.fetchone():
#             raise HTTPException(status_code=404, detail="ORDER NOT FOUND")
#         cur.execute(
#             "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_id = ?",
#             (update.status, order_id),
#         )
#     return {"success": True, "order_id": order_id, "status": update.status}


# # ---------------------------------------------------------------------------
# # Customers
# # ---------------------------------------------------------------------------

# @app.get("/api/customers")
# async def list_customers():
#     with db_cursor() as cur:
#         cur.execute("""
#             SELECT c.customer_id, c.name, c.email, c.created_at AS first_seen,
#                    COUNT(o.order_id) AS order_count,
#                    COALESCE(SUM(o.total), 0) AS lifetime_spend,
#                    MAX(o.created_at) AS last_order_at
#             FROM customers c
#             LEFT JOIN orders o ON o.customer_id = c.customer_id
#             GROUP BY c.customer_id
#             ORDER BY last_order_at DESC NULLS LAST
#         """)
#         customers = [row_to_dict(r) for r in cur.fetchall()]
#     return {"customers": customers}


# @app.get("/api/customers/{customer_id}/orders")
# async def customer_order_history(customer_id: int):
#     with db_cursor() as cur:
#         cur.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
#         customer = row_to_dict(cur.fetchone())
#         if not customer:
#             raise HTTPException(status_code=404, detail="CUSTOMER NOT FOUND")

#         cur.execute(
#             "SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC",
#             (customer_id,),
#         )
#         orders = [row_to_dict(r) for r in cur.fetchall()]

#         ids = [o["order_id"] for o in orders]
#         items_by_order: dict = {}
#         if ids:
#             ph = ",".join("?" * len(ids))
#             cur.execute(
#                 f"SELECT * FROM order_items WHERE order_id IN ({ph})", ids
#             )
#             for item_row in cur.fetchall():
#                 item = row_to_dict(item_row)
#                 items_by_order.setdefault(item["order_id"], []).append(
#                     {"name": item["name"], "price": item["price"],
#                      "quantity": item["quantity"]}
#                 )
#         for o in orders:
#             o["items"] = items_by_order.get(o["order_id"], [])

#     return {"customer": customer, "orders": orders}


# # ---------------------------------------------------------------------------
# # Dashboard
# # ---------------------------------------------------------------------------

# @app.get("/api/dashboard")
# async def dashboard_stats():
#     with db_cursor() as cur:
#         cur.execute(
#             "SELECT COUNT(*) AS n FROM orders WHERE date(created_at) = date('now')"
#         )
#         orders_today = cur.fetchone()["n"]

#         cur.execute(
#             "SELECT COALESCE(SUM(total), 0) AS s FROM orders WHERE date(created_at) = date('now')"
#         )
#         revenue_today = cur.fetchone()["s"]

#         cur.execute(
#             "SELECT COUNT(*) AS n FROM orders WHERE status IN ('transmitted', 'preparing')"
#         )
#         active_orders = cur.fetchone()["n"]

#         cur.execute("SELECT COUNT(DISTINCT menu_id) AS n FROM menus")
#         menus_processed = cur.fetchone()["n"]

#         cur.execute("SELECT COUNT(*) AS n FROM tables")
#         active_tables = cur.fetchone()["n"]

#         cur.execute("SELECT COUNT(*) AS n FROM customers")
#         total_customers = cur.fetchone()["n"]

#         cur.execute("""
#             SELECT o.order_id, o.table_id, o.status, o.total, o.created_at,
#                    c.name AS customer_name
#             FROM orders o JOIN customers c ON o.customer_id = c.customer_id
#             ORDER BY o.created_at DESC LIMIT 8
#         """)
#         recent_orders = [row_to_dict(r) for r in cur.fetchall()]

#         cur.execute(
#             "SELECT menu_id, restaurant_name, created_at FROM menus ORDER BY created_at DESC LIMIT 1"
#         )
#         latest_menu = row_to_dict(cur.fetchone())

#     return {
#         "orders_today": orders_today,
#         "revenue_today": revenue_today,
#         "active_orders": active_orders,
#         "menus_processed": menus_processed,
#         "active_tables": active_tables,
#         "total_customers": total_customers,
#         "recent_orders": recent_orders,
#         "latest_menu": latest_menu,
#     }


# # ---------------------------------------------------------------------------
# # Settings
# # ---------------------------------------------------------------------------

# @app.get("/api/settings")
# async def get_settings():
#     with db_cursor() as cur:
#         cur.execute(
#             "SELECT menu_id, restaurant_name, lat, lon FROM menus ORDER BY created_at DESC LIMIT 1"
#         )
#         latest_menu = row_to_dict(cur.fetchone())
#         overrides = _read_settings_overrides(cur)
#     return _build_settings_response(overrides, latest_menu)


# @app.patch("/api/settings")
# async def update_settings(update: SettingsUpdate):
#     scalar_fields = {
#         "restaurant_name": update.restaurant_name,
#         "default_theme": update.default_theme,
#         "currency": update.currency,
#         "phone": update.phone,
#         "address": update.address,
#     }
#     float_fields = {
#         "lat": update.lat,
#         "lon": update.lon,
#         "tax_rate": update.tax_rate,
#         "service_charge": update.service_charge,
#     }

#     with db_cursor(commit=True) as cur:
#         for key, value in scalar_fields.items():
#             if value is not None:
#                 _upsert_setting(cur, key, value)
#         for key, value in float_fields.items():
#             if value is not None:
#                 _upsert_setting(cur, key, str(value))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

#     return await get_settings()