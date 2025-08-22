# Script ini membutuhkan pustaka supabase-py. Jika belum, instal dengan:
# pip install supabase

import os
from supabase import create_client, Client

# Ganti dengan URL dan API Key Supabase Anda
SUPABASE_URL = "https://jyjunbzusfrmaywmndpa.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anVuYnp1c2ZybWF5d21uZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NDMxMTgsImV4cCI6MjA2OTQxOTExOH0.IQ6yyyR2OpvQj1lIL1yFsWfVNhJIm2_EFt5Pnv4Bd38"

# Buat klien Supabase
client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Data contoh untuk pelampung merah dan hijau
# Setiap dictionary adalah satu baris data
buoy_data = [
    
    {"latitude": -7.915074, "longitude": 112.588742, "color": "red"},
    {"latitude": -7.915074, "longitude": 112.588728, "color": "green"},
    {"latitude": -7.915044, "longitude":  112.588749, "color": "red"},
    {"latitude": -7.915044, "longitude": 112.588739, "color": "green"},
    {"latitude": -7.915024, "longitude": 112.588718, "color": "green"},
    {"latitude": -7.915024, "longitude": 112.588733, "color": "red"},
    
    {
        "latitude": -7.914956,
        "longitude": 112.588791,
        "color": "green"
    },
    {
        "latitude": -7.914967,
        "longitude": 112.588791,
        "color": "red"
    },
    {
        "latitude": -7.914958,
        "longitude": 112.58881,
        "color": "green"
    },
    {
        "latitude": -7.914971,
        "longitude": 112.588809,
        "color": "red"
    },
    {
        "latitude": -7.914961,
        "longitude": 112.588825,
        "color": "green"
    },
    {
        "latitude": -7.914971,
        "longitude": 112.588825,
        "color": "red"
    },
    {
        "latitude": -7.91496,
        "longitude": 112.588838,
        "color": "green"
    },
    {
        "latitude": -7.914972,
        "longitude": 112.588836,
        "color": "red"
    },

    #kanan
    
    {
        "latitude": -7.914994,
        "longitude": 112.588886,
        "color": "green"
    },
    {
        "latitude": -7.914995,
        "longitude": 112.588902,
        "color": "red"
    },
    {
        "latitude": -7.915038,
        "longitude": 112.588905,
        "color": "green"
    },
    {
        "latitude": -7.915038,
        "longitude": 112.588921,
        "color": "red"
    },
    {
        "latitude": -7.915068,
        "longitude": 112.588900,
        "color": "green"
    },
    {
        "latitude": -7.915069,
        "longitude": 112.588914,
        "color": "red"
    }


    
   ]


def insert_buoys_into_db():
    try:
        # Masukkan semua data pelampung ke tabel 'buoys'
        # Sintaks insert yang benar untuk supabase-py
        response = client.table('buoys').insert(buoy_data).execute()
        print("Data pelampung berhasil dimasukkan ke database.")

    except Exception as e:
        print(f"Terjadi kesalahan: {e}")

if __name__ == "__main__":
    insert_buoys_into_db()