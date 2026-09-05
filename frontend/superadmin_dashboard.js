const API_URL = "http://127.0.0.1:8000";

const admin = JSON.parse(localStorage.getItem("superadmin"));
if (!admin) window.location.href = "index.html";

document.getElementById("welcome").innerText = admin ? `Welcome, ${admin.name}` : "";

// â”€â”€ HOME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function showHome() {
    document.getElementById("content-area").innerHTML = `<div class="section-box"><p>Loading stats...</p></div>`;

    try {
        const resp = await fetch(`${API_URL}/superadmin/stats`);
        const s = await resp.json();

        document.getElementById("content-area").innerHTML = `
        <div class="section-box">
            <h2 style="margin-bottom:24px;color:#0f172a">System Overview</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;">
                ${statCard("fa-user-graduate","Students", s.total_students, "#3b82f6")}
                ${statCard("fa-chalkboard-teacher","Faculty", s.total_faculty, "#8b5cf6")}
                ${statCard("fa-file-alt","Exams", s.total_exams, "#10b981")}
                ${statCard("fa-clipboard-list","Results", s.total_results, "#f59e0b")}
                ${statCard("fa-triangle-exclamation","Violations", s.total_violations, "#ef4444")}
                ${statCard("fa-ban","Malpractice Detected", s.invalid_exams, "#dc2626")}
            </div>
        </div>`;
    } catch(e) {
        document.getElementById("content-area").innerHTML = `<div class="section-box"><p style="color:red">Unable to load stats.</p></div>`;
    }
}

function statCard(icon, label, value, color) {
    return `
    <div style="background:#fff;border-radius:12px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
        <i class="fas ${icon}" style="font-size:30px;color:${color};margin-bottom:10px;"></i>
        <div style="font-size:28px;font-weight:700;color:#0f172a">${value}</div>
        <div style="color:#64748b;font-size:14px">${label}</div>
    </div>`;
}

// â”€â”€ MANAGE STUDENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function showStudents() {
    document.getElementById("content-area").innerHTML = `
    <div class="section-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h2>Manage Students</h2>
            <button onclick="showAddStudentForm()" style="background:#3b82f6;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:14px">
                <i class="fas fa-plus"></i> Add Student
            </button>
        </div>
        <div id="addStudentForm" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px">
            <h3 style="margin-bottom:14px;color:#0f172a">Add New Student</h3>
            <form id="newStudentForm" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <input type="text" id="ns_name" placeholder="Full Name" required style="padding:9px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                <input type="text" id="ns_roll" placeholder="Roll Number (e.g. S002)" required style="padding:9px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                <input type="email" id="ns_email" placeholder="Email (optional)" style="padding:9px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                <input type="text" id="ns_pass" placeholder="Default Password" required style="padding:9px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                <button type="submit" style="background:#16a34a;color:#fff;border:none;padding:9px 20px;border-radius:6px;cursor:pointer;font-size:14px">Add Student</button>
                <button type="button" onclick="document.getElementById('addStudentForm').style.display='none'" style="background:#94a3b8;color:#fff;border:none;padding:9px 20px;border-radius:6px;cursor:pointer;font-size:14px">Cancel</button>
            </form>
            <p id="addStudentMsg" style="margin-top:10px;font-size:14px"></p>
        </div>
        <div id="studentsTable">Loading...</div>
    </div>`;

    document.getElementById("newStudentForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("addStudentMsg");
        try {
            const resp = await fetch(`${API_URL}/superadmin/add-student`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: document.getElementById("ns_name").value,
                    roll_no: document.getElementById("ns_roll").value,
                    email: document.getElementById("ns_email").value,
                    password: document.getElementById("ns_pass").value
                })
            });
            const data = await resp.json();
            if (data.message === "Student Added Successfully") {
                msg.style.color = "green";
                msg.innerText = "Student added successfully!";
                document.getElementById("newStudentForm").reset();
                await loadStudentsTable();
            } else {
                msg.style.color = "red";
                msg.innerText = data.message;
            }
        } catch(err) {
            msg.style.color = "red";
            msg.innerText = "Unable to connect to server.";
        }
    });

    await loadStudentsTable();
}

