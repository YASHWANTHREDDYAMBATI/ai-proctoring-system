from datetime import datetime

from fastapi import FastAPI, Body, HTTPException
from sqlalchemy import text
from backend.database import engine
from backend.groq_client import client
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
import shutil
import bcrypt

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

from backend.ai.yolo_detector import detect_objects


def _parse_availability_datetime(value, field_name: str):
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value

    if not isinstance(value, str):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a valid datetime string."
        )

    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a valid datetime string."
        ) from exc


def _serialize_datetime(value):
    if not value:
        return None

    return value.isoformat(sep="T", timespec="seconds")


def _exam_to_dict(row):
    return {
        "exam_id": row.exam_id,
        "exam_name": row.exam_name,
        "duration": row.duration,
        "created_by": row.created_by,
        "availability_start": _serialize_datetime(
            getattr(row, "availability_start", None)
        ),
        "availability_end": _serialize_datetime(
            getattr(row, "availability_end", None)
        ),
    }


def mark_expired_assignments_not_given(conn):
    """Mark only unstarted assignments whose availability window has closed."""

    result = conn.execute(
        text("""
            UPDATE exam_assignments ea
            JOIN exams e
                ON e.exam_id = ea.exam_id
            SET ea.attendance_status = 'Not Given'
            WHERE ea.attendance_status = 'Assigned'
              AND e.availability_end IS NOT NULL
              AND (
                  NOW() + INTERVAL 330 MINUTE
              ) >= e.availability_end
        """)
    )

    return result.rowcount

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Home Route — redirect to login page
@app.get("/")
def home():
    return RedirectResponse(url="/index.html")


# Get All Students
@app.get("/students")
def get_students():

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT * FROM students")
        )

        students = []

        for row in result:
            students.append({
                "student_id": row.student_id,
                "roll_no": row.roll_no,
                "name": row.name,
                "email": row.email
            })

        return students


# Register Student
@app.post("/register")
def register_student(student: dict = Body(...)):

    with engine.connect() as conn:

        query = text("""
            INSERT INTO students
            (roll_no, name, email, password)
            VALUES
            (:roll_no, :name, :email, :password)
        """)

        conn.execute(query, {
            "roll_no": student["roll_no"],
            "name": student["name"],
            "email": student["email"],
            "password": hash_password(student["password"])
        })

        conn.commit()

    return {
        "message": "Student Registered Successfully"
    }
@app.post("/login")
def login_student(student: dict = Body(...)):

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT * FROM students WHERE roll_no = :roll_no"),
            {"roll_no": student["roll_no"]}
        )
        user = result.fetchone()

        if user and verify_password(student["password"], user.password):
            return {
                "message": "Login Successful",
                "student_id": user.student_id,
                "name": user.name,
                "email": user.email
            }

        return {"message": "Invalid Roll Number or Password"}
@app.post("/faculty/register")
def register_faculty(faculty: dict = Body(...)):

    with engine.connect() as conn:

        result = conn.execute(text("""
            INSERT INTO faculty (name, email, password)
            VALUES (:name, :email, :password)
        """), {
            "name": faculty["name"],
            "email": faculty["email"],
            "password": hash_password(faculty["password"])
        })

        new_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        faculty_code = f"FAC{str(new_id).zfill(3)}"

        conn.execute(
            text("UPDATE faculty SET faculty_code = :code WHERE faculty_id = :id"),
            {"code": faculty_code, "id": new_id}
        )
        conn.commit()

    return {
        "message": "Faculty Registered Successfully",
        "faculty_code": faculty_code
    }

@app.post("/faculty/login")
def login_faculty(faculty: dict = Body(...)):

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT * FROM faculty WHERE faculty_code = :code"),
            {"code": faculty["faculty_code"]}
        )
        user = result.fetchone()

        if user and verify_password(faculty["password"], user.password):
            return {
                "message": "Faculty Login Successful",
                "faculty_id": user.faculty_id,
                "faculty_code": user.faculty_code,
                "name": user.name,
                "email": user.email
            }

        return {"message": "Invalid ID or Password"}
@app.post("/exams/create")
def create_exam(exam: dict = Body(...)):
    exam_name = str(exam.get("exam_name", "")).strip()
    if not exam_name:
        raise HTTPException(
            status_code=400,
            detail="exam_name is required."
        )

    try:
        duration = int(exam.get("duration"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="duration must be a positive integer."
        ) from exc

    if duration <= 0:
        raise HTTPException(
            status_code=400,
            detail="duration must be a positive integer."
        )

    availability_start = _parse_availability_datetime(
        exam.get("availability_start"),
        "availability_start"
    )
    availability_end = _parse_availability_datetime(
        exam.get("availability_end"),
        "availability_end"
    )

    if (availability_start is None) != (availability_end is None):
        raise HTTPException(
            status_code=400,
            detail=(
                "availability_start and availability_end must both be "
                "provided or both be omitted."
            )
        )

    if (
        availability_start is not None and
        availability_end is not None and
        availability_end <= availability_start
    ):
        raise HTTPException(
            status_code=400,
            detail="availability_end must be later than availability_start."
        )

    try:
        with engine.begin() as conn:
            raw_created_by = exam.get("created_by")
            if raw_created_by is not None:
                faculty_check = conn.execute(
                    text("SELECT faculty_id FROM faculty WHERE faculty_id = :fid"),
                    {"fid": raw_created_by}
                ).fetchone()
                created_by = raw_created_by if faculty_check else None
            else:
                created_by = None

            result = conn.execute(
                text("""
                    INSERT INTO exams
                    (
                        exam_name,
                        duration,
                        availability_start,
                        availability_end,
                        created_by
                    )
                    VALUES
                    (
                        :exam_name,
                        :duration,
                        :availability_start,
                        :availability_end,
                        :created_by
                    )
                """),
                {
                    "exam_name": exam_name,
                    "duration": duration,
                    "availability_start": availability_start,
                    "availability_end": availability_end,
                    "created_by": created_by
                }
            )

            exam_id = result.lastrowid

            student_rows = conn.execute(
                text("""
                    SELECT student_id
                    FROM students
                    ORDER BY student_id
                """)
            ).fetchall()

            if student_rows:
                conn.execute(
                    text("""
                        INSERT INTO exam_assignments
                        (
                            exam_id,
                            student_id,
                            attendance_status
                        )
                        VALUES
                        (
                            :exam_id,
                            :student_id,
                            'Assigned'
                        )
                    """),
                    [
                        {
                            "exam_id": exam_id,
                            "student_id": row.student_id
                        }
                        for row in student_rows
                    ]
                )

        return {
            "message": "Exam Created Successfully",
            "exam_id": exam_id,
            "availability_start": _serialize_datetime(availability_start),
            "availability_end": _serialize_datetime(availability_end)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/exams")
def get_exams(student_id: int = None):

    with engine.begin() as conn:

        if student_id:
            mark_expired_assignments_not_given(conn)

            result = conn.execute(
                text("""
                    SELECT e.*, ea.attendance_status AS assignment_status
                    FROM exam_assignments ea
                    JOIN exams e ON e.exam_id = ea.exam_id
                    LEFT JOIN exam_results er
                        ON er.exam_id = ea.exam_id
                       AND er.student_id = ea.student_id
                    WHERE ea.student_id = :sid
                      AND er.result_id IS NULL
                      AND (
                          (
                              ea.attendance_status = 'Assigned'
                              AND e.availability_start IS NOT NULL
                              AND e.availability_end IS NOT NULL
                              AND (NOW() + INTERVAL 330 MINUTE) >= e.availability_start
                              AND (NOW() + INTERVAL 330 MINUTE) < e.availability_end
                          )
                          OR (
                              ea.attendance_status = 'Started'
                              AND ea.deadline_at IS NOT NULL
                              AND (NOW() + INTERVAL 330 MINUTE) <= ea.deadline_at
                          )
                      )
                    ORDER BY e.exam_id
                """),
                {"sid": student_id}
            )

        else:
            result = conn.execute(
                text("SELECT * FROM exams")
            )

        exams = []

        for row in result:

            exam = _exam_to_dict(row)

            if student_id:
                exam["assignment_status"] = row.assignment_status

            exams.append(exam)

        return exams
@app.post("/exam/{exam_id}/start")
def start_exam_attempt(exam_id: int, data: dict = Body(...)):
    student_id = data.get("student_id")

    if not isinstance(student_id, int) or student_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="student_id must be a positive integer."
        )

    with engine.begin() as sync_conn:
        mark_expired_assignments_not_given(sync_conn)

    with engine.begin() as conn:

        student = conn.execute(
            text("""
                SELECT student_id
                FROM students
                WHERE student_id = :student_id
            """),
            {
                "student_id": student_id
            }
        ).fetchone()

        if not student:
            raise HTTPException(
                status_code=404,
                detail="Student not found."
            )

        attempt = conn.execute(
            text("""
                SELECT
                    e.exam_id,
                    e.duration,
                    e.availability_start,
                    e.availability_end,
                    ea.attendance_status,
                    ea.started_at,
                    ea.deadline_at,
                    ea.submitted_at,
                    NOW() AS database_now
                FROM exam_assignments ea
                JOIN exams e
                    ON e.exam_id = ea.exam_id
                WHERE ea.exam_id = :exam_id
                  AND ea.student_id = :student_id
                FOR UPDATE
            """),
            {
                "exam_id": exam_id,
                "student_id": student_id
            }
        ).fetchone()

        if not attempt:

            exam_exists = conn.execute(
                text("""
                    SELECT exam_id
                    FROM exams
                    WHERE exam_id = :exam_id
                """),
                {
                    "exam_id": exam_id
                }
            ).fetchone()

            if not exam_exists:
                raise HTTPException(
                    status_code=404,
                    detail="Exam not found."
                )

            raise HTTPException(
                status_code=403,
                detail="This exam is not assigned to this student."
            )

        if attempt.attendance_status == "Submitted":

            raise HTTPException(
                status_code=409,
                detail="This exam has already been submitted."
            )

        if attempt.attendance_status == "Not Given":

            raise HTTPException(
                status_code=403,
                detail="This exam is no longer available to start."
            )

        if attempt.attendance_status == "Assigned":

            if (
                attempt.availability_start is None
                or attempt.availability_end is None
                or (
                    attempt.database_now + __import__("datetime").timedelta(hours=5, minutes=30)
                    < attempt.availability_start
                )
                or (
                    attempt.database_now + __import__("datetime").timedelta(hours=5, minutes=30)
                    >= attempt.availability_end
                )
            ):
                raise HTTPException(
                    status_code=403,
                    detail="This exam is outside its availability window."
                )

            conn.execute(
                text("""
                    UPDATE exam_assignments
                    SET
                        started_at = NOW(),
                        deadline_at = DATE_ADD(
                            NOW(),
                            INTERVAL :duration MINUTE
                        ),
                        attendance_status = 'Started'
                    WHERE exam_id = :exam_id
                      AND student_id = :student_id
                """),
                {
                    "duration": attempt.duration,
                    "exam_id": exam_id,
                    "student_id": student_id
                }
            )

            attempt = conn.execute(
                text("""
                    SELECT
                        e.duration,
                        e.availability_start,
                        e.availability_end,
                        ea.started_at,
                        ea.deadline_at,
                        NOW() AS database_now
                    FROM exam_assignments ea
                    JOIN exams e
                        ON e.exam_id = ea.exam_id
                    WHERE ea.exam_id = :exam_id
                      AND ea.student_id = :student_id
                """),
                {
                    "exam_id": exam_id,
                    "student_id": student_id
                }
            ).fetchone()

    return {
        "exam_id": exam_id,
        "started_at": _serialize_datetime(attempt.started_at),
        "deadline_at": _serialize_datetime(attempt.deadline_at),
        "duration": attempt.duration,
        "availability_start": _serialize_datetime(attempt.availability_start),
        "availability_end": _serialize_datetime(attempt.availability_end),
        "current_time": _serialize_datetime(attempt.database_now)
    }
@app.post("/questions/add")
def add_question(question: dict = Body(...)):

    with engine.connect() as conn:

        query = text("""
            INSERT INTO questions
            (
                exam_id,
                question_text,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_option
            )
            VALUES
            (
                :exam_id,
                :question_text,
                :option_a,
                :option_b,
                :option_c,
                :option_d,
                :correct_option
            )
        """)

        conn.execute(query, {
            "exam_id": question["exam_id"],
            "question_text": question["question_text"],
            "option_a": question["option_a"],
            "option_b": question["option_b"],
            "option_c": question["option_c"],
            "option_d": question["option_d"],
            "correct_option": question["correct_option"]
        })

        conn.commit()

    return {
        "message": "Question Added Successfully"
    }


@app.post("/questions/bulk-add")
def bulk_add_questions(payload: dict = Body(...)):
    """Atomically add a complete set of four-option questions to an exam."""
    exam_id = payload.get("exam_id")
    questions = payload.get("questions")

    if not isinstance(exam_id, int) or exam_id <= 0:
        raise HTTPException(status_code=400, detail="exam_id must be a positive integer.")
    if not isinstance(questions, list) or not questions:
        raise HTTPException(status_code=400, detail="At least one question is required.")

    required_fields = (
        "question_text", "option_a", "option_b", "option_c", "option_d"
    )
    normalized_questions = []

    for index, question in enumerate(questions, start=1):
        if not isinstance(question, dict):
            raise HTTPException(status_code=400, detail=f"Question {index} is invalid.")

        normalized = {}
        for field in required_fields:
            value = question.get(field)
            if not isinstance(value, str) or not value.strip():
                label = field.replace("_", " ").title()
                raise HTTPException(
                    status_code=400,
                    detail=f"Question {index}: {label} is required."
                )
            normalized[field] = value.strip()

        correct_option = question.get("correct_option")
        if correct_option not in ("A", "B", "C", "D"):
            raise HTTPException(
                status_code=400,
                detail=f"Question {index}: Correct Answer must be A, B, C, or D."
            )
        normalized["correct_option"] = correct_option
        normalized["exam_id"] = exam_id
        normalized_questions.append(normalized)

    insert_question = text("""
        INSERT INTO questions
        (
            exam_id, question_text, option_a, option_b, option_c, option_d,
            correct_option
        )
        VALUES
        (
            :exam_id, :question_text, :option_a, :option_b, :option_c,
            :option_d, :correct_option
        )
    """)

    try:
        with engine.begin() as conn:
            exam_exists = conn.execute(
                text("SELECT exam_id FROM exams WHERE exam_id = :exam_id"),
                {"exam_id": exam_id}
            ).fetchone()
            if not exam_exists:
                raise HTTPException(status_code=404, detail="Exam not found.")

            conn.execute(insert_question, normalized_questions)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to save all questions. No questions were added."
        ) from exc

    return {
        "message": "Questions Added Successfully",
        "exam_id": exam_id,
        "question_count": len(normalized_questions)
    }


