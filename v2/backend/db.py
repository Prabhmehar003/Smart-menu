"""
Master Neon PostgreSQL persistence layer for Smart Menu & EchoReviews.
"""
import os
import logging
import secrets
from contextlib import contextmanager
import psycopg2
from psycopg2.extras import RealDictCursor
import dotenv

dotenv.load_dotenv()

logger = logging.getLogger(__name__)

# Neon / Supabase PostgreSQL connection URL
DEFAULT_DATABASE_URL = "postgresql://neondb_owner:npg_eUAWmYGtn49O@ep-odd-morning-axq27rn5-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

def _sanitize_db_url(url: str | None) -> str | None:
    if not url:
        return url
    if "smartmenu@2005@" in url:
        return url.replace("smartmenu@2005@", "smartmenu%402005@")
    import re
    from urllib.parse import quote_plus
    m = re.match(r"^(postgres(?:ql)?:\/\/[^:]+:)(.*)@([^@\/]+:\d+\/.*)$", url)
    if m:
        prefix, pwd, rest = m.groups()
        return f"{prefix}{quote_plus(pwd)}@{rest}"
    return url

DATABASE_URL = _sanitize_db_url(os.getenv("DATABASE_URL")) or DEFAULT_DATABASE_URL

def _connect(row_factory: bool = True):
    raw_url = os.getenv("DATABASE_URL") or DATABASE_URL or DEFAULT_DATABASE_URL
    url = _sanitize_db_url(raw_url)
    if not url:
        raise ValueError("DATABASE_URL environment variable is not set.")
    
    cursor_factory = RealDictCursor if row_factory else None
    conn = psycopg2.connect(url, cursor_factory=cursor_factory)
    return conn

