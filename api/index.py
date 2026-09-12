import os
import sys

# Ensure project root is in Python module search path for Vercel Serverless Function
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.api.main import app as fastapi_app

async def handler(scope, receive, send):
    """
    ASGI entrypoint wrapper for Vercel Serverless Functions.
    Resolves matched paths from Vercel rewrites and normalizes /api prefixes.
    """
    if scope["type"] == "http":
        headers = dict(scope.get("headers", []))

        # 1. Check if Vercel passed the original matched path in headers
        matched_path = None
        for h_key in (b"x-matched-path", b"x-vercel-matched-path", b"x-forwarded-uri", b"x-real-path"):
            if h_key in headers:
                try:
                    raw_val = headers[h_key].decode("latin1").split("?")[0]
                    if raw_val and raw_val != "/api/index.py":
                        matched_path = raw_val
                        break
                except Exception:
                    pass

        # 2. If rewrite target set matched_path, update scope path
        if matched_path and matched_path != "/api/index.py":
            scope["path"] = matched_path

        # 3. Normalize common paths for Vercel root and documentation
        current_path = scope.get("path", "")
        if current_path in ("/api/index.py", "/api", "/api/"):
            scope["path"] = "/"
        elif current_path.startswith("/api/docs"):
            scope["path"] = "/docs"
        elif current_path.startswith("/api/openapi.json"):
            scope["path"] = "/openapi.json"
        elif current_path == "/api/predict":
            scope["path"] = "/predict"

    await fastapi_app(scope, receive, send)

# Export for Vercel ASGI serverless handler
app = handler