function showAddStudentForm() {
    const form = document.getElementById("addStudentForm");
    form.style.display = form.style.display === "none" ? "block" : "none";
}

async function loadStudentsTable() {
    try {
        const resp = await fetch(`${API_URL}/superadmin/students`);
        const students = await resp.json();

        if (students.length === 0) {
            document.getElementById("studentsTable").innerHTML = "<p>No students registered.</p>";
            return;
        }

        let rows = students.map(s => `
            <tr>
                <td>${s.student_id}</td>
                <td>${s.roll_no}</td>
                <td>${s.name}</td>
                <td>${s.email}</td>
                <td>
                    <button onclick="deleteStudent(${s.student_id}, '${s.name}')"
                        style="background:#ef4444;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;">
                        Delete
                    </button>
                </td>
            </tr>`).join("");

        document.getElementById("studentsTable").innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
                <tr style="background:#3b82f6;color:#fff;text-align:left;">
                    <th style="padding:10px 12px">ID</th>
                    <th style="padding:10px 12px">Roll No</th>
                    <th style="padding:10px 12px">Name</th>
                    <th style="padding:10px 12px">Email</th>
                    <th style="padding:10px 12px">Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    } catch(e) {
        document.getElementById("studentsTable").innerHTML = "<p style='color:red'>Unable to load students.</p>";
    }
}

async function deleteStudent(id, name) {
    if (!confirm(`Delete student "${name}"? This will remove all their exam data.`)) return;
    try {
        await fetch(`${API_URL}/superadmin/students/${id}`, { method: "DELETE" });
        await loadStudentsTable();
    } catch(e) {
        alert("Failed to delete student.");
    }
}

// â”€â”€ MANAGE FACULTY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function showFaculty() {
    document.getElementById("content-area").innerHTML = `
    <div class="section-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h2>Manage Faculty</h2>
            <button onclick="showAddFacultyForm()" style="background:#3b82f6;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:14px">
                <i class="fas fa-plus"></i> Add Faculty
            </button>
        </div>
        <div id="addFacultyForm" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px">
            <h3 style="margin-bottom:14px;color:#0f172a">Add New Faculty</h3>
            <form id="newFacultyForm" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <input type="text" id="nf_name" placeholder="Full Name" required style="padding:9px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                <input type="email" id="nf_email" placeholder="Email (optional)" style="padding:9px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                <input type="text" id="nf_pass" placeholder="Default Password" required style="padding:9px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                <div></div>
                <button type="submit" style="background:#16a34a;color:#fff;border:none;padding:9px 20px;border-radius:6px;cursor:pointer;font-size:14px">Add Faculty</button>
                <button type="button" onclick="document.getElementById('addFacultyForm').style.display='none'" style="background:#94a3b8;color:#fff;border:none;padding:9px 20px;border-radius:6px;cursor:pointer;font-size:14px">Cancel</button>
            </form>
            <p id="addFacultyMsg" style="margin-top:10px;font-size:14px"></p>
        </div>
        <div id="facultyTable">Loading...</div>
    </div>`;

    document.getElementById("newFacultyForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("addFacultyMsg");
        try {
            const resp = await fetch(`${API_URL}/superadmin/add-faculty`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: document.getElementById("nf_name").value,
                    email: document.getElementById("nf_email").value,
                    password: document.getElementById("nf_pass").value
                })
            });
            const data = await resp.json();
            if (data.message === "Faculty Added Successfully") {
                msg.style.color = "green";
                msg.innerText = `Faculty added! Their login ID is: ${data.faculty_code}`;
                document.getElementById("newFacultyForm").reset();
                await loadFacultyTable();
            } else {
                msg.style.color = "red";
                msg.innerText = data.message;
            }
        } catch(err) {
            msg.style.color = "red";
            msg.innerText = "Unable to connect to server.";
        }
    });

    await loadFacultyTable();
}

function showAddFacultyForm() {
    const form = document.getElementById("addFacultyForm");
    form.style.display = form.style.display === "none" ? "block" : "none";
}

