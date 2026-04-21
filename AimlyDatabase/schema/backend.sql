-- =============================================================================
-- AimlyDatabase/schema/backend.sql
-- Backend database schema — run once during `make setup`
-- Database: aimly_backend
-- =============================================================================

-- ------------------------------------------------------------------
-- Users
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                        INT AUTO_INCREMENT PRIMARY KEY,
    username                  VARCHAR(255) UNIQUE NOT NULL,
    password_hash             TEXT,
    user_email                VARCHAR(255) UNIQUE NOT NULL,
    google_id                 VARCHAR(255),
    company_addition_active   INT DEFAULT 0,
    company_addition_metadata TEXT,
    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Brands
-- Replaces user_keys SMTP fields + global/campaign identity fields
-- (business_name, business_info, logo, signature) into one reusable entity.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    business_name  VARCHAR(255),
    business_info  TEXT,
    logo           LONGBLOB,
    logo_mime_type VARCHAR(100),
    smtp_host      VARCHAR(255),
    smtp_port      INT,
    email_address  VARCHAR(255),
    email_password TEXT,           -- AES encrypted with SMTP_ENCRYPTION_KEY
    signature      TEXT,
    is_default     TINYINT(1) DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Global Settings
-- Removed: business_name, business_info, logo, logo_mime_type, signature
-- Renamed: email_instruction → writing_guidelines, extras → additional_notes
-- Added:   llm_model
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS global_settings (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    user_id            INT NOT NULL UNIQUE,
    bcc                TEXT,
    goal               TEXT,
    value_prop         TEXT,
    tone               VARCHAR(100) DEFAULT 'Professional',
    cta                TEXT,
    writing_guidelines TEXT,
    additional_notes   TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Companies
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    name         VARCHAR(255) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    phone_number VARCHAR(100),
    address      TEXT,
    company_info TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_email (user_id, email),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Campaigns
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Campaign-Company Join
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_company (
    id                           INT AUTO_INCREMENT PRIMARY KEY,
    company_id                   INT NOT NULL,
    campaign_id                  INT NOT NULL,
    inherit_campaign_attachments INT DEFAULT 1,
    inherit_campaign_branding    INT DEFAULT 1,
    created_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_campaign (company_id, campaign_id),
    FOREIGN KEY (company_id)  REFERENCES companies (id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Emails
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emails (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    campaign_company_id  INT NOT NULL,
    email_subject        TEXT,
    email_content        TEXT NOT NULL,
    signature            TEXT,
    logo                 LONGBLOB,
    logo_mime_type       VARCHAR(100),
    recipient_email      VARCHAR(255),
    status               VARCHAR(50) DEFAULT 'primary',
    timezone             VARCHAR(100) DEFAULT 'UTC',
    sent_at              DATETIME,
    read_at              DATETIME,
    html_email           INT DEFAULT 0,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_company_id) REFERENCES campaign_company (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Campaign Preferences
-- Removed: business_name, business_info, logo, logo_mime_type, signature
-- Renamed: email_instruction → writing_guidelines, extras → additional_notes
-- Added:   brand_id (FK → brands, nullable, ON DELETE SET NULL)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_preferences (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id                INT NOT NULL UNIQUE,
    brand_id                   INT NULL,
    bcc                        TEXT,
    goal                       TEXT,
    value_prop                 TEXT,
    tone                       VARCHAR(100) DEFAULT 'Professional',
    cta                        TEXT,
    writing_guidelines         TEXT,
    additional_notes           TEXT,
    template_email             TEXT,
    template_html_email        INT DEFAULT 0,
    inherit_global_settings    INT DEFAULT 1,
    inherit_global_attachments INT DEFAULT 1,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
    FOREIGN KEY (brand_id)    REFERENCES brands    (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Attachments
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    user_id    INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_name (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Email-Attachment Junction
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_attachments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    email_id      INT NOT NULL,
    attachment_id INT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_email_attachment (email_id, attachment_id),
    FOREIGN KEY (email_id)      REFERENCES emails      (id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Failed Emails
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS failed_emails (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    email_id   INT NOT NULL,
    reason     TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Campaign Preference-Attachment Junction
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_preference_attachments (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    campaign_preference_id INT NOT NULL,
    attachment_id          INT NOT NULL,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pref_attachment (campaign_preference_id, attachment_id),
    FOREIGN KEY (campaign_preference_id) REFERENCES campaign_preferences (id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id)          REFERENCES attachments           (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Global Settings-Attachment Junction
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS global_settings_attachments (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    global_settings_id INT NOT NULL,
    attachment_id      INT NOT NULL,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_settings_attachment (global_settings_id, attachment_id),
    FOREIGN KEY (global_settings_id) REFERENCES global_settings (id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id)      REFERENCES attachments      (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    name       VARCHAR(255) NOT NULL,
    detail     TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_category (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Category-Company Junction
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category_company (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    company_id  INT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_category_company (category_id, company_id),
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
    FOREIGN KEY (company_id)  REFERENCES companies  (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Subscriptions
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL UNIQUE,
    paddle_subscription_id  VARCHAR(255),
    paddle_customer_id      VARCHAR(255),
    status                  ENUM('trialing','active','past_due','paused','canceled','inactive')
                            DEFAULT 'inactive',
    price_id                VARCHAR(255),
    next_billed_at          DATETIME,
    current_period_ends_at  DATETIME,
    scheduled_change        JSON,
    special_access          TINYINT(1) DEFAULT 0,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;