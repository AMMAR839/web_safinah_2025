import os
import cv2
from ultralytics import YOLO
from supabase import create_client, Client
import datetime
import random

def get_cardinal_direction(value, coord_type):
    if coord_type == 'lat':
        return 'N' if value >= 0 else 'S'
    elif coord_type == 'lon':
        return 'E' if value >= 0 else 'W'

def formatA(lat, lon):
    lat_direction = get_cardinal_direction(lat, 'lat')
    lon_direction = get_cardinal_direction(lon, 'lon')
    abs_lat = abs(lat)
    abs_lon = abs(lon)
    return f"{lat_direction} {abs_lat:.6f} {lon_direction} {abs_lon:.6f}"

def ms_to_kmh(sog_ms):
    if not isinstance(sog_ms, (int, float)) or sog_ms is None:
        return 0
    return sog_ms * 3.6

# --- Pengaturan Supabase ---
SUPABASE_URL = "https://jyjunbzusfrmaywmndpa.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anVuYnp1c2ZybWF5d21uZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NDMxMTgsImV4cCI6MjA2OTQxOTExOH0.IQ6yyyR2OpvQj1lIL1yFsWfVNhJIm2_EFt5Pnv4Bd38"
client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# --- Load Model YOLO ---
model = YOLO('buoys.pt')

# --- Buka Kamera ---
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Error: Tidak dapat membuka kamera/video.")
    exit()

# --- Proses Frame ---
while cap.isOpened():
    ret, frame1 = cap.read()
    if not ret:
        print("❌ Tidak ada frame. Keluar.")
        break
    
    frame = cv2.resize(frame1, (640, 480))
    
    # --- Perubahan: Simulasikan data navigasi terbaru di sini ---
    # Ganti ini dengan cara kamu mendapatkan data dari Pixhawk

    # Lakukan deteksi objek
    results = model(frame, conf=0.9, verbose=False)
    
    # Misal: merah adalah class index 0, sesuaikan dengan model Anda
    # hijau = 0
    # merah = 1
    
    if results[0].boxes[0].cls[0] == 0:
        x1, y1, x2, y2 = results[0].boxes[0].xyxy[0]
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Ambil data terbaru dari nav_data
        navData = (
            client.table('nav_data')
            .select('*')
            .order('timestamp', desc=True)
            .limit(1)
            .execute()
        )

        # Ambil data terbaru dari cog_data
        cogdata = (
            client.table('cog_data')
            .select('*')
            .order('timestamp', desc=True)
            .limit(1)
            .execute()
        )


        if navData.data:
            latestPosition = [navData.data[0]['latitude'], navData.data[0]['longitude']]
            formatAtion = formatA(latestPosition[0], latestPosition[1])
            sog_kmsh = ms_to_kmh(navData.data[0]['sog_ms'])

        if cogdata.data:
            latestCog = cogdata.data[0]['cog']


        latest_nav_data = {
        "Koordinat": formatAtion,
        "sog_kmsh": sog_kmsh,
        "cog": cogdata.data[0]['cog']}

        try:
            # Format metadata menjadi string
            metadata_text = [
                f"Day: {datetime.datetime.now().strftime('%a')}",
                f"Date: {datetime.datetime.now().strftime('%d/%m/%Y')}",
                f"Time: {datetime.datetime.now().strftime('%H:%M:%S')}",
                f"Coordinate: {latest_nav_data['Koordinat']}",
                f"SOG: {latest_nav_data['sog_kmsh']:.2f} km/h",
                f"COG: {latest_nav_data['cog']:.2f}°"
            ]

            # --- Bagian Baru: Gambar teks di frame ---
            y_offset = 30
            for text_line in metadata_text:
                cv2.putText(
                    frame,
                    text_line,
                    (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, # Skala font
                    (255, 255, 255), # Warna putih
                    1, # Ketebalan
                    cv2.LINE_AA,
                )
                y_offset += 20

            # Simpan frame dengan metadata sebagai file gambar
            image_filename = "kamera_atas.jpg"
            cv2.imwrite(image_filename, frame)

            # Unggah foto ke Supabase Storage
            with open(image_filename, 'rb') as f:
                client.storage.from_("missionimages").upload(image_filename, f.read(), {'content-type': 'image/jpeg'})
            
            public_url = client.storage.from_("missionimages").get_public_url(image_filename)
            
            
            # Masukkan metadata ke tabel 'gambar_atas'
            data_to_insert = {
                "image_url": public_url,
                "image_slot_name": "kamera_atas",
            }
            client.table('image_mission').insert(data_to_insert).execute()

            print(f"✅ Foto dengan metadata berhasil diunggah.")
  
            
        except Exception as e:
            print(f"Terjadi kesalahan saat mengirim data ke Supabase: {e}")

    if results[0].boxes[0].cls[0] == 1:
        x1, y1, x2, y2 = results[0].boxes[0].xyxy[0]
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Ambil data terbaru dari nav_data
        navData = (
            client.table('nav_data')
            .select('*')
            .order('timestamp', desc=True)
            .limit(1)
            .execute()
        )

        # Ambil data terbaru dari cog_data
        cogdata = (
            client.table('cog_data')
            .select('*')
            .order('timestamp', desc=True)
            .limit(1)
            .execute()
        )


        if navData.data:
            latestPosition = [navData.data[0]['latitude'], navData.data[0]['longitude']]
            formatAtion = formatA(latestPosition[0], latestPosition[1])
            sog_kmsh = ms_to_kmh(navData.data[0]['sog_ms'])

        if cogdata.data:
            latestCog = cogdata.data[0]['cog']


        latest_nav_data = {
        "Koordinat": formatAtion,
        "sog_kmsh": sog_kmsh,
        "cog": cogdata.data[0]['cog']}

        try:
            # Format metadata menjadi string
            metadata_text = [
                f"Day: {datetime.datetime.now().strftime('%a')}",
                f"Date: {datetime.datetime.now().strftime('%d/%m/%Y')}",
                f"Time: {datetime.datetime.now().strftime('%H:%M:%S')}",
                f"Coordinate: {latest_nav_data['Koordinat']}",
                f"SOG: {latest_nav_data['sog_kmsh']:.2f} km/h",
                f"COG: {latest_nav_data['cog']:.2f}°"
            ]

            # --- Bagian Baru: Gambar teks di frame ---
            y_offset = 30
            for text_line in metadata_text:
                cv2.putText(
                    frame,
                    text_line,
                    (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, # Skala font
                    (255, 255, 255), # Warna putih
                    1, # Ketebalan
                    cv2.LINE_AA,
                )
                y_offset += 20

            # Simpan frame dengan metadata sebagai file gambar
            image_filename = "kamera_bawah.jpg"
            cv2.imwrite(image_filename, frame)

            # Unggah foto ke Supabase Storage
            with open(image_filename, 'rb') as f:
                client.storage.from_("missionimages").upload(image_filename, f.read(), {'content-type': 'image/jpeg'})
            
            public_url = client.storage.from_("missionimages").get_public_url(image_filename)
            
            
            # Masukkan metadata ke tabel 'gambar_atas'
            data_to_insert = {
                "image_url": public_url,
                "image_slot_name": "kamera_atas",
            }
            client.table('image_mission').insert(data_to_insert).execute()

            print(f"✅ Foto dengan metadata berhasil diunggah.")
  
            
        except Exception as e:
            print(f"Terjadi kesalahan saat mengirim data ke Supabase: {e}") 

        
    cv2.imshow("Deteksi Objek", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


