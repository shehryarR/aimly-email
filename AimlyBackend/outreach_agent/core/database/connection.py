"""
Connection Module - Database connection, table creation, and pragma configuration
UPDATED: Removed user_sessions table - Using JWT authentication instead
        Renamed company_campaigns -> campaign_company
        Renamed user_information -> user_keys
        ADDED: attachments table for managing uploaded files
        ADDED: junction tables for email, campaign_preference, and global_settings attachments
        REMOVED: attachment_path columns from campaign_preferences and global_settings
        CHANGED: logo_path to logo BLOB in global_settings and campaign_preferences
        ADDED: template_email field to campaign_preferences for reusable email templates
        ADDED: categories table for grouping companies
        ADDED: category_company junction table (many-to-many: categories <-> companies)
        ADDED: company_addition_metadata to users for crash-safe AI company discovery jobs
"""

import sqlite3
import json
import os
from pathlib import Path

DATABASE_NAME = os.getenv("DB_PATH", "./data/outreach.db")


def load_env_json():
    """Injects env.json into the system environment if it exists."""
    env_path = Path(__file__).parent.parent.parent.parent / "env.json"
    print(f"Env Path {env_path}")
    if env_path.exists():
        try:
            with open(env_path) as f:
                env_data = json.load(f)
                for key, value in env_data.items():
                    os.environ.setdefault(key, str(value))
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load env.json: {e}")


def get_connection() -> sqlite3.Connection:
    db_path = Path(DATABASE_NAME)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DATABASE_NAME, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA foreign_keys = ON")
    
    # Increase maximum BLOB size to 5MB (default is 1GB, but we're being explicit)
    conn.execute("PRAGMA max_page_count = 1000000")  # Allows for larger BLOBs

    return conn