async function loadFacultyTable() {
    try {
        const resp = await fetch(`${API_URL}/superadmin/faculty`);
        const faculty = await resp.json();

        if (faculty.length === 0) {
            document.getElementById("facultyTable").innerHTML = "<p>No faculty registered.</p>";
            return;
        }

        let rows = faculty.map(f => `
            <tr>
                <td>${f.faculty_id}</td>
                <td><strong>${f.faculty_code || "â€”"}</strong></td>
                <td>${f.name}</td>
                <td>${f.email || "â€”"}</td>
                <td>
                    <button onclick="deleteFaculty(${f.faculty_id}, '${f.name}')"
                        style="background:#ef4444;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;">
                        Delete
                    </button>
                </td>
            </tr>`).join("");

        document.getElementById("facultyTable").innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
                <tr style="background:#3b82f6;color:#fff;text-align:left;">
                    <th style="padding:10px 12px">ID</th>
                    <th style="padding:10px 12px">Login Code</th>
                    <th style="padding:10px 12px">Name</th>
                    <th style="padding:10px 12px">Email</th>
                    <th style="padding:10px 12px">Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    } catch(e) {
        document.getElementById("facultyTable").innerHTML = "<p style='color:red'>Unable to load faculty.</p>";
    }
}

async function deleteFaculty(id, name) {
    if (!confirm(`Delete faculty "${name}"?`)) return;
    try {
        await fetch(`${API_URL}/superadmin/faculty/${id}`, { method: "DELETE" });
        await loadFacultyTable();
    } catch(e) {
        alert("Failed to delete faculty.");
    }
}

// â”€â”€ CREATE EXAM + ADD QUESTIONS (combined) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _saExamId = null;
let _saQuestionCount = 0;