@contextmanager
def db_cursor(commit: bool = False):
    conn = _connect(row_factory=True)
    try:
        cur = conn.cursor()
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db() -> None:
    """
    Create all tables for BOTH projects on first run. Safe to call on every startup.
    """
    logger.info("init_db: creating unified tables in Neon PostgreSQL")

    conn = _connect(row_factory=False)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                -- ==========================================
                -- FIREBASE AUTH / USER TABLES (Created first for Foreign Keys)
                -- ==========================================
                CREATE TABLE IF NOT EXISTS users (
                    uid          TEXT PRIMARY KEY,
                    email        TEXT UNIQUE NOT NULL,
                    name         TEXT,
                    role         TEXT NOT NULL DEFAULT 'client',
                    avatar_url   TEXT,
                    phone_number TEXT,
                    address_line TEXT,
                    city         TEXT,
                    region       TEXT,
                    country      TEXT,
                    postal_code  TEXT,
                    device_type  TEXT,
                    device_name  TEXT,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS provider_profiles (
                    uid               TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
                    business_name     TEXT,
                    bio               TEXT,
                    years_experience  INTEGER,
                    hourly_rate       DOUBLE PRECISION,
                    license_number    TEXT,
                    service_radius_km DOUBLE PRECISION,
                    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

                -- ==========================================
                -- PROJECT 1: SMART MENU TABLES
                -- ==========================================
                CREATE TABLE IF NOT EXISTS menus (
                    menu_id         TEXT PRIMARY KEY,
                    user_id         TEXT REFERENCES users(uid) ON DELETE CASCADE,
                    restaurant_name TEXT NOT NULL,
                    data_json       TEXT NOT NULL,
                    lat             DOUBLE PRECISION,
                    lon             DOUBLE PRECISION,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS tables (
                    id         SERIAL PRIMARY KEY,
                    token      TEXT    NOT NULL UNIQUE,
                    menu_id    TEXT    NOT NULL,
                    table_id   TEXT    NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS customers (
                    customer_id SERIAL PRIMARY KEY,
                    name        TEXT NOT NULL,
                    email       TEXT NOT NULL UNIQUE,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS orders (
                    order_id    TEXT PRIMARY KEY,
                    user_id     TEXT REFERENCES users(uid) ON DELETE CASCADE,
                    menu_id     TEXT NOT NULL,
                    table_id    TEXT NOT NULL,
                    customer_id INTEGER NOT NULL,
                    ip_address  TEXT,
                    notes       TEXT,
                    status      TEXT NOT NULL DEFAULT 'transmitted',
                    total       DOUBLE PRECISION NOT NULL,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS order_items (
                    item_id  SERIAL PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    name     TEXT NOT NULL,
                    price    DOUBLE PRECISION NOT NULL,
                    quantity INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS settings (
                    key   TEXT PRIMARY KEY,
                    value TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_orders_menu     ON orders(menu_id);
                CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
                CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
                CREATE INDEX IF NOT EXISTS idx_tables_menu     ON tables(menu_id);

                -- ==========================================
                -- PROJECT 2: ECHOREVIEWS TABLES
                -- ==========================================
                CREATE TABLE IF NOT EXISTS er_reviews (
                    review_id         SERIAL PRIMARY KEY,
                    customer_email    TEXT NOT NULL,
                    rating            INTEGER NOT NULL,
                    content           TEXT,
                    status            TEXT NOT NULL DEFAULT 'contained', -- 'public_ready', 'contained', 'resolved'
                    ai_sentiment      TEXT,
                    ai_draft_response TEXT,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS er_competitors (
                    comp_id      SERIAL PRIMARY KEY,
                    name         TEXT NOT NULL,
                    market_share DOUBLE PRECISION,
                    vulnerability TEXT,
                    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS er_config (
                    config_key   TEXT PRIMARY KEY,
                    config_value TEXT
                );
            """)
        conn.commit()
    finally:
        conn.close()

    _verify_tables()
    _migrate()
    logger.info("init_db: unified schema deployment done")

def _verify_tables() -> None:
    required = {
        "menus", "tables", "customers", "orders", "order_items", "settings", 
        "er_reviews", "er_competitors", "er_config", "users", "provider_profiles"
    }
    conn = _connect(row_factory=False)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
            )
            rows = cur.fetchall()
            found = {row[0] for row in rows}
    finally:
        conn.close()

    missing = required - found
    if missing:
        raise RuntimeError(f"init_db FAILED — missing tables: {missing}")
    logger.info("init_db: all unified tables present.")

# ---------------------------------------------------------------------------
# Auth / Users Database Helpers
# ---------------------------------------------------------------------------

import time

_USER_CACHE: dict = {}  # uid -> (user_dict, expire_timestamp)

def invalidate_user_cache(uid: str | None = None):
    if uid:
        _USER_CACHE.pop(uid, None)
    else:
        _USER_CACHE.clear()

def get_user_by_uid(uid: str) -> dict | None:
    now = time.time()
    cached = _USER_CACHE.get(uid)
    if cached and now < cached[1]:
        return cached[0]

    with db_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE uid = %s", (uid,))
        row = cur.fetchone()
        res = row_to_dict(row)
        if res:
            _USER_CACHE[uid] = (res, now + 15.0)  # 15 second TTL
        return res

def get_user_by_email(email: str) -> dict | None:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        return row_to_dict(row)

def upsert_user(
    uid: str,
    email: str,
    name: str | None = None,
    role: str = "client",
    avatar_url: str | None = None,
    device_type: str | None = None,
    device_name: str | None = None
) -> dict:
    with db_cursor(commit=True) as cur:
        # Check if user already exists by email to prevent UniqueViolation on users_email_key
        cur.execute("SELECT uid FROM users WHERE email = %s", (email,))
        existing_email_user = cur.fetchone()

        if existing_email_user:
            cur.execute("""
                UPDATE users SET
                    uid = %s,
                    name = COALESCE(%s, users.name),
                    role = COALESCE(%s, users.role),
                    avatar_url = COALESCE(%s, users.avatar_url),
                    device_type = COALESCE(%s, users.device_type),
                    device_name = COALESCE(%s, users.device_name),
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = %s
                RETURNING *;
            """, (uid, name, role, avatar_url, device_type, device_name, email))
            row = cur.fetchone()
            return row_to_dict(row)

        cur.execute("""
            INSERT INTO users (uid, email, name, role, avatar_url, device_type, device_name, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (uid) DO UPDATE SET
                email = EXCLUDED.email,
                name = COALESCE(EXCLUDED.name, users.name),
                avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
                device_type = COALESCE(EXCLUDED.device_type, users.device_type),
                device_name = COALESCE(EXCLUDED.device_name, users.device_name),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        """, (uid, email, name, role, avatar_url, device_type, device_name))
        row = cur.fetchone()
        invalidate_user_cache(uid)
        return row_to_dict(row)

def update_user_profile(uid: str, profile_data: dict) -> dict | None:
    fields = []
    values = []
    
    mapping = {
        "email": "email",
        "phoneNumber": "phone_number",
        "phone_number": "phone_number",
        "countryCode": "country_code",
        "country_code": "country_code",
        "addressLine": "address_line",
        "address_line": "address_line",
        "city": "city",
        "region": "region",
        "state": "region",
        "country": "country",
        "postalCode": "postal_code",
        "postal_code": "postal_code",
        "avatarUrl": "avatar_url",
        "avatar_url": "avatar_url",
        "name": "name",
        "role": "role",
        "restaurantName": "restaurant_name",
        "restaurant_name": "restaurant_name",
        "restaurantPhone": "restaurant_phone",
        "restaurant_phone": "restaurant_phone",
        "restaurantAddress": "restaurant_address",
        "restaurant_address": "restaurant_address",
        "currency": "currency",
        "taxRate": "tax_rate",
        "tax_rate": "tax_rate",
        "serviceCharge": "service_charge",
        "service_charge": "service_charge",
        "plan": "plan",
        "lat": "lat",
        "lon": "lon",
        "default_theme": "default_theme",
        "defaultTheme": "default_theme",
    }

    for key, col in mapping.items():
        if key in profile_data and profile_data[key] is not None:
            fields.append(f"{col} = %s")
            values.append(profile_data[key])

    if not fields:
        return get_user_by_uid(uid)

    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(uid)

    query = f"UPDATE users SET {', '.join(fields)} WHERE uid = %s RETURNING *;"
    with db_cursor(commit=True) as cur:
        cur.execute(query, tuple(values))
        row = cur.fetchone()
        invalidate_user_cache(uid)
        return row_to_dict(row)

def upsert_provider_profile(uid: str, provider_data: dict) -> dict | None:
    business_name = provider_data.get("businessName") or provider_data.get("business_name")
    bio = provider_data.get("bio")
    years_exp = provider_data.get("yearsExperience") or provider_data.get("years_experience")
    hourly_rate = provider_data.get("hourlyRate") or provider_data.get("hourly_rate")
    license_num = provider_data.get("licenseNumber") or provider_data.get("license_number")
    radius_km = provider_data.get("serviceRadiusKm") or provider_data.get("service_radius_km")

    try:
        years_exp = int(years_exp) if years_exp is not None and str(years_exp).strip() != "" else None
    except (ValueError, TypeError):
        years_exp = None

    try:
        hourly_rate = float(hourly_rate) if hourly_rate is not None and str(hourly_rate).strip() != "" else None
    except (ValueError, TypeError):
        hourly_rate = None

    try:
        radius_km = float(radius_km) if radius_km is not None and str(radius_km).strip() != "" else None
    except (ValueError, TypeError):
        radius_km = None

    with db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO provider_profiles (uid, business_name, bio, years_experience, hourly_rate, license_number, service_radius_km, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (uid) DO UPDATE SET
                business_name = COALESCE(EXCLUDED.business_name, provider_profiles.business_name),
                bio = COALESCE(EXCLUDED.bio, provider_profiles.bio),
                years_experience = COALESCE(EXCLUDED.years_experience, provider_profiles.years_experience),
                hourly_rate = COALESCE(EXCLUDED.hourly_rate, provider_profiles.hourly_rate),
                license_number = COALESCE(EXCLUDED.license_number, provider_profiles.license_number),
                service_radius_km = COALESCE(EXCLUDED.service_radius_km, provider_profiles.service_radius_km),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        """, (uid, business_name, bio, years_exp, hourly_rate, license_num, radius_km))
        row = cur.fetchone()
        return row_to_dict(row)


def _migrate() -> None:
    """Idempotent migrations for older deployments."""
    conn = _connect(row_factory=False)
    try:
        with conn.cursor() as cur:
            # Check for 'updated_at' in orders
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'orders' AND table_schema = 'public'
            """)
            order_cols = [row[0] for row in cur.fetchall()]

            if order_cols and "updated_at" not in order_cols:
                logger.info("_migrate: adding updated_at to orders")
                cur.execute(
                    "ALTER TABLE orders ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;"
                )
                conn.commit()

            # Ensure all user columns for account & restaurant setup exist
            cur.execute("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_name TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_phone TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_address TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
                ALTER TABLE users ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION DEFAULT 0.0;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS service_charge DOUBLE PRECISION DEFAULT 0.0;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'basic';
                ALTER TABLE users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS default_theme TEXT DEFAULT 'amber-gold';
            """)
            conn.commit()

            # Multi-tenancy columns for menus and orders
            cur.execute("""
                ALTER TABLE menus ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(uid) ON DELETE CASCADE;
                ALTER TABLE menus ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'basic';
                CREATE INDEX IF NOT EXISTS idx_menus_user_id ON menus(user_id);

                ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(uid) ON DELETE CASCADE;
                CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
            """)
            conn.commit()

            # Backfill existing menus and orders if user_id is null
            cur.execute("""
                UPDATE menus
                SET user_id = u.uid
                FROM users u
                WHERE menus.user_id IS NULL
                  AND (
                    menus.restaurant_name = u.restaurant_name
                    OR (u.restaurant_name IS NOT NULL AND menus.restaurant_name ILIKE '%' || u.restaurant_name || '%')
                  );

                UPDATE menus
                SET user_id = (SELECT uid FROM users ORDER BY created_at DESC LIMIT 1)
                WHERE user_id IS NULL;

                UPDATE orders
                SET user_id = m.user_id
                FROM menus m
                WHERE orders.user_id IS NULL
                  AND orders.menu_id = m.menu_id
                  AND m.user_id IS NOT NULL;

                UPDATE orders
                SET user_id = (SELECT uid FROM users ORDER BY created_at DESC LIMIT 1)
                WHERE user_id IS NULL;

                CREATE TABLE IF NOT EXISTS dining_sessions (
                    session_token TEXT PRIMARY KEY,
                    menu_id       TEXT NOT NULL,
                    table_id      TEXT NOT NULL,
                    user_id       TEXT,
                    plan          TEXT NOT NULL DEFAULT 'basic',
                    ip_address    TEXT,
                    expires       TIMESTAMPTZ NOT NULL,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_dining_sessions_user_id ON dining_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_dining_sessions_menu_id ON dining_sessions(menu_id);

                ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_token TEXT;
                CREATE INDEX IF NOT EXISTS idx_orders_session_token ON orders(session_token);

                ALTER TABLE tables ADD COLUMN IF NOT EXISTS short_code TEXT;
                ALTER TABLE tables ADD COLUMN IF NOT EXISTS table_name TEXT;
                CREATE INDEX IF NOT EXISTS idx_tables_short_code ON tables(short_code);

                ALTER TABLE orders ADD COLUMN IF NOT EXISTS scan_source TEXT DEFAULT 'qr';
                ALTER TABLE dining_sessions ADD COLUMN IF NOT EXISTS scan_source TEXT DEFAULT 'qr';

                CREATE TABLE IF NOT EXISTS table_scans (
                    id SERIAL PRIMARY KEY,
                    menu_id TEXT NOT NULL,
                    table_id TEXT NOT NULL,
                    short_code TEXT,
                    scan_source TEXT NOT NULL DEFAULT 'qr',
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_table_scans_menu_id ON table_scans(menu_id);
            """)
            conn.commit()

            # Backfill existing tables with short_code and table_name if missing
            cur.execute("SELECT id, table_id FROM tables WHERE short_code IS NULL;")
            missing_codes = cur.fetchall()
            for r in missing_codes:
                rid = r[0]
                tid = str(r[1])
                code = secrets.token_hex(3)
                tname = "Central Service Window" if tid == "COUNTER" else f"Table {tid}"
                cur.execute("UPDATE tables SET short_code = %s, table_name = COALESCE(table_name, %s) WHERE id = %s", (code, tname, rid))
            conn.commit()
    finally:
        conn.close()

def save_dining_session(session_token: str, data: dict) -> None:
    try:
        with db_cursor(commit=True) as cur:
            cur.execute("""
                INSERT INTO dining_sessions (session_token, menu_id, table_id, user_id, plan, ip_address, expires, scan_source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (session_token) DO UPDATE SET
                    plan = EXCLUDED.plan,
                    expires = EXCLUDED.expires,
                    user_id = COALESCE(EXCLUDED.user_id, dining_sessions.user_id),
                    ip_address = COALESCE(EXCLUDED.ip_address, dining_sessions.ip_address),
                    scan_source = COALESCE(EXCLUDED.scan_source, dining_sessions.scan_source);
            """, (
                session_token,
                data.get("menu_id"),
                data.get("table_id"),
                data.get("user_id"),
                (data.get("plan") or "basic").lower(),
                data.get("ip_address"),
                data.get("expires"),
                (data.get("scan_source") or "qr").lower(),
            ))
    except Exception as e:
        logger.warning(f"save_dining_session error: {e}")

def get_dining_session(session_token: str) -> dict | None:
    try:
        with db_cursor() as cur:
            cur.execute("""
                SELECT session_token, menu_id, table_id, user_id, plan, ip_address, expires, scan_source
                FROM dining_sessions
                WHERE session_token = %s AND expires > CURRENT_TIMESTAMP;
            """, (session_token,))
            row = cur.fetchone()
            if row:
                d = dict(row)
                return d
    except Exception as e:
        logger.warning(f"get_dining_session error: {e}")
    return None

def update_dining_sessions_plan(plan: str, user_id: str | None = None) -> None:
    try:
        with db_cursor(commit=True) as cur:
            if user_id:
                cur.execute(
                    "UPDATE dining_sessions SET plan = %s WHERE user_id = %s;",
                    (plan.lower(), user_id)
                )
            else:
                cur.execute(
                    "UPDATE dining_sessions SET plan = %s;",
                    (plan.lower(),)
                )
    except Exception as e:
        logger.warning(f"update_dining_sessions_plan error: {e}")

def row_to_dict(row) -> dict | None:
    return dict(row) if row else None





# """
# SQLite persistence layer.
# """
# import sqlite3
# import logging
# from contextlib import contextmanager
# from pathlib import Path

# logger = logging.getLogger(__name__)

# DB_PATH = Path(__file__).parent / "acid_menu.db"


# def _connect(row_factory: bool = True) -> sqlite3.Connection:
#     conn = sqlite3.connect(str(DB_PATH))
#     conn.execute("PRAGMA journal_mode = WAL")
#     conn.execute("PRAGMA foreign_keys = ON")
#     if row_factory:
#         conn.row_factory = sqlite3.Row
#     return conn


# @contextmanager
# def db_cursor(commit: bool = False):
#     conn = _connect(row_factory=True)
#     try:
#         cur = conn.cursor()
#         yield cur
#         if commit:
#             conn.commit()
#     except Exception:
#         conn.rollback()
#         raise
#     finally:
#         conn.close()


# def init_db() -> None:
#     """
#     Create all tables on first run.  Safe to call on every startup.

#     IMPORTANT: row_factory must NOT be set before executescript() on
#     Python 3.12+ — the internal cursor executescript() creates does not
#     inherit row_factory cleanly and on 3.14 this silently drops all DDL.
#     We open a plain connection (no row_factory), run the script, close it,
#     then run migrations on a fresh connection.
#     """
#     logger.info("init_db: creating tables in %s", DB_PATH)

#     # Plain connection — no row_factory, no PRAGMA that touches schema yet.
#     conn = sqlite3.connect(str(DB_PATH))
#     try:
#         conn.executescript("""
#             PRAGMA journal_mode = WAL;
#             PRAGMA foreign_keys = OFF;

#             CREATE TABLE IF NOT EXISTS menus (
#                 menu_id         TEXT PRIMARY KEY,
#                 restaurant_name TEXT NOT NULL,
#                 data_json       TEXT NOT NULL,
#                 lat             REAL,
#                 lon             REAL,
#                 created_at      TEXT NOT NULL DEFAULT (datetime('now'))
#             );

#             CREATE TABLE IF NOT EXISTS tables (
#                 id         INTEGER PRIMARY KEY AUTOINCREMENT,
#                 token      TEXT    NOT NULL UNIQUE,
#                 menu_id    TEXT    NOT NULL,
#                 table_id   TEXT    NOT NULL,
#                 created_at TEXT    NOT NULL DEFAULT (datetime('now'))
#             );

#             CREATE TABLE IF NOT EXISTS customers (
#                 customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
#                 name        TEXT NOT NULL,
#                 email       TEXT NOT NULL UNIQUE,
#                 created_at  TEXT NOT NULL DEFAULT (datetime('now'))
#             );

#             CREATE TABLE IF NOT EXISTS orders (
#                 order_id    TEXT    PRIMARY KEY,
#                 menu_id     TEXT    NOT NULL,
#                 table_id    TEXT    NOT NULL,
#                 customer_id INTEGER NOT NULL,
#                 ip_address  TEXT,
#                 notes       TEXT,
#                 status      TEXT    NOT NULL DEFAULT 'transmitted',
#                 total       REAL    NOT NULL,
#                 created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
#                 updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
#             );

#             CREATE TABLE IF NOT EXISTS order_items (
#                 item_id  INTEGER PRIMARY KEY AUTOINCREMENT,
#                 order_id TEXT    NOT NULL,
#                 name     TEXT    NOT NULL,
#                 price    REAL    NOT NULL,
#                 quantity INTEGER NOT NULL
#             );

#             CREATE TABLE IF NOT EXISTS settings (
#                 key   TEXT PRIMARY KEY,
#                 value TEXT
#             );

#             CREATE INDEX IF NOT EXISTS idx_orders_menu     ON orders(menu_id);
#             CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
#             CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
#             CREATE INDEX IF NOT EXISTS idx_tables_menu     ON tables(menu_id);
#         """)
#         # executescript auto-commits, so no explicit commit needed.
#     finally:
#         conn.close()

#     # Verify the tables actually landed before running migrations.
#     _verify_tables()
#     _migrate()
#     logger.info("init_db: done")


# def _verify_tables() -> None:
#     """
#     Crash loudly at startup if executescript silently did nothing.
#     This turns a confusing runtime 'no such table' into an immediate
#     boot failure with a clear message.
#     """
#     required = {"menus", "tables", "customers", "orders", "order_items", "settings"}
#     conn = sqlite3.connect(str(DB_PATH))
#     try:
#         rows = conn.execute(
#             "SELECT name FROM sqlite_master WHERE type='table'"
#         ).fetchall()
#         found = {row[0] for row in rows}
#     finally:
#         conn.close()

#     missing = required - found
#     if missing:
#         raise RuntimeError(
#             f"init_db FAILED — tables were not created: {missing}\n"
#             f"DB path: {DB_PATH}\n"
#             f"Tables found: {found}"
#         )
#     logger.info("init_db: all required tables present: %s", found)


# def _migrate() -> None:
#     """
#     Idempotent migrations for older deployments.
#     Uses a plain connection (no row_factory) so PRAGMA table_info
#     rows are accessed by index, not name.
#     """
#     conn = sqlite3.connect(str(DB_PATH))
#     try:
#         # M1: rebuild tables table if it has no surrogate PK column
#         cols = [
#             row[1]
#             for row in conn.execute("PRAGMA table_info(tables)").fetchall()
#         ]
#         if "id" not in cols:
#             logger.info("_migrate: rebuilding tables table to add surrogate PK")
#             conn.executescript("""
#                 ALTER TABLE tables RENAME TO _tables_v1;

#                 CREATE TABLE tables (
#                     id         INTEGER PRIMARY KEY AUTOINCREMENT,
#                     token      TEXT    NOT NULL UNIQUE,
#                     menu_id    TEXT    NOT NULL,
#                     table_id   TEXT    NOT NULL,
#                     created_at TEXT    NOT NULL DEFAULT (datetime('now'))
#                 );

#                 INSERT INTO tables (token, menu_id, table_id, created_at)
#                 SELECT token,
#                        menu_id,
#                        table_id,
#                        COALESCE(created_at, datetime('now'))
#                 FROM   _tables_v1;

#                 DROP TABLE _tables_v1;

#                 CREATE INDEX IF NOT EXISTS idx_tables_menu ON tables(menu_id);
#             """)

#         # M2: add updated_at to orders if missing
#         order_cols = [
#             row[1]
#             for row in conn.execute("PRAGMA table_info(orders)").fetchall()
#         ]
#         if "updated_at" not in order_cols:
#             logger.info("_migrate: adding updated_at to orders")
#             conn.execute(
#                 "ALTER TABLE orders ADD COLUMN updated_at TEXT "
#                 "NOT NULL DEFAULT (datetime('now'))"
#             )
#             conn.commit()

#     finally:
#         conn.close()


# def row_to_dict(row) -> dict | None:
#     return dict(row) if row else None