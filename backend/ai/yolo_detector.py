from ultralytics import YOLO

model = YOLO("yolov8n.pt")

# YOLO output is fairly noisy; a small threshold improves stability.
DEFAULT_CONF_THRESHOLD = 0.25   # general objects
PERSON_CONF_THRESHOLD = 0.55   # stricter for person to avoid partial/background detections
PHONE_CONF_THRESHOLD = 0.50    # stricter for mobile phone (reduce false positives)
PERSON_MIN_AREA_FRAC = 0.03    # person bbox must cover ≥3% of image area (filters tiny ghosts)


def _normalize_class_name(name: str) -> str:
    return (name or "").strip().lower()


def detect_objects(image_path: str, conf_threshold: float = DEFAULT_CONF_THRESHOLD):
    results = model(image_path)

    mobile_detected = False
    mobile_confidence = 0.0
    mobile_bbox = None
    person_count = 0
    detections = []

    for result in results:
        if result.boxes is None:
            continue

        # Image dimensions for area filtering
        img_h, img_w = result.orig_shape if result.orig_shape else (480, 640)
        img_area = img_w * img_h

        for box in result.boxes:
            cls_id = int(box.cls[0])
            class_name = model.names[cls_id]
            class_norm = _normalize_class_name(class_name)
            confidence = float(box.conf[0])

            if confidence < conf_threshold:
                continue

            xyxy = box.xyxy[0].tolist()
            bbox = [round(v, 1) for v in xyxy]  # [x1, y1, x2, y2]

            detections.append({
                "class": class_name,
                "confidence": round(confidence, 2),
                "bbox": bbox
            })

            # Mobile phone: COCO class 67 = "cell phone", stricter threshold
            if class_norm == "cell phone" or cls_id == 67 or (
                "cell" in class_norm and "phone" in class_norm
            ):
                if confidence >= PHONE_CONF_THRESHOLD:
                    mobile_detected = True
                    mobile_confidence = round(confidence, 2)
                    mobile_bbox = bbox

            if class_norm == "person":
                # Apply stricter confidence + minimum size to reduce false positives
                box_area = (xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1])
                area_frac = box_area / img_area if img_area > 0 else 0
                if confidence >= PERSON_CONF_THRESHOLD and area_frac >= PERSON_MIN_AREA_FRAC:
                    person_count += 1

    return {
        "mobile_detected": mobile_detected,
        "mobile_confidence": mobile_confidence,
        "mobile_bbox": mobile_bbox,
        "person_count": person_count,
        "multiple_persons": person_count > 1,
        "detections": detections,
    }

