import os
import sys
import importlib.util
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
V2_BACKEND_DIR = BASE_DIR / "v2" / "backend"

# Ensure v2/backend is on sys.path so relative imports in db.py work
if str(V2_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(V2_BACKEND_DIR))

# Load v2/backend/main.py cleanly without circular reference
spec = importlib.util.spec_from_file_location("v2_backend_main", V2_BACKEND_DIR / "main.py")
v2_module = importlib.util.module_from_spec(spec)
sys.modules["v2_backend_main"] = v2_module
spec.loader.exec_module(v2_module)
app = v2_module.app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
