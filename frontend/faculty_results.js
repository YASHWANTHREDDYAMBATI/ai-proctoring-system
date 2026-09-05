const API_URL = "http://127.0.0.1:8000";

async function loadResults() {

    try {

        const response = await fetch(
            `${API_URL}/faculty/results`
        );

        const results = await response.json();

        const tbody =
            document.querySelector("#resultsTable tbody");

        tbody.innerHTML = "";

        // ===== Summary =====

        let completed = 0;
        let onHold = 0;
        let invalid = 0;
        let totalPercentage = 0;

        results.forEach(result => {

            totalPercentage += Number(result.percentage);

            if (result.status === "Completed")
                completed++;

            else if (result.status === "On Hold")
                onHold++;

            else if (result.status === "Invalid")
                invalid++;

        });

        document.getElementById("totalStudents").textContent =
            results.length;

        document.getElementById("completedCount").textContent =
            completed;

        document.getElementById("onHoldCount").textContent =
            onHold;

        document.getElementById("invalidCount").textContent =
            invalid;

        document.getElementById("averageScore").textContent =
            results.length
                ? (totalPercentage / results.length).toFixed(2) + "%"
                : "0%";

        // ====================

        if (results.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="9">No results found.</td>
                </tr>
            `;

            return;
        }

        results.forEach(result => {

            const resultBadge =
                `<span class="${result.result === "Pass"
                    ? "pass-badge"
                    : "fail-badge"}">
                    ${result.result}
                </span>`;

            const statusBadge =
                `<span class="${
                    result.status === "Completed"
                        ? "valid-badge"
                        : result.status === "On Hold"
                        ? "pending-badge"
                        : "invalid-badge"
                }">
                    ${result.status}
                </span>`;

            let riskBadge = "";

            if (result.exam_status === "INVALID") {

                riskBadge = `
                    <span class="invalid-badge">
                        INVALID
                    </span>
                `;

            }
            else if (result.risk_score >= 60) {

                riskBadge = `
                    <span class="pending-badge">
                        ${result.risk_score}/100
                    </span>
                `;

            }
            else {

                riskBadge = `
                    <span class="valid-badge">
                        ${result.risk_score}/100
                    </span>
                `;

            }

            tbody.innerHTML += `

                <tr>

                    <td>${result.student_name}</td>

                    <td>${result.exam_name}</td>

                    <td>${result.score}/${result.total_questions}</td>

                    <td>${result.percentage}%</td>

                    <td>${resultBadge}</td>

                    <td>${riskBadge}</td>

                    <td>${statusBadge}</td>

                    <td>${result.submitted_at ?? "-"}</td>

                    <td>-</td>

                </tr>

            `;

        });

    }

    catch (error) {

        console.error(error);

        alert("Unable to load results.");

    }

}

loadResults();