const API_URL = "http://127.0.0.1:8000";

const faculty =
    JSON.parse(localStorage.getItem("faculty"));

document.getElementById("welcome").innerText =
    faculty
    ? `Welcome, ${faculty.name}`
    : "Welcome Faculty";

function showDashboard() {

    const faculty =
        JSON.parse(localStorage.getItem("faculty"));

    const facultyName =
        faculty?.name || "Faculty";

    document.getElementById("content-area").innerHTML = `

        <div class="section-box">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                flex-wrap:wrap;
                gap:30px;
            ">

                <div>

                    <h1 style="
                        color:#0f172a;
                        margin-bottom:20px;
                    ">
                        Welcome Back, ${facultyName} 👋
                    </h1>

                    <p style="
                        color:#64748b;
                        font-size:18px;
                        line-height:1.8;
                        max-width:750px;
                    ">

                        You can create examinations, manage questions,
                        monitor student performance, review results,
                        and analyze AI-powered proctoring reports
                        from a single dashboard.

                    </p>

                    <br>

                    <div style="
                        display:flex;
                        flex-direction:column;
                        gap:12px;
                    ">

                        <span style="color:#16a34a;">
                            ✅ AI Proctoring System Active
                        </span>

                        <span style="color:#16a34a;">
                            ✅ Analytics Module Available
                        </span>

                        <span style="color:#16a34a;">
                            ✅ Examination Portal Ready
                        </span>

                        <span style="color:#16a34a;">
                            ✅ Results Dashboard Online
                        </span>

                    </div>

                </div>

                <div>

                    <i class="fas fa-robot"
                       style="
                            font-size:120px;
                            color:#2563eb;
                       ">
                    </i>

                </div>

            </div>

        </div>

        <br>

        <div class="section-box">

            <h2 style="
                color:#0f172a;
                margin-bottom:20px;
            ">
                Faculty Access
            </h2>

            <ul style="
                color:#475569;
                line-height:2.3;
                font-size:17px;
                padding-left:25px;
            ">

                <li>
                    Create and manage examinations
                </li>

                <li>
                    Add questions and configure assessments
                </li>

                <li>
                    View student performance and exam results
                </li>

                <li>
                    Monitor AI-proctoring violations and risks
                </li>

                <li>
                    Generate AI-powered analytics reports
                </li>

            </ul>

        </div>

    `;
}
let _createdExamId = null;
let _createdExamName = "";
let _savingQuestions = false;

function showCreateExam() {
    _createdExamId = null;
    _createdExamName = "";
    _savingQuestions = false;

    document.getElementById("content-area").innerHTML = `
    <div class="section-box">
        <button onclick="showDashboard()">← Back to Dashboard</button>
        <br><br>
        <h2>Create Exam</h2>
        <form id="examForm">
            <label for="exam_name"><b>Exam Name</b></label>
            <input type="text" id="exam_name" placeholder="Enter Exam Name" required>
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
            <p style="color:#64748b;margin-bottom:16px">Add all questions, then save them together.</p>
            <div id="questionCards"></div>
            <button type="button" onclick="addQuestionCard()" style="margin-top:8px">+ Add Question</button>
            <button id="saveQuestionsBtn" type="button" onclick="saveAllQuestions()"
                style="margin:8px 0 0 10px;background:#16a34a;color:#fff;padding:10px 24px;border:none;border-radius:8px;cursor:pointer;">
                Save All Questions
            </button>
            <p id="qMsg"></p>
        </div>
    </div>`;

    document.getElementById("examForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const API_URL = "http://127.0.0.1:8000";
        const faculty = JSON.parse(localStorage.getItem("faculty"));
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
                    created_by: faculty.faculty_id
                })
            });
            const data = await resp.json();
            if (data.message === "Exam Created Successfully") {
                _createdExamId = data.exam_id;

                msg.style.color = "green";
                msg.innerText = `Exam "${examName}" created! Now add questions below.`;
                document.getElementById("examForm").querySelector("button").disabled = true;

                document.getElementById("examLabel").innerText = `Adding questions to: ${examName}`;
                document.getElementById("questionSection").style.display = "block";
                _createdExamName = examName;
                addQuestionCard();
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

function addQuestionCard() {
    const cards = document.getElementById("questionCards");
    const card = document.createElement("div");
    card.className = "question-card";
    card.style.cssText = "border:1px solid #cbd5e1;border-radius:10px;padding:18px;margin:16px 0;background:#f8fafc";
    card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <h4 class="question-title" style="margin:0 0 12px"></h4>
            <button type="button" class="remove-question" onclick="removeQuestionCard(this)" style="margin-bottom:12px">Remove Question</button>
        </div>
        <label><b>Question text</b></label>
        <textarea class="question-text" placeholder="Enter question" required style="width:100%;box-sizing:border-box;min-height:78px;margin:7px 0 12px"></textarea>
        <label>A <input class="option-a" type="text" placeholder="Option A" required></label>
        <label>B <input class="option-b" type="text" placeholder="Option B" required></label>
        <label>C <input class="option-c" type="text" placeholder="Option C" required></label>
        <label>D <input class="option-d" type="text" placeholder="Option D" required></label>
        <div style="margin-top:10px"><b>Correct Answer:</b>
            <label style="display:inline;margin-left:12px"><input type="radio" name="correct-answer" value="A"> A</label>
            <label style="display:inline;margin-left:8px"><input type="radio" name="correct-answer" value="B"> B</label>
            <label style="display:inline;margin-left:8px"><input type="radio" name="correct-answer" value="C"> C</label>
            <label style="display:inline;margin-left:8px"><input type="radio" name="correct-answer" value="D"> D</label>
        </div>`;
    cards.appendChild(card);
    renumberQuestionCards();
}

function removeQuestionCard(button) {
    const cards = document.querySelectorAll("#questionCards .question-card");
    if (cards.length === 1) {
        document.getElementById("qMsg").style.color = "red";
        document.getElementById("qMsg").innerText = "At least one question is required.";
        return;
    }
    button.closest(".question-card").remove();
    renumberQuestionCards();
}

function renumberQuestionCards() {
    document.querySelectorAll("#questionCards .question-card").forEach((card, index) => {
        card.querySelector(".question-title").innerText = `Question ${index + 1}`;
        card.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.name = `correct-answer-${index + 1}`;
        });
    });
}

function collectQuestions() {
    const cards = [...document.querySelectorAll("#questionCards .question-card")];
    if (!cards.length) return { error: "Add at least one question." };

    const fieldLabels = [
        ["question-text", "Question text", "question_text"],
        ["option-a", "Option A", "option_a"],
        ["option-b", "Option B", "option_b"],
        ["option-c", "Option C", "option_c"],
        ["option-d", "Option D", "option_d"]
    ];
    const questions = [];
    for (let index = 0; index < cards.length; index++) {
        const card = cards[index];
        const question = {};
        for (const [className, label, apiField] of fieldLabels) {
            const value = card.querySelector(`.${className}`).value.trim();
            if (!value) return { error: `Question ${index + 1}: ${label} is empty.` };
            question[apiField] = value;
        }
        const selected = card.querySelector('input[type="radio"]:checked');
        if (!selected) return { error: `Question ${index + 1}: select the correct answer.` };
        question.correct_option = selected.value;
        questions.push(question);
    }
    return { questions };
}

async function saveAllQuestions() {
    if (_savingQuestions || !_createdExamId) return;
    const qMsg = document.getElementById("qMsg");
    const collected = collectQuestions();
    if (collected.error) {
        qMsg.style.color = "red";
        qMsg.innerText = collected.error;
        return;
    }

    _savingQuestions = true;
    const saveButton = document.getElementById("saveQuestionsBtn");
    saveButton.disabled = true;
    saveButton.innerText = "Saving...";
    try {
        const resp = await fetch(`${API_URL}/questions/bulk-add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ exam_id: _createdExamId, questions: collected.questions })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.detail || "Unable to save questions.");
        showBulkQuestionSuccess(data.question_count);
    } catch (err) {
        _savingQuestions = false;
        saveButton.disabled = false;
        saveButton.innerText = "Save All Questions";
        qMsg.style.color = "red";
        qMsg.innerText = err.message || "Unable to connect to server. Your questions are still here; please retry.";
    }
}

