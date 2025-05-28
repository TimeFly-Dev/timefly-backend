import { mysqlPool } from '../db/mysql'

async function initMysql() {
	try {
		const connection = await mysqlPool.getConnection()

		// Create users table with Stripe integration
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
          stripe_customer_id VARCHAR(255) UNIQUE NULL,
          subscription_status VARCHAR(50) DEFAULT 'inactive',
          subscription_id VARCHAR(255) UNIQUE NULL,
          current_plan_id VARCHAR(255) NULL,
          subscription_start_date TIMESTAMP NULL,
          subscription_end_date TIMESTAMP NULL,
          trial_end_date TIMESTAMP NULL,
          next_billing_date TIMESTAMP NULL,
          plan_name VARCHAR(100) NULL,
          billing_cycle VARCHAR(20) NULL,
          mrr DECIMAL(10,2) DEFAULT 0.00,
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
        uuid VARCHAR(45) UNIQUE,
        name VARCHAR(100) NOT NULL UNIQUE,
        query VARCHAR(255),
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
        uuid VARCHAR(45),
        skin VARCHAR(50) DEFAULT 'outline',
        time_range VARCHAR(50) DEFAULT 'week',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
      )
    `)

		// Create Stripe subscriptions table (detailed history)
		await connection.query(`
      CREATE TABLE IF NOT EXISTS stripe_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
        stripe_customer_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        canceled_at TIMESTAMP NULL,
        trial_start TIMESTAMP NULL,
        trial_end TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (stripe_customer_id),
        INDEX (status),
        INDEX (current_period_end),
        INDEX (user_id, status)
      )
    `)

		// Create Stripe subscription items table
		await connection.query(`
      CREATE TABLE IF NOT EXISTS stripe_subscription_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subscription_id INT NOT NULL,
        stripe_item_id VARCHAR(255) NOT NULL UNIQUE,
        stripe_price_id VARCHAR(255) NOT NULL,
        stripe_product_id VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_amount INT NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES stripe_subscriptions(id) ON DELETE CASCADE,
        INDEX (stripe_price_id),
        INDEX (stripe_product_id)
      )
    `)

		// Create Stripe invoices table
		await connection.query(`
      CREATE TABLE IF NOT EXISTS stripe_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
        stripe_subscription_id VARCHAR(255) NULL,
        amount_total INT NOT NULL,
        amount_paid INT NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        status VARCHAR(50) NOT NULL,
        invoice_pdf TEXT NULL,
        hosted_invoice_url TEXT NULL,
        payment_intent_id VARCHAR(255) NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        due_date TIMESTAMP NULL,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (stripe_subscription_id),
        INDEX (status),
        INDEX (period_end),
        INDEX (due_date),
        INDEX (user_id, status)
      )
    `)

		// Create Stripe events table (webhook log)
		await connection.query(`
      CREATE TABLE IF NOT EXISTS stripe_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
        event_type VARCHAR(100) NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (event_type),
        INDEX (processed),
        INDEX (created_at)
      )
    `)

		// Create Stripe payment methods table
		await connection.query(`
      CREATE TABLE IF NOT EXISTS stripe_payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
        stripe_customer_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'card',
        card_brand VARCHAR(20) NULL,
        card_last4 VARCHAR(4) NULL,
        card_exp_month INT NULL,
        card_exp_year INT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (stripe_customer_id),
        INDEX (is_default)
      )
    `)

		// Insert default widget types (updated to match actual structure)
		await connection.query(`
      INSERT IGNORE INTO widgets (uuid, name, query) VALUES 
      ('09e97548-341a-11f0-8053-da26b5a95d6d', 'ClockWidget', NULL),
      ('09e97b2a-341a-11f0-8053-da26b5a95d6d', 'TotalTime', 'getTotalTime'),
      ('09e97c1d-341a-11f0-8053-da26b5a95d6d', 'TotalTime1x2', 'getTotalTime'),
      ('09e97e0f-341a-11f0-8053-da26b5a95d6d', 'TodaysActivity1x2', 'getTodaysActivity'),
      ('09e980c0-341a-11f0-8053-da26b5a95d6d', 'MostActiveWeekday', 'getMostActiveWeekday'),
      ('09e9815a-341a-11f0-8053-da26b5a95d6d', 'Top3BarsChart', 'getTop3'),
      ('09e99a49-341a-11f0-8053-da26b5a95d6d', 'GoalProgressBar1x2', 'getGoalProgress'),
      ('09e99ac0-341a-11f0-8053-da26b5a95d6d', 'MaxFocusStreak', 'getMaxFocusStreak'),
      ('09e99b2a-341a-11f0-8053-da26b5a95d6d', 'GoalMosaic1x2', 'getGoalMosaic')
    `)

		console.log('MySQL tables created successfully')
		console.log('✅ Users table updated with Stripe fields')
		console.log('✅ Stripe subscriptions table created')
		console.log('✅ Stripe subscription items table created')
		console.log('✅ Stripe invoices table created')
		console.log('✅ Stripe events table created')
		console.log('✅ Stripe payment methods table created')
		console.log('✅ Widget data updated with actual UUIDs')
		
		connection.release()
	} catch (error) {
		console.error('Error creating MySQL tables:', error)
	} finally {
		await mysqlPool.end()
	}
}

initMysql()