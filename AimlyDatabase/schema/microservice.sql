-- =============================================================================
-- AimlyDatabase/schema/microservice.sql
-- Microservice database schema — run once during `make init-db`
-- Database: aimly_microservice
-- =============================================================================

-- ------------------------------------------------------------------
-- Read Receipts
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_reads (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    email_id   INT NOT NULL UNIQUE,
    read_at    TIMESTAMP NULL DEFAULT NULL,
    processed  TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_reads_processed (processed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------
-- Opt-Outs / Unsubscribes
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_optouts (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    sender_email   VARCHAR(255) NOT NULL,
    receiver_email VARCHAR(255) NOT NULL,
    opted_out_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_optout (sender_email, receiver_email),
    INDEX idx_email_optouts_lookup (sender_email, receiver_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;