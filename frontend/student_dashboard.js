function logout() {
    localStorage.removeItem("student_id");
    localStorage.removeItem("student_name");
    window.location.href = "index.html";
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

            <select
                id="examSelect"
                onchange="displayResult()"
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

    const index = document.getElementById("examSelect").value;
    const result = window.studentResults[index];

    window.selectedExam = result;

    const isInvalid = result.status === "Invalid";
    const isCancelled = result.status === "Cancelled";

    const badgeColor =
        result.status === "Completed"
            ? "#16a34a"
            : "#dc2626";

    const progressColor =
        result.result === "Pass"
            ? "linear-gradient(90deg,#16a34a,#4ade80)"
            : "linear-gradient(90deg,#dc2626,#f87171)";

    let html = `

    <div style="
        background:white;
        border-radius:18px;
        padding:30px;
        margin-top:20px;
        box-shadow:0 10px 30px rgba(0,0,0,.08);
        border-top:6px solid #2563eb;
    ">

        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:30px;
        ">

            <h2 style="
                margin:0;
                color:#1e3a8a;
                font-size:34px;
            ">
                📘 ${result.exam_name}
            </h2>

            <span style="
                background:${badgeColor};
                color:white;
                padding:8px 20px;
                border-radius:25px;
                font-weight:bold;
                font-size:15px;
            ">
                ${result.status}
            </span>

        </div>

    `;

    if (isInvalid) {

        html += `

        <div style="
            background:#fff5f5;
            border:1px solid #fecaca;
            border-left:7px solid #dc2626;
            border-radius:14px;
            padding:35px;
            text-align:center;
        ">

            <div style="
                width:70px;
                height:70px;
                margin:0 auto 20px;
                background:#fee2e2;
                border-radius:50%;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:34px;
            ">
                ⚠️
            </div>

            <h2 style="
                margin:0 0 15px;
                color:#dc2626;
                font-size:28px;
            ">
                Exam Invalid
            </h2>

            <p style="
                color:#334155;
                font-size:17px;
                line-height:1.8;
                margin:0 auto;
                max-width:750px;
            ">
                You have violated the examination rules during this exam.
                Your examination has been marked as
                <b style="color:#dc2626;">Invalid</b>
                due to detected proctoring violations.
            </p>

            <div style="
                margin:25px auto 0;
                max-width:500px;
                padding:18px;
                background:white;
                border:1px solid #fecaca;
                border-radius:10px;
                text-align:left;
            ">

                <p style="margin:0 0 10px;">
                    <b>⚠️ Proctoring Violations:</b>
                    ${result.violation_count}
                </p>

                <p style="margin:0;">
                    <b>📋 Status:</b>
                    <span style="color:#dc2626;font-weight:bold;">
                        Invalid
                    </span>
                </p>

            </div>

            <p style="
                margin:25px 0 0;
                color:#64748b;
                font-size:14px;
                line-height:1.7;
            ">
                Your examination result is not available because the attempt
                has been marked as invalid. Please contact your faculty for
                further clarification.
            </p>

        </div>

        `;

    }
    else if (isCancelled) {

        html += `

        <div style="
            background:#fff5f5;
            border-left:6px solid #dc2626;
            border-radius:12px;
            padding:25px;
        ">

            <h2 style="
                margin-top:0;
                color:#dc2626;
            ">
                ❌ Exam Cancelled
            </h2>

            <p>
                <b>Result :</b> ${result.result}
            </p>

            <p>
                <b>Violations :</b> ${result.violation_count}
            </p>

            <p>
                <b>Reason :</b>
                ${result.cancel_reason || "Not Available"}
            </p>

        </div>

        `;

    }
    else {

        const aiSummary =
            result.violation_count == 0
                ? "✅ AI Summary: No suspicious behaviour detected."
                : result.violation_count <= 3
                ? "⚠️ AI Summary: Minor violations detected. Faculty review recommended."
                : "🚨 AI Summary: Multiple violations detected. Exam requires review.";

        html += `

        <div style="
            display:grid;
            grid-template-columns:repeat(2,1fr);
            gap:20px;
        ">

            <div class="result-item">

                <div style="color:#64748b;">
                    📊 Score
                </div>

                <h2>
                    ${result.score}/${result.total_questions}
                </h2>

            </div>

            <div class="result-item">

                <div style="color:#64748b;">
                    🏆 Result
                </div>

                <h2 style="
                    color:${result.result === "Pass" ? "#16a34a" : "#dc2626"};
                ">
                    ${result.result}
                </h2>

            </div>

            <div class="result-item">

                <div style="color:#64748b;">
                    ⚠️ Violations
                </div>

                <h2>
                    ${result.violation_count}
                </h2>

            </div>

            <div class="result-item">

                <div style="color:#64748b;">
                    📈 Percentage
                </div>

                <h2>
                    ${result.percentage}%
                </h2>

            </div>

        </div>

        <div style="margin-top:30px;">

            <div style="
                display:flex;
                justify-content:space-between;
                margin-bottom:10px;
                font-weight:bold;
            ">

                <span>Performance</span>

                <span>${result.percentage}%</span>

            </div>

            <div style="
                height:18px;
                background:#e5e7eb;
                border-radius:30px;
                overflow:hidden;
            ">

                <div style="
                    width:${result.percentage}%;
                    height:100%;
                    background:${progressColor};
                    transition:width .8s ease;
                ">
                </div>

            </div>

        </div>

        <div style="
            margin-top:25px;
            padding-top:18px;
            border-top:1px solid #e2e8f0;
            color:#475569;
            font-size:15px;
        ">

            📅 <b>Submitted :</b>

            ${
                result.submitted_at
                    ? new Date(result.submitted_at).toLocaleString("en-IN",{
                        dateStyle:"medium",
                        timeStyle:"short"
                    })
                    : "Not Available"
            }

        </div>

        <div style="
            margin-top:20px;
            padding:18px;
            background:#f8fafc;
            border-left:5px solid #2563eb;
            border-radius:10px;
            font-size:15px;
        ">

            🤖 <b>AI Assessment</b>

            <br><br>

            ${aiSummary}

        </div>

        <div style="
            margin-top:25px;
            text-align:center;
        ">

            <button
                onclick="viewStudentAnswers()"
                style="
                    background:#2563eb;
                    color:white;
                    border:none;
                    padding:12px 28px;
                    border-radius:8px;
                    font-size:16px;
                    cursor:pointer;
                ">

                📄 View Answer Sheet

            </button>

        </div>

        `;

    }

    html += `</div>`;

    document.getElementById("resultDisplay").innerHTML = html;
}
async function viewStudentAnswers(){

    const API_URL =
        "http://127.0.0.1:8000";

    const studentId =
        localStorage.getItem("student_id");

    const examId =
        window.selectedExam.exam_id;

    try{

        const response =
            await fetch(
                `${API_URL}/student/answers/${studentId}/${examId}`
            );

        const answers =
            await response.json();

        let html = "";

        let correct = 0;
        let wrong = 0;

        answers.forEach((answer,index)=>{

            if(answer.is_correct){

                correct++;

            }
            else{

                wrong++;

            }

            const options = {

                "A": answer.option_a,
                "B": answer.option_b,
                "C": answer.option_c,
                "D": answer.option_d

            };

            const studentAnswerText =
                answer.student_answer
                ?
                `${answer.student_answer}. ${options[answer.student_answer]}`
                :
                "Not Answered";

            const correctAnswerText =
                `${answer.correct_answer}. ${options[answer.correct_answer]}`;

            html += `

                <div class="answer-card">

                    <h3>

                        Question ${index+1}

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

                        <b>Your Answer :</b>

                        ${studentAnswerText}

                    </p>

                    <p>

                        <b>Correct Answer :</b>

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

        html += `

            <div class="answer-card">

                <h2>

                    Summary

                </h2>

                <p>

                    ✔ Correct Answers :
                    ${correct}

                </p>

                <p>

                    ✘ Wrong Answers :
                    ${wrong}

                </p>

                <p>

                    📊 Score :
                    ${window.selectedExam.score}/${window.selectedExam.total_questions}

                </p>

                <p>

                    📈 Percentage :
                    ${window.selectedExam.percentage}%

                </p>

            </div>

        `;

        document.getElementById(
            "studentAnswersContent"
        ).innerHTML = html;

        document.getElementById(
            "studentAnswersModal"
        ).style.display = "block";

    }

    catch(error){

        console.error(error);

        alert("Unable to load answer sheet.");

    }

}
function closeStudentAnswersModal(){

    document.getElementById(
        "studentAnswersModal"
    ).style.display = "none";

}