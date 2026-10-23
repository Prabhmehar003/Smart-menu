import os
import json
import uuid
import secrets
import base64
import re
import math
import asyncio
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

from db import (
    init_db, db_cursor, row_to_dict,
    get_user_by_uid, get_user_by_email, upsert_user,
    update_user_profile, upsert_provider_profile,
    save_dining_session, get_dining_session, update_dining_sessions_plan
)

dotenv.load_dotenv()

SECRET_KEY = os.environ.get(
    "ACID_SECRET_KEY", "acid-maximalism-secure-key-do-not-share"
)

_groq_key = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=_groq_key) if _groq_key else None
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY") or "vcbKY4KAfaLUO7PRGtKMyZEODdDmsepLON-pBn9RZ7I"

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

try:
    init_db()
except Exception as e:
    print(f"Warning: could not initialize database on startup: {e}")

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
        "timestamp": datetime.utcnow().isoformat()
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

def clean_dish_name(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", name or "")
    cleaned = re.sub(
        r"\b(spl|spl\.|special|veg|veg\.|non-veg|non-veg\.|family|best|hot|cold|fresh|signature)\b",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"[^a-zA-Z\s]", " ", cleaned)
    res = " ".join(cleaned.split()).strip()
    return res if res else (name or "").strip()

async def fetch_scraped_image(dish_name: str) -> str | None:
    if not UNSPLASH_ACCESS_KEY:
        return None
    clean = clean_dish_name(dish_name)
    cache_key = f"unsplash_{clean.lower()}"
    if cache_key in IMAGE_CACHE:
        return IMAGE_CACHE[cache_key]
    try:
        async with httpx.AsyncClient(timeout=4.0) as http:
            r = await http.get(
                "https://api.unsplash.com/search/photos",
                params={"query": f"{clean} food dish", "per_page": 1, "orientation": "squarish"},
                headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            )
        if r.status_code == 200:
            results = r.json().get("results", [])
            if results and results[0].get("urls", {}).get("regular"):
                url = results[0]["urls"]["regular"]
                IMAGE_CACHE[cache_key] = url
                return url
    except Exception:
        pass
    return None

async def fetch_wikipedia_image(dish_name: str) -> str | None:
    clean = clean_dish_name(dish_name)
    cache_key = f"wiki_{clean.lower()}"
    if cache_key in IMAGE_CACHE:
        return IMAGE_CACHE[cache_key]
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "titles": clean,
                    "prop": "pageimages",
                    "format": "json",
                    "pithumbsize": 800,
                },
            )
        if r.status_code == 200:
            pages = r.json().get("query", {}).get("pages", {})
            for p in pages.values():
                if "thumbnail" in p and p["thumbnail"].get("source"):
                    url = p["thumbnail"]["source"]
                    IMAGE_CACHE[cache_key] = url
                    return url
    except Exception:
        pass
    return None

async def fetch_generated_image(dish_name: str, description: str = "") -> str | None:
    clean = clean_dish_name(dish_name)
    if not clean:
        clean = "gourmet restaurant food dish"
    import urllib.parse
    prompt_str = f"gourmet {clean} plated food photography restaurant dining studio lighting 4k"
    encoded = urllib.parse.quote(prompt_str)
    return f"https://image.pollinations.ai/prompt/{encoded}?width=800&height=600&nologo=true"

async def resolve_dish_image(dish_name: str, description: str = "") -> str | None:
    dish_clean = (dish_name or "").strip()
    if not dish_clean:
        return None
    cache_key = dish_clean.lower()
    if cache_key in IMAGE_CACHE:
        return IMAGE_CACHE[cache_key]

    url = await fetch_scraped_image(dish_clean)
    if not url:
        url = await fetch_wikipedia_image(dish_clean)
    if not url:
        url = await fetch_generated_image(dish_clean, description)

    if url:
        IMAGE_CACHE[cache_key] = url
    return url

async def enrich_menu_with_images(menu_data: dict) -> None:
    flat_items, tasks = [], []
    for cat in menu_data.get("categories", []):
        for item in cat.get("items", []):
            flat_items.append(item)
            tasks.append(
                resolve_dish_image(item.get("name", ""), item.get("description", ""))
            )
    if not tasks:
        return
    resolved = await asyncio.gather(*tasks, return_exceptions=True)
    for item, url in zip(flat_items, resolved):
        if isinstance(url, str) and url.startswith("http"):
            item["image_url"] = url
        else:
            item["image_url"] = await fetch_generated_image(item.get("name", ""))


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
    base64_image = base64.b64encode(image_bytes).decode()
    mime_type = file.content_type

    prompt = """
    Extract the menu data from this image. Return STRICTLY JSON:
    {
      "restaurant_name": "Name",
      "categories": [
        {
          "category_name": "Category",
          "theme": "acid-lime",
          "items": [{"name": "Item Name", "price": 10.50,
                     "description": "Details", "tags": ["spicy", "popular"]}]
        }
      ]
    }
    Rotate themes: "acid-lime", "acid-cyan", "acid-pink". OUTPUT ONLY VALID JSON.
    """

    try:
        if not client:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured on the server")
        model_name = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
        max_tokens_val = int(os.environ.get("GROQ_MAX_TOKENS", "900"))

        completion = client.chat.completions.create(
            model=model_name,
            messages=[
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
                }
            ],
            temperature=0.1,
            max_tokens=max_tokens_val,
        )
        content = completion.choices[0].message.content or ""
        raw = re.sub(
            r"<think>.*?</think>",
            "",
            content,
            flags=re.DOTALL,
        ).strip()

        # Strip markdown code blocks if wrapped in ```json ... ```
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        start_idx = raw.find("{")
        end_idx = raw.rfind("}")
        if start_idx != -1 and end_idx != -1:
            raw = raw[start_idx : end_idx + 1]

        menu_data = json.loads(raw)
    except Exception as e:
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