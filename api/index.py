import os
import sys

# Ensure project root is in Python module search path for Vercel Serverless Function
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.api.main import app

# Export for Vercel ASGI handler
handler = app
app = app