function showBulkQuestionSuccess(questionCount) {
    document.getElementById("content-area").innerHTML = `
    <div class="section-box" style="text-align:center;padding:40px">
        <i class="fas fa-circle-check" style="font-size:60px;color:#16a34a;margin-bottom:16px"></i>
        <h2 style="color:#0f172a">Exam Created Successfully!</h2>
        <p style="color:#64748b;margin-top:8px">${_createdExamName} was created with ${questionCount} question(s).</p>
        <button onclick="showCreateExam()" style="margin-top:20px;margin-right:10px">Create Another Exam</button>
        <button onclick="showDashboard()">Back to Dashboard</button>
    </div>`;
}

async function loadResults() {

    const API_URL =
        "http://127.0.0.1:8000";

    try {

        const response =
            await fetch(
                `${API_URL}/faculty/results`
            );

        const results =
            await response.json();

        const tbody =
            document.querySelector(
                "#resultsTable tbody"
            );

        tbody.innerHTML = "";

        results.forEach(result => {

            tbody.innerHTML += `

                <tr>

                    <td>
                        ${result.student_name}
                    </td>

                    <td>
                        ${result.exam_name}
                    </td>

                    <td>
                        ${result.score}
                    </td>

                    <td>
                        ${result.total_questions}
                    </td>

                    <td>
                        ${result.percentage}%
                    </td>

                </tr>

            `;

        });

    }

    catch(error){

        console.error(error);

        alert(
            "Unable to load results."
        );
    }

}

async function showResults() {

    document.getElementById("content-area").innerHTML = `

<div class="section-box">

    <button onclick="showDashboard()">

        ← Back to Dashboard

    </button>

    <br><br>

    <h2>Exam Review Dashboard</h2>

    <br>

    <select id="result_exam_id">

        <option value="">
            Select Exam
        </option>

    </select>

    <br><br>

    <button onclick="loadExamResults()">

        Load Results

    </button>

    <button onclick="exportResultsCSV()">

        Export CSV

    </button>

    <br><br>

    <div class="summary-cards">

        <div class="summary-card">
            <h3>Total Students</h3>
            <h2 id="totalStudents">0</h2>
        </div>

        <div class="summary-card">
            <h3>Gave Exam</h3>
            <h2 id="gaveExamCount">0</h2>
        </div>

        <div class="summary-card">
            <h3>Did Not Give</h3>
            <h2 id="didNotGiveCount">0</h2>
        </div>

        <div class="summary-card">
            <h3>Completed</h3>
            <h2 id="completedCount">0</h2>
        </div>

        <div class="summary-card">
            <h3>Invalid</h3>
            <h2 id="invalidCount">0</h2>
        </div>

        <div class="summary-card">
            <h3>On Hold</h3>
            <h2 id="onHoldCount">0</h2>
        </div>

        <div class="summary-card">
            <h3>Pass</h3>
            <h2 id="passCount">0</h2>
        </div>

        <div class="summary-card">
            <h3>Fail</h3>
            <h2 id="failCount">0</h2>
        </div>

    </div>

    <br>

    <div class="search-box">

        <input
            type="text"
            id="resultSearch"
            placeholder="Search Student or Exam..."
            onkeyup="searchResults()">

    </div>

    <br>

    <div class="filter-box">

        <label><b>Filter Status:</b></label>

        <select id="statusFilter" onchange="filterResults()">

            <option value="ALL">All</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
            <option value="Invalid">Invalid</option>

        </select>

        <label style="margin-left:16px"><b>Attendance:</b></label>

        <select id="attendanceFilter" onchange="filterResults()">
            <option value="ALL">All</option>
            <option value="GIVEN">Given</option>
            <option value="Not Given">Not Given</option>
        </select>

    </div>

    <br>

    <div class="sort-box">

        <label><b>Sort By:</b></label>

        <select id="sortResults" onchange="sortResults()">

            <option value="">Default</option>
            <option value="score">Highest Score</option>
            <option value="risk">Highest Risk</option>
            <option value="latest">Latest Submission</option>

        </select>

    </div>

    <br>

    <table id="resultsTable">

        <thead>

            <tr>

                <th>Student</th>
                <th>Exam</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Result</th>
                <th>Risk Score</th>
                <th>Result Status</th>
                <th>Attendance</th>
                <th>Submitted</th>
                <th>Action</th>

            </tr>

        </thead>

        <tbody>

        </tbody>

    </table>

</div>

`;

    await loadResultExams();

}
async function loadResultExams() {

    const API_URL =
        "http://127.0.0.1:8000";

    try {

        const response =
            await fetch(`${API_URL}/exams`);

        const exams =
            await response.json();

        const dropdown =
            document.getElementById(
                "result_exam_id"
            );

        exams.forEach(exam => {

            dropdown.innerHTML += `

                <option value="${exam.exam_id}">
                    ${exam.exam_name}
                </option>

            `;

        });

    }

    catch(error){

        console.error(error);
    }

}
async function loadExamResults() {
    const API_URL = "http://127.0.0.1:8000";
    const examId = document.getElementById("result_exam_id").value;
    if (!examId) {
        alert("Select an exam");
        return;
    }

    try {
        const [resultsResponse, summaryResponse] = await Promise.all([
            fetch(`${API_URL}/faculty/results/${examId}`),
            fetch(`${API_URL}/faculty/results-summary/${examId}`)
        ]);
        if (!resultsResponse.ok || !summaryResponse.ok) {
            throw new Error("Failed to load exam results.");
        }

        const results = await resultsResponse.json();
        const summary = await summaryResponse.json();
        const cardValues = {
            totalStudents: summary.total_students,
            gaveExamCount: summary.gave_exam,
            didNotGiveCount: summary.did_not_give,
            completedCount: summary.completed,
            invalidCount: summary.invalid,
            onHoldCount: summary.on_hold,
            passCount: summary.pass,
            failCount: summary.fail
        };
        Object.entries(cardValues).forEach(([id, value]) => {
            document.getElementById(id).textContent = value ?? 0;
        });

        const tbody = document.querySelector("#resultsTable tbody");
        tbody.innerHTML = "";
        if (!results.length) {
            tbody.innerHTML = '<tr><td colspan="10">No assigned students found.</td></tr>';
            return;
        }

        results.forEach(result => {
            const hasResult = result.status !== null && result.status !== undefined;
            const isNotGiven = result.attendance_status === "Not Given";
            const resultBadge = hasResult
                ? `<span class="${result.result === "Pass" ? "pass-badge" : "fail-badge"}">${result.result}</span>`
                : "—";
            const statusBadge = isNotGiven
                ? '<span class="invalid-badge">Not Given Exam</span>'
                : hasResult
                    ? `<span class="${result.status === "Completed" ? "valid-badge" : result.status === "On Hold" ? "pending-badge" : "invalid-badge"}">${result.status}</span>`
                    : "—";
            const riskScore = result.risk_score;
            const riskBadge = riskScore === null || riskScore === undefined
                ? "—"
                : `<span class="${riskScore >= 60 ? "invalid-badge" : riskScore >= 30 ? "pending-badge" : "valid-badge"}">${riskScore}/100</span>`;
            const rowClass = result.status === "Completed" ? "completed-row"
                : result.status === "On Hold" ? "onhold-row"
                : result.status === "Invalid" ? "invalid-row" : "";
            const actions = hasResult
                ? `<button onclick="reviewStudent(${result.student_id}, ${examId})">Review</button>
                   <button onclick="viewAnswers(${result.student_id}, ${examId})">View Answers</button>`
                : "—";
            const score = hasResult ? `${result.score}/${result.total_questions}` : "—";
            const percentage = hasResult ? `${result.percentage}%` : "—";

            tbody.innerHTML += `
                <tr class="${rowClass}"
                    data-result-status="${result.status || ""}"
                    data-attendance="${result.attendance_status}"
                    data-score="${result.score ?? ""}"
                    data-risk="${riskScore ?? ""}"
                    data-submitted="${result.submitted_at || ""}">
                    <td>${result.student_name} <span style="color:#64748b;font-size:12px">#${result.student_id}</span></td>
                    <td>${result.exam_name}</td>
                    <td>${score}</td>
                    <td>${percentage}</td>
                    <td>${resultBadge}</td>
                    <td>${riskBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${result.attendance_status}</td>
                    <td>${result.submitted_at ?? "—"}</td>
                    <td>${actions}</td>
                </tr>`;
        });
    } catch (error) {
        console.error("Load Results Error:", error);
        alert("Unable to load results.");
    }

}
// -- PROCTORING --
let _proctoringRefreshTimer = null;
let _selectedExamIdFilter = "";

