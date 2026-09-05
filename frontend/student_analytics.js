const API_URL = "http://127.0.0.1:8000";

async function getStudentSummary() {

    const studentId =
        document.getElementById("studentId").value;

    const summaryBox =
        document.getElementById("summaryBox");

    if (!studentId) {
        alert("Enter Student ID");
        return;
    }

    summaryBox.innerText = "Loading...";

    try {

        const response = await fetch(
            `${API_URL}/ai/student-summary/${studentId}`
        );

        const data = await response.json();

        summaryBox.innerText = data.summary;

    }

    catch (error) {

        summaryBox.innerText =
            "Unable to generate summary.";

        console.error(error);
    }
}