function showCreateExam() {
    _saExamId = null;
    _saQuestionCount = 0;

    document.getElementById("content-area").innerHTML = `
    <div class="section-box">
        <h2>Create Exam</h2>
        <form id="examForm">
            <label for="exam_name"><b>Exam Name</b></label>
            <input type="text" id="exam_name" placeholder="Exam Name" required>
            <label for="duration"><b>Exam Duration (Minutes)</b></label>
            <input type="number" id="duration" placeholder="Duration (Minutes)" required>
            <label for="availability_start"><b>Availability Start</b></label>
            <input type="datetime-local" id="availability_start" required>
            <label for="availability_end"><b>Availability End</b></label>
            <input type="datetime-local" id="availability_end" required>
            <button type="submit">Create Exam &amp; Add Questions</button>
        </form>
        <p id="examMsg"></p>

        <div id="questionSection" style="display:none;margin-top:24px;border-top:2px solid #e2e8f0;padding-top:20px;">
            <h3 id="examLabel"></h3>
            <p style="color:#64748b;margin-bottom:16px">Add at least 1 question to finish.</p>
            <div id="questionList" style="margin-bottom:16px"></div>
            <form id="questionForm">
                <textarea id="question_text" placeholder="Enter Question" required></textarea>
                <input type="text" id="option_a" placeholder="Option A" required>
                <input type="text" id="option_b" placeholder="Option B" required>
                <input type="text" id="option_c" placeholder="Option C" required>
                <input type="text" id="option_d" placeholder="Option D" required>
                <select id="correct_option" required>
                    <option value="">Correct Answer</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                </select>
                <button type="submit">Add Question</button>
            </form>
            <p id="qMsg"></p>
            <button id="finishBtn" onclick="saFinishExam()"
                style="margin-top:16px;background:#16a34a;color:#fff;padding:10px 24px;border:none;border-radius:8px;cursor:pointer;display:none;">
                ✓ Finish &amp; Save Exam
            </button>
        </div>
    </div>`;

    document.getElementById("examForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("examMsg");
        const examName = document.getElementById("exam_name").value.trim();
        const duration = parseInt(document.getElementById("duration").value, 10);
        const availabilityStart =
            document.getElementById("availability_start").value;
        const availabilityEnd =
            document.getElementById("availability_end").value;
        try {
            const resp = await fetch(`${API_URL}/exams/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    exam_name: examName,
                    duration: duration,
                    availability_start: availabilityStart,
                    availability_end: availabilityEnd,
                    created_by: admin.admin_id
                })
            });
            const data = await resp.json();
            if (data.message === "Exam Created Successfully") {
                _saExamId = data.exam_id;
                msg.style.color = "green";
                msg.innerText = `Exam "${examName}" created! Now add questions below.`;
                document.getElementById("examForm").querySelector("button").disabled = true;
                document.getElementById("examLabel").innerText = `Adding questions to: ${examName}`;
                document.getElementById("questionSection").style.display = "block";
                document.getElementById("questionForm").addEventListener("submit", saSubmitQuestion);
            } else {
                msg.style.color = "red";
                msg.innerText = data.detail || data.message || "Unable to create exam.";
            }
        } catch(err) {
            msg.style.color = "red";
            msg.innerText = "Unable to connect to server.";
        }
    });
}

async function saSubmitQuestion(e) {
    e.preventDefault();
    const qMsg = document.getElementById("qMsg");
    try {
        const resp = await fetch(`${API_URL}/questions/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                exam_id: _saExamId,
                question_text: document.getElementById("question_text").value,
                option_a: document.getElementById("option_a").value,
                option_b: document.getElementById("option_b").value,
                option_c: document.getElementById("option_c").value,
                option_d: document.getElementById("option_d").value,
                correct_option: document.getElementById("correct_option").value
            })
        });
        const data = await resp.json();
        if (data.message === "Question Added Successfully") {
            _saQuestionCount++;
            qMsg.style.color = "green";
            qMsg.innerText = `Question ${_saQuestionCount} added successfully.`;
            document.getElementById("questionList").innerHTML +=
                `<p style="color:#16a34a;font-size:14px">✓ Q${_saQuestionCount}: ${document.getElementById("question_text").value}</p>`;
            document.getElementById("questionForm").reset();
            document.getElementById("finishBtn").style.display = "inline-block";
        } else {
            qMsg.style.color = "red";
            qMsg.innerText = data.message;
        }
    } catch(err) {
        qMsg.style.color = "red";
        qMsg.innerText = "Unable to connect to server.";
    }
}

function saFinishExam() {
    if (_saQuestionCount === 0) { alert("Please add at least 1 question before finishing."); return; }
    document.getElementById("content-area").innerHTML = `
    <div class="section-box" style="text-align:center;padding:40px">
        <i class="fas fa-circle-check" style="font-size:60px;color:#16a34a;margin-bottom:16px"></i>
        <h2 style="color:#0f172a">Exam Created Successfully!</h2>
        <p style="color:#64748b;margin-top:8px">${_saQuestionCount} question(s) added.</p>
        <button onclick="showCreateExam()" style="margin-top:20px;margin-right:10px">Create Another Exam</button>
        <button onclick="showHome()">Back to Dashboard</button>
    </div>`;
}