@app.get("/questions/{exam_id}")
def get_questions(exam_id: int):

    connection = engine.connect()

    query = text("""
        SELECT
            question_id,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d
        FROM questions
        WHERE exam_id = :exam_id
    """)

    result = connection.execute(
        query,
        {"exam_id": exam_id}
    )

    questions = []

    for row in result:
        questions.append({
            "question_id": row.question_id,
            "question_text": row.question_text,
            "option_a": row.option_a,
            "option_b": row.option_b,
            "option_c": row.option_c,
            "option_d": row.option_d
        })

    connection.close()

    return questions
@app.post("/exam/submit")
def submit_exam(data: dict = Body(...)):

    score = 0

    with engine.begin() as conn:

        # Prevent duplicate submission
        existing = conn.execute(
            text("""
                SELECT *
                FROM exam_results
                WHERE student_id = :student_id
                AND exam_id = :exam_id
            """),
            {
                "student_id": data["student_id"],
                "exam_id": data["exam_id"]
            }
        ).fetchone()

        if existing:
            return {
                "message": "You have already submitted this exam.",
                "score": existing.score,
                "total_questions": existing.total_questions,
                "percentage": float(existing.percentage),
                "status": existing.status,
                "result": existing.result
            }

        assignment = conn.execute(
            text("""
                SELECT attendance_status, deadline_at, NOW() AS database_now
                FROM exam_assignments
                WHERE student_id = :student_id
                  AND exam_id = :exam_id
                FOR UPDATE
            """),
            {
                "student_id": data["student_id"],
                "exam_id": data["exam_id"]
            }
        ).fetchone()

        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="This exam was not initialized for this student."
            )
        if assignment.attendance_status == "Submitted":
            raise HTTPException(status_code=409, detail="This exam has already been submitted.")
        if assignment.attendance_status != "Started" or assignment.deadline_at is None:
            raise HTTPException(
                status_code=400,
                detail="Start the exam before submitting answers."
            )
        if assignment.database_now > assignment.deadline_at:
            raise HTTPException(status_code=409, detail="The exam deadline has passed.")

        # Save answers and calculate score
        for answer in data["answers"]:

            conn.execute(
                text("""
                    INSERT INTO student_answers
                    (
                        student_id,
                        exam_id,
                        question_id,
                        selected_option
                    )
                    VALUES
                    (
                        :student_id,
                        :exam_id,
                        :question_id,
                        :selected_option
                    )
                """),
                {
                    "student_id": data["student_id"],
                    "exam_id": data["exam_id"],
                    "question_id": answer["question_id"],
                    "selected_option": answer["selected_option"]
                }
            )

            correct = conn.execute(
                text("""
                    SELECT correct_option
                    FROM questions
                    WHERE question_id = :question_id
                """),
                {
                    "question_id": answer["question_id"]
                }
            ).fetchone()

            if correct and correct.correct_option == answer["selected_option"]:
                score += 1

        total_questions = len(data["answers"])

        percentage = (
            round((score / total_questions) * 100, 2)
            if total_questions > 0 else 0
        )

        # Academic Result
        exam_result = "Pass" if percentage >= 40 else "Fail"

        # Read AI Risk Score
        risk = conn.execute(
            text("""
                SELECT
                    total_score,
                    exam_status
                FROM risk_scores
                WHERE student_id = :student_id
                AND exam_id = :exam_id
            """),
            {
                "student_id": data["student_id"],
                "exam_id": data["exam_id"]
            }
        ).fetchone()

        risk_score = 0
        exam_status = "Completed"

        if risk:

            risk_score = risk.total_score or 0

            if risk.exam_status == "INVALID":
                exam_status = "Invalid"

            elif risk_score >= 60:
                exam_status = "On Hold"

            else:
                exam_status = "Completed"

        violation_count = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM violations
                WHERE student_id = :student_id
                AND exam_id = :exam_id
            """),
            {
                "student_id": data["student_id"],
                "exam_id": data["exam_id"]
            }
        ).scalar() or 0

        conn.execute(
            text("""
                INSERT INTO exam_results
                (
                    student_id,
                    exam_id,
                    score,
                    total_questions,
                    percentage,
                    status,
                    result,
                    violation_count,
                    cancel_reason
                )
                VALUES
                (
                    :student_id,
                    :exam_id,
                    :score,
                    :total_questions,
                    :percentage,
                    :status,
                    :result,
                    :violation_count,
                    :cancel_reason
                )
            """),
            {
                "student_id": data["student_id"],
                "exam_id": data["exam_id"],
                "score": score,
                "total_questions": total_questions,
                "percentage": percentage,
                "status": exam_status,
                "result": exam_result,
                "violation_count": violation_count,
                "cancel_reason": None
            }
        )

        conn.execute(
            text("""
                UPDATE exam_assignments
                SET
                    submitted_at = COALESCE(submitted_at, NOW()),
                    attendance_status = 'Submitted'
                WHERE student_id = :student_id
                  AND exam_id = :exam_id
            """),
            {
                "student_id": data["student_id"],
                "exam_id": data["exam_id"]
            }
        )

    return {
        "message": "Exam Submitted Successfully",
        "score": score,
        "total_questions": total_questions,
        "percentage": percentage,
        "status": exam_status,
        "result": exam_result,
        "risk_score": risk_score,
        "violation_count": violation_count
    }
@app.get("/faculty/results")
def faculty_results():

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT
                    s.name AS student_name,
                    e.exam_name,
                    r.score,
                    r.total_questions,
                    r.percentage
                FROM exam_results r
                JOIN students s
                    ON r.student_id = s.student_id
                JOIN exams e
                    ON r.exam_id = e.exam_id
            """)
        )

        results = []

        for row in result:
            results.append({
                "student_name": row.student_name,
                "exam_name": row.exam_name,
                "score": row.score,
                "total_questions": row.total_questions,
                "percentage": float(row.percentage)
            })

        return results
