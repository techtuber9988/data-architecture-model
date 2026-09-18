-- document-model: Database Schema
-- PostgreSQL 15+

BEGIN;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL,
    display_name  TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email ON users (email);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID        NOT NULL,
    slug          TEXT        NOT NULL,
    title         TEXT        NOT NULL,
    body          TEXT        NOT NULL DEFAULT '',
    owner_id      UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'review', 'published', 'archived')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_documents_workspace_slug
    ON documents (workspace_id, slug);

CREATE INDEX idx_documents_owner
    ON documents (owner_id);

CREATE INDEX idx_documents_status
    ON documents (workspace_id, status);

-- ============================================================
-- DOCUMENT VERSIONS
-- ============================================================
CREATE TABLE document_versions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version       INT         NOT NULL,
    title         TEXT        NOT NULL,
    body          TEXT        NOT NULL DEFAULT '',
    author_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_document_version
        UNIQUE (document_id, version),

    CONSTRAINT chk_version_positive
        CHECK (version > 0)
);

CREATE INDEX idx_document_versions_document
    ON document_versions (document_id, version DESC);

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE tags (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID        NOT NULL,
    name          TEXT        NOT NULL,

    CONSTRAINT uq_tags_workspace_name
        UNIQUE (workspace_id, name)
);

-- ============================================================
-- DOCUMENT TAGS  (many-to-many)
-- ============================================================
CREATE TABLE document_tags (
    document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id        UUID NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,

    PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX idx_document_tags_tag
    ON document_tags (tag_id);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE comments (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    author_id     UUID        NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,
    parent_id     UUID        REFERENCES comments(id)           ON DELETE CASCADE,
    body          TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_document
    ON comments (document_id, created_at);

CREATE INDEX idx_comments_parent
    ON comments (parent_id)
    WHERE parent_id IS NOT NULL;

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE permissions (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id       UUID    NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    role          TEXT    NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),

    CONSTRAINT uq_permissions_doc_user
        UNIQUE (document_id, user_id)
);

CREATE INDEX idx_permissions_user
    ON permissions (user_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
    id            BIGSERIAL   PRIMARY KEY,
    document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE SET NULL,
    user_id       UUID        REFERENCES users(id)              ON DELETE SET NULL,
    action        TEXT        NOT NULL CHECK (action IN (
                        'create', 'update', 'publish',
                        'archive', 'comment', 'share', 'delete'
                    )),
    payload       JSONB       NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_document
    ON audit_log (document_id, created_at DESC);

CREATE INDEX idx_audit_log_user
    ON audit_log (user_id, created_at DESC);

-- ============================================================
-- HELPER: auto-touch updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

COMMIT;
