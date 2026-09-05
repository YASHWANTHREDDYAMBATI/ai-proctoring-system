const API_URL = "http://127.0.0.1:8000";

document.getElementById("examForm")
.addEventListener("submit", async function(e) {

    e.preventDefault();

    const exam_name =
        document.getElementById("exam_name").value;

    const duration =
        document.getElementById("duration").value;

    const message =
        document.getElementById("message");

    const faculty =
        JSON.parse(localStorage.getItem("faculty"));

    try {

        const response = await fetch(
            `${API_URL}/exams/create`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    exam_name: exam_name,
                    duration: parseInt(duration),
                    created_by: faculty.faculty_id
                })
            }
        );

        const data = await response.json();

        message.innerText = data.message;

        if (data.message === "Exam Created Successfully") {

            message.style.color = "green";

            document.getElementById("examForm").reset();

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