@app.get("/student/results/{student_id}")
def student_results(student_id: int):

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT
                    r.exam_id,

                    e.exam_name,

                    r.score,
                    r.total_questions,
                    r.percentage,

                    r.status,
                    r.result,

                    r.violation_count,
                    r.cancel_reason,

                    r.submitted_at

                FROM exam_results r

                JOIN exams e
                    ON r.exam_id = e.exam_id

                WHERE r.student_id = :student_id

                ORDER BY r.submitted_at DESC
            """),
            {
                "student_id": student_id
            }
        )

        results = []

        for row in result:

            results.append({

                "exam_id": row.exam_id,

                "exam_name": row.exam_name,

                "score": row.score,

                "total_questions": row.total_questions,

                "percentage": float(row.percentage),

                "status": row.status,

                "result": "Pass" if float(row.percentage) >= 40 else "Fail",

                "violation_count": row.violation_count,

                "cancel_reason": row.cancel_reason,

                "submitted_at": (
                    str(row.submitted_at)
                    if row.submitted_at
                    else None
                )

            })

        return results
@app.get("/dashboard/top-performers")
def top_performers():

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT
                    s.name AS student_name,
                    e.exam_name,
                    r.score,
                    r.total_questions,
                    r.percentage
                FROM exam_results r
                JOIN students s
                    ON r.student_id = s.student_id
                JOIN exams e
                    ON r.exam_id = e.exam_id
                ORDER BY r.percentage DESC
                LIMIT 5
            """)
        )

        performers = []

        for row in result:
            performers.append({
                "student_name": row.student_name,
                "exam_name": row.exam_name,
                "score": row.score,
                "total_questions": row.total_questions,
                "percentage": float(row.percentage)
            })

        return performers
@app.get("/dashboard/exam-stats")
def exam_stats():

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT
                    COUNT(*) AS total_results,
                    AVG(percentage) AS average_percentage,
                    MAX(percentage) AS highest_percentage,
                    MIN(percentage) AS lowest_percentage
                FROM exam_results
            """)
        )

        stats = result.fetchone()

        return {
            "total_results": stats.total_results,
            "average_percentage": round(float(stats.average_percentage), 2),
            "highest_percentage": float(stats.highest_percentage),
            "lowest_percentage": float(stats.lowest_percentage)
        }
@app.get("/ai/exam-summary")
def exam_summary():

    with engine.connect() as conn:

        # Total Exams
        total_exams = conn.execute(
            text("SELECT COUNT(*) FROM exams")
        ).scalar()

        # Total Students Participated
        total_students = conn.execute(
            text("""
                SELECT COUNT(DISTINCT student_id)
                FROM exam_results
            """)
        ).scalar()

        # Pass / Fail
        pass_fail = conn.execute(
            text("""
                SELECT
                    SUM(CASE WHEN percentage >= 40 THEN 1 ELSE 0 END) AS passed,
                    SUM(CASE WHEN percentage < 40 THEN 1 ELSE 0 END) AS failed
                FROM exam_results
            """)
        ).fetchone()

        passed = pass_fail[0] or 0
        failed = pass_fail[1] or 0

        total = passed + failed

        pass_percentage = (passed / total * 100) if total else 0
        fail_percentage = (failed / total * 100) if total else 0

        # Best Performing Exam
        best_exam_result = conn.execute(
            text("""
                SELECT e.exam_name,
                       AVG(r.percentage) AS avg_score
                FROM exam_results r
                JOIN exams e
                    ON r.exam_id = e.exam_id
                GROUP BY e.exam_id, e.exam_name
                ORDER BY avg_score DESC
                LIMIT 1
            """)
        ).fetchone()

        best_exam = (
            f"{best_exam_result[0]} ({best_exam_result[1]:.2f}%)"
            if best_exam_result else "N/A"
        )

        # Hardest Exam
        hardest_exam_result = conn.execute(
            text("""
                SELECT e.exam_name,
                       AVG(r.percentage) AS avg_score
                FROM exam_results r
                JOIN exams e
                    ON r.exam_id = e.exam_id
                GROUP BY e.exam_id, e.exam_name
                ORDER BY avg_score ASC
                LIMIT 1
            """)
        ).fetchone()

        hardest_exam = (
            f"{hardest_exam_result[0]} ({hardest_exam_result[1]:.2f}%)"
            if hardest_exam_result else "N/A"
        )

        # Top Student
        top_student_result = conn.execute(
            text("""
                SELECT s.name,
                       s.roll_no,
                       AVG(r.percentage) AS avg_score
                FROM exam_results r
                JOIN students s
                    ON r.student_id = s.student_id
                GROUP BY s.student_id, s.name, s.roll_no
                ORDER BY avg_score DESC
                LIMIT 1
            """)
        ).fetchone()

        top_student = (
            f"{top_student_result[0]} ({top_student_result[1]})"
            if top_student_result else "N/A"
        )

        # Students Needing Attention
        students_needing_attention = conn.execute(
            text("""
                SELECT COUNT(DISTINCT student_id)
                FROM exam_results
                WHERE percentage < 40
            """)
        ).scalar()

        # Violation counts by type (institution-wide)
        viol_totals = conn.execute(
            text("""
                SELECT violation_type, COUNT(*) AS cnt, SUM(risk_points) AS pts
                FROM violations
                GROUP BY violation_type
            """)
        ).fetchall()

        # Invalid exam count
        invalid_exams = conn.execute(
            text("SELECT COUNT(*) FROM risk_scores WHERE exam_status='INVALID'")
        ).scalar() or 0

        # High risk students (risk score > 30)
        high_risk_students = conn.execute(
            text("SELECT COUNT(DISTINCT student_id) FROM risk_scores WHERE total_score > 30")
        ).scalar() or 0

        # Tab-switch stats (institution-wide)
        tab_switch_row = conn.execute(
            text("""
                SELECT
                    COUNT(*) AS violation_count,
                    COUNT(DISTINCT student_id) AS student_count
                FROM violations
                WHERE violation_type = 'tab_switch'
            """)
        ).fetchone()
        tab_switch_violations = int(tab_switch_row.violation_count or 0)
        tab_switch_students = int(tab_switch_row.student_count or 0)

        # Most violated rule
        top_violation = conn.execute(
            text("""
                SELECT violation_type, COUNT(*) AS cnt
                FROM violations
                GROUP BY violation_type
                ORDER BY cnt DESC
                LIMIT 1
            """)
        ).fetchone()

    viol_summary = "\n".join(
        f"  {r.violation_type.replace('_',' ').title()}: {r.cnt} time(s), total {r.pts} risk pts"
        for r in viol_totals
    ) if viol_totals else "  No violations recorded."

    most_common_violation = (
        f"{top_violation[0].replace('_',' ').title()} ({top_violation[1]} times)"
        if top_violation else "None"
    )

    prompt = f"""
You are an educational analytics expert specializing in AI-proctored exams.

Generate an institution-wide performance and integrity report.

ACADEMIC DATA:
Total Exams Conducted: {total_exams}
Total Students Participated: {total_students}
Overall Pass Percentage: {pass_percentage:.2f}%
Overall Fail Percentage: {fail_percentage:.2f}%
Best Performing Exam: {best_exam}
Most Difficult Exam: {hardest_exam}
Top Performing Student: {top_student}
Students Needing Academic Attention: {students_needing_attention}

PROCTORING & INTEGRITY DATA:
Total Exams Marked INVALID (cheating suspected): {invalid_exams}
Students with High Risk Score (>30): {high_risk_students}
Most Common Violation: {most_common_violation}
Students Who Switched Tabs/Windows: {tab_switch_students}
Total Tab-Switch Violations: {tab_switch_violations}

Violation Breakdown (all exams combined):
{viol_summary}

Generate the report in the following format:

1. OVERALL ACADEMIC PERFORMANCE
   - Total Exams Conducted
   - Total Students Participated
   - Overall Pass Percentage
   - Overall Fail Percentage

2. PASS VS FAIL ANALYSIS
   Explain the overall pass/fail trend in one short paragraph.

3. EXAM DIFFICULTY INSIGHTS
   Mention the best performing exam and most difficult exam with a short explanation.

4. PROCTORING & INTEGRITY SUMMARY
   List:
   • Total violations by type
   • INVALID exam count
   • High-risk student count
   • Most common violation
   • Tab-switch violations and affected student count

5. STUDENT PERFORMANCE INSIGHTS
   Mention the top-performing student and students needing academic attention.

6. FACULTY RECOMMENDATIONS
   Give 3-5 concise recommendations.

7. FUTURE IMPROVEMENT SUGGESTIONS
   Give 3-5 concise suggestions.

IMPORTANT FORMATTING RULES:

- Do NOT use markdown tables.
- Do NOT use characters like |, ---, ###, ** or code blocks.
- Do NOT create ASCII tables.
- Use only normal headings and bullet points.
- Keep each section short and professional.
- Write the report so it can be displayed directly in a web dashboard.
- Avoid unnecessary blank lines.
- Do NOT generate individual student or exam summaries.
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    summary = response.choices[0].message.content

    return {
        "summary": summary
    }
