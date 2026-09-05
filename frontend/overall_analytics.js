const API_URL = "http://127.0.0.1:8000";

async function getOverallSummary() {

    const summaryBox =
        document.getElementById("summaryBox");

    summaryBox.innerText = "Generating AI Report...";

    try {

        const response = await fetch(
            `${API_URL}/ai/exam-summary`
        );

        const data = await response.json();

        summaryBox.innerText =
            data.summary;

    }

    catch (error) {

        console.error(error);

        summaryBox.innerText =
            "Unable to generate overall summary.";
    }
}