// â”€â”€ PROCTORING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function showProctoring() {
    if (typeof _stopProctoringRefresh === "function") _stopProctoringRefresh();

    document.getElementById("content-area").innerHTML = `
    <div class="section-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
            <strong style="font-size:18px">Live Proctoring Monitor</strong>
            <div style="display:flex;align-items:center;gap:12px">
                <select id="examFilter" onchange="_saExamFilter=this.value;_saRefreshProctoring()"
                    style="padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                    <option value="">All Exams</option>
                </select>
                <span style="font-size:12px;color:#64748b">Auto-refresh every 5s</span>
                <span id="saLastRefreshed" style="font-size:12px;color:#94a3b8"></span>
            </div>
        </div>
        <div id="proctoringContent">Loading...</div>
        <div id="saViolationPanel" style="display:none;margin-top:24px;border-top:2px solid #e2e8f0;padding-top:20px"></div>
    </div>`;

    let _saExamFilter = "";
    let _saRefreshTimer = null;

    window._saExamFilter = "";
    window._saRefreshProctoring = async function() {
        const examId = window._saExamFilter;
        const url = examId ? `${API_URL}/api/risk-score?exam_id=${examId}` : `${API_URL}/api/risk-score`;
        try {
            const resp = await fetch(url);
            const students = await resp.json();
            const lastEl = document.getElementById("saLastRefreshed");
            if (lastEl) lastEl.innerText = `Last: ${new Date().toLocaleTimeString()}`;
            const tableEl = document.getElementById("proctoringContent");
            if (!tableEl) { clearInterval(window._saRefreshTimer); return; }
            if (!students.length) {
                tableEl.innerHTML = "<p style='color:#64748b;padding:20px 0'>No proctoring data yet.</p>"; return;
            }
            const levelColors = { LOW:{bg:"#dcfce7",color:"#16a34a"}, MEDIUM:{bg:"#fef9c3",color:"#ca8a04"}, HIGH:{bg:"#fee2e2",color:"#dc2626"} };
            let rows = students.map(s => {
                const lc = levelColors[s.risk_level] || levelColors.LOW;
                const levelBadge = `<span style="background:${lc.bg};color:${lc.color};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700">${s.risk_level}</span>`;
                const statusColor = s.exam_status === "INVALID" ? "#dc2626" : "#16a34a";
                const statusBadge = `<span style="background:${statusColor};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">${s.exam_status}</span>`;
                const scoreColor = s.risk_level === "HIGH" ? "#dc2626" : s.risk_level === "MEDIUM" ? "#ca8a04" : "#16a34a";
                const lastViol = s.last_violation_time ? s.last_violation_time.substring(11,19) : "&mdash;";
                return `<tr style="cursor:pointer;border-bottom:1px solid #f1f5f9"
                    onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''"
                    onclick="saOpenViolationLog(${s.student_id},${s.exam_id},'${s.student_name.replace(/'/g,"\\'")}','${s.exam_name.replace(/'/g,"\\'")}')">
                    <td style="padding:12px 14px;font-weight:600">${s.student_name}</td>
                    <td style="padding:12px 14px;color:#475569">${s.roll_no}</td>
                    <td style="padding:12px 14px;color:#475569">${s.exam_name}</td>
                    <td style="padding:12px 14px;font-size:20px;font-weight:800;color:${scoreColor}">${s.risk_score}<span style="font-size:12px;color:#94a3b8">/100</span></td>
                    <td style="padding:12px 14px">${levelBadge}</td>
                    <td style="padding:12px 14px">${statusBadge}</td>
                    <td style="padding:12px 14px;font-size:13px;color:#64748b">${lastViol}</td>
                </tr>`;
            }).join("");
            tableEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead><tr style="background:#1e293b;color:#fff;text-align:left;">
                    <th style="padding:11px 14px">Student</th><th style="padding:11px 14px">Roll No</th>
                    <th style="padding:11px 14px">Exam</th><th style="padding:11px 14px">Risk Score</th>
                    <th style="padding:11px 14px">Risk Level</th><th style="padding:11px 14px">Status</th>
                    <th style="padding:11px 14px">Last Violation</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <p style="margin-top:10px;font-size:12px;color:#94a3b8">Click a row to see full violation timeline &nbsp;|&nbsp;
                <span style="color:#16a34a;font-weight:600">&#9632;</span> LOW &lt;30 &nbsp;
                <span style="color:#ca8a04;font-weight:600">&#9632;</span> MEDIUM 30&ndash;60 &nbsp;
                <span style="color:#dc2626;font-weight:600">&#9632;</span> HIGH &gt;60</p>`;
        } catch(e) {
            const el = document.getElementById("proctoringContent");
            if (el) el.innerHTML = "<p style='color:red'>Unable to load data.</p>";
        }
    };

    // Load exams for filter
    try {
        const er = await fetch(`${API_URL}/exams`);
        const exams = await er.json();
        const dd = document.getElementById("examFilter");
        if (dd) exams.forEach(ex => { dd.innerHTML += `<option value="${ex.exam_id}">${ex.exam_name}</option>`; });
    } catch(e) {}

    await window._saRefreshProctoring();
    window._saRefreshTimer = setInterval(window._saRefreshProctoring, 5000);
}

