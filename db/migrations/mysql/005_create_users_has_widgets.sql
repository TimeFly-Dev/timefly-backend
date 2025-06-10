-- migrate:up
CREATE TABLE IF NOT EXISTS users_has_widgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  widget_id INT NOT NULL,
  props JSON NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  position INT NOT NULL DEFAULT '0',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE,
  UNIQUE KEY unique_widget_id_per_user (user_id, widget_id),
  INDEX idx_users_widgets_position (user_id, position)
);

-- migrate:down
DROP TABLE IF EXISTS users_has_widgets;
