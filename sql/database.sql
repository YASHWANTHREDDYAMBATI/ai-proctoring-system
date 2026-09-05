USE ai_proctoring;

-- Core tables (kept commented as per your existing file style)
-- CREATE TABLE students(
--     student_id INT AUTO_INCREMENT PRIMARY KEY,
--     roll_no VARCHAR(20) UNIQUE NOT NULL,
--     name VARCHAR(100) NOT NULL,
--     email VARCHAR(100) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL
-- );

-- CREATE TABLE faculty(
--     faculty_id INT AUTO_INCREMENT PRIMARY KEY,
--     name VARCHAR(100) NOT NULL,
--     email VARCHAR(100) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL
-- );

-- CREATE TABLE exams(
--     exam_id INT AUTO_INCREMENT PRIMARY KEY,
--     exam_name VARCHAR(100) NOT NULL,
--     duration INT NOT NULL,
--     created_by INT,
--     FOREIGN KEY (created_by) REFERENCES faculty(faculty_id)
-- );

-- CREATE TABLE questions(
--     question_id INT AUTO_INCREMENT PRIMARY KEY,
--     exam_id INT,
--     question_text TEXT NOT NULL,
--     option_a VARCHAR(255) NOT NULL,
--     option_b VARCHAR(255) NOT NULL,
--     option_c VARCHAR(255) NOT NULL,
--     option_d VARCHAR(255) NOT NULL,
--     correct_option CHAR(1) NOT NULL,
--     FOREIGN KEY (exam_id) REFERENCES exams(exam_id)
-- );

-- CREATE TABLE student_answers(
--     answer_id INT AUTO_INCREMENT PRIMARY KEY,
--     student_id INT,
--     exam_id INT,
--     question_id INT,
--     selected_option CHAR(1),
--     FOREIGN KEY(student_id) REFERENCES students(student_id),
--     FOREIGN KEY(exam_id) REFERENCES exams(exam_id),
--     FOREIGN KEY(question_id) REFERENCES questions(question_id)
-- );

-- CREATE TABLE exam_results(
--     result_id INT AUTO_INCREMENT PRIMARY KEY,
--     student_id INT,
--     exam_id INT,
--     score INT,
--     total_questions INT,
--     percentage DECIMAL(5,2),
--     FOREIGN KEY(student_id) REFERENCES students(student_id),
--     FOREIGN KEY(exam_id) REFERENCES exams(exam_id)
-- );

-- ============================
-- Proctoring tables (required)
-- ============================

CREATE TABLE IF NOT EXISTS violations(
    violation_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    exam_id INT NOT NULL,
    violation_type VARCHAR(100) NOT NULL,
    risk_points INT NOT NULL,
    details TEXT DEFAULT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (exam_id) REFERENCES exams(exam_id)
);
-- If table already exists, run: ALTER TABLE violations ADD COLUMN IF NOT EXISTS details TEXT DEFAULT NULL;

-- Index for faster dashboard filtering
CREATE INDEX IF NOT EXISTS idx_violation_lookup
ON violations(student_id, exam_id);


CREATE TABLE IF NOT EXISTS risk_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    exam_id INT NOT NULL,
    total_score INT NOT NULL DEFAULT 0,
    exam_status VARCHAR(20) NOT NULL DEFAULT 'VALID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_risk_scores_student_exam (student_id, exam_id),

    FOREIGN KEY(student_id) REFERENCES students(student_id),
    FOREIGN KEY(exam_id) REFERENCES exams(exam_id)
);

-- Index for faster upserts/lookups
CREATE INDEX IF NOT EXISTS idx_risk_lookup
ON risk_scores(student_id, exam_id);


-- Violation throttling table (prevents risk inflation)
CREATE TABLE IF NOT EXISTS violation_throttle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    exam_id INT NOT NULL,
    violation_type VARCHAR(100) NOT NULL,
    last_logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_throttle (student_id, exam_id, violation_type),

    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (exam_id) REFERENCES exams(exam_id)
);

-- Useful helper: avoid NULL rows; ensure risk_scores row exists before updating.
-- You can pre-create rows per (student_id, exam_id) in your flow.

-- Debug selects (safe to remove)
-- SELECT * FROM violations;
-- SELECT * FROM risk_scores;
SHOW TABLES;
-- CREATE TABLE IF NOT EXISTS risk_scores (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     student_id INT NOT NULL,
--     exam_id INT NOT NULL,
--     total_score INT NOT NULL DEFAULT 0,
--     exam_status VARCHAR(20) NOT NULL DEFAULT 'VALID',
--     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

--     UNIQUE KEY uq_risk_scores_student_exam (student_id, exam_id),

--     FOREIGN KEY(student_id) REFERENCES students(student_id),
--     FOREIGN KEY(exam_id) REFERENCES exams(exam_id)
-- );
-- CREATE TABLE IF NOT EXISTS violation_throttle (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     student_id INT NOT NULL,
--     exam_id INT NOT NULL,
--     violation_type VARCHAR(100) NOT NULL,
--     last_logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     UNIQUE KEY uq_throttle (student_id, exam_id, violation_type),

--     FOREIGN KEY (student_id) REFERENCES students(student_id),
--     FOREIGN KEY (exam_id) REFERENCES exams(exam_id)
-- );
select * from risk_scores;
select * from faculty;