@app.get("/ai/student-summary/{student_id}")
def student_summary(student_id: int):

    with engine.connect() as conn:

        # ==========================
        # Student Details
        # ==========================

        student = conn.execute(
            text("""
                SELECT
                    roll_no,
                    name,
                    email
                FROM students
                WHERE student_id = :student_id
            """),
            {"student_id": student_id}
        ).fetchone()

        if not student:
            return {"message": "Student not found."}

        # ==========================
        # Exam Results
        # ==========================

        result = conn.execute(
            text("""
                SELECT
                    e.exam_name,
                    r.score,
                    r.total_questions,
                    r.percentage
                FROM exam_results r
                JOIN exams e
                    ON r.exam_id = e.exam_id
                WHERE r.student_id = :student_id
            """),
            {"student_id": student_id}
        ).fetchall()

        if not result:
            return {"message": "No exam records found for this student."}

        exams_attempted = len(result)

        total_percentage = 0

        pass_count = 0
        fail_count = 0

        best_exam = ""
        best_percentage = -1

        lowest_exam = ""
        lowest_percentage = 101

        exam_lines = []

        for row in result:

            total_percentage += float(row.percentage)

            exam_lines.append(
                f"{row.exam_name} : {row.percentage}%"
            )

            if row.percentage >= 40:
                pass_count += 1
            else:
                fail_count += 1

            if row.percentage > best_percentage:
                best_percentage = row.percentage
                best_exam = row.exam_name

            if row.percentage < lowest_percentage:
                lowest_percentage = row.percentage
                lowest_exam = row.exam_name

        average_score = round(
            total_percentage / exams_attempted,
            2
        )

        pass_percentage = round(
            pass_count * 100 / exams_attempted,
            2
        )

        fail_percentage = round(
            fail_count * 100 / exams_attempted,
            2
        )

        # ==========================
        # Violations
        # ==========================

        violations = conn.execute(
            text("""
                SELECT
                    violation_type,
                    COUNT(*) cnt
                FROM violations
                WHERE student_id = :student_id
                GROUP BY violation_type
            """),
            {"student_id": student_id}
        ).fetchall()

        violation_dict = {}

        violation_text = []

        for row in violations:

            name = row.violation_type.replace(
                "_",
                " "
            ).title()

            violation_dict[name] = row.cnt

            violation_text.append(
                f"{name}: {row.cnt}"
            )

        # ==========================
        # Risk Score
        # ==========================

        risk = conn.execute(
            text("""
                SELECT
                    COALESCE(MAX(total_score),0)
                FROM risk_scores
                WHERE student_id = :student_id
            """),
            {"student_id": student_id}
        ).scalar()

        if risk < 30:
            risk_level = "LOW"
        elif risk <= 60:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

    # ==========================
    # AI Prompt
    # ==========================

    prompt = f"""
You are an AI educational assistant.

Student Details

Roll Number : {student.roll_no}

Name : {student.name}

Email : {student.email}

Academic Statistics

Exams Attempted : {exams_attempted}

Average Score : {average_score}%

Pass Percentage : {pass_percentage}%

Fail Percentage : {fail_percentage}%

Best Exam : {best_exam}

Lowest Exam : {lowest_exam}

Exam Performance

{chr(10).join(exam_lines)}

Violation Summary

{chr(10).join(violation_text)}

Risk Score : {risk}

Risk Level : {risk_level}

Write ONLY TWO PARAGRAPHS.

Paragraph 1:
AI Assessment.

Paragraph 2:
Faculty Recommendation.

Rules

Do NOT use headings.

Do NOT use markdown.

Do NOT repeat statistics.

Maximum 80 words per paragraph.

Professional tone.
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    summary = response.choices[0].message.content

    return {

        "student_name": student.name,

        "roll_no": student.roll_no,

        "email": student.email,

        "exams_attempted": exams_attempted,

        "average_score": average_score,

        "pass_percentage": pass_percentage,

        "fail_percentage": fail_percentage,

        "best_exam": best_exam,

        "best_exam_percentage": best_percentage,

        "lowest_exam": lowest_exam,

        "lowest_exam_percentage": lowest_percentage,

        "risk_score": risk,

        "risk_level": risk_level,

        "violations": violation_dict,

        "assessment": summary

    }
@app.get("/ai/exam-summary/{exam_id}")
def individual_exam_summary(exam_id: int):

    with engine.begin() as conn:

        mark_expired_assignments_not_given(conn)

        result = conn.execute(
            text("""
                SELECT
                    e.exam_name,
                    s.roll_no,
                    s.name,
                    r.score,
                    r.total_questions,
                    r.percentage
                FROM exam_results r
                JOIN students s
                    ON r.student_id = s.student_id
                JOIN exams e
                    ON r.exam_id = e.exam_id
                WHERE e.exam_id = :exam_id
            """),
            {"exam_id": exam_id}
        )

        records = []

        for row in result:

            records.append(
                f"Student: {row.name} ({row.roll_no}) | "
                f"Score: {row.score}/{row.total_questions} | "
                f"{row.percentage}%"
            )

        viol_result = conn.execute(
            text("""
                SELECT
                    s.name,
                    v.violation_type,
                    COUNT(*) AS cnt,
                    SUM(v.risk_points) AS pts
                FROM violations v
                JOIN students s
                    ON s.student_id = v.student_id
                WHERE v.exam_id = :exam_id
                GROUP BY s.name, v.violation_type
                ORDER BY s.name, v.violation_type
            """),
            {"exam_id": exam_id}
        )

        violation_lines = []

        for row in viol_result:

            violation_lines.append(
                f"{row.name}: "
                f"{row.violation_type.replace('_',' ').title()} "
                f"x{row.cnt} (+{row.pts} pts)"
            )

        risk_result = conn.execute(
            text("""
                SELECT
                    s.name,
                    LEAST(
                        COALESCE(SUM(v2.risk_points),0),
                        100
                    ) AS risk_score,
                    rs.exam_status
                FROM risk_scores rs
                JOIN students s
                    ON s.student_id = rs.student_id
                LEFT JOIN violations v2
                    ON v2.student_id = rs.student_id
                    AND v2.exam_id = rs.exam_id
                WHERE rs.exam_id = :exam_id
                GROUP BY
                    s.name,
                    rs.exam_status
                ORDER BY risk_score DESC
            """),
            {"exam_id": exam_id}
        )

        risk_lines = []

        invalid_count = 0
        total_risk = 0
        risk_students = 0

        for row in risk_result:

            risk_lines.append(
                f"{row.name}: Risk Score {row.risk_score} | {row.exam_status}"
            )

            total_risk += row.risk_score
            risk_students += 1

            if row.exam_status == "INVALID":
                invalid_count += 1

        exam_name_row = conn.execute(
            text("""
                SELECT exam_name
                FROM exams
                WHERE exam_id = :eid
            """),
            {"eid": exam_id}
        ).fetchone()

        tab_switch_stats = conn.execute(
            text("""
                SELECT
                    COUNT(*) AS violation_count,
                    COUNT(DISTINCT student_id) AS student_count
                FROM violations
                WHERE exam_id = :exam_id AND violation_type = 'tab_switch'
            """),
            {"exam_id": exam_id}
        ).fetchone()

        attendance_stats = conn.execute(
            text("""
                SELECT
                    COUNT(*) AS total_students,
                    COALESCE(SUM(attendance_status IN ('Started', 'Submitted')), 0) AS gave_exam,
                    COALESCE(SUM(attendance_status NOT IN ('Started', 'Submitted')), 0) AS did_not_give,
                    COALESCE(SUM(attendance_status = 'Not Given'), 0) AS not_given
                FROM exam_assignments
                WHERE exam_id = :exam_id
            """),
            {"exam_id": exam_id}
        ).fetchone()

        stats = conn.execute(
            text("""
                SELECT
                    percentage,
                    status
                FROM exam_results
                WHERE exam_id = :exam_id
            """),
            {"exam_id": exam_id}
        )

        pass_count = 0
        fail_count = 0

        completed = 0
        on_hold = 0
        invalid = 0

        for row in stats:

            if float(row.percentage) >= 40:
                pass_count += 1
            else:
                fail_count += 1

            if row.status == "Completed":
                completed += 1
            elif row.status == "On Hold":
                on_hold += 1
            elif row.status == "Invalid":
                invalid += 1

    total_students = int(attendance_stats.total_students or 0)
    gave_exam = int(attendance_stats.gave_exam or 0)
    did_not_give = int(attendance_stats.did_not_give or 0)
    not_given = int(attendance_stats.not_given or 0)
    tab_switch_violations = int(tab_switch_stats.violation_count or 0)
    tab_switch_students = int(tab_switch_stats.student_count or 0)

    if not records and not violation_lines and not risk_lines and not total_students:

        return {
            "exam_name": "N/A",
            "assessment": "No data found for this exam.",
            "recommendation": "No recommendations available.",
            "total_students": 0,
            "gave_exam": 0,
            "did_not_give": 0,
            "not_given": 0,
            "pass_count": 0,
            "fail_count": 0,
            "completed": 0,
            "on_hold": 0,
            "invalid": 0,
            "average_risk": 0,
            "tab_switch_violations": 0,
            "tab_switch_students": 0
        }

    exam_label = (
        exam_name_row.exam_name
        if exam_name_row
        else f"Exam #{exam_id}"
    )

    records_section = "\n".join(records)
    violation_section = "\n".join(violation_lines) if violation_lines else "No violations recorded."
    risk_section = "\n".join(risk_lines) if risk_lines else "No risk data."

    prompt = f"""
You are an educational analytics assistant.

Exam Name:
{exam_label}

Performance Data:
{records_section}

Violation Data:
{violation_section}

Tab-Switch Data:
Students who switched tabs/windows: {tab_switch_students}
Total tab-switch violations: {tab_switch_violations}