def create_tables() -> None:
    with get_connection() as conn:
        cursor = conn.cursor()

        # ------------------------------------------------------------------
        # Users
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                username       TEXT UNIQUE NOT NULL,
                password_hash  TEXT,
                user_email     TEXT UNIQUE NOT NULL,
                google_id      TEXT,
                company_addition_active  INTEGER DEFAULT 0,
                company_addition_metadata TEXT,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migrate existing users table if company_addition_metadata column doesn't exist
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN company_addition_metadata TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Migrate existing users table if google_id column doesn't exist
        # NOTE: SQLite does not support ADD COLUMN ... UNIQUE directly
        # We add the column first, then create a unique index separately
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN google_id TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Create unique index on google_id if it doesn't exist
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
            ON users (google_id)
            WHERE google_id IS NOT NULL
        """)

        # Migrate users table: make password_hash nullable (required for Google OAuth users)
        # SQLite doesn't support ALTER COLUMN, so we check PRAGMA table_info and rebuild if needed
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        pwd_col = next((c for c in columns if c[1] == 'password_hash'), None)
        if pwd_col and pwd_col[3] == 1:  # notnull == 1 means NOT NULL constraint is set
            print("Migrating users table: removing NOT NULL from password_hash for Google OAuth support...")
            cursor.executescript("""
                PRAGMA foreign_keys = OFF;

                CREATE TABLE users_new (
                    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
                    username                  TEXT UNIQUE NOT NULL,
                    password_hash             TEXT,
                    user_email                TEXT UNIQUE NOT NULL,
                    google_id                 TEXT,
                    company_addition_active   INTEGER DEFAULT 0,
                    company_addition_metadata TEXT,
                    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                INSERT INTO users_new
                    SELECT id, username, password_hash, user_email,
                           google_id, company_addition_active,
                           company_addition_metadata, created_at
                    FROM users;

                DROP TABLE users;

                ALTER TABLE users_new RENAME TO users;

                CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
                    ON users (google_id)
                    WHERE google_id IS NOT NULL;

                PRAGMA foreign_keys = ON;
            """)
            print("✅ users table migrated successfully")

        # Migrate existing emails table if html_email column doesn't exist
        try:
            cursor.execute("ALTER TABLE emails ADD COLUMN html_email INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Migrate existing campaign_preferences table if template_html_email column doesn't exist
        try:
            cursor.execute("ALTER TABLE campaign_preferences ADD COLUMN template_html_email INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # ------------------------------------------------------------------
        # User Keys (renamed from user_information)
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_keys (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        INTEGER NOT NULL UNIQUE,

                llm_model      TEXT,
                smtp_host      TEXT,
                smtp_port      INTEGER,
                email_address  TEXT,
                email_password TEXT,

                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (user_id)
                    REFERENCES users (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Global Settings
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS global_settings (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id            INTEGER NOT NULL UNIQUE,

                bcc                TEXT,
                business_name      TEXT,
                business_info      TEXT,

                goal               TEXT,
                value_prop         TEXT,
                tone               TEXT DEFAULT 'Professional',
                cta                TEXT,
                extras             TEXT,
                email_instruction  TEXT,

                signature          TEXT,
                logo               BLOB,        -- Stores logo image data (up to 5MB)
                logo_mime_type     TEXT,        -- Stores MIME type (image/png, image/jpeg, etc.)
                created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (user_id)
                    REFERENCES users (id)
                    ON DELETE CASCADE
            )
        """)

        # -- ------------------------------------------------------------------
        # -- Companies
        # -- ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      INTEGER NOT NULL,
                name         TEXT NOT NULL,
                email        TEXT NOT NULL,  -- Removed UNIQUE constraint
                phone_number TEXT,
                address      TEXT,
                company_info TEXT,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, email),  -- Added composite unique constraint
                FOREIGN KEY (user_id)
                    REFERENCES users (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Campaigns
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id           INTEGER NOT NULL,
                name              TEXT NOT NULL,
                created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id)
                    REFERENCES users (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Campaign-Company Join (Renamed table)
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS campaign_company (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id  INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                inherit_campaign_attachments INTEGER DEFAULT 1,
                inherit_campaign_branding INTEGER DEFAULT 1,
                UNIQUE (company_id, campaign_id),
                FOREIGN KEY (company_id)
                    REFERENCES companies (id)
                    ON DELETE CASCADE,
                FOREIGN KEY (campaign_id)
                    REFERENCES campaigns (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Emails
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emails (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_company_id  INTEGER NOT NULL,
                email_subject       TEXT,
                email_content       TEXT NOT NULL,
                signature          TEXT,
                logo               BLOB,        -- Stores logo image data (up to 5MB)
                logo_mime_type     TEXT,        -- Stores MIME type (image/png, image/jpeg, etc.)
                recipient_email     TEXT,
                status              TEXT DEFAULT 'primary', -- Can be 'primary', 'sent', 'scheduled', 'failed', 'draft'. Each campaign_company will always have exactly one primary email; others can exist freely.
                timezone            TEXT DEFAULT 'UTC',
                sent_at             DATETIME,
                read_at             DATETIME,
                html_email          INTEGER DEFAULT 0,   -- 1 = LLM-generated HTML email, 0 = plain text email

                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_company_id)
                    REFERENCES campaign_company (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Campaign Preferences 
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS campaign_preferences (
                id                       INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id              INTEGER NOT NULL UNIQUE,

                bcc                      TEXT,

                business_name            TEXT,
                business_info            TEXT,

                goal                     TEXT,
                value_prop               TEXT,
                tone                     TEXT DEFAULT 'Professional',
                cta                      TEXT,
                extras                   TEXT,
                email_instruction        TEXT,

                signature                TEXT,
                logo                     BLOB,        -- Stores logo image data (up to 5MB)
                logo_mime_type           TEXT,        -- Stores MIME type (image/png, image/jpeg, etc.)
                
                template_email            TEXT,        -- Reusable email template with placeholders like {{company_name}}
                template_html_email      INTEGER DEFAULT 0,  -- 1 = template is HTML, 0 = template is plain text
                inherit_global_settings  INTEGER DEFAULT 1,
                inherit_global_attachments INTEGER DEFAULT 1,

                created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (campaign_id)
                    REFERENCES campaigns (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Attachments - Base table for managing uploaded files
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attachments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,  -- Original filename
                user_id     INTEGER NOT NULL,  -- Owner of the attachment
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name),  -- Each user can have unique filenames
                FOREIGN KEY (user_id)
                    REFERENCES users (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Email-Attachment Junction Table
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_attachments (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id       INTEGER NOT NULL,
                attachment_id  INTEGER NOT NULL,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(email_id, attachment_id),
                FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
                FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Failed Emails — reason log for every status = 'failed' write
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS failed_emails (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id   INTEGER NOT NULL,
                reason     TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (email_id)
                    REFERENCES emails (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Campaign Preference-Attachment Junction Table
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS campaign_preference_attachments (
                id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_preference_id  INTEGER NOT NULL,
                attachment_id           INTEGER NOT NULL,
                created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(campaign_preference_id, attachment_id),
                FOREIGN KEY (campaign_preference_id) REFERENCES campaign_preferences(id) ON DELETE CASCADE,
                FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Global Settings-Attachment Junction Table
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS global_settings_attachments (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                global_settings_id  INTEGER NOT NULL,
                attachment_id       INTEGER NOT NULL,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(global_settings_id, attachment_id),
                FOREIGN KEY (global_settings_id) REFERENCES global_settings(id) ON DELETE CASCADE,
                FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
            )
        """)


        # ------------------------------------------------------------------
        # Categories
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                name        TEXT NOT NULL,
                detail      TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name),
                FOREIGN KEY (user_id)
                    REFERENCES users (id)
                    ON DELETE CASCADE
            )
        """)

        # ------------------------------------------------------------------
        # Category-Company Junction (many-to-many)
        # ------------------------------------------------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS category_company (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER NOT NULL,
                company_id  INTEGER NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category_id, company_id),
                FOREIGN KEY (category_id)
                    REFERENCES categories (id)
                    ON DELETE CASCADE,
                FOREIGN KEY (company_id)
                    REFERENCES companies (id)
                    ON DELETE CASCADE
            )
        """)

        conn.commit()


# ----------------------------------------------------------------------
# Startup reset — call this once on app startup before schedulers start
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
        # Reset crashed JSON/CSV jobs (-1 → 0)
        conn.execute("""
            UPDATE users
            SET company_addition_active = 0,
                company_addition_metadata = NULL
            WHERE company_addition_active = -1
        """)

        # Reset broken AI jobs (> 0 but no metadata)
        conn.execute("""
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