async function saOpenViolationLog(studentId, examId, studentName, examName) {
    const panel = document.getElementById("saViolationPanel");
    if (!panel) return;
    panel.style.display = "block";
    panel.innerHTML = `<p style="color:#64748b">Loading log for <strong>${studentName}</strong>...</p>`;
    panel.scrollIntoView({ behavior:"smooth", block:"nearest" });
    try {
        const resp = await fetch(`${API_URL}/api/risk-score/student?student_id=${studentId}&exam_id=${examId}`);
        const data = await resp.json();
        if (data.error) { panel.innerHTML = `<p style='color:red'>${data.error}</p>`; return; }
        const violationLabel = { looking_away:"Looking Away", face_missing:"Face Missing", multiple_persons:"Multiple Persons", mobile_phone:"Mobile Phone", face_detection_failure:"Camera Failure", tab_switch:"Tab Switch" };
        const violationColor = { looking_away:"#f59e0b", face_missing:"#ef4444", multiple_persons:"#8b5cf6", mobile_phone:"#dc2626", face_detection_failure:"#64748b", tab_switch:"#f97316" };
        const scoreColor = data.total_score > 60 ? "#dc2626" : data.total_score >= 30 ? "#ca8a04" : "#16a34a";
        const statusColor = data.exam_status === "INVALID" ? "#dc2626" : "#16a34a";
        const timeline = data.events.length ? data.events.map((ev, i) => {
            const label = violationLabel[ev.violation_type] || ev.violation_type;
            const color = violationColor[ev.violation_type] || "#64748b";
            const time = ev.timestamp.substring(0,19).replace("T"," ");
            const details = ev.details ? ` &middot; <span style="color:#94a3b8;font-size:12px">${ev.details}</span>` : "";
            return `<div style="display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f1f5f9">
                <div style="width:32px;height:32px;border-radius:50%;background:${color}22;display:flex;align-items:center;justify-content:center;font-weight:700;color:${color};font-size:13px;flex-shrink:0">${i+1}</div>
                <div style="flex:1">
                    <div style="font-weight:600;color:#0f172a">${label} <span style="font-size:12px;font-weight:400;color:${color}">+${ev.risk_points} pts</span></div>
                    <div style="font-size:13px;color:#64748b;margin-top:2px">${time}${details}</div>
                </div></div>`;
        }).join("") : `<p style="color:#64748b;padding:16px 0">No violations recorded.</p>`;
        panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div>
                <h3 style="margin:0">${studentName} <span style="font-size:13px;font-weight:400;color:#64748b">${examName}</span></h3>
                <div style="margin-top:6px;display:flex;gap:10px;align-items:center">
                    <span style="font-size:22px;font-weight:800;color:${scoreColor}">${data.total_score}<span style="font-size:13px;color:#94a3b8">/100</span></span>
                    <span style="background:${statusColor};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">${data.exam_status}</span>
                    <span style="font-size:13px;color:#64748b">${data.events.length} event(s)</span>
                </div>
            </div>
            <button onclick="document.getElementById('saViolationPanel').style.display='none'"
                style="background:#f1f5f9;border:none;padding:6px 14px;border-radius:6px;cursor:pointer">&times; Close</button>
        </div>
        <div style="max-height:380px;overflow-y:auto">${timeline}</div>`;
    } catch(e) { panel.innerHTML = "<p style='color:red'>Unable to load log.</p>"; }
}
function showAnalytics() {
    document.getElementById("content-area").innerHTML = `
    <div class="section-box">
        <h2>AI Analytics</h2><br>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;">
            <div class="card"><h3>Overall Summary</h3><p>Institution-wide AI report.</p><br><button onclick="getOverallSummary()">Generate</button></div>
            <div class="card"><h3>Exam Summary</h3><p>AI report for a specific exam.</p><br><button onclick="showExamSummary()">Open</button></div>
            <div class="card"><h3>Student Summary</h3><p>AI report for a student.</p><br><button onclick="showStudentSummary()">Open</button></div>
        </div>
        <br><div id="analyticsOutput"></div>
    </div>`;
}

async function getOverallSummary() {
    const box = document.getElementById("analyticsOutput");
    box.innerText = "Generating...";
    try {
        const resp = await fetch(`${API_URL}/ai/exam-summary`);
        const data = await resp.json();
        box.innerText = data.summary;
    } catch(e) { box.innerText = "Unable to generate summary."; }
}

async function showExamSummary() {
    const box = document.getElementById("analyticsOutput");
    box.innerHTML = `
        <select id="sa_examId"><option value="">Select Exam</option></select>
        <button onclick="getExamSummary()" style="margin-left:10px">Generate</button>
        <pre id="sa_summaryBox" style="margin-top:16px;white-space:pre-wrap"></pre>`;
    try {
        const resp = await fetch(`${API_URL}/exams`);
        const exams = await resp.json();
        const dd = document.getElementById("sa_examId");
        exams.forEach(ex => { dd.innerHTML += `<option value="${ex.exam_id}">${ex.exam_name}</option>`; });
    } catch(e) {}
}

async function getExamSummary() {
    const examId = document.getElementById("sa_examId").value;
    if (!examId) { alert("Select an exam"); return; }
    const box = document.getElementById("sa_summaryBox");
    box.innerText = "Generating...";
    try {
        const resp = await fetch(`${API_URL}/ai/exam-summary/${examId}`);
        const data = await resp.json();
        box.innerText = [
            `Exam: ${data.exam_name}`,
            `Total Students: ${data.total_students}  |  Gave Exam: ${data.gave_exam}  |  Did Not Give: ${data.did_not_give}  |  Not Given: ${data.not_given}`,
            `Pass: ${data.pass_count}  |  Fail: ${data.fail_count}  |  Average Risk: ${data.average_risk}`,
            `Tab Switches: ${data.tab_switch_violations ?? 0}  |  Students Who Switched Tabs: ${data.tab_switch_students ?? 0}`,
            "",
            "ASSESSMENT",
            data.assessment || "",
            "",
            "FACULTY RECOMMENDATIONS",
            data.recommendation || ""
        ].join("\n");
    } catch(e) { box.innerText = "Unable to generate summary."; }
}

async function showStudentSummary() {
    const box = document.getElementById("analyticsOutput");
    box.innerHTML = `
        <input type="text" id="sa_rollNo" placeholder="Enter Student Roll Number" style="padding:8px;border-radius:6px;border:1px solid #cbd5e1;margin-right:10px">
        <button onclick="getStudentSummary()">Generate</button>
        <pre id="sa_summaryBox" style="margin-top:16px;white-space:pre-wrap"></pre>`;
}

async function getStudentSummary() {
    const rollNo = document.getElementById("sa_rollNo").value.trim();
    if (!rollNo) { alert("Enter Roll Number"); return; }
    const box = document.getElementById("sa_summaryBox");
    box.innerText = "Generating...";
    try {
        const studentResp = await fetch(`${API_URL}/student/id/${rollNo}`);
        const studentData = await studentResp.json();
        if (studentData.error) { box.innerText = "Student not found."; return; }
        const resp = await fetch(`${API_URL}/ai/student-summary/${studentData.student_id}`);
        const data = await resp.json();
        if (data.message) { box.innerText = data.message; return; }
        box.innerText = [
            `Student: ${data.student_name} (${data.roll_no})`,
            `Exams Attempted: ${data.exams_attempted}  |  Average Score: ${data.average_score}%`,
            `Pass: ${data.pass_percentage}%  |  Fail: ${data.fail_percentage}%`,
            `Best Exam: ${data.best_exam} (${data.best_exam_percentage}%)  |  Lowest Exam: ${data.lowest_exam} (${data.lowest_exam_percentage}%)`,
            `Risk Score: ${data.risk_score}/100 (${data.risk_level})`,
            "",
            data.assessment || ""
        ].join("\n");
    } catch(e) { box.innerText = "Unable to generate summary."; }
}

// â”€â”€ CHANGE PASSWORD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showChangePassword() {
    document.getElementById("content-area").innerHTML = `
    <div class="section-box" style="max-width:480px">
        <h2 style="margin-bottom:20px">Change Password</h2>
        <form id="changePwForm" style="display:flex;flex-direction:column;gap:14px">
            <input type="password" id="cp_current" placeholder="Current Password" required
                style="padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:14px">
            <input type="password" id="cp_new" placeholder="New Password" required
                style="padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:14px">
            <input type="password" id="cp_confirm" placeholder="Confirm New Password" required
                style="padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:14px">
            <button type="submit"
                style="background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600">
                Update Password
            </button>
        </form>
        <p id="cpMsg" style="margin-top:14px;font-size:14px"></p>
    </div>`;

    document.getElementById("changePwForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("cpMsg");
        const newPw = document.getElementById("cp_new").value;
        const confirmPw = document.getElementById("cp_confirm").value;

        if (newPw !== confirmPw) {
            msg.style.color = "red";
            msg.innerText = "New passwords do not match.";
            return;
        }
        if (newPw.length < 6) {
            msg.style.color = "red";
            msg.innerText = "New password must be at least 6 characters.";
            return;
        }

        try {
            const resp = await fetch(`${API_URL}/superadmin/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: admin.username || "superadmin",
                    current_password: document.getElementById("cp_current").value,
                    new_password: newPw
                })
            });
            const data = await resp.json();
            if (data.message === "Password changed successfully") {
                msg.style.color = "green";
                msg.innerText = "Password changed successfully! Please log in again.";
                document.getElementById("changePwForm").reset();
                setTimeout(() => {
                    localStorage.removeItem("superadmin");
                    window.location.href = "index.html";
                }, 2000);
            } else {
                msg.style.color = "red";
                msg.innerText = data.message;
            }
        } catch(err) {
            msg.style.color = "red";
            msg.innerText = "Unable to connect to server.";
        }
    });
}

