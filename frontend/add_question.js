const API_URL = "http://127.0.0.1:8000";

/* Load Exams into Dropdown */
async function loadExams() {

    try {

        const response = await fetch(`${API_URL}/exams`);

        const exams = await response.json();

        const examDropdown =
            document.getElementById("exam_id");

        exams.forEach(exam => {

            examDropdown.innerHTML += `
                <option value="${exam.exam_id}">
                    ${exam.exam_name}
                </option>
            `;
        });

    } catch (error) {

        console.error(error);
    }
}

loadExams();

/* Add Question */
document.getElementById("questionForm")
.addEventListener("submit", async function(e) {

    e.preventDefault();

    const message =
        document.getElementById("message");

    try {

        const response = await fetch(
            `${API_URL}/questions/add`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    exam_id:
                        parseInt(document.getElementById("exam_id").value),

                    question_text:
                        document.getElementById("question_text").value,

                    option_a:
                        document.getElementById("option_a").value,

                    option_b:
                        document.getElementById("option_b").value,

                    option_c:
                        document.getElementById("option_c").value,

                    option_d:
                        document.getElementById("option_d").value,

                    correct_option:
                        document.getElementById("correct_option").value
                })
            }
        );

        const data = await response.json();

        message.innerText = data.message;

        if (data.message === "Question Added Successfully") {

            message.style.color = "green";

            document.getElementById("questionForm").reset();

        } else {

            message.style.color = "red";
        }

    } catch (error) {

        console.error(error);

        message.style.color = "red";

        message.innerText =
            "Unable to connect to server.";
    }

});