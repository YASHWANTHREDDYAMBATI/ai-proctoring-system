-- Phase 1 review-only migration for the existing ai_proctoring database.
-- Do not run automatically. This migration is additive and does not alter
-- existing exam_results, risk_scores, violations, or seeded records.

ALTER TABLE exams
    ADD COLUMN availability_start DATETIME NULL AFTER duration,
    ADD COLUMN availability_end DATETIME NULL AFTER availability_start;

CREATE INDEX idx_exams_availability_window
    ON exams (availability_start, availability_end);

CREATE TABLE exam_assignments (
    assignment_id INT NOT NULL AUTO_INCREMENT,
    exam_id INT NOT NULL,
    student_id INT NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    deadline_at DATETIME NULL,
    submitted_at DATETIME NULL,
    attendance_status ENUM('Assigned', 'Started', 'Submitted', 'Not Given')
        NOT NULL DEFAULT 'Assigned',
    PRIMARY KEY (assignment_id),
    UNIQUE KEY uq_exam_assignments_exam_student (exam_id, student_id),
    KEY idx_exam_assignments_student_exam (student_id, exam_id),
    KEY idx_exam_assignments_exam_status (exam_id, attendance_status),
    CONSTRAINT fk_exam_assignments_exam
        FOREIGN KEY (exam_id) REFERENCES exams (exam_id),
    CONSTRAINT fk_exam_assignments_student
        FOREIGN KEY (student_id) REFERENCES students (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
