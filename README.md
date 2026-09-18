# document-model

PostgreSQL schema for a multi-tenant document management system. Handles
versioning, tagging, comments, permissions, and audit logging.

## Prerequisites

- PostgreSQL 15 or later
- `psql` CLI (or any SQL client)

## Quick Start

```bash
# 1. Create the database
createdb document_model

# 2. Apply the schema
psql -d document_model -f schema.sql

# 3. Verify tables were created
psql -d document_model -c "\dt"
```

## Running Tests

There is no test suite in this repository — the schema itself is the deliverable.
To validate it against a real instance:

```bash
psql -d document_model -f schema.sql   # should complete without errors
psql -d document_model -c "\d+"        # inspect all tables and indexes
```

## Project Structure

```
document-model/
├── schema.sql        # Full database schema (PostgreSQL 15+)
├── DATA_MODEL.md     # Data model documentation (tables, constraints, queries)
└── README.md         # This file
```

## Schema Overview

| Table | Purpose |
|---|---|
| `users` | System users (email, display name) |
| `documents` | Core document records, workspace-partitioned |
| `document_versions` | Immutable version history per document |
| `tags` | Workspace-scoped labels |
| `document_tags` | Many-to-many join between documents and tags |
| `comments` | Threaded comments on documents |
| `permissions` | Per-document access control (viewer/editor/admin) |
| `audit_log` | Append-only event store for all mutations |

See [DATA_MODEL.md](DATA_MODEL.md) for the full writeup covering relationships,
constraints, query plans, and scaling notes.

## Common Operations

```sql
-- Create a document with a version
INSERT INTO users (id, email, display_name)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'alice@example.com', 'Alice');

INSERT INTO documents (id, workspace_id, slug, title, owner_id)
VALUES ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        'getting-started',
        'Getting Started',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

INSERT INTO document_versions (document_id, version, title, body, author_id)
VALUES ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 1, 'Getting Started',
        'Welcome to the document system.',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- Load a document (the query that runs most often)
SELECT d.*, dv.version, dv.body
FROM documents d
JOIN document_versions dv
  ON dv.document_id = d.id
 AND dv.version = (SELECT MAX(version) FROM document_versions WHERE document_id = d.id)
WHERE d.slug = 'getting-started'
  AND d.workspace_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
```

## Scaling Notes

- The full-text search query is the first to degrade at scale. See
  [DATA_MODEL.md §4](DATA_MODEL.md#4-the-query-that-breaks-first-at-10-data)
  for mitigation options.
- `document_versions` is insert-only by design. Do not update version rows.
- `audit_log` uses `ON DELETE SET NULL` for `document_id` — audit rows survive
  document deletion.
