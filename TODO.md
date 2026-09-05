- [x] Step 1: Improve YOLO detector logic + confidence threshold (backend/ai/yolo_detector.py)
- [x] Step 2: Add/update DB schema for violations and risk_scores (sql/database.sql)

- [x] Step 3: Add FastAPI endpoints: /violations/log, /risk/update, /faculty/violations (backend/main.py)

- [x] Step 4: Ensure YOLO /detect-objects output maps to violation types + points consistently (backend/main.py + frontend JS)

- [x] Step 5: Add webcam frame detection in the proctoring frontend (frontend page with exam running)
- [x] Step 6: Add auto-logging frontend calls to /violations/log and /risk/update
- [x] Step 7: Validate by running uvicorn + testing /docs endpoints and one end-to-end flow