Risk Data:
{risk_section}

Attendance Data:
Total assigned students: {total_students}
Students who gave the exam: {gave_exam}
Students who did not give the exam: {did_not_give}
Not Given assignments: {not_given}

Invalid Exams:
{invalid_count}

Return ONLY these two sections.

ASSESSMENT

Write exactly THREE short paragraphs.

Paragraph 1:
Overall academic performance and pass/fail trend.

Paragraph 2:
Integrity analysis, risk score analysis and violations.

Paragraph 3:
Overall conclusion about the exam, including attendance where relevant. Do not infer or invent reasons for non-attendance.

FACULTY RECOMMENDATIONS

Provide exactly FIVE numbered recommendations.

Rules:
- Do NOT repeat any heading.
- Use the heading ASSESSMENT only once.
- Use the heading FACULTY RECOMMENDATIONS only once.
- No markdown.
- No **.
- No ###.
- No emojis.
- No tables.
- No bullet points except the five numbered recommendations.
- Keep paragraphs concise.
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    summary = response.choices[0].message.content.strip()

    assessment = summary
    recommendation = ""

    if "FACULTY RECOMMENDATIONS" in summary.upper():

        split_index = summary.upper().find("FACULTY RECOMMENDATIONS")

        assessment = summary[:split_index].replace("ASSESSMENT", "").strip()

        recommendation = summary[split_index + len("FACULTY RECOMMENDATIONS"):].strip()

    average_risk = (
        round(total_risk / risk_students, 2)
        if risk_students
        else 0
    )

    return {

        "exam_name": exam_label,

        "assessment": assessment,

        "recommendation": recommendation,

        "total_students": total_students,

        "gave_exam": gave_exam,

        "did_not_give": did_not_give,

        "not_given": not_given,

        "pass_count": pass_count,

        "fail_count": fail_count,

        "completed": completed,

        "on_hold": on_hold,

        "invalid": invalid,

        "average_risk": average_risk,

        "tab_switch_violations": tab_switch_violations,

        "tab_switch_students": tab_switch_students

    }
