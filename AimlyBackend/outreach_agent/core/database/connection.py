"""
Connection Module - Database connection and table creation
Database: MySQL via pymysql
"""

import os
import pymysql
import pymysql.cursors


def get_connection() -> pymysql.connections.Connection:
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "mysql"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("BACKEND_DB_USER", "aimly_backend"),
        password=os.getenv("BACKEND_DB_PASSWORD"),
        database=os.getenv("DB_NAME", "aimly_backend"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=30,
    )
    return conn


def create_tables() -> None:
    with get_connection() as conn:
        with conn.cursor() as cursor:

            # ------------------------------------------------------------------
            # Users
            # ------------------------------------------------------------------
            cursor.execute("""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # User Keys
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_keys (
                    id             INT AUTO_INCREMENT PRIMARY KEY,
                    user_id        INT NOT NULL UNIQUE,
                    llm_model      VARCHAR(255),
                    smtp_host      VARCHAR(255),
                    smtp_port      INT,
                    email_address  VARCHAR(255),
                    email_password TEXT,
                    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Global Settings
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS global_settings (
                    id                 INT AUTO_INCREMENT PRIMARY KEY,
                    user_id            INT NOT NULL UNIQUE,
                    bcc                TEXT,
                    business_name      VARCHAR(255),
                    business_info      TEXT,
                    goal               TEXT,
                    value_prop         TEXT,
                    tone               VARCHAR(100) DEFAULT 'Professional',
                    cta                TEXT,
                    extras             TEXT,
                    email_instruction  TEXT,
                    signature          TEXT,
                    logo               LONGBLOB,
                    logo_mime_type     VARCHAR(100),
                    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Companies
            # ------------------------------------------------------------------
            cursor.execute("""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Campaigns
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS campaigns (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    user_id    INT NOT NULL,
                    name       VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Campaign-Company Join
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS campaign_company (
                    id                           INT AUTO_INCREMENT PRIMARY KEY,
                    company_id                   INT NOT NULL,
                    campaign_id                  INT NOT NULL,
                    inherit_campaign_attachments INT DEFAULT 1,
                    inherit_campaign_branding    INT DEFAULT 1,
                    created_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_company_campaign (company_id, campaign_id),
                    FOREIGN KEY (company_id)  REFERENCES companies (id)  ON DELETE CASCADE,
                    FOREIGN KEY (campaign_id) REFERENCES campaigns (id)  ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Emails
            # ------------------------------------------------------------------
            cursor.execute("""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Campaign Preferences
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS campaign_preferences (
                    id                         INT AUTO_INCREMENT PRIMARY KEY,
                    campaign_id                INT NOT NULL UNIQUE,
                    bcc                        TEXT,
                    business_name              VARCHAR(255),
                    business_info              TEXT,
                    goal                       TEXT,
                    value_prop                 TEXT,
                    tone                       VARCHAR(100) DEFAULT 'Professional',
                    cta                        TEXT,
                    extras                     TEXT,
                    email_instruction          TEXT,
                    signature                  TEXT,
                    logo                       LONGBLOB,
                    logo_mime_type             VARCHAR(100),
                    template_email             TEXT,
                    template_html_email        INT DEFAULT 0,
                    inherit_global_settings    INT DEFAULT 1,
                    inherit_global_attachments INT DEFAULT 1,
                    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Attachments
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS attachments (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    name       VARCHAR(255) NOT NULL,
                    user_id    INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_user_name (user_id, name),
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Email-Attachment Junction
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS email_attachments (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    email_id      INT NOT NULL,
                    attachment_id INT NOT NULL,
                    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_email_attachment (email_id, attachment_id),
                    FOREIGN KEY (email_id)      REFERENCES emails      (id) ON DELETE CASCADE,
                    FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Failed Emails
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS failed_emails (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    email_id   INT NOT NULL,
                    reason     TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Campaign Preference-Attachment Junction
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS campaign_preference_attachments (
                    id                     INT AUTO_INCREMENT PRIMARY KEY,
                    campaign_preference_id INT NOT NULL,
                    attachment_id          INT NOT NULL,
                    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_pref_attachment (campaign_preference_id, attachment_id),
                    FOREIGN KEY (campaign_preference_id) REFERENCES campaign_preferences (id) ON DELETE CASCADE,
                    FOREIGN KEY (attachment_id)          REFERENCES attachments           (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Global Settings-Attachment Junction
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS global_settings_attachments (
                    id                 INT AUTO_INCREMENT PRIMARY KEY,
                    global_settings_id INT NOT NULL,
                    attachment_id      INT NOT NULL,
                    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_settings_attachment (global_settings_id, attachment_id),
                    FOREIGN KEY (global_settings_id) REFERENCES global_settings (id) ON DELETE CASCADE,
                    FOREIGN KEY (attachment_id)      REFERENCES attachments      (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Categories
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    user_id    INT NOT NULL,
                    name       VARCHAR(255) NOT NULL,
                    detail     TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_user_category (user_id, name),
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ------------------------------------------------------------------
            # Category-Company Junction
            # ------------------------------------------------------------------
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS category_company (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    category_id INT NOT NULL,
                    company_id  INT NOT NULL,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_category_company (category_id, company_id),
                    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
                    FOREIGN KEY (company_id)  REFERENCES companies  (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

        conn.commit()
    print("✅ Tables created")


# ----------------------------------------------------------------------
# Startup reset
# ----------------------------------------------------------------------
def reset_company_addition_flags() -> None:
    """
    Called once on server startup to recover from any crashed addition jobs.

    Rules:
      - company_addition_active = -1  → crashed JSON/CSV job → reset to 0, clear metadata
      - company_addition_active > 0 AND metadata IS NULL  → broken AI job → reset to 0
      - company_addition_active > 0 AND metadata IS NOT NULL  → valid AI job → leave for scheduler
    """
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE users
                SET company_addition_active = 0,
                    company_addition_metadata = NULL
                WHERE company_addition_active = -1
            """)
            cursor.execute("""
                UPDATE users
                SET company_addition_active = 0
                WHERE company_addition_active > 0
                  AND (company_addition_metadata IS NULL OR company_addition_metadata = '')
            """)
        conn.commit()

    print("✅ Company addition flags reset on startup")


# ----------------------------------------------------------------------
# Bootstrap sequence (runs on import)
# ----------------------------------------------------------------------
create_tables()