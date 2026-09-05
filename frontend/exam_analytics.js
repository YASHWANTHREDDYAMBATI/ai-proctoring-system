const API_URL = "http://127.0.0.1:8000";

async function getExamSummary() {

    const examId =
        document.getElementById("examId").value;

    const summaryBox =
        document.getElementById("summaryBox");

    if (!examId) {
        alert("Enter Exam ID");
        return;
    }

    summaryBox.innerText = "Loading...";

    try {

        const response = await fetch(
            `${API_URL}/ai/exam-summary/${examId}`
        );

        const data = await response.json();

        summaryBox.innerText = data.summary;

    }

    catch (error) {

        console.error(error);

        summaryBox.innerText =
            "Unable to generate summary.";
    }
}