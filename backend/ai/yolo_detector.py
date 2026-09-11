from ultralytics import YOLO
import torch

# Use a GPU if available — this matters way more for "1 sec" than any other tweak
DEVICE = 0 if torch.cuda.is_available() else "cpu"

model = YOLO("yolov8n.pt")
model.to(DEVICE)

# Warm up once at import time — first inference call is always slow (CUDA context, graph build, etc.)
_ = model(torch.zeros(1, 3, 640, 640), device=DEVICE, verbose=False)

DEFAULT_CONF_THRESHOLD = 0.25
PERSON_CONF_THRESHOLD = 0.55
PHONE_CONF_THRESHOLD = 0.30
PERSON_MIN_AREA_FRAC = 0.03
PHONE_CLASS_ID = 67

# Lowest threshold across everything you care about — one inference call, one NMS pass
_MIN_CONF_FOR_PASS = min(DEFAULT_CONF_THRESHOLD, PHONE_CONF_THRESHOLD)


def _normalize_class_name(name: str) -> str:
    return (name or "").strip().lower()


def detect_objects(image_path: str, conf_threshold: float = DEFAULT_CONF_THRESHOLD):
    results = model(
        image_path,
        imgsz=640,
        conf=_MIN_CONF_FOR_PASS,
        device=DEVICE,
        half=(DEVICE != "cpu"),   # fp16 on GPU — meaningful speedup, negligible accuracy loss
        verbose=False,
    )

    mobile_detected = False
    mobile_confidence = 0.0
    mobile_bbox = None
    person_count = 0
    detections = []

    for result in results:
        if result.boxes is None:
            continue

        img_h, img_w = result.orig_shape if result.orig_shape else (480, 640)
        img_area = img_w * img_h

        for box in result.boxes:
            cls_id = int(box.cls[0])
            class_name = model.names[cls_id]
            class_norm = _normalize_class_name(class_name)
            confidence = float(box.conf[0])

            # per-class thresholds applied here instead of a second model call
            if cls_id == PHONE_CLASS_ID:
                if confidence < PHONE_CONF_THRESHOLD:
                    continue
            elif class_norm == "person":
                if confidence < PERSON_CONF_THRESHOLD:
                    continue
            else:
                if confidence < conf_threshold:
                    continue

            xyxy = box.xyxy[0].tolist()
            bbox = [round(v, 1) for v in xyxy]

            if cls_id == PHONE_CLASS_ID:
                detections.append({"class": "cell phone", "confidence": round(confidence, 2), "bbox": bbox})
                if confidence > mobile_confidence:
                    mobile_detected = True
                    mobile_confidence = round(confidence, 2)
                    mobile_bbox = bbox
                continue

            detections.append({"class": class_name, "confidence": round(confidence, 2), "bbox": bbox})

            if class_norm == "person":
                box_area = (xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1])
                area_frac = box_area / img_area if img_area > 0 else 0
                if area_frac >= PERSON_MIN_AREA_FRAC:
                    person_count += 1

    return {
        "mobile_detected": mobile_detected,
        "mobile_confidence": mobile_confidence,
        "mobile_bbox": mobile_bbox,
        "person_count": person_count,
        "multiple_persons": person_count > 1,
        "detections": detections,
    }