@app.post("/detect-objects")
async def detect_objects_api(file: UploadFile = File(...)):

    # Create uploads folder if it doesn't exist
    os.makedirs("uploads", exist_ok=True)

    # Save uploaded image
    file_path = os.path.join("uploads", file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run YOLO detection
    result = detect_objects(file_path)

    return result


# -----------------------------
# Proctoring Risk / Violations
# -----------------------------

VIOLATION_POINTS = {
    "looking_away": 8,
    "face_missing": 10,
    "multiple_persons": 15,
    "mobile_phone": 20,
    "face_detection_failure": 5,
    "tab_switch": 15,
}
RISK_SCORE_MAX = 100

MAJOR_INVALID_VIOLATION = "mobile_phone"
THROTTLE_SECONDS = 10


def _ensure_risk_row_exists(conn, student_id: int, exam_id: int):
    # One row per (student_id, exam_id) with unique constraint.
    conn.execute(
        text(
            """
            INSERT INTO risk_scores (student_id, exam_id, total_score, exam_status)
            VALUES (:student_id, :exam_id, 0, 'VALID')
            ON DUPLICATE KEY UPDATE
                exam_status = risk_scores.exam_status
            """
        ),
        {"student_id": student_id, "exam_id": exam_id},
    )


def _throttle_allows(conn, student_id: int, exam_id: int, violation_type: str) -> bool:
    # Returns True if the same violation_type is not logged within THROTTLE_SECONDS.
    row = conn.execute(
        text(
            """
            SELECT
                CASE
                    WHEN TIMESTAMPDIFF(SECOND, last_logged_at, NOW()) >= :ttl THEN 1
                    ELSE 0
                END AS allowed
            FROM violation_throttle
            WHERE student_id=:student_id AND exam_id=:exam_id AND violation_type=:violation_type
            """
        ),
        {
            "ttl": THROTTLE_SECONDS,
            "student_id": student_id,
            "exam_id": exam_id,
            "violation_type": violation_type,
        },
    ).fetchone()

    if not row:
        return True

    return int(row[0]) == 1


def _update_throttle_timestamp(conn, student_id: int, exam_id: int, violation_type: str):
    conn.execute(
        text(
            """
            INSERT INTO violation_throttle (student_id, exam_id, violation_type, last_logged_at)
            VALUES (:student_id, :exam_id, :violation_type, NOW())
            ON DUPLICATE KEY UPDATE
                last_logged_at = NOW()
            """
        ),
        {"student_id": student_id, "exam_id": exam_id, "violation_type": violation_type},
    )


# PART 2: RISK SCORE INITIALIZATION
@app.post("/risk/init")
def risk_init(data: dict = Body(...)):
    student_id = int(data["student_id"])
    exam_id = int(data["exam_id"])

    with engine.connect() as conn:
        _ensure_risk_row_exists(conn, student_id, exam_id)
        conn.commit()

    return {"message": "risk_scores initialized", "student_id": student_id, "exam_id": exam_id}


# PART 3 + PART 4: UPSERT LOGIC + THROTTLING
@app.post("/violations/log")
def log_violation(data: dict = Body(...)):
    student_id = int(data["student_id"])
    exam_id = int(data["exam_id"])
    violation_type = data["violation_type"]
    risk_points = int(data.get("risk_points", VIOLATION_POINTS.get(violation_type, 0)))
    details = data.get("details", None)  # optional: confidence, bbox, duration

    with engine.connect() as conn:
        _ensure_risk_row_exists(conn, student_id, exam_id)

        if not _throttle_allows(conn, student_id, exam_id, violation_type):
            conn.commit()
            return {"message": "throttled", "violation_logged": False}

        conn.execute(
            text(
                """
                INSERT INTO violations (student_id, exam_id, violation_type, risk_points, details)
                VALUES (:student_id, :exam_id, :violation_type, :risk_points, :details)
                """
            ),
            {
                "student_id": student_id,
                "exam_id": exam_id,
                "violation_type": violation_type,
                "risk_points": risk_points,
                "details": details,
            },
        )

        _update_throttle_timestamp(conn, student_id, exam_id, violation_type)
        conn.commit()

    return {"message": "Violation Logged", "violation_logged": True}


@app.post("/risk/update")
def update_risk(data: dict = Body(...)):
    student_id = int(data["student_id"])
    exam_id = int(data["exam_id"])
    violation = data["violation"]

    if violation not in VIOLATION_POINTS:
        return {"risk_added": 0, "message": "unknown violation"}

    with engine.connect() as conn:
        _ensure_risk_row_exists(conn, student_id, exam_id)

        # Mobile phone must always mark INVALID immediately
        if violation == MAJOR_INVALID_VIOLATION:
            conn.execute(
                text(
                    """
                    UPDATE risk_scores
                    SET exam_status='INVALID'
                    WHERE student_id=:student_id AND exam_id=:exam_id
                    """
                ),
                {"student_id": student_id, "exam_id": exam_id},
            )

        # total_score mirrors the violations table (the source of truth for
        # whether an event was actually recorded, after /violations/log's own
        # throttling) rather than incrementing independently here — an earlier
        # version re-checked the same throttle window right after
        # /violations/log had just refreshed it, so this always read as
        # "throttled" and total_score never advanced past 0.
        row = conn.execute(
            text(
                """
                UPDATE risk_scores
                SET total_score = LEAST(
                        COALESCE(
                            (SELECT SUM(v.risk_points) FROM violations v
                             WHERE v.student_id=:student_id AND v.exam_id=:exam_id),
                            0
                        ),
                        :max_score
                    ),
                    exam_status = CASE
                        WHEN exam_status='INVALID' THEN 'INVALID'
                        WHEN :violation='mobile_phone' THEN 'INVALID'
                        ELSE 'VALID'
                    END
                WHERE student_id=:student_id AND exam_id=:exam_id
                """
            ),
            {
                "student_id": student_id,
                "exam_id": exam_id,
                "violation": violation,
                "max_score": RISK_SCORE_MAX,
            },
        )

        conn.commit()

        total_score = conn.execute(
            text(
                """
                SELECT total_score FROM risk_scores
                WHERE student_id=:student_id AND exam_id=:exam_id
                """
            ),
            {"student_id": student_id, "exam_id": exam_id},
        ).scalar()

    return {"total_score": int(total_score or 0)}


# PART 5: FACULTY DASHBOARD API
@app.get("/api/risk-score")
def api_risk_score(exam_id: int = None):
    with engine.connect() as conn:
        base_query = """
            SELECT
                s.student_id, s.name AS student_name, s.roll_no,
                e.exam_id, e.exam_name,
                LEAST(COALESCE(SUM(v.risk_points), 0), 100) AS risk_score,
                r.exam_status,
                MAX(v.timestamp) AS last_violation_time,
                MAX(v.violation_type) AS last_violation_type
            FROM risk_scores r
            JOIN students s ON s.student_id = r.student_id
            JOIN exams e ON e.exam_id = r.exam_id
            LEFT JOIN violations v ON v.student_id = r.student_id AND v.exam_id = r.exam_id
            {where}
            GROUP BY s.student_id, s.name, s.roll_no, e.exam_id, e.exam_name, r.exam_status
            ORDER BY risk_score DESC
        """
        if exam_id:
            result = conn.execute(
                text(base_query.format(where="WHERE r.exam_id = :exam_id")),
                {"exam_id": exam_id}
            )
        else:
            result = conn.execute(text(base_query.format(where="")))

        rows = []
        for row in result:
            score = int(row.risk_score or 0)
            if score < 30:
                risk_level = "LOW"
            elif score <= 60:
                risk_level = "MEDIUM"
            else:
                risk_level = "HIGH"
            rows.append({
                "student_id": row.student_id,
                "student_name": row.student_name,
                "roll_no": row.roll_no,
                "exam_id": row.exam_id,
                "exam_name": row.exam_name,
                "risk_score": score,
                "risk_level": risk_level,
                "exam_status": row.exam_status,
                "last_violation_time": str(row.last_violation_time) if row.last_violation_time else None,
                "last_violation_type": row.last_violation_type,
            })
        return rows


@app.get("/api/risk-score/student")
def api_risk_score_student(student_id: int, exam_id: int):
    with engine.connect() as conn:
        # Summary row — compute score from violations (not cached total_score)
        summary_row = conn.execute(text("""
            SELECT
                LEAST(COALESCE((SELECT SUM(v2.risk_points) FROM violations v2
                                WHERE v2.student_id = r.student_id AND v2.exam_id = r.exam_id), 0), 100)
                    AS total_score,
                r.exam_status, s.name, s.roll_no, e.exam_name
            FROM risk_scores r
            JOIN students s ON s.student_id = r.student_id
            JOIN exams e ON e.exam_id = r.exam_id
            WHERE r.student_id = :sid AND r.exam_id = :eid
        """), {"sid": student_id, "eid": exam_id}).fetchone()

        # Full chronological violation log
        violations_result = conn.execute(text("""
            SELECT violation_id, violation_type, risk_points, details, timestamp
            FROM violations
            WHERE student_id = :sid AND exam_id = :eid
            ORDER BY timestamp ASC
        """), {"sid": student_id, "eid": exam_id})

        events = []
        for v in violations_result:
            events.append({
                "violation_id": v.violation_id,
                "violation_type": v.violation_type,
                "risk_points": int(v.risk_points),
                "details": v.details,
                "timestamp": str(v.timestamp),
            })

        if not summary_row:
            return {"error": "No data found"}

        return {
            "student_name": summary_row.name,
            "roll_no": summary_row.roll_no,
            "exam_name": summary_row.exam_name,
            "total_score": int(summary_row.total_score or 0),
            "exam_status": summary_row.exam_status,
            "events": events,
        }


@app.post("/api/exam-summary")
def api_exam_summary(body: dict = Body(...)):
    student_id = body.get("student_id")
    exam_id = body.get("exam_id")

    if not student_id or not exam_id:
        return {"error": "student_id and exam_id are required"}

    with engine.connect() as conn:

        meta = conn.execute(
            text("""
                SELECT
                    s.name AS student_name,
                    s.roll_no,
                    e.exam_name,
                    r.exam_status,
                    LEAST(
                        COALESCE(
                            (
                                SELECT SUM(v2.risk_points)
                                FROM violations v2
                                WHERE v2.student_id = r.student_id
                                  AND v2.exam_id = r.exam_id
                            ),
                            0
                        ),
                        100
                    ) AS total_score
                FROM risk_scores r
                JOIN students s
                    ON s.student_id = r.student_id
                JOIN exams e
                    ON e.exam_id = r.exam_id
                WHERE r.student_id = :sid
                  AND r.exam_id = :eid
            """),
            {
                "sid": student_id,
                "eid": exam_id
            }
        ).fetchone()

        if not meta:
            return {"error": "No exam data found for this student"}

        viol_rows = conn.execute(
            text("""
                SELECT
                    violation_type,
                    risk_points,
                    details
                FROM violations
                WHERE student_id = :sid
                  AND exam_id = :eid
                ORDER BY timestamp ASC
            """),
            {
                "sid": student_id,
                "eid": exam_id
            }
        ).fetchall()

    counts = {}
    durations = {}

    for v in viol_rows:

        vt = str(v.violation_type).strip().lower().replace(" ", "_")

        counts[vt] = counts.get(vt, 0) + 1

        if v.details:
            import re

            match = re.search(
                r'duration[=\s:]+([0-9.]+)s',
                str(v.details),
                re.IGNORECASE
            )

            if match:
                durations[vt] = (
                    durations.get(vt, 0.0)
                    + float(match.group(1))
                )

    total_score = int(meta.total_score or 0)
    total_events = len(viol_rows)

    if total_score >= 60:
        risk_level = "HIGH"
    elif total_score >= 30:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    bullet_lines = []

    if "looking_away" in counts:
        sec = durations.get("looking_away", 0)

        duration_text = (
            f" for approximately {int(sec)} seconds in total"
            if sec
            else ""
        )

        bullet_lines.append(
            f"Looking away detected {counts['looking_away']} time(s){duration_text}"
        )

    if "face_missing" in counts:
        sec = durations.get("face_missing", 0)

        duration_text = (
            f" for approximately {int(sec)} seconds in total"
            if sec
            else ""
        )

        bullet_lines.append(
            f"Face missing detected {counts['face_missing']} time(s){duration_text}"
        )

    if "multiple_persons" in counts:
        bullet_lines.append(
            f"Multiple persons detected {counts['multiple_persons']} time(s)"
        )

    if "mobile_phone" in counts:
        bullet_lines.append(
            f"Mobile phone detected {counts['mobile_phone']} time(s)"
        )

    if "face_detection_failure" in counts:
        bullet_lines.append(
            f"Face detection failure {counts['face_detection_failure']} time(s)"
        )

    if "tab_switch" in counts:
        bullet_lines.append(
            f"Tab switch detected {counts['tab_switch']} time(s)"
        )

    violations_text = (
        "\n".join(bullet_lines)
        if bullet_lines
        else "No violations recorded."
    )

    if risk_level == "HIGH":

        fallback_assessment = (
            f"The examination session recorded {total_events} proctoring "
            f"violation event(s), including {', '.join(counts.keys()).replace('_', ' ')}. "
            f"The risk score of {total_score}/100 indicates high-risk behavior, "
            f"and the session requires faculty review for possible malpractice."
        )

    elif risk_level == "MEDIUM":

        fallback_assessment = (
            f"The examination session recorded {total_events} proctoring "
            f"violation event(s), including {', '.join(counts.keys()).replace('_', ' ')}. "
            f"The risk score of {total_score}/100 indicates moderate risk and "
            f"the session should be reviewed by faculty."
        )

    elif total_events > 0:

        fallback_assessment = (
            f"The examination session recorded {total_events} proctoring "
            f"violation event(s). The risk score of {total_score}/100 indicates "
            f"low risk, but the recorded events should be reviewed."
        )

    else:

        fallback_assessment = (
            "No proctoring violations were recorded during the examination. "
            "The student exhibited generally compliant behavior during the session."
        )

    prompt = f"""
You are an exam proctoring AI.

Generate ONLY a complete behavioral assessment for the examination session.

Student: {meta.student_name} ({meta.roll_no})
Exam: {meta.exam_name}
Risk Score: {total_score}/100
Risk Level: {risk_level}
Exam Status: {meta.exam_status}
Total Violation Events: {total_events}

Actual Violations:
{violations_text}

Requirements:
- Write exactly 2 or 3 complete sentences.
- Describe only the actual violations provided above.
- Do not invent any additional violations.
- Mention the important detected behaviors.
- If risk is HIGH, state that the session requires faculty review and may indicate possible malpractice.
- If risk is MEDIUM, state that the session requires review.
- If there are no violations, state that the behavior was generally compliant.
- Do not include the student's name.
- Do not include the exam name.
- Do not include the risk score as a separate line.
- Do not use headings.
- Do not use bullet points.
- Do not use markdown.
- Return only the assessment paragraph.
"""

    assessment = ""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=500,
            temperature=0.2,
        )

        assessment = (
            response.choices[0].message.content or ""
        ).strip()

        assessment = assessment.replace(
            "ASSESSMENT:",
            ""
        ).replace(
            "Assessment:",
            ""
        ).strip()

        words = assessment.split()

        if (
            len(words) < 15
            or len(assessment) < 80
            or not any(char in assessment for char in ".!?")
        ):
            assessment = fallback_assessment

    except Exception:
        assessment = fallback_assessment

    summary = f"""Student: {meta.student_name} ({meta.roll_no})
Exam: {meta.exam_name}
Risk Score: {total_score}/100 — {risk_level} RISK
Status: {meta.exam_status}

Violations:
{violations_text}

Assessment:
{assessment}"""

    return {
        "summary": summary
    }
@app.get("/faculty/violations")
def get_violations():
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT
                    s.name AS student_name,
                    e.exam_name,
                    r.total_score AS risk_score,
                    r.exam_status,
                    MAX(v.timestamp) AS last_violation_time
                FROM risk_scores r
                JOIN students s ON s.student_id = r.student_id
                JOIN exams e ON e.exam_id = r.exam_id
                LEFT JOIN violations v
                    ON v.student_id = r.student_id
                    AND v.exam_id = r.exam_id
                GROUP BY s.name, e.exam_name, r.total_score, r.exam_status
                ORDER BY
                    CASE WHEN r.exam_status='INVALID' THEN 0 ELSE 1 END ASC,
                    r.total_score DESC
                """
            )
        )

        rows = []
        for row in result:
            rows.append(
                {
                    "student": row.student_name,
                    "exam": row.exam_name,
                    "risk_score": int(row.risk_score or 0),
                    "status": row.exam_status,
                    "last_violation_time": str(row.last_violation_time) if row.last_violation_time else None,
                }
            )

        return rows
@app.get("/faculty/violations/details")
def get_violations_details():
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT
                    s.name AS student_name,
                    e.exam_name,
                    v.violation_type,
                    COUNT(*) AS violation_count,
                    SUM(v.risk_points) AS total_points
                FROM violations v
                JOIN students s ON s.student_id = v.student_id
                JOIN exams e ON e.exam_id = v.exam_id
                GROUP BY s.student_id, s.name, e.exam_id, e.exam_name, v.violation_type
                ORDER BY s.name, e.exam_name, v.violation_type
            """)
        )
        rows = []
        for row in result:
            rows.append({
                "student": row.student_name,
                "exam": row.exam_name,
                "violation_type": row.violation_type,
                "count": int(row.violation_count),
                "points": int(row.total_points or 0),
            })
        return rows


