import sys
import os

# app.py'nin bulunduğu klasörü path'e ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ['VERCEL'] = '1'

from app import app, db, seed_beats

# Serverless cold start'ta DB oluştur
with app.app_context():
    db.create_all()
    seed_beats()
