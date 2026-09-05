CREATE DATABASE IF NOT EXISTS ai_proctoring;
USE ai_proctoring;
SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `exam_results`;
CREATE TABLE `exam_results` (
  `result_id` int NOT NULL AUTO_INCREMENT,
  `student_id` int DEFAULT NULL,
  `exam_id` int DEFAULT NULL,
  `score` int DEFAULT NULL,
  `total_questions` int DEFAULT NULL,
  `percentage` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`result_id`),
  KEY `student_id` (`student_id`),
  KEY `exam_id` (`exam_id`),
  CONSTRAINT `exam_results_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `exam_results_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`exam_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `exam_results` (`result_id`, `student_id`, `exam_id`, `score`, `total_questions`, `percentage`) VALUES (3, 1, 56, 1, 1, '100.00');

DROP TABLE IF EXISTS `exams`;
CREATE TABLE `exams` (
  `exam_id` int NOT NULL AUTO_INCREMENT,
  `exam_name` varchar(100) NOT NULL,
  `duration` int NOT NULL,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`exam_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `exams_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `faculty` (`faculty_id`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `exams` (`exam_id`, `exam_name`, `duration`, `created_by`) VALUES (56, 'feature testing', 10, NULL);

DROP TABLE IF EXISTS `faculty`;
CREATE TABLE `faculty` (
  `faculty_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `faculty_code` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`faculty_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `faculty_code` (`faculty_code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `faculty` (`faculty_id`, `name`, `email`, `password`, `faculty_code`) VALUES (1, 'Admin', 'admin@test.com', '$2b$12$5Iw6f/gc/HoLIZDoAbvZMO9QtYsYo.2Nk692zRz2PevVhK39YWqLy', 'FAC001');

DROP TABLE IF EXISTS `questions`;
CREATE TABLE `questions` (
  `question_id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int DEFAULT NULL,
  `question_text` text NOT NULL,
  `option_a` varchar(255) NOT NULL,
  `option_b` varchar(255) NOT NULL,
  `option_c` varchar(255) NOT NULL,
  `option_d` varchar(255) NOT NULL,
  `correct_option` char(1) NOT NULL,
  PRIMARY KEY (`question_id`),
  KEY `exam_id` (`exam_id`),
  CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`exam_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `questions` (`question_id`, `exam_id`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option`) VALUES (4, 56, 'a', 'a', 'a', 'c ', 'd ', 'A');

DROP TABLE IF EXISTS `risk_scores`;
CREATE TABLE `risk_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `exam_id` int NOT NULL,
  `total_score` int NOT NULL DEFAULT '0',
  `exam_status` varchar(20) NOT NULL DEFAULT 'VALID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_risk_scores_student_exam` (`student_id`,`exam_id`),
  KEY `exam_id` (`exam_id`),
  CONSTRAINT `risk_scores_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `risk_scores_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`exam_id`)
) ENGINE=InnoDB AUTO_INCREMENT=233 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `risk_scores` (`id`, `student_id`, `exam_id`, `total_score`, `exam_status`, `created_at`, `updated_at`) VALUES (226, 1, 56, 0, 'VALID', '2026-06-26 23:21:08', '2026-06-26 23:21:08');

DROP TABLE IF EXISTS `student_answers`;
CREATE TABLE `student_answers` (
  `answer_id` int NOT NULL AUTO_INCREMENT,
  `student_id` int DEFAULT NULL,
  `exam_id` int DEFAULT NULL,
  `question_id` int DEFAULT NULL,
  `selected_option` char(1) DEFAULT NULL,
  PRIMARY KEY (`answer_id`),
  KEY `student_id` (`student_id`),
  KEY `exam_id` (`exam_id`),
  KEY `question_id` (`question_id`),
  CONSTRAINT `student_answers_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `student_answers_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`exam_id`),
  CONSTRAINT `student_answers_ibfk_3` FOREIGN KEY (`question_id`) REFERENCES `questions` (`question_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `student_answers` (`answer_id`, `student_id`, `exam_id`, `question_id`, `selected_option`) VALUES (4, 1, 56, 4, 'A');

DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `student_id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `roll_no` (`roll_no`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `students` (`student_id`, `roll_no`, `name`, `email`, `password`) VALUES (1, 'S001', 'Test Student', 'student@test.com', '$2b$12$HK9ku6jYCvYApIqT4nAWCujUy4xBX6CMWWb8GWLag2djqwPreLcMS');

DROP TABLE IF EXISTS `super_admins`;
CREATE TABLE `super_admins` (
  `admin_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(50) NOT NULL DEFAULT 'superadmin',
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `super_admins` (`admin_id`, `name`, `email`, `password`, `username`) VALUES (2, 'Super Admin', 'superadmin@test.com', '$2b$12$c5yfIdOaukplw.LaU1NrE.Qx6C7XnwFD7FuAhU6y2o2RpGq.I1Cn6', 'superadmin');

DROP TABLE IF EXISTS `violation_throttle`;
CREATE TABLE `violation_throttle` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `exam_id` int NOT NULL,
  `violation_type` varchar(100) NOT NULL,
  `last_logged_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_throttle` (`student_id`,`exam_id`,`violation_type`),
  KEY `exam_id` (`exam_id`),
  CONSTRAINT `violation_throttle_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `violation_throttle_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`exam_id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `violation_throttle` (`id`, `student_id`, `exam_id`, `violation_type`, `last_logged_at`) VALUES (49, 1, 56, 'face_missing', '2026-06-26 23:22:27');

DROP TABLE IF EXISTS `violations`;
CREATE TABLE `violations` (
  `violation_id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `exam_id` int NOT NULL,
  `violation_type` varchar(100) NOT NULL,
  `risk_points` int NOT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `details` text,
  PRIMARY KEY (`violation_id`),
  KEY `student_id` (`student_id`),
  KEY `exam_id` (`exam_id`),
  CONSTRAINT `violations_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `violations_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`exam_id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `violations` (`violation_id`, `student_id`, `exam_id`, `violation_type`, `risk_points`, `timestamp`, `details`) VALUES (49, 1, 56, 'face_missing', 10, '2026-06-26 23:22:16', 'absent_duration=3.0s');
INSERT INTO `violations` (`violation_id`, `student_id`, `exam_id`, `violation_type`, `risk_points`, `timestamp`, `details`) VALUES (50, 1, 56, 'face_missing', 10, '2026-06-26 23:22:27', 'absent_duration=10.5s');
SET FOREIGN_KEY_CHECKS=1;