@app.get("/faculty/results/{exam_id}")
def faculty_results_by_exam(exam_id: int):

    with engine.begin() as conn:

        mark_expired_assignments_not_given(conn)

        result = conn.execute(
            text("""
                SELECT
                    s.student_id,
                    s.name AS student_name,
                    e.exam_name,
                    ea.attendance_status,
                    ea.started_at,
                    ea.deadline_at,
                    ea.submitted_at AS assignment_submitted_at,
                    r.score,
                    r.total_questions,
                    r.percentage,
                    r.result,
                    r.status,
                    r.violation_count,
                    r.cancel_reason,
                    rs.total_score AS risk_score,
                    rs.exam_status,
                    r.submitted_at AS result_submitted_at
                FROM exam_assignments ea
                JOIN students s ON s.student_id = ea.student_id
                JOIN exams e ON e.exam_id = ea.exam_id
                LEFT JOIN exam_results r
                    ON r.student_id = ea.student_id
                   AND r.exam_id = ea.exam_id
                LEFT JOIN risk_scores rs
                    ON rs.student_id = ea.student_id
                   AND rs.exam_id = ea.exam_id
                WHERE ea.exam_id = :exam_id
                ORDER BY
                    r.percentage IS NULL,
                    r.percentage DESC,
                    s.name
            """),
            {
                "exam_id": exam_id
            }
        )

        results = []

        for row in result:
            percentage = float(row.percentage) if row.percentage is not None else None
            has_result = row.score is not None

            results.append({
                "student_id": row.student_id,
                "student_name": row.student_name,
                "exam_name": row.exam_name,
                "attendance_status": row.attendance_status,
                "started_at": _serialize_datetime(row.started_at),
                "deadline_at": _serialize_datetime(row.deadline_at),
                "score": row.score,
                "total_questions": row.total_questions,
                "percentage": percentage,
                # Preserve the project's existing percentage-based pass/fail rule
                # for actual attempts, while leaving non-attempts unevaluated.
                "result": ("Pass" if percentage >= 40 else "Fail") if has_result else None,
                "status": row.status,
                "violation_count": row.violation_count,
                "cancel_reason": row.cancel_reason,
                "risk_score": (row.risk_score if row.risk_score is not None else 0) if has_result else None,
                "exam_status": (row.exam_status or "VALID") if has_result else None,
                "submitted_at": _serialize_datetime(
                    row.result_submitted_at or row.assignment_submitted_at
                )
            })

        return results


@app.get("/faculty/results-summary/{exam_id}")
def faculty_results_summary(exam_id: int):
    with engine.begin() as conn:
        mark_expired_assignments_not_given(conn)
        row = conn.execute(
            text("""
                SELECT
                    COUNT(*) AS total_students,
                    COALESCE(SUM(ea.attendance_status IN ('Started', 'Submitted')), 0) AS gave_exam,
                    COALESCE(SUM(ea.attendance_status NOT IN ('Started', 'Submitted')), 0) AS did_not_give,
                    COALESCE(SUM(ea.attendance_status = 'Not Given'), 0) AS not_given,
                    COALESCE(SUM(r.status = 'Completed'), 0) AS completed,
                    COALESCE(SUM(r.status = 'Invalid'), 0) AS invalid_count,
                    COALESCE(SUM(r.status = 'On Hold'), 0) AS on_hold,
                    COALESCE(SUM(r.percentage >= 40), 0) AS pass_count,
                    COALESCE(SUM(r.percentage < 40), 0) AS fail_count
                FROM exam_assignments ea
                LEFT JOIN exam_results r
                    ON r.student_id = ea.student_id
                   AND r.exam_id = ea.exam_id
                WHERE ea.exam_id = :exam_id
            """),
            {"exam_id": exam_id}
        ).fetchone()

    return {
        "total_students": int(row.total_students or 0),
        "gave_exam": int(row.gave_exam or 0),
        "did_not_give": int(row.did_not_give or 0),
        "not_given": int(row.not_given or 0),
        "completed": int(row.completed or 0),
        "invalid": int(row.invalid_count or 0),
        "on_hold": int(row.on_hold or 0),
        "pass": int(row.pass_count or 0),
        "fail": int(row.fail_count or 0)
    }
@app.get("/faculty/result/{student_id}/{exam_id}")
def faculty_result(student_id: int, exam_id: int):

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT

                    s.student_id,
                    s.name AS student_name,

                    e.exam_name,

                    r.score,
                    r.total_questions,
                    r.percentage,

                    r.result,
                    r.status,

                    r.violation_count,
                    r.cancel_reason,

                    rs.total_score AS risk_score,
                    rs.exam_status,

                    r.submitted_at

                FROM exam_results r

                JOIN students s
                    ON r.student_id = s.student_id

                JOIN exams e
                    ON r.exam_id = e.exam_id

                LEFT JOIN risk_scores rs
                    ON rs.student_id = r.student_id
                    AND rs.exam_id = r.exam_id

                WHERE
                    r.student_id = :student_id
                    AND r.exam_id = :exam_id
            """),
            {
                "student_id": student_id,
                "exam_id": exam_id
            }
        )

        row = result.fetchone()

        if not row:
            return {"error": "Result not found"}

        return {

            "student_id": row.student_id,

            "student_name": row.student_name,

            "exam_name": row.exam_name,

            "score": row.score,

            "total_questions": row.total_questions,

            "percentage": float(row.percentage),

            "result": "Pass" if float(row.percentage) >= 40 else "Fail",

            "status": row.status,

            "violation_count": row.violation_count,

            "cancel_reason": row.cancel_reason,

            "risk_score": row.risk_score if row.risk_score else 0,

            "exam_status": row.exam_status if row.exam_status else "VALID",

            "submitted_at": (
                str(row.submitted_at)
                if row.submitted_at
                else None
            )

        }
@app.put("/faculty/result/{student_id}/{exam_id}/approve")
def approve_result(student_id: int, exam_id: int):

    with engine.begin() as conn:

        result = conn.execute(
            text("""
                UPDATE exam_results
                SET status = 'Completed'
                WHERE student_id = :student_id
                  AND exam_id = :exam_id
            """),
            {
                "student_id": student_id,
                "exam_id": exam_id
            }
        )

        if result.rowcount == 0:
            return {
                "success": False,
                "message": "Result not found."
            }

    return {
        "success": True,
        "message": "Result approved successfully."
    }


@app.put("/faculty/result/{student_id}/{exam_id}/keep-invalid")
def keep_invalid_result(student_id: int, exam_id: int):

    with engine.begin() as conn:

        result = conn.execute(
            text("""
                UPDATE exam_results
                SET status = 'Invalid'
                WHERE student_id = :student_id
                  AND exam_id = :exam_id
            """),
            {
                "student_id": student_id,
                "exam_id": exam_id
            }
        )

        if result.rowcount == 0:
            return {
                "success": False,
                "message": "Result not found."
            }

    return {
        "success": True,
        "message": "Result kept as invalid."
    }
@app.get("/faculty/answers/{student_id}/{exam_id}")
def faculty_view_answers(student_id: int, exam_id: int):

    with engine.connect() as conn:

        result = conn.execute(

            text("""

                SELECT

                    q.question_id,

                    q.question_text,

q.option_a,
q.option_b,
q.option_c,
q.option_d,

                    q.correct_option,

                    sa.selected_option

                FROM questions q

                LEFT JOIN student_answers sa

                    ON q.question_id = sa.question_id

                    AND sa.student_id = :student_id

                    AND sa.exam_id = :exam_id

                WHERE q.exam_id = :exam_id

                ORDER BY q.question_id

            """),

            {

                "student_id": student_id,

                "exam_id": exam_id

            }

        )

        answers = []

        for row in result:

            answers.append({

                "question_id": row.question_id,

                "question_text": row.question_text,

"option_a": row.option_a,

"option_b": row.option_b,

"option_c": row.option_c,

"option_d": row.option_d,

                "student_answer": row.selected_option,

                "correct_answer": row.correct_option,

                "is_correct":

                    row.selected_option == row.correct_option

                    if row.selected_option

                    else False

            })

        return answers
@app.get("/faculty/violations/{student_id}/{exam_id}")
def faculty_violations(student_id: int, exam_id: int):

    with engine.connect() as conn:

        result = conn.execute(

            text("""

                SELECT

                    violation_type,
                    risk_points,
                    details,
                    timestamp

                FROM violations

                WHERE
                    student_id = :student_id
                    AND
                    exam_id = :exam_id

                ORDER BY timestamp ASC

            """),

            {
                "student_id": student_id,
                "exam_id": exam_id
            }

        )

        violations = []

        total_risk = 0

        for row in result:

            total_risk += row.risk_points

            violations.append({

                "violation_type": row.violation_type,

                "risk_points": row.risk_points,

                "details": row.details,

                "timestamp": (
                    str(row.timestamp)
                    if row.timestamp
                    else None
                )

            })

        if total_risk >= 70:

            recommendation = "INVALID"

        elif total_risk >= 30:

            recommendation = "REVIEW"

        else:

            recommendation = "VALID"

        return {

            "total_risk": total_risk,

            "recommendation": recommendation,

            "violations": violations

        }
@app.get("/students")
def get_students():

    with engine.connect() as conn:

        result = conn.execute(text("""
            SELECT
                student_id,
                roll_no,
                name
            FROM students
            ORDER BY roll_no
        """))

        students = []

        for row in result:

            students.append({

                "student_id": row.student_id,
                "roll_no": row.roll_no,
                "name": row.name

            })

        return students
@app.get("/student/id/{roll_no}")
def get_student_id(roll_no: str):

    with engine.connect() as conn:

        result = conn.execute(
            text("""
                SELECT student_id
                FROM students
                WHERE roll_no = :roll_no
            """),
            {"roll_no": roll_no}
        ).fetchone()

        if not result:

            return {
                "error": "Student not found"
            }

        return {
            "student_id": result.student_id
        }


# ============================
# Super Admin Endpoints
# ============================

@app.post("/superadmin/register")
def register_superadmin(data: dict = Body(...)):
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO super_admins (name, email, username, password)
            VALUES (:name, :email, :username, :password)
        """), {
            "name": data["name"],
            "email": data["email"],
            "username": data.get("username", "superadmin"),
            "password": hash_password(data["password"])
        })
        conn.commit()
    return {"message": "Super Admin Registered Successfully"}