function _stopProctoringRefresh() {
    if (_proctoringRefreshTimer) {
        clearInterval(_proctoringRefreshTimer);
        _proctoringRefreshTimer = null;
    }
}
async function reviewStudent(studentId, examId) {

    const API_URL = "http://127.0.0.1:8000";

    try {

        const response = await fetch(
            `${API_URL}/faculty/result/${studentId}/${examId}`
        );

        if (!response.ok) {
            throw new Error("Failed to fetch student result.");
        }

        const result = await response.json();

        if (result.error) {
            alert(result.error);
            return;
        }

        let buttons = "";

if (
    result.exam_status === "INVALID" ||
    result.risk_score >= 60
) {

            buttons = `
                <button class="approve-btn"
                    onclick="approveResult(${studentId},${examId})">
                    Approve Result
                </button>

                <button class="invalid-btn"
                    onclick="keepInvalid(${studentId},${examId})">
                    Keep Invalid
                </button>
            `;

        } else {

            buttons = `
                <div style="
                    margin-top:15px;
                    padding:10px;
                    background:#e8f5e9;
                    border-radius:8px;
                    color:#2e7d32;
                    font-weight:bold;
                ">
                    ✔ Faculty approval not required.
                </div>
            `;

        }

        document.getElementById("reviewContent").innerHTML = `

            <p><strong>Student:</strong> ${result.student_name}</p>

            <p><strong>Exam:</strong> ${result.exam_name}</p>

            <p><strong>Score:</strong> ${result.score}/${result.total_questions}</p>

            <p><strong>Percentage:</strong> ${result.percentage}%</p>

            <p><strong>Result:</strong> ${result.result}</p>

            <p><strong>Status:</strong> ${result.status}</p>

            <p><strong>Violations:</strong> ${result.violation_count}</p>

            <p><strong>Risk Score:</strong> ${result.risk_score}/100</p>

            <div style="
                margin:15px 0;
                padding:12px;
                border-left:4px solid #2563eb;
                background:#eef4ff;
                border-radius:6px;
            ">
                ℹ️ Check the <b>Proctoring</b> page for detailed AI analysis,
                violation timeline and behavioral summary.
            </div>

            <p><strong>Submitted:</strong> ${result.submitted_at ?? "-"}</p>

            <div style="margin-top:20px;">
                ${buttons}
            </div>

        `;

        document.getElementById("reviewModal").style.display = "block";

    }

    catch (error) {

        console.error(error);

        alert("Unable to fetch student result.");

    }

}
function closeReviewModal() {

    document.getElementById("reviewModal").style.display = "none";

}
async function approveResult(studentId, examId) {

    const API_URL = "http://127.0.0.1:8000";

    const confirmApproval = confirm(
        "Are you sure you want to approve this result?\n\n" +
        "The result status will be changed from INVALID to Completed."
    );

    if (!confirmApproval) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/faculty/result/${studentId}/${examId}/approve`,
            {
                method: "PUT"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Failed to approve result."
            );
        }

        alert("Result approved successfully.");

        closeReviewModal();

        // Refresh results table
        if (typeof showResults === "function") {
            showResults();
        }

    } catch (error) {

        console.error("Approve Result Error:", error);

        alert(
            "Unable to approve result.\n\n" +
            error.message
        );
    }
}


async function keepInvalid(studentId, examId) {

    const API_URL = "http://127.0.0.1:8000";

    const confirmInvalid = confirm(
        "Keep this result as INVALID?"
    );

    if (!confirmInvalid) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/faculty/result/${studentId}/${examId}/keep-invalid`,
            {
                method: "PUT"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Failed to keep result invalid."
            );
        }

        alert("Result has been kept as INVALID.");

        closeReviewModal();

        // Refresh results table
        if (typeof showResults === "function") {
            showResults();
        }

    } catch (error) {

        console.error("Keep Invalid Error:", error);

        alert(
            "Unable to update result.\n\n" +
            error.message
        );
    }
}
async function viewAnswers(studentId, examId){

    const API_URL =
        "http://127.0.0.1:8000";

    try{

        const response =
            await fetch(
                `${API_URL}/faculty/answers/${studentId}/${examId}`
            );

        const answers =
            await response.json();

        let html = "";

        answers.forEach((answer,index)=>{

            const options = {

                "A": answer.option_a,
                "B": answer.option_b,
                "C": answer.option_c,
                "D": answer.option_d

            };

            const studentAnswerText =
                answer.student_answer
                    ? `${answer.student_answer}. ${options[answer.student_answer]}`
                    : "Not Answered";

            const correctAnswerText =
                `${answer.correct_answer}. ${options[answer.correct_answer]}`;

            html += `

                <div class="answer-card">

                    <h3>

                        Question ${index + 1}

                    </h3>

                    <p>

                        <b>${answer.question_text}</b>

                    </p>

                    <br>

                    <p><b>A.</b> ${answer.option_a}</p>

                    <p><b>B.</b> ${answer.option_b}</p>

                    <p><b>C.</b> ${answer.option_c}</p>

                    <p><b>D.</b> ${answer.option_d}</p>

                    <br>

                    <p>

                        <b>Student Answer:</b>

                        ${studentAnswerText}

                    </p>

                    <p>

                        <b>Correct Answer:</b>

                        ${correctAnswerText}

                    </p>

                    <p>

                        ${
                            answer.is_correct

                            ?

                            "<span class='correct-answer'>✔ Correct</span>"

                            :

                            "<span class='wrong-answer'>✘ Wrong</span>"
                        }

                    </p>

                    <hr>

                </div>

            `;

        });

        document.getElementById(
            "answersContent"
        ).innerHTML = html;

        document.getElementById(
            "answersModal"
        ).style.display = "block";

    }

    catch(error){

        console.error(error);

        alert("Unable to load answers.");

    }

}
function closeAnswersModal(){

    document.getElementById(
        "answersModal"
    ).style.display = "none";

}
async function showProctoring() {
    _stopProctoringRefresh();

    document.getElementById("content-area").innerHTML = `
    <div class="section-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
            <div>
                <button onclick="showDashboard();_stopProctoringRefresh()" style="margin-right:12px">&larr; Back</button>
                <strong style="font-size:18px">Live Proctoring Monitor</strong>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <select id="examFilter" onchange="_selectedExamIdFilter=this.value;_proctoringRefreshNow()"
                    style="padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;font-size:14px">
                    <option value="">All Exams</option>
                </select>
                <span style="font-size:12px;color:#64748b">Auto-refresh every 5s</span>
                <span id="lastRefreshed" style="font-size:12px;color:#94a3b8"></span>
            </div>
        </div>
        <div id="proctoringTable">Loading...</div>
        <div id="violationPanel" style="display:none;margin-top:24px;border-top:2px solid #e2e8f0;padding-top:20px"></div>
    </div>`;

    try {
        const examsResp = await fetch(`${API_URL}/exams`);
        const exams = await examsResp.json();
        const dd = document.getElementById("examFilter");
        if (dd) exams.forEach(ex => {
            dd.innerHTML += `<option value="${ex.exam_id}">${ex.exam_name}</option>`;
        });
    } catch(e) {}

    await _proctoringRefreshNow();
    _proctoringRefreshTimer = setInterval(_proctoringRefreshNow, 5000);
}

