-- Task Manager schema (MySQL 8+). Run once:  mysql -u root -p < database/schema.sql
CREATE DATABASE IF NOT EXISTS task_manager
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE task_manager;

CREATE TABLE IF NOT EXISTS tasks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status      ENUM('Pending','In Progress','Completed') NOT NULL DEFAULT 'Pending',
  priority    ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  due_date    DATE NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_status (status),
  KEY idx_tasks_priority (priority),
  KEY idx_tasks_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: a dedicated app user (do not use root in production)
-- CREATE USER 'task_user'@'localhost' IDENTIFIED BY 'change_me';
-- GRANT ALL PRIVILEGES ON task_manager.* TO 'task_user'@'localhost';
-- FLUSH PRIVILEGES;

-- Optional sample data
-- INSERT INTO tasks (title, description, status, priority, due_date) VALUES
--  ('Design landing page', 'Wireframes and final mockups', 'In Progress', 'High', CURDATE() + INTERVAL 3 DAY),
--  ('Write API docs', 'Document all endpoints', 'Pending', 'Medium', CURDATE() + INTERVAL 7 DAY),
--  ('Set up CI', NULL, 'Completed', 'Low', NULL);
