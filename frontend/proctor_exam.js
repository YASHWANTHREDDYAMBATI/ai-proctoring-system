const API_URL = "http://127.0.0.1:8000";

// Change these if you want different behavior
const FRAME_CAPTURE_MS = 2000;          // YOLO runs every 2 seconds
const DETECTION_CONF_THRESHOLD = 0.5;   // minimum confidence for detections

// MediaPipe timing constants
const FACE_MISSING_SECONDS = 3;         // flag if face absent for 3+ continuous seconds
const LOOK_AWAY_SUSTAIN_SECONDS = 5;    // flag if looking away for 5+ continuous seconds
const VIOLATION_THROTTLE_SECONDS = 10;  // max one log per 10 seconds per violation type

let currentExamId = null;
let proctorTimer = null;
let webcamStream = null;

let examTime = 0;

let countdownTimer = null;

// One-question-at-a-time exam state
let allQuestions = [];
let currentQuestionIndex = 0;
let studentAnswers = {}; // question_id -> "A"|"B"|"C"|"D"

// Tab-switch detection state
let tabSwitchCount = 0;
const TAB_SWITCH_RISK_POINTS = 15; // mirrors backend VIOLATION_POINTS.tab_switch

// Live Monitoring panel visibility (detection keeps running regardless)
let monitorHidden = false;

// FaceMesh state
let faceMesh = null;
let camera = null;
let lastFaceDetected = null; // boolean
let faceMissingSinceMs = null;
let lastFaceMissingLogAtMs = 0;

let lastLookingDir = null; // "left"|"right"|"up"|"down"|null
let lastLookingAwaySinceMs = null;
let lastLookingAwayLogAtMs = 0;

// UI helpers
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}


async function startProctoring(examId) {
    currentExamId = examId;

    document.getElementById("error").innerText = "";
    document.getElementById("status").innerText = "Starting exam...";

    const studentIdInit = localStorage.getItem("student_id");
    if (!studentIdInit) {
        document.getElementById("error").innerText = "Please login first.";
        document.getElementById("status").innerText = "";
        return;
    }

    let attempt;
    try {
        const startResponse = await fetch(`${API_URL}/exam/${examId}/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: parseInt(studentIdInit) })
        });
        attempt = await startResponse.json();
        if (!startResponse.ok) {
            throw new Error(attempt.detail || "This exam cannot be started.");
        }
    } catch (error) {
        document.getElementById("error").innerText = error.message || "Unable to start exam.";
        document.getElementById("status").innerText = "";
        return;
    }

    document.getElementById("status").innerText = "Requesting webcam permissions...";

    // Reset Member 2 state
    faceMissingSinceMs = null;
    lastFaceDetected = null;
    lastFaceMissingLogAtMs = 0;

    lastLookingDir = null;
    lastLookingAwaySinceMs = null;
    lastLookingAwayLogAtMs = 0;

    setText("faceStatus", "--");
    setText("attentionStatus", "Looking Forward");
    setText("personStatus", "--");
    setText("phoneStatus", "Not Detected");

    // Initialize risk row so student appears in faculty view even with no violations
    if (studentIdInit) {
        fetch(`${API_URL}/risk/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                student_id: parseInt(studentIdInit),
                exam_id: parseInt(examId)
            })
        }).catch(() => {});
    }

    // Webcam setup
    const video = document.getElementById("video");

    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
        video.srcObject = webcamStream;
        await video.play();

        // Detect if the camera stream gets killed mid-exam
        webcamStream.getTracks().forEach(track => {
            track.addEventListener("ended", async () => {
                setText("faceStatus", "Camera Lost");
                console.warn(`[PROCTOR] Camera stream ended mid-exam | t=${new Date().toISOString()}`);
                const sid = localStorage.getItem("student_id");
                if (sid && currentExamId) {
                    await logViolationAndRisk(sid, currentExamId, "face_detection_failure", 5,
                        "reason=camera_stream_ended").catch(() => {});
                }
            });
        });
    } catch (e) {
        document.getElementById("error").innerText =
            "Webcam permission denied or not available.";
        document.getElementById("status").innerText = "";
        // Log face detection failure (camera blocked/unavailable)
        const studentIdFail = localStorage.getItem("student_id");
        if (studentIdFail && examId) {
            console.warn(`[PROCTOR] Face detection failure (camera blocked) | t=${new Date().toISOString()}`);
            await logViolationAndRisk(studentIdFail, examId, "face_detection_failure", 5,
                `reason=${e.name || "camera_unavailable"}`).catch(() => {});
        }
        return;
    }

    // Load questions for the exam
    await loadQuestions(examId, attempt);

