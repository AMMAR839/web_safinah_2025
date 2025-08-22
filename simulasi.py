import time
import random
from supabase import create_client, Client
from datetime import datetime
from zoneinfo import ZoneInfo
import math

# --- Konfigurasi Supabase ---
SUPABASE_URL = 'https://jyjunbzusfrmaywmndpa.supabase.co'
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anVuYnp1c2ZybWF5d21uZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NDMxMTgsImV4cCI6MjA2OTQxOTExOH0.IQ6yyyR2OpvQj1lIL1yFsWfVNhJIm2_EFt5Pnv4Bd38"
TABLE_NAV_DATA = "nav_data"
TABLE_COG_DATA = "cog_data"

# Titik-titik yang diberikan, digabungkan menjadi satu daftar
waypoints = [
    {"latitude": -7.915141, "longitude": 112.588725},
    {"latitude": -7.915074, "longitude": 112.588742},
    {"latitude": -7.915074, "longitude": 112.588728},
    {"latitude": -7.915044, "longitude": 112.588749},
    {"latitude": -7.915044, "longitude": 112.588739},
    {"latitude": -7.915024, "longitude": 112.588718},
    {"latitude": -7.915024, "longitude": 112.588733},
    {"latitude": -7.914956, "longitude": 112.588791},
    {"latitude": -7.914967, "longitude": 112.588791},
    {"latitude": -7.914958, "longitude": 112.58881},
    {"latitude": -7.914971, "longitude": 112.588809},
    {"latitude": -7.914961, "longitude": 112.588825},
    {"latitude": -7.914971, "longitude": 112.588825},
    {"latitude": -7.91496, "longitude": 112.588838},
    {"latitude": -7.914972, "longitude": 112.588836},
    {"latitude": -7.914994, "longitude": 112.588886},
    {"latitude": -7.914995, "longitude": 112.588902},
    {"latitude": -7.915038, "longitude": 112.588905},
    {"latitude": -7.915038, "longitude": 112.588921},
    {"latitude": -7.915068, "longitude": 112.588900},
    {"latitude": -7.915069, "longitude": 112.588914},
    {"latitude": -7.915141, "longitude": 112.588725}
]

# Urutkan waypoints untuk mendapatkan jalur yang logis (berdasarkan lintang)
waypoints.sort(key=lambda p: (p["latitude"], p["longitude"]))

# Global variables for simulation
current_waypoint_index = 0
direction = 1  # 1 for forward, -1 for backward
progress = 0.0  # Interpolation progress between waypoints (0.0 to 1.0)
step_size = 0.1 # Increase this for faster movement between points

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
last_time_delete = time.time()

def generate_moving_nav_data():
    """Membuat data navigasi yang bergerak di sepanjang waypoints."""
    global current_waypoint_index, direction, progress
    
    # Dapatkan titik awal dan akhir untuk interpolasi
    start_point = waypoints[current_waypoint_index]
    
    # Tentukan titik akhir, perhatikan batas array
    if direction == 1:
        end_point_index = (current_waypoint_index + 1) % len(waypoints)
    else:
        end_point_index = (current_waypoint_index - 1 + len(waypoints)) % len(waypoints)
    end_point = waypoints[end_point_index]

    # Interpolasi posisi
    current_lat = start_point["latitude"] + (end_point["latitude"] - start_point["latitude"]) * progress
    current_lon = start_point["longitude"] + (end_point["longitude"] - start_point["longitude"]) * progress
    
    # Update progress dan waypoint index
    progress += step_size
    if progress >= 1.0:
        progress = 0.0
        current_waypoint_index = end_point_index
        # Ganti arah jika sudah mencapai ujung jalur
        if current_waypoint_index == len(waypoints) - 1:
            direction = -1
        elif current_waypoint_index == 0:
            direction = 1

    return {
        "timestamp": datetime.now(ZoneInfo("Asia/Jakarta")).isoformat(),
        "latitude": current_lat,
        "longitude": current_lon, 
        "sog_ms": round(random.uniform(0, 1.5), 2),
    }

def generate_random_cog_data():
    """Membuat data COG acak"""
    return {
        "timestamp" : datetime.now(ZoneInfo("Asia/Jakarta")).isoformat(),
        "cog": round(random.uniform(0, 360), 2),
    }

def send_to_supabase(data, table_name):
    try:
        response = supabase.table(table_name).insert(data).execute()
        if response.data:
            print(f"✅ Data terkirim ke '{table_name}': {data}")
        else:
            print(f"⚠️ Gagal kirim ke '{table_name}'. Error:", response.error)
    except Exception as e:
        print(f"❌ Error saat kirim ke Supabase: {e}")

def periodic_delete_all_data():
    """Menghapus semua data dari dua tabel Supabase."""
    try:
        for table in [TABLE_NAV_DATA, TABLE_COG_DATA]:
            response = supabase.table(table).delete().gt('id', 0).execute()
            print(f"Semua data di tabel '{table}' telah dihapus.")
    except Exception as e:
        print(f"Error saat menghapus semua data: {e}")

def run_simulation(interval_seconds=1):
    """Loop pengiriman data simulasi"""
    global last_time_delete
    print(f"🚀 Mulai mengirim data simulasi setiap {interval_seconds} detik...")
    
    while True:
        current_time = time.time()
        
        nav_data = generate_moving_nav_data()
        cog_data = generate_random_cog_data()

        send_to_supabase(nav_data, TABLE_NAV_DATA)
        send_to_supabase(cog_data, TABLE_COG_DATA)

        if current_time - last_time_delete > 10:
            last_time_delete = time.time()
            periodic_delete_all_data()
        
        time.sleep(interval_seconds)

if __name__ == "__main__":
    run_simulation()