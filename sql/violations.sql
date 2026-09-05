-- INSERT INTO violations
-- (student_id, exam_id, violation_type, risk_points, details)
-- VALUES

-- -- Student 4
-- (4,59,'looking_away',8,'Looked away from screen multiple times'),

-- -- Student 7
-- (7,59,'mobile_phone',20,'Mobile phone detected'),
-- (7,59,'face_missing',10,'Face missing for several seconds'),

-- -- Student 12
-- (12,59,'looking_away',8,'Repeated looking away'),

-- -- Student 19
-- (19,59,'multiple_persons',15,'Multiple persons detected'),
-- (19,59,'looking_away',8,'Looking away repeatedly'),

-- -- Student 25
-- (25,59,'face_missing',10,'Face not detected'),

-- -- Student 26 (High Risk)
-- (26,59,'mobile_phone',20,'Mobile phone detected'),
-- (26,59,'multiple_persons',15,'Multiple persons detected'),
-- (26,59,'face_missing',10,'Face disappeared'),
-- (26,59,'looking_away',8,'Repeated looking away'),

-- -- Student 30
-- (30,59,'looking_away',8,'Looking away');
-- INSERT INTO violations
-- (student_id, exam_id, violation_type, risk_points, details)
-- VALUES

-- (3,60,'looking_away',8,'Frequently looked away from screen'),

-- (5,60,'face_missing',10,'Face disappeared during exam'),

-- (8,60,'mobile_phone',20,'Mobile phone detected'),

-- (10,60,'looking_away',8,'Student repeatedly looked away'),

-- (12,60,'face_missing',10,'Face missing'),

-- (14,60,'multiple_persons',15,'Another person detected'),

-- (17,60,'looking_away',8,'Looking away several times'),

-- (18,60,'mobile_phone',20,'Phone detected'),

-- (21,60,'face_missing',10,'Face not visible'),

-- (24,60,'looking_away',8,'Looking away'),

-- (28,60,'multiple_persons',15,'Multiple persons detected'),

-- (31,60,'mobile_phone',20,'Mobile phone detected');
-- INSERT INTO violations
-- (student_id, exam_id, violation_type, risk_points, details)
-- VALUES

-- (2,61,'looking_away',8,'Frequently looked away'),

-- (6,61,'face_missing',10,'Face not visible'),

-- (9,61,'looking_away',8,'Repeated eye movement'),

-- (11,61,'mobile_phone',20,'Mobile phone detected'),

-- (13,61,'looking_away',8,'Looking away'),

-- (16,61,'multiple_persons',15,'Another person entered frame'),

-- (20,61,'face_missing',10,'Face missing for several seconds'),

-- (22,61,'looking_away',8,'Looking away'),

-- (23,61,'mobile_phone',20,'Phone detected'),

-- (27,61,'face_missing',10,'Face not detected'),

-- (29,61,'looking_away',8,'Looking away'),

-- (30,61,'multiple_persons',15,'Multiple persons detected');
-- INSERT INTO violations
-- (student_id, exam_id, violation_type, risk_points, details)
-- VALUES

-- (1,62,'looking_away',8,'Frequently looked away from screen'),

-- (4,62,'face_missing',10,'Face not detected for several seconds'),

-- (7,62,'mobile_phone',20,'Mobile phone detected'),

-- (10,62,'looking_away',8,'Repeated looking away'),

-- (12,62,'multiple_persons',15,'Another person detected'),

-- (15,62,'face_missing',10,'Face disappeared'),

-- (18,62,'looking_away',8,'Looking away repeatedly'),

-- (19,62,'mobile_phone',20,'Phone detected'),

-- (21,62,'face_missing',10,'Face not visible'),

-- (25,62,'looking_away',8,'Repeated looking away'),

-- (26,62,'multiple_persons',15,'Multiple persons detected'),

-- (29,62,'mobile_phone',20,'Mobile phone detected');
-- INSERT INTO violations
-- (student_id, exam_id, violation_type, risk_points, details)
-- VALUES

-- (2,63,'looking_away',8,'Frequently looked away'),

-- (5,63,'face_missing',10,'Face missing'),

-- (8,63,'mobile_phone',20,'Mobile phone detected'),

-- (11,63,'looking_away',8,'Repeated looking away'),

-- (14,63,'face_missing',10,'Face disappeared'),

-- (17,63,'multiple_persons',15,'Multiple persons detected'),

-- (20,63,'looking_away',8,'Looking away repeatedly'),

-- (22,63,'face_missing',10,'Face not visible'),

-- (24,63,'mobile_phone',20,'Mobile phone detected'),

-- (27,63,'looking_away',8,'Looking away'),

-- (30,63,'multiple_persons',15,'Multiple persons detected'),

-- (31,63,'face_missing',10,'Face not detected');
-- INSERT INTO risk_scores (student_id, exam_id, total_score, exam_status)
-- SELECT
--     er.student_id,
--     er.exam_id,
--     COALESCE(SUM(v.risk_points),0) AS total_score,
--     CASE
--         WHEN COALESCE(SUM(v.risk_points),0) >= 40 THEN 'INVALID'
--         ELSE 'VALID'
--     END AS exam_status
-- FROM exam_results er
-- LEFT JOIN violations v
-- ON er.student_id = v.student_id
-- AND er.exam_id = v.exam_id
-- GROUP BY
--     er.student_id,
--     er.exam_id;
-- UPDATE exam_results er
-- SET violation_count =
-- (
--     SELECT COUNT(*)
--     FROM violations v
--     WHERE v.student_id = er.student_id
--       AND v.exam_id = er.exam_id
-- )
-- WHERE er.result_id > 0;

-- UPDATE exam_results er
-- JOIN risk_scores rs
-- ON er.student_id = rs.student_id
-- AND er.exam_id = rs.exam_id
-- SET er.status =
-- CASE
--     WHEN rs.exam_status = 'INVALID'
--         THEN 'Invalid'
--     ELSE
--         'Completed'
-- END
-- WHERE er.result_id > 0;

-- UPDATE exam_results
-- SET result =
-- CASE
--     WHEN percentage >= 40
--         THEN 'Pass'
--     ELSE
--         'Fail'
-- END
-- WHERE result_id > 0;
-- INSERT INTO risk_scores (student_id, exam_id, total_score, exam_status)
-- SELECT
--     er.student_id,
--     er.exam_id,
--     COALESCE(SUM(v.risk_points),0) AS total_score,
--     CASE
--         WHEN SUM(CASE
--                     WHEN v.violation_type IN ('mobile_phone','multiple_persons')
--                     THEN 1 ELSE 0
--                  END) > 0
--             THEN 'INVALID'

--         WHEN COALESCE(SUM(v.risk_points),0) >= 40
--             THEN 'INVALID'

--         WHEN COALESCE(SUM(v.risk_points),0) >= 20
--             THEN 'ON HOLD'

--         ELSE
--             'VALID'
--     END AS exam_status
-- FROM exam_results er
-- LEFT JOIN violations v
-- ON er.student_id = v.student_id
-- AND er.exam_id = v.exam_id
-- GROUP BY
--     er.student_id,
--     er.exam_id;
-- UPDATE exam_results er
-- JOIN risk_scores rs
-- ON er.student_id = rs.student_id
-- AND er.exam_id = rs.exam_id
-- SET er.status =
-- CASE
--     WHEN rs.exam_status = 'INVALID' THEN 'Invalid'
--     WHEN rs.exam_status = 'ON HOLD' THEN 'On Hold'
--     ELSE 'Completed'
-- END
-- WHERE er.result_id > 0;