document.getElementById("status").innerText = "Proctoring started.";

startTimer();
setupTabSwitchDetection();

    // Capture frames periodically for YOLO
    console.log("Starting detection timer...");
    proctorTimer = setInterval(captureAndDetectFrame, FRAME_CAPTURE_MS);

    // Start FaceMesh (MediaPipe)
    await startFaceMesh(video);
}


async function loadQuestions(examId, attempt) {

    // Fetch exam details (name + duration)
    const examResponse =
        await fetch(`${API_URL}/exam/${examId}`);

    const exam =
        await examResponse.json();

    // The stored attempt deadline, rather than a fresh duration, survives refreshes.
    examTime = Math.max(
        0,
        Math.ceil(
            (new Date(attempt.deadline_at) - new Date(attempt.current_time)) / 1000
        )
    );

    // Show exam name
    document.getElementById("examTitle").innerText =
        exam.exam_name;

    // Fetch questions
    const response =
        await fetch(`${API_URL}/questions/${examId}`);

    const questions =
        await response.json();

    allQuestions = questions;
    studentAnswers = {};
    currentQuestionIndex = 0;

    renderQuestion(0);
}

function renderQuestion(index) {
    const contentEl = document.getElementById("content");
    const total = allQuestions.length;

    if (!total) {
        contentEl.innerHTML = `
            <h2 class="question-heading">Exam Questions</h2>
            <p style="color:#94a3b8">No questions were found for this exam.</p>
        `;
        document.getElementById("questionProgress").innerText = "";
        document.getElementById("progressFill").style.width = "0%";
        document.getElementById("prevBtn").style.display = "none";
        document.getElementById("nextBtn").style.display = "none";
        document.getElementById("submitBtn").style.display = "none";
        return;
    }

    currentQuestionIndex = Math.max(0, Math.min(index, total - 1));
    const question = allQuestions[currentQuestionIndex];
    const selected = studentAnswers[question.question_id];

    const renderOption = (letter, text) => `
        <label class="option-card">
            <input type="radio"
                   name="q${question.question_id}"
                   value="${letter}"
                   ${selected === letter ? "checked" : ""}
                   onchange="selectAnswer(${question.question_id}, '${letter}')">
            ${text}
        </label>
    `;

    contentEl.innerHTML = `
        <div class="question-card">
            <h3>Question ${currentQuestionIndex + 1}</h3>
            <p class="question-text">${question.question_text}</p>
            ${renderOption("A", question.option_a)}
            ${renderOption("B", question.option_b)}
            ${renderOption("C", question.option_c)}
            ${renderOption("D", question.option_d)}
        </div>
    `;

    document.getElementById("questionProgress").innerText =
        `Question ${currentQuestionIndex + 1} of ${total}`;
    document.getElementById("progressFill").style.width =
        `${((currentQuestionIndex + 1) / total) * 100}%`;

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const submitBtn = document.getElementById("submitBtn");

    prevBtn.style.display = "inline-block";
    prevBtn.disabled = currentQuestionIndex === 0;

    const isLastQuestion = currentQuestionIndex === total - 1;
    nextBtn.style.display = isLastQuestion ? "none" : "inline-block";
    submitBtn.style.display = isLastQuestion ? "inline-block" : "none";
}

function selectAnswer(questionId, value) {
    studentAnswers[questionId] = value;
}

function nextQuestion() {
    if (currentQuestionIndex < allQuestions.length - 1) {
        renderQuestion(currentQuestionIndex + 1);
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        renderQuestion(currentQuestionIndex - 1);
    }
}
function captureFrameToBlob() {

    const video =
        document.getElementById("video");

    const canvas =
        document.getElementById("canvas");

    const ctx =
        canvas.getContext("2d");

    if (
        !video.videoWidth ||
        !video.videoHeight
    ) {
        return null;
    }

    // Resize image before sending to YOLO
    const targetWidth = 640;

    const scale =
        targetWidth / video.videoWidth;

    const targetHeight =
        Math.floor(video.videoHeight * scale);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    return new Promise(resolve => {

        canvas.toBlob(
            blob => resolve(blob),
            "image/jpeg",
            0.8
        );

    });
}

async function captureAndDetectFrame() {
    console.log("captureAndDetectFrame running");
    try {
        const studentId = localStorage.getItem("student_id");
        if (!studentId || !currentExamId) return;

        const blob = await captureFrameToBlob();
        if (!blob) return;

        const formData = new FormData();
        formData.append("file", blob, `frame_${Date.now()}.jpg`);

        const detectResp = await fetch(`${API_URL}/detect-objects`, {
            method: "POST",
            body: formData
        });

        const data = await detectResp.json();

        await autoLogViolations(studentId, currentExamId, data);

    } catch (e) {
        // Avoid spamming UI every interval
        console.error("Proctoring error:", e);
    }
}

