import os
import gc
import numpy as np
from pathlib import Path
from ultralytics import YOLO
import openvino as ov


pt_model = YOLO("deteksibouys.pt")
pt_model.export(format="openvino", dynamic=True, half=True)
del pt_model
gc.collect()