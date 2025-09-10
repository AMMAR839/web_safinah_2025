import os
import cv2
import datetime
import gc
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import openvino as ov
from supabase import create_client, Client


# Ganti dengan URL dan API Key Supabase Anda
SUPABASE_URL = "https://jyjunbzusfrmaywmndpa.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anVuYnp1c2ZybWF5d21uZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NDMxMTgsImV4cCI6MjA2OTQxOTExOH0.IQ6yyyR2OpvQj1lIL1yFsWfVNhJIm2_EFt5Pnv4Bd38"

# Buat klien Supabase
client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Ambil daftar semua file di bucket missionimages
files = client.storage.from_("missionimages").list()

# Ambil hanya nama file (path)
file_names = [f["name"] for f in files]

if file_names:
    client.storage.from_("missionimages").remove(file_names)
    print(f"🗑️ {len(file_names)} file berhasil dihapus dari Supabase Storage.")
else:
    print("✅ Tidak ada file di bucket missionimages.")

response = client.table("image_mission").delete().neq("id", 0).execute()

if response:
    print(f"🗑️ {response.count} record berhasil dihapus dari tabel image_mission.")

else:
    print("✅ Tidak ada record di tabel image_mission.")