async function autoLogViolations(studentId, examId, yoloResult) {
    // Update live UI
    const personCount = yoloResult.person_count ?? 0;
    const personEl = document.getElementById("personStatus");
    if (personEl) {
        personEl.innerText = personCount;
        personEl.style.color = yoloResult.multiple_persons ? "#dc2626" : "#16a34a";
    }

    const phoneEl = document.getElementById("phoneStatus");
    if (phoneEl) {
        phoneEl.innerText = yoloResult.mobile_detected ? "DETECTED" : "Not Detected";
        phoneEl.style.color = yoloResult.mobile_detected ? "#dc2626" : "#16a34a";
    }

    // Mobile phone detected (+20, conf >= 0.5)
    if (yoloResult.mobile_detected) {
        const phoneDetails = `conf=${yoloResult.mobile_confidence}, bbox=${JSON.stringify(yoloResult.mobile_bbox)}`;
        console.warn(`[PROCTOR] Mobile phone | ${phoneDetails} | t=${new Date().toISOString()}`);
        await logViolationAndRisk(studentId, examId, "mobile_phone", 20, phoneDetails);
    }

    // Multiple persons detected (+15)
    if (yoloResult.multiple_persons) {
        const personsDetails = `person_count=${yoloResult.person_count}`;
        console.warn(`[PROCTOR] Multiple persons (${yoloResult.person_count}) | t=${new Date().toISOString()}`);
        await logViolationAndRisk(studentId, examId, "multiple_persons", 15, personsDetails);
    }
}

async function logViolationAndRisk(studentId, examId, violationType, riskPoints, details = null) {
    await fetch(`${API_URL}/violations/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_id: parseInt(studentId),
            exam_id: parseInt(examId),
            violation_type: violationType,
            risk_points: riskPoints,
            details: details
        })
    });

    await fetch(`${API_URL}/risk/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_id: parseInt(studentId),
            exam_id: parseInt(examId),
            violation: violationType
        })
    });
}

