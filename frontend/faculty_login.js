const API_URL = "http://127.0.0.1:8000";

document.getElementById("facultyLoginForm")
.addEventListener("submit", async function(e) {

    e.preventDefault();

    const identifier = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const message = document.getElementById("message");
    const loginBtn = document.querySelector("#facultyLoginForm button");

    loginBtn.disabled = true;
    loginBtn.innerText = "Logging In...";
    message.innerText = "";

    try {
        // Try super admin login (username = "superadmin" or starts with "superadmin")
        const adminResp = await fetch(`${API_URL}/superadmin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: identifier, password: password })
        });
        const adminData = await adminResp.json();

        if (adminData.message === "Super Admin Login Successful") {
            localStorage.setItem("superadmin", JSON.stringify(adminData));
            message.style.color = "green";
            message.innerText = "Login successful! Redirecting...";
            window.location.href = "superadmin_dashboard.html";
            return;
        }

        // Try faculty login (uses faculty_code like FAC001)
        const facultyResp = await fetch(`${API_URL}/faculty/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ faculty_code: identifier, password: password })
        });
        const facultyData = await facultyResp.json();

        if (facultyData.message === "Faculty Login Successful") {
            localStorage.setItem("faculty", JSON.stringify(facultyData));
            message.style.color = "green";
            message.innerText = "Login successful! Redirecting...";
            window.location.href = "faculty_dashboard.html";
            return;
        }

        // Try student login (uses roll number)
        const studentResp = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roll_no: identifier, password: password })
        });
        const studentData = await studentResp.json();

        if (studentData.message === "Login Successful") {
            localStorage.setItem("student_id", studentData.student_id);
            localStorage.setItem("student_name", studentData.name);
            message.style.color = "green";
            message.innerText = "Login successful! Redirecting...";
            window.location.href = "student_dashboard.html";
            return;
        }

        // All failed
        message.style.color = "red";
        message.innerText = "Invalid credentials. Please check your email/roll number and password.";

    } catch(error) {
        console.log(error);
        message.style.color = "red";
        message.innerText = "Unable to connect to server.";
    }

    loginBtn.disabled = false;
    loginBtn.innerText = "Login";
});

function togglePassword() {
    const password = document.getElementById("password");
    password.type = password.type === "password" ? "text" : "password";
}
