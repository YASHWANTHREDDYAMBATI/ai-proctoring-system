async function studentLogin() {

    const roll_no = document.getElementById("roll_no").value;
const password =
    document.getElementById("password").value;
    const loginBtn =
    document.querySelector(".login-form button");

loginBtn.disabled = true;

loginBtn.innerText = "Logging In...";

    try {

        const response = await fetch(
            "http://127.0.0.1:8000/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    roll_no: roll_no,
                    password: password
                })
            }
        );

        const data = await response.json();

if (data.message === "Login Successful") {

    localStorage.setItem("student_id", data.student_id);
    localStorage.setItem("student_name", data.name);

    window.location.href = "student_dashboard.html";
loginBtn.disabled = false;

loginBtn.innerText = "Login";
}
else {
loginBtn.disabled = false;

loginBtn.innerText = "Login";
    document.getElementById("message").innerText =
        data.message;

}
    }

    catch(error) {
loginBtn.disabled = false;

loginBtn.innerText = "Login";
        document.getElementById("message").innerText =
            "Cannot connect to backend.";

    }

}
async function viewExams() {

    const studentId = localStorage.getItem("student_id");
    const url = studentId
        ? `http://127.0.0.1:8000/exams?student_id=${studentId}`
        : "http://127.0.0.1:8000/exams";

    const response = await fetch(url);
    const exams = await response.json();

    let html = `

        <div class="section-box">

            <h2>Available Exams</h2>

            <br>

    `;

    if (exams.length === 0) {
        html += `<p style="color:#64748b;">No exams available at the moment. Check back later.</p>`;
    }

    exams.forEach(exam => {

        html += `

            <div class="exam-card">

                <h3>
                    ${exam.exam_name}
                </h3>

                <p>
                    Duration:
                    ${exam.duration}
                    Minutes
                </p>

                <button
                    onclick="window.location.href='proctor_exam.html?examId=${exam.exam_id}'">

                    Start Proctored Exam

                </button>

            </div>

        `;

    });

    html += `</div>`;

    document.getElementById("content").innerHTML = html;
}
async function startProctoredExam(examId) {

    const response = await fetch(
        `http://127.0.0.1:8000/questions/${examId}`
    );

    const questions = await response.json();

    let html = "<h3>Exam Questions</h3>";

    questions.forEach(question => {

        html += `
            <div>

                <p>
                    <b>${question.question_text}</b>
                </p>

                <input type="radio"
                       name="q${question.question_id}"
                       value="A">
                ${question.option_a}

                <br>

                <input type="radio"
                       name="q${question.question_id}"
                       value="B">
                ${question.option_b}

                <br>

                <input type="radio"
                       name="q${question.question_id}"
                       value="C">
                ${question.option_c}

                <br>

                <input type="radio"
                       name="q${question.question_id}"
                       value="D">
                ${question.option_d}

                <hr>

            </div>
        `;
    });

html += `
    <button onclick="submitExam(${examId})">
        Submit Exam
    </button>
`;
    document.getElementById("content").innerHTML = html;
}
async function submitExam(examId) {

    const answers = [];

    const questions = await fetch(
        `http://127.0.0.1:8000/questions/${examId}`
    );

    const questionData = await questions.json();

    questionData.forEach(question => {

        const selected = document.querySelector(
            `input[name="q${question.question_id}"]:checked`
        );

        if (selected) {

            answers.push({
                question_id: question.question_id,
                selected_option: selected.value
            });

        }

    });

    const payload = {
        student_id: parseInt(localStorage.getItem("student_id")),
        exam_id: examId,
        answers: answers
    };

    const response = await fetch(
        "http://127.0.0.1:8000/exam/submit",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
    );

const result = await response.json();

if (result.message === "You have already submitted this exam.") {

    document.getElementById("content").innerHTML = `
        <h3>${result.message}</h3>
    `;

} else {

    document.getElementById("content").innerHTML = `
        <h3>${result.message}</h3>

        <p>
            Score: ${result.score}/${result.total_questions}
        </p>

        <p>
            Percentage: ${result.percentage}%
        </p>
    `;
}
}
async function viewResults() {
    const studentId = localStorage.getItem("student_id");

    const response = await fetch(
        `http://127.0.0.1:8000/student/results/${studentId}`
    );

    const results = await response.json();

    if (results.length === 0) {

        document.getElementById("content").innerHTML = `
            <div class="section-box">
                <h2>My Results</h2>
                <br>
                <p>No exam results found.</p>
            </div>
        `;

        return;
    }

    let html = `
        <div class="section-box">

            <h2>My Results</h2>

            <br>

            <label><b>Select Exam</b></label>

            <br><br>

            <select id="examSelect" onchange="displayResult()"
                    style="
                        width:300px;
                        padding:10px;
                        border-radius:8px;
                        font-size:16px;
                    ">
    `;

    results.forEach((result, index) => {

        html += `
            <option value="${index}">
                ${result.exam_name}
            </option>
        `;

    });

    html += `
            </select>

            <br><br>

            <div id="resultDisplay"></div>

        </div>
    `;

    document.getElementById("content").innerHTML = html;

    window.studentResults = results;

    displayResult();
}

function displayResult() {

    const index =
        document.getElementById("examSelect").value;

    const result =
        window.studentResults[index];

    let html = `
        <div class="result-card">

            <h3>${result.exam_name}</h3>

            <p><b>Status:</b> ${result.status}</p>
    `;

    if (result.status === "Cancelled") {

        html += `

            <p><b>Result:</b> ${result.result}</p>

            <p><b>Cancellation Reason:</b>
            ${result.cancel_reason}</p>

            <p><b>Violations:</b>
            ${result.violation_count}</p>

        `;

    }
    else {

        html += `

            <p><b>Score:</b>
            ${result.score}/${result.total_questions}</p>

            <p><b>Percentage:</b>
            ${result.percentage}%</p>

            <p><b>Result:</b>
            ${result.result}</p>

            <p><b>Violations:</b>
            ${result.violation_count}</p>

            <p><b>Submitted:</b>
            ${result.submitted_at}</p>

        `;

    }

    html += `</div>`;

    document.getElementById("resultDisplay").innerHTML = html;
}