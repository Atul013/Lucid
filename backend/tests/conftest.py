"""app.connectors.gmail reads GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI at import
time, same as on real boot. Stub them so importing it doesn't require real
OAuth credentials — deliberately NOT loading the real .env wholesale, since
that would also pull in LUCID_ENCRYPTION_KEY/LUCID_API_KEY and silently
change how every other test's crypto_store/security behavior runs.
"""
import os

os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