async function submitExam() {
    const studentId = localStorage.getItem("student_id");
    const examId = currentExamId;

    if (!studentId || !examId) return;

    // Stop proctoring before submit
    if (proctorTimer) {
        clearInterval(proctorTimer);
        proctorTimer = null;
    }
    if(countdownTimer){

    clearInterval(countdownTimer);

    countdownTimer = null;
}
    if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
    }

    // Answers are tracked in studentAnswers as the student navigates questions
    const answers = Object.keys(studentAnswers).map(qId => ({
        question_id: parseInt(qId),
        selected_option: studentAnswers[qId]
    }));

    const payload = {
        student_id: parseInt(studentId),
        exam_id: parseInt(examId),
        answers: answers
    };

    const response = await fetch(`${API_URL}/exam/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        document.getElementById("error").innerText =
            result.detail || result.message || "Unable to submit the exam.";
        return;
    }

    // Hide timer and submit button
    const timerBox = document.querySelector(".timer-box");
    if (timerBox) timerBox.style.display = "none";
    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) submitBtn.style.display = "none";

    document.getElementById("error").innerText = "";

    const score = result.score ?? result.correct_answers ?? "--";
    const total = result.total_questions ?? "--";
    const pct   = result.percentage != null ? result.percentage : "--";

    document.getElementById("content").innerHTML = `
        <div style="text-align:center; padding: 40px 20px;">
            <h2 style="margin-bottom:16px;">${result.message || "Exam Submitted"}</h2>
            <p style="font-size:1.1rem; margin-bottom:8px;">Score: ${score}/${total}</p>
            <p style="font-size:1.1rem; margin-bottom:32px;">Percentage: ${pct}%</p>
            <button onclick="window.location.href='student_dashboard.html'"
                style="font-size:1rem; padding:14px 36px; border-radius:8px; border:none;
                       background:#3b82f6; color:#fff; cursor:pointer; font-weight:600;">
                Back to Dashboard
            </button>
        </div>
    `;
}

function classifyLookingDirection(landmarks, videoW, videoH) {
    const lm = landmarks;

    const noseX = lm[1].x;
    const noseY = lm[1].y;

    // lm[33]  = person's LEFT  eye outer corner → appears on image RIGHT (higher x)
    // lm[263] = person's RIGHT eye outer corner → appears on image LEFT  (lower x)
    const leftOuterX  = lm[33].x;   // higher x for forward-facing
    const rightOuterX = lm[263].x;  // lower x for forward-facing

    // --- YAW ---
    // Normalize nose X within the eye-outer-corner horizontal span.
    // 0.5 = forward. Moving toward 0 or 1 (or past them) = head turning.
    // This works even for near-profile views where face-boundary landmarks collapse.
    const eyeSpanX = leftOuterX - rightOuterX;  // positive when face is mostly forward
    let yawNorm = 0.5;
    if (Math.abs(eyeSpanX) > 0.03) {
        yawNorm = (noseX - rightOuterX) / eyeSpanX;
    }

    // --- PITCH ---
    const foreheadY  = lm[10].y;
    const chinY      = lm[152].y;
    const faceHeight = Math.abs(chinY - foreheadY);
    const faceMidY   = (foreheadY + chinY) / 2;
    const normPitch  = faceHeight > 0.02 ? (noseY - faceMidY) / faceHeight : 0;

    // Uncomment to debug values in browser console:
    // console.debug(`[GAZE] yawNorm=${yawNorm.toFixed(3)} normPitch=${normPitch.toFixed(3)}`);

    // yawNorm >0.72 or <0.28 ≈ ~20° horizontal turn (values exceed 1.0 in profile view)
    if (yawNorm > 0.72) return "right";
    if (yawNorm < 0.28) return "left";
    if (normPitch > 0.22) return "down";
    if (normPitch < -0.18) return "up";

    return "forward";
}

function shouldLogFaceMissing(nowMs) {
    if (faceMissingSinceMs == null) return false;
    const missingForMs = nowMs - faceMissingSinceMs;
    if (missingForMs < FACE_MISSING_SECONDS * 1000) return false;
    if (nowMs - lastFaceMissingLogAtMs < VIOLATION_THROTTLE_SECONDS * 1000) return false;
    return true;
}

function shouldLogLookingAway(nowMs, lookingDir) {
    if (!lookingDir || lookingDir === "forward") return false;
    if (lastLookingAwaySinceMs == null) return false;
    const awayForMs = nowMs - lastLookingAwaySinceMs;
    if (awayForMs < LOOK_AWAY_SUSTAIN_SECONDS * 1000) return false;
    if (nowMs - lastLookingAwayLogAtMs < VIOLATION_THROTTLE_SECONDS * 1000) return false;
    return true;
}

async function logViolationAndRiskForClient(violationType, riskPoints, details = null) {
    const studentId = localStorage.getItem("student_id");
    if (!studentId || !currentExamId) return;

    await fetch(`${API_URL}/violations/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_id: parseInt(studentId),
            exam_id: parseInt(currentExamId),
            violation_type: violationType,
            risk_points: riskPoints,
            details: details
        })
    });

    await fetch(`${API_URL}/risk/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_id: parseInt(studentId),
            exam_id: parseInt(currentExamId),
            violation: violationType
        })
    });
}

let tabSwitchListenerAttached = false;

function setupTabSwitchDetection() {
    if (tabSwitchListenerAttached) return;
    tabSwitchListenerAttached = true;

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) return;
        if (!currentExamId) return;

        tabSwitchCount++;
        const details = `switch #${tabSwitchCount} at ${new Date().toISOString()}`;
        console.warn(`[PROCTOR] Tab switch detected | ${details}`);
        logViolationAndRiskForClient("tab_switch", TAB_SWITCH_RISK_POINTS, details);
    });
}

function toggleMonitorPanel() {
    monitorHidden = !monitorHidden;

    const body = document.getElementById("monitorBody");
    const note = document.getElementById("monitorHiddenNote");
    const btn = document.getElementById("toggleMonitorBtn");

    if (body) body.style.display = monitorHidden ? "none" : "block";
    if (note) note.style.display = monitorHidden ? "block" : "none";
    if (btn) btn.innerText = monitorHidden ? "Show" : "Hide";
    // Detection (YOLO frame capture + FaceMesh) keeps running on its own
    // timers regardless of this panel's visibility.
}

