-- migrate:up
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url VARCHAR(255),
    api_key VARCHAR(64) UNIQUE,
    api_key_created_at TIMESTAMP NULL,
    api_key_last_used_at TIMESTAMP NULL,
    api_key_last_used_ip VARCHAR(45) NULL,
    api_key_last_used_user_agent VARCHAR(255) NULL,
    api_key_usage_count INT DEFAULT 0,
    api_key_revoked_at TIMESTAMP NULL,
    api_key_revoked_reason VARCHAR(255) NULL,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_api_key (api_key),
    INDEX idx_api_key_last_used (api_key_last_used_at),
    INDEX idx_api_key_revoked (api_key_revoked_at),
    INDEX idx_api_key_created (api_key_created_at),
    INDEX idx_api_key_status (api_key, api_key_revoked_at)
);

-- migrate:down
DROP TABLE IF EXISTS users;