// â”€â”€ LOGOUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function showManageExams() {
    const area = document.getElementById("content-area");
    area.innerHTML = `<div class="section-box"><h2>Manage Exams</h2><p style="color:#64748b">Loading exams...</p></div>`;

    const res = await fetch(`${API_URL}/exams`);
    const exams = await res.json();

    if (exams.length === 0) {
        area.innerHTML = `<div class="section-box"><h2>Manage Exams</h2><p style="color:#64748b">No exams found.</p></div>`;
        return;
    }

    let rows = exams.map(e => `
        <tr>
            <td style="padding:12px 16px;">${e.exam_id}</td>
            <td style="padding:12px 16px;">${e.exam_name}</td>
            <td style="padding:12px 16px;">${e.duration} min</td>
            <td style="padding:12px 16px;">
                <button onclick="confirmDeleteExam(${e.exam_id}, '${e.exam_name.replace(/'/g, "\\'")}')"
                    style="background:#ef4444;color:#fff;border:none;padding:7px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");

    area.innerHTML = `
        <div class="section-box">
            <h2>Manage Exams</h2>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <thead>
                    <tr style="background:#f1f5f9;text-align:left;">
                        <th style="padding:12px 16px;">ID</th>
                        <th style="padding:12px 16px;">Exam Name</th>
                        <th style="padding:12px 16px;">Duration</th>
                        <th style="padding:12px 16px;">Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

async function confirmDeleteExam(examId, examName) {
    const confirmed = confirm(`Delete "${examName}"?\n\nThis will permanently remove the exam, all questions, student results, violations, and risk scores.`);
    if (!confirmed) return;

    const res = await fetch(`${API_URL}/exams/${examId}`, { method: "DELETE" });
    const data = await res.json();

    if (res.ok) {
        alert(`"${examName}" deleted successfully.`);
        showManageExams();
    } else {
        alert("Error: " + (data.detail || "Could not delete exam."));
    }
}

function logout() {
    localStorage.removeItem("superadmin");
    window.location.href = "index.html";
}

// Init
showHome();