async function _proctoringRefreshNow() {
    const examId = _selectedExamIdFilter;
    const url = examId
        ? `${API_URL}/api/risk-score?exam_id=${examId}`
        : `${API_URL}/api/risk-score`;

    try {
        const resp = await fetch(url);
        const students = await resp.json();

        const lastEl = document.getElementById("lastRefreshed");
        if (lastEl) lastEl.innerText = `Last: ${new Date().toLocaleTimeString()}`;

        const tableEl = document.getElementById("proctoringTable");
        if (!tableEl) return;

        if (!students.length) {
            tableEl.innerHTML = `<p style="color:#64748b;padding:20px 0">No proctoring data yet. Students must start an exam first.</p>`;
            return;
        }

        const violationIcon = {
            looking_away: "&#128065;", face_missing: "&#128683;",
            multiple_persons: "&#128101;", mobile_phone: "&#128241;",
            face_detection_failure: "&#9888;", tab_switch: "&#8646;"
        };

        let rows = students.map(s => {
            const levelColors = {
                LOW:    { bg: "#dcfce7", color: "#16a34a" },
                MEDIUM: { bg: "#fef9c3", color: "#ca8a04" },
                HIGH:   { bg: "#fee2e2", color: "#dc2626" },
            };
            const lc = levelColors[s.risk_level] || levelColors.LOW;
            const levelBadge = `<span style="background:${lc.bg};color:${lc.color};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700">${s.risk_level}</span>`;
            const statusColor = s.exam_status === "INVALID" ? "#dc2626" : "#16a34a";
            const statusBadge = `<span style="background:${statusColor};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">${s.exam_status}</span>`;
            const lastViol = s.last_violation_time ? s.last_violation_time.substring(11,19) : "&mdash;";
            const scoreColor = s.risk_level === "HIGH" ? "#dc2626" : s.risk_level === "MEDIUM" ? "#ca8a04" : "#16a34a";
            return `<tr style="cursor:pointer;border-bottom:1px solid #f1f5f9"
                onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''"
                onclick="openViolationLog(${s.student_id}, ${s.exam_id}, '${s.student_name.replace(/'/g,"\\'")}', '${s.exam_name.replace(/'/g,"\\'")}')">
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
            <thead>
                <tr style="background:#1e293b;color:#fff;text-align:left;">
                    <th style="padding:11px 14px">Student</th>
                    <th style="padding:11px 14px">Roll No</th>
                    <th style="padding:11px 14px">Exam</th>
                    <th style="padding:11px 14px">Risk Score</th>
                    <th style="padding:11px 14px">Risk Level</th>
                    <th style="padding:11px 14px">Status</th>
                    <th style="padding:11px 14px">Last Violation</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:10px;font-size:12px;color:#94a3b8">Click a row to see full violation timeline &nbsp;|&nbsp;
            <span style="color:#16a34a;font-weight:600">&#9632;</span> LOW &lt;30 &nbsp;
            <span style="color:#ca8a04;font-weight:600">&#9632;</span> MEDIUM 30&ndash;60 &nbsp;
            <span style="color:#dc2626;font-weight:600">&#9632;</span> HIGH &gt;60
        </p>`;

    } catch(e) {
        const tableEl = document.getElementById("proctoringTable");
        if (tableEl) tableEl.innerHTML = "<p style='color:red'>Unable to load proctoring data.</p>";
    }
}

async function openViolationLog(studentId, examId, studentName, examName) {
    const panel = document.getElementById("violationPanel");
    if (!panel) return;
    panel.style.display = "block";
    panel.innerHTML = `<p style="color:#64748b">Loading violation log for <strong>${studentName}</strong>...</p>`;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    try {
        const resp = await fetch(`${API_URL}/api/risk-score/student?student_id=${studentId}&exam_id=${examId}`);
        const data = await resp.json();
        if (data.error) { panel.innerHTML = `<p style='color:red'>${data.error}</p>`; return; }

        const violationLabel = {
            looking_away: "Looking Away", face_missing: "Face Missing",
            multiple_persons: "Multiple Persons", mobile_phone: "Mobile Phone",
            face_detection_failure: "Camera Failure", tab_switch: "Tab Switch"
        };
        const violationIcon = {
            looking_away: "&#128065;", face_missing: "&#128683;",
            multiple_persons: "&#128101;", mobile_phone: "&#128241;",
            face_detection_failure: "&#9888;", tab_switch: "&#8646;"
        };
        const violationColor = {
            looking_away: "#f59e0b", face_missing: "#ef4444",
            multiple_persons: "#8b5cf6", mobile_phone: "#dc2626",
            face_detection_failure: "#64748b", tab_switch: "#f97316"
        };

        const scoreColor = data.total_score > 60 ? "#dc2626" : data.total_score >= 30 ? "#ca8a04" : "#16a34a";
        const statusColor = data.exam_status === "INVALID" ? "#dc2626" : "#16a34a";

        let timeline = "";
        if (!data.events.length) {
            timeline = `<p style="color:#64748b;padding:16px 0">No violations recorded.</p>`;
        } else {
            timeline = data.events.map((ev, i) => {
                const icon = violationIcon[ev.violation_type] || "&#9888;";
                const label = violationLabel[ev.violation_type] || ev.violation_type;
                const color = violationColor[ev.violation_type] || "#64748b";
                const time = ev.timestamp.substring(0, 19).replace("T", " ");
                const details = ev.details ? `<span style="color:#94a3b8;font-size:12px"> &middot; ${ev.details}</span>` : "";
                return `
                <div style="display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f1f5f9">
                    <div style="width:32px;height:32px;border-radius:50%;background:${color}22;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${icon}</div>
                    <div style="flex:1">
                        <div style="font-weight:600;color:#0f172a">${label}
                            <span style="font-size:12px;font-weight:400;color:${color};margin-left:8px">+${ev.risk_points} pts</span>
                        </div>
                        <div style="font-size:13px;color:#64748b;margin-top:2px">${time}${details}</div>
                    </div>
                    <div style="font-size:12px;color:#94a3b8;flex-shrink:0">#${i + 1}</div>
                </div>`;
            }).join("");
        }

        const summaryPanelId = `aiSummary_${studentId}_${examId}`;
        panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
            <div>
                <h3 style="margin:0;color:#0f172a">${studentName}
                    <span style="font-size:13px;font-weight:400;color:#64748b;margin-left:8px">${examName}</span>
                </h3>
                <div style="margin-top:6px;display:flex;gap:10px;align-items:center">
                    <span style="font-size:22px;font-weight:800;color:${scoreColor}">${data.total_score}<span style="font-size:13px;color:#94a3b8">/100</span></span>
                    <span style="background:${statusColor};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">${data.exam_status}</span>
                    <span style="font-size:13px;color:#64748b">${data.events.length} event(s)</span>
                </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <button onclick="loadAiSummary(${studentId}, ${examId}, '${summaryPanelId}')"
                    style="background:#6366f1;color:#fff;border:none;padding:7px 16px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600">
                    &#129302; Generate AI Summary
                </button>
                <button onclick="document.getElementById('violationPanel').style.display='none'"
                    style="background:#f1f5f9;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">&times; Close</button>
            </div>
        </div>
        <div style="max-height:380px;overflow-y:auto;padding-right:4px">${timeline}</div>
        <div id="${summaryPanelId}" style="margin-top:16px"></div>`;

    } catch(e) {
        panel.innerHTML = "<p style='color:red'>Unable to load violation log.</p>";
    }
}

async function loadAiSummary(studentId, examId, containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;color:#64748b;font-size:13px">
        &#9203; Generating AI summary&hellip;</div>`;
    try {
        const resp = await fetch(`${API_URL}/api/exam-summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId, exam_id: examId })
        });
        const data = await resp.json();
        if (data.error) {
            box.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;color:#dc2626;font-size:13px">${data.error}</div>`;
            return;
        }
        const lines = data.summary.split("\n");
        const formatted = lines.map(line => {
            if (line.startsWith("Assessment:")) {
                return `<div style="font-weight:700;color:#4f46e5;margin-top:10px;margin-bottom:4px">Assessment</div>`;
            }
            if (line.startsWith("Violations:")) {
                return `<div style="font-weight:700;color:#0f172a;margin-top:10px;margin-bottom:4px">Violations</div>`;
            }
            if (line.startsWith("- ")) {
                return `<div style="color:#475569;padding-left:12px;margin:2px 0">&#8226; ${line.slice(2)}</div>`;
            }
            if (line.trim() === "") return `<div style="margin:4px 0"></div>`;
            return `<div style="color:#334155;font-size:13px;margin:2px 0">${line}</div>`;
        }).join("");
        box.innerHTML = `
        <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:10px;padding:16px;margin-top:4px">
            <div style="font-weight:700;color:#4f46e5;font-size:14px;margin-bottom:10px">&#129302; AI Behavioral Summary</div>
            ${formatted}
        </div>`;
    } catch(e) {
        box.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;color:#dc2626;font-size:13px">Failed to generate summary.</div>`;
    }
}

function showAnalytics() {

    document.getElementById("content-area").innerHTML = `

<div class="section-box">

    <button onclick="showDashboard()">

        ← Back to Dashboard

    </button>

    <br><br>

    <h2>AI Analytics Dashboard</h2>

            <br>

            <div style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
                gap:20px;
            ">

                <div class="card">

                    <h3>Student Summary</h3>

                    <p>
                        Generate AI report for a student.
                    </p>

                    <br>

                    <button onclick="showStudentAnalytics()">
                        Open
                    </button>

                </div>

                <div class="card">

                    <h3>Exam Summary</h3>

                    <p>
                        Generate AI report for an exam.
                    </p>

                    <br>

                    <button onclick="showExamAnalytics()">
                        Open
                    </button>

                </div>

                <div class="card">

                    <h3>Overall Summary</h3>

                    <p>
                        Institution-wide AI report.
                    </p>

                    <br>

                    <button onclick="showOverallAnalytics()">
                        Open
                    </button>

                </div>

            </div>

        </div>

    `;
}
function showStudentAnalytics() {

    document.getElementById("content-area").innerHTML = `

        <div class="section-box">

            <button class="back-btn"
                    onclick="showAnalytics()">

                ← Back to Analytics

            </button>

            <br><br>

            <h2>👤 Student AI Summary</h2>

            <input
                type="text"
                id="rollNo"
                placeholder="Enter Student Roll Number">

            <button onclick="getStudentSummaryDashboard()">

                Generate Report

            </button>

            <br><br>

            <div id="summaryBox"></div>

        </div>

    `;
}
async function loadStudentsDropdown() {

    const API_URL =
        "http://127.0.0.1:8000";

    try {

        const response =
            await fetch(
                `${API_URL}/students`
            );

        const students =
            await response.json();

        const dropdown =
            document.getElementById(
                "studentId"
            );

        students.forEach(student => {

            dropdown.innerHTML += `

                <option
                    value="${student.student_id}">

                    ${student.roll_no}

                </option>

            `;

        });

    }

    catch(error){

        console.error(error);
    }
}
async function getStudentSummaryDashboard() {

    const API_URL =
        "http://127.0.0.1:8000";

    const rollNo =
        document.getElementById("rollNo").value.trim();

    const summaryBox =
        document.getElementById("summaryBox");

    if(!rollNo){

        alert("Enter Roll Number");

        return;

    }
summaryBox.innerHTML = `
<div class="loading-box">

    <div class="loader"></div>

    <h3>Generating AI Report...</h3>

    <p>Please wait while AI analyzes the data.</p>

</div>
`;

    try{

        const studentResponse =
            await fetch(
                `${API_URL}/student/id/${rollNo}`
            );

        const studentData =
            await studentResponse.json();

        if(studentData.error){

            summaryBox.innerHTML =
                "<h3>Student not found.</h3>";

            return;

        }

        const response =
            await fetch(
                `${API_URL}/ai/student-summary/${studentData.student_id}`
            );

        const data =
            await response.json();

        let violationsHtml = "";

        if(Object.keys(data.violations).length === 0){

            violationsHtml =
                "<li>No Violations Recorded</li>";

        }

        else{

            for(const key in data.violations){

                violationsHtml +=
                    `<li><b>${key}</b> : ${data.violations[key]}</li>`;

            }

        }

        // ===============================
        // Split AI response into Assessment
        // and Recommendation
        // ===============================

        const paragraphs =
            data.assessment.split(/\n\s*\n/);

        const assessment =
            (paragraphs[0] || data.assessment)
                .replace(/\n/g,"<br>");

        const recommendation =
            paragraphs.length > 1
                ? paragraphs
                    .slice(1)
                    .join("<br><br>")
                    .replace(/\n/g,"<br>")
                : "No separate faculty recommendation generated.";

        summaryBox.innerHTML = `

<div style="
background:#f8fbff;
border:1px solid #dbeafe;
border-radius:14px;
padding:25px;
">

<h2 style="
color:#2563eb;
margin-bottom:25px;
">
👤 Student AI Summary
</h2>

<div style="
display:grid;
grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
gap:18px;
">

<div style="
background:white;
padding:18px;
border-radius:10px;
box-shadow:0 2px 8px rgba(0,0,0,.08);
">

<h3 style="
margin-bottom:12px;
color:#2563eb;
">
Student Details
</h3>

<p><b>Name:</b> ${data.student_name}</p>

<p><b>Roll No:</b> ${data.roll_no}</p>

<p><b>Email:</b> ${data.email}</p>

</div>

<div style="
background:white;
padding:18px;
border-radius:10px;
box-shadow:0 2px 8px rgba(0,0,0,.08);
">

<h3 style="
margin-bottom:12px;
color:#2563eb;
">
Performance Summary
</h3>

<p><b>Exams Attempted:</b> ${data.exams_attempted}</p>

<p><b>Average Score:</b> ${data.average_score}%</p>

<p><b>Pass Percentage:</b> ${data.pass_percentage}%</p>

<p><b>Fail Percentage:</b> ${data.fail_percentage}%</p>

</div>

<div style="
background:white;
padding:18px;
border-radius:10px;
box-shadow:0 2px 8px rgba(0,0,0,.08);
">

<h3 style="
margin-bottom:12px;
color:#2563eb;
">
Exam Performance
</h3>

<p><b>Best Exam:</b> ${data.best_exam}</p>

<p>${data.best_exam_percentage}%</p>

<br>

<p><b>Lowest Exam:</b> ${data.lowest_exam}</p>

<p>${data.lowest_exam_percentage}%</p>

</div>

<div style="
background:white;
padding:18px;
border-radius:10px;
box-shadow:0 2px 8px rgba(0,0,0,.08);
">

<h3 style="
margin-bottom:12px;
color:#2563eb;
">
Violation Summary
</h3>

<ul style="
margin-left:18px;
line-height:1.8;
">

${violationsHtml}

</ul>

<hr style="margin:15px 0;">

<p><b>Risk Score:</b> ${data.risk_score}/100</p>

<p><b>Risk Level:</b> ${data.risk_level}</p>

</div>

</div>

<div style="
background:white;
padding:20px;
margin-top:25px;
border-radius:10px;
box-shadow:0 2px 8px rgba(0,0,0,.08);
">

<h3 style="
color:#2563eb;
margin-bottom:15px;
">
🤖 AI Assessment
</h3>

<p style="
line-height:1.8;
margin:0;
">

${assessment}

</p>

</div>

<div style="
background:white;
padding:20px;
margin-top:20px;
border-radius:10px;
box-shadow:0 2px 8px rgba(0,0,0,.08);
">

<h3 style="
color:#2563eb;
margin-bottom:15px;
">
📌 Faculty Recommendation
</h3>

<p style="
line-height:1.8;
margin:0;
">

${recommendation}

</p>

</div>

</div>

`;

    }

    catch(error){

        console.error(error);

        summaryBox.innerHTML =
            "<h3>Unable to generate summary.</h3>";

    }

}
async function showExamAnalytics() {

    document.getElementById("content-area").innerHTML = `

        <div class="section-box">

            <button class="back-btn"
                    onclick="showAnalytics()">

                ← Back to Analytics

            </button>

            <br><br>

            <h2>📊 Exam AI Summary</h2>

            <br>

            <select id="examId">

                <option value="">
                    Select Exam
                </option>

            </select>

            <br><br>

            <button onclick="getExamSummaryDashboard()">

                Generate Report

            </button>

            <br><br>

            <div class="summary-cards">

                <div class="summary-card">

                    <h3>Total Students</h3>

                    <h2 id="examTotalStudents">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Gave Exam</h3>

                    <h2 id="examGaveExam">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Did Not Give</h3>

                    <h2 id="examDidNotGive">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Not Given</h3>

                    <h2 id="examNotGiven">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Pass</h3>

                    <h2 id="examPassCount">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Fail</h3>

                    <h2 id="examFailCount">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Average Risk</h3>

                    <h2 id="examAverageRisk">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Tab Switches</h3>

                    <h2 id="examTabSwitches">0</h2>

                </div>

                <div class="summary-card">

                    <h3>Students Who Switched Tabs</h3>

                    <h2 id="examTabSwitchStudents">0</h2>

                </div>

            </div>

            <br><br>

            <div style="
                display:grid;
                grid-template-columns:repeat(2,1fr);
                gap:30px;
                margin-top:30px;
            ">

                <div style="
                    background:#fff;
                    border-radius:12px;
                    padding:20px;
                    box-shadow:0 2px 10px rgba(0,0,0,.08);
                    text-align:center;
                ">

                    <h3>Pass vs Fail</h3>

<div style="
    width:320px;
    height:320px;
    margin:auto;
">
    <canvas id="passFailChart"></canvas>
</div>

                </div>

                <div style="
                    background:#fff;
                    border-radius:12px;
                    padding:20px;
                    box-shadow:0 2px 10px rgba(0,0,0,.08);
                    text-align:center;
                ">

                    <h3>Status Distribution</h3>

<div style="
    width:320px;
    height:320px;
    margin:auto;
">
    <canvas id="statusChart"></canvas>
</div>

                </div>

            </div>

            <br><br>

<h3>🤖 AI Summary</h3>

<br>

<button
    id="downloadPdfBtn"
    onclick="downloadExamReport()"
    style="display:none;margin-bottom:20px;">

    📥 Download PDF Report

</button>

<div id="summaryBox"></div>

        </div>

    `;

    await loadExamDropdown();

}
async function loadExamDropdown() {

    const API_URL =
        "http://127.0.0.1:8000";

    try {

        const response =
            await fetch(
                `${API_URL}/exams`
            );

        const exams =
            await response.json();

        const dropdown =
            document.getElementById("examId");

        exams.forEach(exam => {

            dropdown.innerHTML += `

                <option value="${exam.exam_id}">

                    ${exam.exam_name}

                </option>

            `;

        });

    }

    catch(error){

        console.error(error);
    }

}
async function getExamSummaryDashboard() {

    const API_URL =
        "http://127.0.0.1:8000";

    const examId =
        document.getElementById("examId").value;

    const summaryBox =
        document.getElementById("summaryBox");


    // ===============================
    // Check Exam
    // ===============================

    if (!examId) {

        alert("Select an Exam");

        return;

    }


    // ===============================
    // Loading Message
    // ===============================

    summaryBox.innerHTML = `

        <div class="loader"></div>

        <h3>Generating AI Report...</h3>

        <p>
            Please wait while AI analyzes the data.
        </p>

    `;


    try {

        // ===============================
        // Fetch AI Exam Summary
        // ===============================

        const response =
            await fetch(
                `${API_URL}/ai/exam-summary/${examId}`
            );


        // Check HTTP response
        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "AI Summary API Error:",
                errorText
            );

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const data =
            await response.json();


        console.log(
            "AI Exam Summary Response:",
            data
        );


        // ===============================
        // Check API Error
        // ===============================

        if (data.error) {

            throw new Error(
                data.error
            );

        }


        // ===============================
        // Store AI Data
        // ===============================

        window.examAssessment =
            String(
                data.assessment ?? ""
            );

        window.examRecommendation =
            String(
                data.recommendation ?? ""
            );


        // ===============================
        // Summary Cards
        // ===============================

        document.getElementById(
            "examTotalStudents"
        ).innerText =
            data.total_students ?? 0;


        document.getElementById(
            "examGaveExam"
        ).innerText =
            data.gave_exam ?? 0;


        document.getElementById(
            "examDidNotGive"
        ).innerText =
            data.did_not_give ?? 0;


        document.getElementById(
            "examNotGiven"
        ).innerText =
            data.not_given ?? 0;


        document.getElementById(
            "examPassCount"
        ).innerText =
            data.pass_count ?? 0;


        document.getElementById(
            "examFailCount"
        ).innerText =
            data.fail_count ?? 0;


        document.getElementById(
            "examAverageRisk"
        ).innerText =
            data.average_risk ?? 0;


        document.getElementById(
            "examTabSwitches"
        ).innerText =
            data.tab_switch_violations ?? 0;


        document.getElementById(
            "examTabSwitchStudents"
        ).innerText =
            data.tab_switch_students ?? 0;


        // ===============================
        // Destroy Old Charts
        // ===============================

        if (
            window.passFailChart &&
            typeof window.passFailChart.destroy === "function"
        ) {

            window.passFailChart.destroy();

            window.passFailChart = null;

        }


        if (
            window.statusChart &&
            typeof window.statusChart.destroy === "function"
        ) {

            window.statusChart.destroy();

            window.statusChart = null;

        }


        // ===============================
        // Pass vs Fail Chart
        // ===============================

        const passCanvas =
            document.getElementById(
                "passFailChart"
            );


        if (passCanvas) {

            window.passFailChart =
                new Chart(
                    passCanvas,
                    {

                        type: "pie",

                        data: {

                            labels: [
                                "Pass",
                                "Fail"
                            ],

                            datasets: [

                                {

                                    data: [

                                        Number(
                                            data.pass_count
                                        ) || 0,

                                        Number(
                                            data.fail_count
                                        ) || 0

                                    ]

                                }

                            ]

                        },

                        options: {

                            responsive: true,

                            maintainAspectRatio: true,

                            plugins: {

                                legend: {

                                    position: "bottom",

                                    labels: {

                                        font: {

                                            size: 14

                                        }

                                    }

                                }

                            }

                        }

                    }
                );

        }


        // ===============================
        // Status Distribution Chart
        // ===============================

        const statusCanvas =
            document.getElementById(
                "statusChart"
            );


        if (statusCanvas) {

            window.statusChart =
                new Chart(
                    statusCanvas,
                    {

                        type: "pie",

                        data: {

                            labels: [

                                "Completed",

                                "On Hold",

                                "Invalid"

                            ],

                            datasets: [

                                {

                                    data: [

                                        Number(
                                            data.completed
                                        ) || 0,

                                        Number(
                                            data.on_hold
                                        ) || 0,

                                        Number(
                                            data.invalid
                                        ) || 0

                                    ]

                                }

                            ]

                        },

                        options: {

                            responsive: true,

                            maintainAspectRatio: true,

                            plugins: {

                                legend: {

                                    position: "bottom",

                                    labels: {

                                        font: {

                                            size: 14

                                        }

                                    }

                                }

                            }

                        }

                    }
                );

        }


        // ===============================
        // AI Assessment
        // ===============================

        const assessment =
            window.examAssessment
                .replace(/\n{3,}/g, "\n\n")
                .replace(/\n/g, "<br>");


        // ===============================
        // Faculty Recommendations
        // ===============================

        const recommendation =
            window.examRecommendation
                .replace(/\n{3,}/g, "\n\n")
                .replace(/\n/g, "<br>");


        // ===============================
        // Display AI Summary
        // ===============================

summaryBox.innerHTML = `

    <div class="ai-summary-content">

        <h3>
            📊 Exam AI Summary
        </h3>


        <h4>
            🤖 AI Assessment
        </h4>

        <div class="ai-assessment">

            ${assessment || "No assessment available."}

        </div>


        <h4>
            📌 Faculty Recommendations
        </h4>

        <div class="ai-recommendation">

            ${
                recommendation ||
                "No recommendations available."
            }

        </div>


        <!-- PDF DOWNLOAD BUTTON -->

        <div style="
            margin-top:25px;
            text-align:left;
        ">

            <button
                onclick="downloadExamReport()"
                style="
                    padding:12px 20px;
                    background:#2563eb;
                    color:white;
                    border:none;
                    border-radius:6px;
                    cursor:pointer;
                    font-size:14px;
                    font-weight:bold;
                "
            >

                📄 Download PDF Report

            </button>

        </div>

    </div>

`;


    }

    catch (error) {

        console.error(
            "Exam Summary Error:",
            error
        );


        summaryBox.innerHTML = `

            <h3>
                Unable to generate report.
            </h3>

            <p>
                ${error.message}
            </p>

        `;

    }

}
function showOverallAnalytics() {

    document.getElementById("content-area").innerHTML = `

<div class="section-box">

    <button class="back-btn"
            onclick="showAnalytics()">

        ← Back to Analytics

    </button>

    <br><br>

    <h2>

        🏫 Overall AI Summary

    </h2>

    <button onclick="getOverallSummaryDashboard()">

        Generate Institution Report

    </button>

    <br><br>

    <div id="summaryBox"></div>

</div>

`;

}
async function getOverallSummaryDashboard() {

    const API_URL =
        "http://127.0.0.1:8000";

    const summaryBox =
        document.getElementById("summaryBox");

summaryBox.innerHTML = `
<div class="loading-box">

    <div class="loader"></div>

    <h3>Generating AI Report...</h3>

    <p>Please wait while AI analyzes the data.</p>

</div>
`;

    try {

        const response =
            await fetch(
                `${API_URL}/ai/exam-summary`
            );

        const data =
            await response.json();

        let report =
            data.summary
                .replace(/\*\*/g, "")
                .replace(/\n{3,}/g, "\n\n")
                .replace(/\n\n/g, "<br><br>")
                .replace(/\n/g, "<br>");

        // ===============================
        // Beautify Section Headings
        // ===============================

        report = report

        .replace(
            /(1\.\s*)?OVERALL ACADEMIC PERFORMANCE/gi,
            "<h3 style='color:#2563eb;margin:25px 0 12px;'>📊 Overall Academic Performance</h3>"
        )

        .replace(
            /(2\.\s*)?PASS VS FAIL ANALYSIS/gi,
            "<h3 style='color:#2563eb;margin:25px 0 12px;'>📈 Pass vs Fail Analysis</h3>"
        )

        .replace(
            /(3\.\s*)?EXAM DIFFICULTY INSIGHTS/gi,
            "<h3 style='color:#2563eb;margin:25px 0 12px;'>📚 Exam Difficulty Insights</h3>"
        )

        .replace(
            /(4\.\s*)?PROCTORING\s*&\s*INTEGRITY SUMMARY/gi,
            "<h3 style='color:#2563eb;margin:25px 0 12px;'>🛡️ Proctoring & Integrity Summary</h3>"
        )

        .replace(
            /(5\.\s*)?STUDENT PERFORMANCE INSIGHTS/gi,
            "<h3 style='color:#2563eb;margin:25px 0 12px;'>👨‍🎓 Student Performance Insights</h3>"
        )

        .replace(
            /(6\.\s*)?FACULTY RECOMMENDATIONS/gi,
            "<h3 style='color:#2563eb;margin:25px 0 12px;'>📌 Faculty Recommendations</h3>"
        )

        .replace(
            /(7\.\s*)?FUTURE IMPROVEMENT SUGGESTIONS/gi,
            "<h3 style='color:#2563eb;margin:25px 0 12px;'>🚀 Future Improvement Suggestions</h3>"
        );

        // ===============================
        // Beautify Bullet Points
        // ===============================

        report =
            report.replace(
                /•/g,
                "&bull;"
            );

        summaryBox.innerHTML = `

<div style="
background:#f8fbff;
border:1px solid #dbeafe;
border-radius:14px;
padding:25px;
">

<h2 style="
color:#2563eb;
margin-bottom:20px;
">
🏫 Overall AI Summary
</h2>

<div style="
background:white;
padding:25px;
border-radius:12px;
box-shadow:0 2px 8px rgba(0,0,0,.08);
line-height:1.9;
font-size:15px;
color:#334155;
">

${report}

</div>

</div>

`;

    }

    catch(error){

        console.error(error);

        summaryBox.innerHTML =
            "<h3>Unable to generate summary.</h3>";

    }

}

function showChangePassword() {
    const faculty = JSON.parse(localStorage.getItem("faculty"));
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
        if (newPw !== confirmPw) { msg.style.color = "red"; msg.innerText = "New passwords do not match."; return; }
        if (newPw.length < 6) { msg.style.color = "red"; msg.innerText = "Password must be at least 6 characters."; return; }
        try {
            const resp = await fetch(`${API_URL}/faculty/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    faculty_code: faculty.faculty_code,
                    current_password: document.getElementById("cp_current").value,
                    new_password: newPw
                })
            });
            const data = await resp.json();
            if (data.message === "Password changed successfully") {
                msg.style.color = "green";
                msg.innerText = "Password changed! Please log in again.";
                setTimeout(() => { localStorage.removeItem("faculty"); window.location.href = "index.html"; }, 2000);
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

    localStorage.removeItem("faculty");

    window.location.href =
        "index.html";
}

showDashboard();
function searchResults(){

    const input =
        document.getElementById("resultSearch");

    const filter =
        input.value.toUpperCase();

    const rows =
        document.querySelectorAll(
            "#resultsTable tbody tr"
        );

    rows.forEach(row => {

        const text =
            row.textContent.toUpperCase();

        if(text.includes(filter)){

            row.style.display = "";

        }

        else{

            row.style.display = "none";

        }

    });

}
function exportResultsCSV(){

    const table =
        document.getElementById("resultsTable");

    let csv = [];

    for(let i=0;i<table.rows.length;i++){

        let row = [];

        for(let j=0;j<table.rows[i].cells.length-1;j++){

            let value =
                table.rows[i].cells[j].innerText;

            // Keep the UI dashes readable, but export non-attempt fields as
            // empty CSV values for Not Given assignments.
            if (
                table.rows[i].dataset.attendance === "Not Given" &&
                [2, 3, 4, 5, 8].includes(j)
            ) {
                value = "";
            }

            row.push(
                '"' +
                value.replace(/"/g,'""') +
                '"'
            );

        }

        csv.push(row.join(","));

    }

    const csvFile =
        new Blob([csv.join("\n")],
        {type:"text/csv"});

    const downloadLink =
        document.createElement("a");

    downloadLink.download =
        "exam_results.csv";

    downloadLink.href =
        window.URL.createObjectURL(csvFile);

    downloadLink.style.display =
        "none";

    document.body.appendChild(
        downloadLink
    );

    downloadLink.click();

    document.body.removeChild(
        downloadLink
    );

}
function filterResults() {

    const statusFilter =
        document.getElementById("statusFilter").value;

    const attendanceFilter =
        document.getElementById("attendanceFilter").value;

    const rows =
        document.querySelectorAll("#resultsTable tbody tr");

    rows.forEach(row => {

        const matchesStatus =
            statusFilter === "ALL" ||
            row.dataset.resultStatus === statusFilter;

        const attendance = row.dataset.attendance;
        const matchesAttendance =
            attendanceFilter === "ALL" ||
            (attendanceFilter === "GIVEN"
                ? attendance === "Started" || attendance === "Submitted"
                : attendance === attendanceFilter);

        row.style.display = matchesStatus && matchesAttendance ? "" : "none";

    });

}
function sortResults() {

    const table =
        document.getElementById("resultsTable");

    const tbody =
        table.querySelector("tbody");

    const rows =
        Array.from(tbody.querySelectorAll("tr"));

    const option =
        document.getElementById("sortResults").value;

    rows.sort((a, b) => {

        if (option === "score") {

            return (Number(b.dataset.score) || -1) -
                   (Number(a.dataset.score) || -1);

        }

        if (option === "risk") {

            return (Number(b.dataset.risk) || -1) -
                   (Number(a.dataset.risk) || -1);

        }

        if (option === "latest") {

            return (Date.parse(b.dataset.submitted) || 0) -
                   (Date.parse(a.dataset.submitted) || 0);

        }

        return 0;

    });

    tbody.innerHTML = "";

    rows.forEach(row => tbody.appendChild(row));

}
async function downloadExamReport() {

    if (!window.jspdf) {

        alert(
            "PDF library is not loaded. Please refresh the page and try again."
        );

        console.error(
            "jsPDF is not loaded."
        );

        return;
    }

    const { jsPDF } = window.jspdf;

    const doc =
        new jsPDF("p","mm","a4");

    const pageWidth =
        doc.internal.pageSize.getWidth();

    const pageHeight =
        doc.internal.pageSize.getHeight();

    let y = 20;

    // ==========================================
    // Title
    // ==========================================

    doc.setFont("helvetica","bold");
    doc.setFontSize(20);

    doc.text(
        "AI PROCTORING EXAM REPORT",
        pageWidth / 2,
        y,
        {
            align:"center"
        }
    );

    y += 8;

    doc.setDrawColor(180);

    doc.line(
        20,
        y,
        pageWidth-20,
        y
    );

    y += 10;

    doc.setFont("helvetica","normal");
    doc.setFontSize(11);

    doc.text(
        "Generated On : " +
        new Date().toLocaleString(),
        20,
        y
    );

    y += 14;

    // ==========================================
    // Exam Summary
    // ==========================================

    doc.setFont("helvetica","bold");
    doc.setFontSize(15);

    doc.text(
        "Exam Summary",
        20,
        y
    );

    y += 8;

    doc.setFont("helvetica","normal");
    doc.setFontSize(11);

    doc.text(
        `Exam Name : ${
            document.getElementById("examId").options[
                document.getElementById("examId").selectedIndex
            ].text
        }`,
        20,
        y
    );

    y += 7;

    doc.text(
        `Total Students : ${document.getElementById("examTotalStudents").innerText}`,
        20,
        y
    );

    y += 7;

    doc.text(
        `Gave Exam : ${document.getElementById("examGaveExam").innerText}`,
        20,
        y
    );

    y += 7;

    doc.text(
        `Did Not Give : ${document.getElementById("examDidNotGive").innerText}`,
        20,
        y
    );

    y += 7;

    doc.text(
        `Not Given : ${document.getElementById("examNotGiven").innerText}`,
        20,
        y
    );

    y += 7;

    doc.text(
        `Pass : ${document.getElementById("examPassCount").innerText}`,
        20,
        y
    );

    y += 7;

    doc.text(
        `Fail : ${document.getElementById("examFailCount").innerText}`,
        20,
        y
    );

    y += 7;

    doc.text(
        `Average Risk Score : ${document.getElementById("examAverageRisk").innerText}`,
        20,
        y
    );

    y += 15;

    // ==========================================
    // AI Assessment
    // ==========================================

    doc.setFont("helvetica","bold");
    doc.setFontSize(15);

    doc.text(
        "AI Assessment",
        20,
        y
    );

    y += 8;

    doc.setFont("helvetica","normal");
    doc.setFontSize(10);

    const assessment =
        (window.examAssessment || "")
            .replace(/\r/g,"")
            .trim();

    const assessmentParagraphs =
        assessment.split(/\n\s*\n/);

    assessmentParagraphs.forEach(paragraph=>{

        const lines =
            doc.splitTextToSize(
                paragraph.trim(),
                170
            );

        if(y + lines.length*5 > 265){

            doc.addPage();

            y = 20;

        }

        doc.text(
            lines,
            20,
            y
        );

        y += lines.length*5 + 6;

    });

    // ==========================================
    // Faculty Recommendation
    // ==========================================

    if(y > 235){

        doc.addPage();

        y = 20;

    }

    doc.setFont("helvetica","bold");
    doc.setFontSize(15);

    doc.text(
        "Faculty Recommendations",
        20,
        y
    );

    y += 8;

    doc.setFont("helvetica","normal");
    doc.setFontSize(10);

    const recommendation =
        (window.examRecommendation || "")
            .replace(/\r/g,"")
            .trim();

    const recommendationParagraphs =
        recommendation.split(/\n\s*\n/);

    recommendationParagraphs.forEach(paragraph=>{

        const lines =
            doc.splitTextToSize(
                paragraph.trim(),
                170
            );

        if(y + lines.length*5 > 265){

            doc.addPage();

            y = 20;

        }

        doc.text(
            lines,
            20,
            y
        );

        y += lines.length*5 + 6;

    });

    // ==========================================
    // Charts
    // ==========================================

    doc.addPage();

    y = 20;

    doc.setFont("helvetica","bold");
    doc.setFontSize(16);

    doc.text(
        "Exam Statistics Charts",
        20,
        y
    );

    y += 12;

    const passCanvas =
        document.getElementById("passFailChart");

    const statusCanvas =
        document.getElementById("statusChart");

    if(passCanvas){

        doc.setFontSize(12);

        doc.text(
            "Pass vs Fail",
            25,
            y
        );

        doc.addImage(
            passCanvas.toDataURL("image/png"),
            "PNG",
            20,
            y+5,
            75,
            75
        );

    }

    if(statusCanvas){

        doc.setFontSize(12);

        doc.text(
            "Status Distribution",
            120,
            y
        );

        doc.addImage(
            statusCanvas.toDataURL("image/png"),
            "PNG",
            115,
            y+5,
            75,
            75
        );

    }

    // ==========================================
    // Footer
    // ==========================================

    doc.setFontSize(9);

    doc.setTextColor(120);

    doc.text(
        "Generated by AI Proctoring System",
        pageWidth/2,
        pageHeight-10,
        {
            align:"center"
        }
    );

    // ==========================================
    // Save PDF
    // ==========================================

    const examName =
        document
            .getElementById("examId")
            .options[
                document.getElementById("examId").selectedIndex
            ]
            .text;

    const fileName =
        examName
            .replace(/[^\w\s]/g,"")
            .replace(/\s+/g,"_");

    doc.save(
        fileName +
        "_AI_Proctoring_Report.pdf"
    );

}
