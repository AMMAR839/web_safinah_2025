import os
import cv2
import datetime
import gc
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import openvino as ov
from supabase import create_client, Client

# --- Fungsi bantu ---
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

# --- Supabase ---
SUPABASE_URL = "https://jyjunbzusfrmaywmndpa.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anVuYnp1c2ZybWF5d21uZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NDMxMTgsImV4cCI6MjA2OTQxOTExOH0.IQ6yyyR2OpvQj1lIL1yFsWfVNhJIm2_EFt5Pnv4Bd38"
client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# --- OpenVINO setup ---
det_model_path = Path("deteksibouys_openvino_model/deteksibouys.xml")


core = ov.Core()

def compile_model(det_model_path, device):
    det_ov_model = core.read_model(det_model_path)
    ov_config = {}
    if device != "CPU":
        det_ov_model.reshape({0: [1, 3, 640, 640]})
    if "GPU" in device or ("AUTO" in device and "GPU" in core.available_devices):
        ov_config = {"GPU_DISABLE_WINOGRAD_CONVOLUTION": "YES"}
    det_compiled_model = core.compile_model(det_ov_model, device, ov_config)
    return det_compiled_model

def load_model(det_model_path, device):
    compiled_model = compile_model(det_model_path, device)
    det_model = YOLO(det_model_path.parent, task="detect")

    if det_model.predictor is None:
        custom = {"conf": 0.25, "batch": 1, "save": False, "mode": "predict"}
        args = {**det_model.overrides, **custom}
        det_model.predictor = det_model._smart_load("predictor")(overrides=args, _callbacks=det_model.callbacks)
        det_model.predictor.setup_model(model=det_model.model)

    det_model.predictor.model.ov_compiled_model = compiled_model
    return det_model

det_model = load_model(det_model_path, "CPU")  # bisa "AUTO", "GPU" dsb.

# --- Kamera ---
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Error: Tidak dapat membuka kamera/video.")
    exit()

kamera_atas_sudah_difoto = False
kamera_bawah_sudah_difoto = False
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("❌ Tidak ada frame. Keluar.")
        break

    # Resize opsional
    frame = cv2.resize(frame, (640, 480))

    # --- Jalankan deteksi OpenVINO YOLO ---
    detections = det_model(frame, conf=0.9, verbose=False)

    if detections[0].boxes:  # Check if any detections exist
        for box in detections[0].boxes:
            cls_id = int(box.cls[0])  # 0=hijau, 1=merah
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # warna kotak sesuai class
            color = (0,255,0) if cls_id==0 else (0,0,255)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Ambil data navigasi terbaru
            navData = (
                client.table('nav_data')
                .select('*')
                .order('timestamp', desc=True)
                .limit(1)
                .execute()
            )
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
                "cog": cogdata.data[0]['cog']
            }

            # Tulis metadata di frame
            metadata_text = [
                f"Day: {datetime.datetime.now().strftime('%a')}",
                f"Date: {datetime.datetime.now().strftime('%d/%m/%Y')}",
                f"Time: {datetime.datetime.now().strftime('%H:%M:%S')}",
                f"Coordinate: {latest_nav_data['Koordinat']}",
                f"SOG: {latest_nav_data['sog_kmsh']:.2f} km/h",
                f"COG: {latest_nav_data['cog']:.2f}°"
            ]

            y_offset = 30
            for text_line in metadata_text:
                cv2.putText(frame, text_line, (10, y_offset),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1, cv2.LINE_AA)
                y_offset += 20

            # Simpan frame dengan nama berbeda sesuai class
            if (cls_id==0 and not kamera_atas_sudah_difoto):
                image_filename = "kamera_atas.jpg"
                kamera_atas_sudah_difoto = True
            elif (cls_id==1 and not kamera_bawah_sudah_difoto):
                image_filename = "kamera_bawah.jpg"
                kamera_bawah_sudah_difoto = True

            if image_filename and ((cls_id==0 and kamera_atas_sudah_difoto) or (cls_id==1 and kamera_bawah_sudah_difoto)):
                cv2.imwrite(image_filename, frame)

                # Upload ke Supabase Storage
                with open(image_filename, 'rb') as f:
                    client.storage.from_("missionimages").upload(image_filename, f.read(), {'content-type': 'image/jpeg'})
                public_url = client.storage.from_("missionimages").get_public_url(image_filename)

                # Insert metadata ke DB
                data_to_insert = {
                    "image_url": public_url,
                    "image_slot_name": "kamera_atas" if cls_id==0 else "kamera_bawah",
                }
                client.table('image_mission').insert(data_to_insert).execute()
                print(f"✅ Foto {image_filename} berhasil diunggah.")

    cv2.imshow("Deteksi Buoy OpenVINO", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