async function startFaceMesh(video) {
    const FaceMeshClass = (window.FaceMesh && typeof window.FaceMesh === "function")
        ? window.FaceMesh : null;

    if (!FaceMeshClass) {
        setText("faceStatus", "FaceMesh N/A");
        console.error("[PROCTOR] FaceMesh CDN script not loaded");
        return;
    }

    faceMesh = new FaceMeshClass({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    try {
        await faceMesh.initialize();
    } catch (initErr) {
        setText("faceStatus", "Init failed");
        console.error("[PROCTOR] FaceMesh initialize() failed:", initErr);
        return;
    }

    // Set onResults AFTER initialize() — setOptions/initialize internally resets listeners
    let faceMeshRunning = true;
    const onResultsCb = (results) => {
        const nowMs = Date.now();
        const videoW = video.videoWidth || 640;
        const videoH = video.videoHeight || 480;

        const hasFace = !!(results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0);
        lastFaceDetected = hasFace;

        if (hasFace) {
            setText("faceStatus", "Face Detected");
            faceMissingSinceMs = null;

            const landmarks = results.multiFaceLandmarks[0];
            const dir = classifyLookingDirection(landmarks, videoW, videoH);

            if (dir === "forward") {
                lastLookingDir = "forward";
                lastLookingAwaySinceMs = null;
                setText("attentionStatus", "Looking Forward");
            } else {
                lastLookingDir = dir;
                setText("attentionStatus", "Looking Away (" + dir + ")");

                if (lastLookingAwaySinceMs == null) lastLookingAwaySinceMs = nowMs;

                if (shouldLogLookingAway(nowMs, dir)) {
                    const durationS = ((nowMs - (lastLookingAwaySinceMs || nowMs)) / 1000).toFixed(1);
                    const details = `direction=${dir}, duration=${durationS}s`;
                    console.warn(`[PROCTOR] Looking away (${dir}) for ${durationS}s`);
                    lastLookingAwayLogAtMs = nowMs;
                    lastLookingAwaySinceMs = null;
                    (async () => { await logViolationAndRiskForClient("looking_away", 8, details); })();
                }
            }
        } else {
            setText("faceStatus", "Face Missing");
            if (faceMissingSinceMs == null) faceMissingSinceMs = nowMs;

            if (shouldLogFaceMissing(nowMs)) {
                const absentS = ((nowMs - (faceMissingSinceMs || nowMs)) / 1000).toFixed(1);
                console.warn(`[PROCTOR] Face missing for ${absentS}s`);
                lastFaceMissingLogAtMs = nowMs;
                faceMissingSinceMs = nowMs;
                (async () => { await logViolationAndRiskForClient("face_missing", 10, `absent_duration=${absentS}s`); })();
            }
        }

    };

    // onResults is a METHOD (not a property) — call it to register the listener
    faceMesh.onResults(onResultsCb);

    // Capture frames via canvas and send at ~5fps using setInterval.
    // Passing a canvas snapshot is more reliable than passing the video element directly.
    const faceCanvas = document.createElement("canvas");
    const faceCtx = faceCanvas.getContext("2d");

    // Use fixed canvas size — avoids videoWidth=0 race on stream startup
    faceCanvas.width = 640;
    faceCanvas.height = 480;

    const faceTimer = setInterval(() => {
        if (!faceMeshRunning || !faceMesh) { clearInterval(faceTimer); return; }
        if (video.readyState < 1) return;
        faceCtx.drawImage(video, 0, 0, 640, 480);
        faceMesh.send({ image: faceCanvas }).catch(() => {});
    }, 200);

    webcamStream.getTracks().forEach(track => {
        track.addEventListener("ended", () => {
            faceMeshRunning = false;
            clearInterval(faceTimer);
        });
    });
}

// Read examId from query string and start
function startTimer(){

    const renderTimer = () => {
        const minutes = Math.floor(Math.max(examTime, 0) / 60);
        const seconds = Math.max(examTime, 0) % 60;
        const timer = document.getElementById("timer");
        if (timer) {
            timer.innerText = `${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`;
        }
    };

    renderTimer();

    countdownTimer = setInterval(() => {
        examTime--;
        renderTimer();

        if(examTime < 0){

            clearInterval(countdownTimer);

            submitExam();
        }

    },1000);
}

// Read examId from query string and start
function getQueryParam(name) {

    const params =
        new URLSearchParams(window.location.search);

    return params.get(name);
}

document.addEventListener("DOMContentLoaded", async () => {

    const examId = getQueryParam("examId");

    if (!examId) {

        document.getElementById("error").innerText =
            "Missing examId in URL.";

        return;
    }

    const studentId =
        localStorage.getItem("student_id");

    if (!studentId) {

        document.getElementById("error").innerText =
            "Please login first.";

        return;
    }

    await startProctoring(examId);
});

// Expose for inline onclick in HTML if needed
window.submitExam = submitExam;
window.startProctoring = startProctoring;
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.selectAnswer = selectAnswer;
window.toggleMonitorPanel = toggleMonitorPanel;