@app.post("/superadmin/login")
def login_superadmin(data: dict = Body(...)):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM super_admins WHERE username = :username"),
            {"username": data["username"]}
        ).fetchone()
        if row and verify_password(data["password"], row.password):
            return {"message": "Super Admin Login Successful", "admin_id": row.admin_id, "name": row.name, "email": row.email}
        return {"message": "Invalid ID or Password"}


@app.get("/superadmin/students")
def superadmin_get_students():
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT student_id, roll_no, name, email FROM students ORDER BY student_id")).fetchall()
        return [{"student_id": r.student_id, "roll_no": r.roll_no, "name": r.name, "email": r.email} for r in rows]


@app.delete("/superadmin/students/{student_id}")
def superadmin_delete_student(student_id: int):
    with engine.connect() as conn:
        # Delete dependent records first
        conn.execute(text("DELETE FROM violation_throttle WHERE student_id=:id"), {"id": student_id})
        conn.execute(text("DELETE FROM violations WHERE student_id=:id"), {"id": student_id})
        conn.execute(text("DELETE FROM risk_scores WHERE student_id=:id"), {"id": student_id})
        conn.execute(text("DELETE FROM student_answers WHERE student_id=:id"), {"id": student_id})
        conn.execute(text("DELETE FROM exam_results WHERE student_id=:id"), {"id": student_id})
        conn.execute(text("DELETE FROM students WHERE student_id=:id"), {"id": student_id})
        conn.commit()
    return {"message": "Student deleted successfully"}


@app.get("/superadmin/faculty")
def superadmin_get_faculty():
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT faculty_id, faculty_code, name, email FROM faculty ORDER BY faculty_id")).fetchall()
        return [{"faculty_id": r.faculty_id, "faculty_code": r.faculty_code, "name": r.name, "email": r.email} for r in rows]


@app.delete("/superadmin/faculty/{faculty_id}")
def superadmin_delete_faculty(faculty_id: int):
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM faculty WHERE faculty_id=:id"), {"id": faculty_id})
        conn.commit()
    return {"message": "Faculty deleted successfully"}


@app.post("/faculty/change-password")
def faculty_change_password(data: dict = Body(...)):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT password FROM faculty WHERE faculty_code = :code"),
            {"code": data["faculty_code"]}
        ).fetchone()
        if not row:
            return {"message": "Faculty not found"}
        if not verify_password(data["current_password"], row.password):
            return {"message": "Current password is incorrect"}
        conn.execute(
            text("UPDATE faculty SET password = :p WHERE faculty_code = :code"),
            {"p": hash_password(data["new_password"]), "code": data["faculty_code"]}
        )
        conn.commit()
    return {"message": "Password changed successfully"}


@app.post("/student/change-password")
def student_change_password(data: dict = Body(...)):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT password FROM students WHERE student_id = :id"),
            {"id": data["student_id"]}
        ).fetchone()
        if not row:
            return {"message": "Student not found"}
        if not verify_password(data["current_password"], row.password):
            return {"message": "Current password is incorrect"}
        conn.execute(
            text("UPDATE students SET password = :p WHERE student_id = :id"),
            {"p": hash_password(data["new_password"]), "id": data["student_id"]}
        )
        conn.commit()
    return {"message": "Password changed successfully"}


@app.post("/superadmin/add-student")
def superadmin_add_student(data: dict = Body(...)):
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT student_id FROM students WHERE roll_no = :roll_no"),
            {"roll_no": data["roll_no"]}
        ).fetchone()
        if existing:
            return {"message": "Roll number already exists"}
        conn.execute(text("""
            INSERT INTO students (roll_no, name, email, password)
            VALUES (:roll_no, :name, :email, :password)
        """), {
            "roll_no": data["roll_no"],
            "name": data["name"],
            "email": data.get("email", ""),
            "password": hash_password(data["password"])
        })
        conn.commit()
    return {"message": "Student Added Successfully"}


@app.post("/superadmin/add-faculty")
def superadmin_add_faculty(data: dict = Body(...)):
    with engine.connect() as conn:
        result = conn.execute(text("""
            INSERT INTO faculty (name, email, password)
            VALUES (:name, :email, :password)
        """), {
            "name": data["name"],
            "email": data.get("email", ""),
            "password": hash_password(data["password"])
        })
        new_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        faculty_code = f"FAC{str(new_id).zfill(3)}"
        conn.execute(
            text("UPDATE faculty SET faculty_code = :code WHERE faculty_id = :id"),
            {"code": faculty_code, "id": new_id}
        )
        conn.commit()
    return {"message": "Faculty Added Successfully", "faculty_code": faculty_code}


@app.post("/superadmin/change-password")
def superadmin_change_password(data: dict = Body(...)):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT password FROM superadmin WHERE username = :u"),
            {"u": data.get("username", "superadmin")}
        ).fetchone()
        if not row:
            return {"message": "Admin not found"}
        if not verify_password(data["current_password"], row.password):
            return {"message": "Current password is incorrect"}
        conn.execute(
            text("UPDATE superadmin SET password = :p WHERE username = :u"),
            {"p": hash_password(data["new_password"]), "u": data.get("username", "superadmin")}
        )
        conn.commit()
    return {"message": "Password changed successfully"}


@app.get("/superadmin/stats")
def superadmin_stats():
    with engine.connect() as conn:
        total_students = conn.execute(text("SELECT COUNT(*) FROM students")).scalar() or 0
        total_faculty = conn.execute(text("SELECT COUNT(*) FROM faculty")).scalar() or 0
        total_exams = conn.execute(text("SELECT COUNT(*) FROM exams")).scalar() or 0
        total_violations = conn.execute(text("SELECT COUNT(*) FROM violations")).scalar() or 0
        invalid_exams = conn.execute(text("SELECT COUNT(*) FROM risk_scores WHERE exam_status='INVALID'")).scalar() or 0
        total_results = conn.execute(text("SELECT COUNT(*) FROM exam_results")).scalar() or 0
    return {
        "total_students": int(total_students),
        "total_faculty": int(total_faculty),
        "total_exams": int(total_exams),
        "total_violations": int(total_violations),
        "invalid_exams": int(invalid_exams),
        "total_results": int(total_results),
    }


@app.delete("/exams/{exam_id}")
def delete_exam(exam_id: int):
    with engine.connect() as conn:
        exam = conn.execute(
            text("SELECT exam_id FROM exams WHERE exam_id = :eid"),
            {"eid": exam_id}
        ).fetchone()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        try:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            conn.execute(text("DELETE FROM violation_throttle WHERE exam_id = :eid"), {"eid": exam_id})
            conn.execute(text("DELETE FROM violations WHERE exam_id = :eid"), {"eid": exam_id})
            conn.execute(text("DELETE FROM risk_scores WHERE exam_id = :eid"), {"eid": exam_id})
            conn.execute(text("DELETE FROM student_answers WHERE exam_id = :eid"), {"eid": exam_id})
            conn.execute(text("DELETE FROM exam_results WHERE exam_id = :eid"), {"eid": exam_id})
            conn.execute(text("DELETE FROM questions WHERE exam_id = :eid"), {"eid": exam_id})
            conn.execute(text("DELETE FROM exams WHERE exam_id = :eid"), {"eid": exam_id})
            conn.commit()
        except Exception as e:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

    return {"message": "Exam and all related data deleted successfully"}
@app.get("/exam/{exam_id}")
def get_exam(exam_id: int):

    with engine.connect() as conn:

        query = text("""
            SELECT exam_id,
                   exam_name,
                   duration,
                   created_by,
                   availability_start,
                   availability_end
            FROM exams
            WHERE exam_id = :exam_id
        """)

        result = conn.execute(query, {
            "exam_id": exam_id
        }).fetchone()

        if result:

            return _exam_to_dict(result)

        return {
            "message": "Exam not found"
        }
@app.get("/student/answers/{student_id}/{exam_id}")
def student_view_answers(student_id: int, exam_id: int):

    with engine.connect() as conn:

        result_status = conn.execute(
            text("""
                SELECT status
                FROM exam_results
                WHERE student_id = :student_id
                  AND exam_id = :exam_id
            """),
            {
                "student_id": student_id,
                "exam_id": exam_id
            }
        ).fetchone()

        if not result_status:
            raise HTTPException(
                status_code=404,
                detail="Exam result not found."
            )

        if result_status.status == "Invalid":
            raise HTTPException(
                status_code=403,
                detail="Answer sheet is unavailable while the result is under faculty review."
            )

        result = conn.execute(
            text("""
                SELECT
                    q.question_id,
                    q.question_text,
                    q.option_a,
                    q.option_b,
                    q.option_c,
                    q.option_d,
                    q.correct_option,
                    sa.selected_option
                FROM questions q
                LEFT JOIN student_answers sa
                    ON q.question_id = sa.question_id
                    AND sa.student_id = :student_id
                    AND sa.exam_id = :exam_id
                WHERE q.exam_id = :exam_id
                ORDER BY q.question_id
            """),
            {
                "student_id": student_id,
                "exam_id": exam_id
            }
        )

        answers = []

        for row in result:

            answers.append({
                "question_id": row.question_id,
                "question_text": row.question_text,
                "option_a": row.option_a,
                "option_b": row.option_b,
                "option_c": row.option_c,
                "option_d": row.option_d,
                "student_answer": row.selected_option,
                "correct_answer": row.correct_option,
                "is_correct":
                    row.selected_option == row.correct_option
                    if row.selected_option
                    else False
            })

        return answers

# Serve frontend files at http://127.0.0.1:8000/
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")


#use to run this file use .\venv\Scripts\Activate.ps1 and then run: uvicorn backend.main:app --reload

