import { mysqlPool } from '../db/mysql'

async function initMysql() {
	try {
		const connection = await mysqlPool.getConnection()

		// Create users table
		await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          google_id VARCHAR(255) NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL UNIQUE,
          full_name VARCHAR(255),
          avatar_url VARCHAR(255),
          api_key VARCHAR(64) UNIQUE,
          api_key_created_at TIMESTAMP NULL,
          api_key_last_used_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `)

		// Create user_settings table
		await connection.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INT PRIMARY KEY,
        theme VARCHAR(20) DEFAULT 'light',
        notification_preferences JSON,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

		// Create user_sessions table to track active sessions
		await connection.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id INT NOT NULL,
        refresh_token VARCHAR(255) NOT NULL,
        device_name VARCHAR(255),
        device_type VARCHAR(64),
        browser VARCHAR(64),
        os VARCHAR(64),
        ip_address VARCHAR(45),
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (user_id),
        INDEX (expires_at),
        INDEX (is_revoked)
      )
    `)

		// Create widgets table to store widget types
		await connection.query(`
      CREATE TABLE IF NOT EXISTS widgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        component_path VARCHAR(255) NOT NULL,
        default_props JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

		// Create user_widgets table to store widget instances
		await connection.query(`
      CREATE TABLE IF NOT EXISTS user_widgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        widget_id INT NOT NULL,
        position_x INT NOT NULL DEFAULT 0,
        position_y INT NOT NULL DEFAULT 0,
        width INT NOT NULL DEFAULT 1,
        height INT NOT NULL DEFAULT 1,
        z_index INT NOT NULL DEFAULT 0,
        widget_name VARCHAR(100),
        skin VARCHAR(50) DEFAULT 'outline',
        time_range VARCHAR(50) DEFAULT 'week',
        config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
      )
    `)

		// Insert default widget types
		await connection.query(`
      INSERT IGNORE INTO widgets (name, component_path, default_props) VALUES 
      ('ClockWidget', 'components/widgets/ClockWidget.vue', '{
        "hideSettings": false,
        "widgetIndex": 0,
        "widgetName": "Clock",
        "skin": "outline",
        "timeRange": "week",
        "widgetDrawerMode": false
      }'),
      ('GoalTrackingMosaic', 'components/widgets/GoalTrackingMosaic.vue', '{
        "hideSettings": false,
        "widgetIndex": 0,
        "widgetName": "Goal Tracking",
        "skin": "outline",
        "timeRange": "week",
        "widgetDrawerMode": false,
        "class": "size-1x2"
      }'),
      ('TodaysActivity', 'components/widgets/TodaysActivity.vue', '{
        "hideSettings": false,
        "widgetIndex": 0,
        "widgetName": "Todays Activity",
        "skin": "outline",
        "timeRange": "week",
        "widgetDrawerMode": false,
        "class": "size-1x2"
      }')
    `)

		console.log('MySQL tables created successfully')
		connection.release()
	} catch (error) {
		console.error('Error creating MySQL tables:', error)
	} finally {
		await mysqlPool.end()
	}
}

initMysql()
