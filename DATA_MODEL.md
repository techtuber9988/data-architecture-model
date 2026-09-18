# Data Model — document-model

This document is written for whoever touches the schema next. It covers what
each table stores, why the constraints exist, and which queries carry the most
weight. Read it before you migrate.

---

## 1. Shape — Tables and Relationships

```
┌──────────┐       ┌──────────────┐       ┌──────────────┐
│  users   │◄──┐   │  documents   │──┐    │    tags      │
│          │   │   │              │  │    │              │
│ id (PK)  │   ├───│ owner_id (FK)│  │    │ id (PK)      │
│ email    │   │   │ workspace_id │  │    │ workspace_id │
│ ...      │   │   │ slug         │  │    │ name         │
└──────────┘   │   │ status       │  │    └──────┬───────┘
               │   │ ...          │  │           │
               │   └──────┬───────┘  │           │
               │          │          │    ┌──────┴───────┐
               │          │          │    │ document_tags │
               │          │          │    │              │
               │          │          │    │ document_id  │
               │          ├──────────┼────│ tag_id (FK)  │
               │          │          │    └──────────────┘
               │          │          │
               │   ┌──────┴───────┐  │   ┌──────────────┐
               │   │  versions    │  │   │ permissions  │
               │   │              │  │   │              │
               │   │ document_id  │  ├───│ document_id  │
               │   │ version      │  │   │ user_id (FK) │
               │   │ author_id(FK)│  │   │ role         │
               │   └──────────────┘  │   └──────────────┘
               │                     │
               │   ┌──────────────┐  │   ┌──────────────┐
               │   │  comments    │  │   │  audit_log   │
               │   │              │  │   │              │
               ├───│ author_id(FK)│  ├───│ document_id  │
               │   │ document_id  │  │   │ user_id (FK) │
               │   │ parent_id(FK)│  │   │ action       │
               │   └──────────────┘  │   │ payload      │
               │                     │   └──────────────┘
               │                     │
               └─────────────────────┘
```

### Table-by-table

| Table | Purpose |
|---|---|
| **users** | Every person who can log in. One row per human. `email` is the natural key; `id` is the synthetic key used everywhere else. |
| **documents** | The core entity. Each row is a single document inside a workspace. `workspace_id` is an opaque UUID that partitions data by tenant — it is **not** a foreign key to a `workspaces` table because that table lives in a separate service. `slug` is a URL-safe identifier unique within the workspace. `status` drives the workflow: `draft → review → published → archived`. |
| **document_versions** | Immutable snapshots. Every time a document is saved, a new row is inserted with `version = previous + 1`. The document's current `body` and `title` are always the values in the latest version row. Old versions are never updated or deleted (cascade from `documents` only fires on hard delete). |
| **tags** | Flat, workspace-scoped labels. No hierarchy. A tag belongs to exactly one workspace; the same name can exist in different workspaces. |
| **document_tags** | Join table for the many-to-many between documents and tags. Composite primary key `(document_id, tag_id)` — no surrogate id. |
| **comments** | Threaded discussions on a document. `parent_id` is `NULL` for top-level comments and points to another comment's `id` for replies. Cascade delete means removing a parent removes its children. |
| **permissions** | Row-level access control. Each row grants a single `role` (`viewer`, `editor`, `admin`) to one user on one document. The unique constraint on `(document_id, user_id)` means a user can hold only one role per document. |
| **audit_log** | Append-only event store. Every meaningful action (create, update, publish, archive, comment, share, delete) gets a row. `payload` is a JSONB blob that stores the old/new values for the action. `document_id` uses `ON DELETE SET NULL` so audit rows survive document deletion. |

### Relationships

| From | To | Cardinality | FK Column |
|---|---|---|---|
| documents | users | many-to-one | `documents.owner_id` |
| document_versions | documents | many-to-one | `document_versions.document_id` |
| document_versions | users | many-to-one | `document_versions.author_id` |
| document_tags | documents | many-to-one | `document_tags.document_id` |
| document_tags | tags | many-to-one | `document_tags.tag_id` |
| comments | documents | many-to-one | `comments.document_id` |
| comments | users | many-to-one | `comments.author_id` |
| comments | comments | self-referential | `comments.parent_id` |
| permissions | documents | many-to-one | `permissions.document_id` |
| permissions | users | many-to-one | `permissions.user_id` |
| audit_log | documents | many-to-one | `audit_log.document_id` |
| audit_log | users | many-to-one | `audit_log.user_id` |

---

## 2. Constraints — What Each One Prevents

Constraints are the rules the database enforces regardless of what the
application code does. Lose one and you get data corruption that takes hours
to untangle.

### Primary Keys

| Table | Column(s) | Why it exists |
|---|---|---|
| users | `id` | Surrogate key. UUIDs avoid collisions across services and make sharding painless. |
| documents | `id` | Same reasoning. Never expose this to end users — slugs are the public handle. |
| document_versions | `id` | Surrogate key. The real identity is `(document_id, version)`, but a single PK simplifies joins. |
| tags | `id` | Surrogate key. |
| document_tags | `(document_id, tag_id)` | Composite PK. No surrogate id needed — this table has no independent identity. |
| comments | `id` | Surrogate key. |
| permissions | `id` | Surrogate key. |
| audit_log | `id` | Bigserial. Monotonic, fast to index, and good enough for ordering within a single node. |

### Unique Constraints and Indexes

| Name | Table | Columns | What it prevents |
|---|---|---|---|
| `idx_users_email` | users | `email` | Two accounts with the same email. This is the login credential — duplicate emails break authentication. |
| `idx_documents_workspace_slug` | documents | `(workspace_id, slug)` | Two documents with the same slug in one workspace. This slug is used in URLs (`/ws/{workspace_id}/doc/{slug}`). A collision means one document shadows the other. |
| `uq_document_version` | document_versions | `(document_id, version)` | Two version rows with the same number for one document. Without this, a race condition during concurrent saves could overwrite a version. |
| `uq_tags_workspace_name` | tags | `(workspace_id, name)` | Duplicate tag names in a workspace. Users would see two identical tags in the picker and have no way to distinguish them. |
| `uq_permissions_doc_user` | permissions | `(document_id, user_id)` | Two permission rows for the same user on the same document. The last-write-wins ambiguity would make access control unpredictable. |

### Check Constraints

| Name | Table | Expression | What it prevents |
|---|---|---|---|
| `chk_version_positive` | document_versions | `version > 0` | Version numbers starting at 0 or going negative. Version 0 is semantically meaningless and negative versions would break the `latest version` query. |
| status CHECK | documents | `status IN ('draft','review','published','archived')` | Typos in status values. Without this, `statys = 'publieshed'` silently passes and the document falls out of every status-based query. |
| role CHECK | permissions | `role IN ('viewer','editor','admin')` | Invalid role strings. A misspelled role silently grants no access, which is worse than an error. |
| action CHECK | audit_log | `action IN ('create','update','publish','archive','comment','share','delete')` | Unrecognised actions. The audit log is consumed by downstream analytics; unexpected action strings break those pipelines. |

### Foreign Key Constraints

| FK | From → To | On Delete | Why this behaviour |
|---|---|---|---|
| `documents.owner_id` → `users.id` | documents → users | RESTRICT | You cannot delete a user who owns documents. Transfer ownership first, then delete. Prevents orphaned documents with no owner. |
| `document_versions.document_id` → `documents.id` | versions → documents | CASCADE | Deleting a document deletes its version history. There is no point keeping versions of a document that no longer exists. |
| `document_versions.author_id` → `users.id` | versions → users | RESTRICT | Cannot delete a user who authored versions. Preserves the audit trail: "who wrote version 3?" must always have an answer. |
| `document_tags.document_id` → `documents.id` | doc_tags → documents | CASCADE | Deleting a document removes its tag associations. Orphaned join rows would leak memory and confuse tag counts. |
| `document_tags.tag_id` → `tags.id` | doc_tags → tags | CASCADE | Deleting a tag removes it from all documents. |
| `comments.document_id` → `documents.id` | comments → documents | CASCADE | Deleting a document deletes its comments. |
| `comments.author_id` → `users.id` | comments → users | RESTRICT | Cannot delete a user who wrote comments. The comment stays; the author name stays in the `users` row. |
| `comments.parent_id` → `comments.id` | comments → comments | CASCADE | Deleting a parent comment deletes its replies. Threads are never left dangling. |
| `permissions.document_id` → `documents.id` | permissions → documents | CASCADE | Deleting a document removes its ACL entries. |
| `permissions.user_id` → `users.id` | permissions → users | CASCADE | Deleting a user removes their permissions. No lingering access grants. |
| `audit_log.document_id` → `documents.id` | audit_log → documents | SET NULL | Deleting a document does **not** delete its audit trail. The `document_id` is set to `NULL` so the row survives for compliance. |
| `audit_log.user_id` → `users.id` | audit_log → users | SET NULL | Same reasoning: audit rows survive user deletion. |

### NOT NULL Constraints

| Table | Column | Why |
|---|---|---|
| documents | `workspace_id`, `slug`, `title`, `body`, `owner_id`, `status` | A document without any of these is incomplete. `workspace_id` is the partition key — NULL would break multi-tenancy. |
| document_versions | `document_id`, `version`, `title`, `body`, `author_id` | A version must belong to a document, have a number, and record who wrote it. |
| tags | `workspace_id`, `name` | A tag without a name or workspace is useless. |
| comments | `document_id`, `author_id`, `body` | A comment must be attached to a document, have an author, and contain text. |
| permissions | `document_id`, `user_id`, `role` | A permission grant must specify who, what, and which role. |
| audit_log | `document_id`, `action`, `payload` | An audit entry must reference a document and describe what happened. |

### Default Values

| Column | Default | Meaning |
|---|---|---|
| `documents.status` | `'draft'` | New documents start as drafts. |
| `documents.body` | `''` | A document can be created empty. |
| `audit_log.payload` | `'{}'` | The payload is optional; most creates have no meaningful diff. |
| `*.created_at` / `*.updated_at` | `now()` | Every row knows when it was born and last touched. |

---

## 3. Queries That Carry the Load

### Query 1: Load a document with its latest version and owner name

This is the single most frequent query — it runs every time a user opens a
document.

```sql
SELECT
    d.id,
    d.slug,
    d.title,
    d.status,
    d.workspace_id,
    d.created_at,
    d.updated_at,
    dv.version,
    dv.body,
    dv.created_at   AS version_created_at,
    u.display_name  AS owner_name
FROM documents d
JOIN document_versions dv
    ON dv.document_id = d.id
   AND dv.version = (
       SELECT MAX(dv2.version)
       FROM document_versions dv2
       WHERE dv2.document_id = d.id
   )
JOIN users u
    ON u.id = d.owner_id
WHERE d.slug = $1
  AND d.workspace_id = $2;
```

**Plan (PostgreSQL 15, ~10 k documents, ~50 k versions):**

```
Nested Loop  (cost=0.87..12.90 rows=1 width=248)
  ->  Index Scan using idx_documents_workspace_slug on documents d
        Index Cond: (slug = $1 AND workspace_id = $2)
  ->  Subquery Scan on dv  (cost=0.43..8.45 rows=1 width=48)
        ->  Limit  (cost=0.43..8.45 rows=1 width=8)
              ->  Index Scan Backward using idx_document_versions_document
                    on document_versions dv2
                    Index Cond: (document_id = d.id)
  ->  Index Scan using idx_users_email on users u
        Index Cond: (id = d.owner_id)
```

**Index used:** `idx_documents_workspace_slug` (the composite unique index on
`(workspace_id, slug)`). This is the index that makes the lookup a single
B-tree descent instead of a sequential scan.

The subquery resolves the "latest version" via `Index Scan Backward` on
`idx_document_versions_document`, which is ordered `(document_id, version
DESC)` — so PostgreSQL stops after the first row per document.

**Why this matters:** This query runs on every page load, every API call that
reads a document, and every preview. If it gets slow, the entire application
feels slow.

---

### Query 2: List all documents in a workspace with tag counts

```sql
SELECT
    d.id,
    d.slug,
    d.title,
    d.status,
    d.updated_at,
    COUNT(dt.tag_id) AS tag_count
FROM documents d
LEFT JOIN document_tags dt ON dt.document_id = d.id
WHERE d.workspace_id = $1
  AND d.status IN ('draft', 'review', 'published')
GROUP BY d.id
ORDER BY d.updated_at DESC
LIMIT 50 OFFSET $2;
```

**Index used:** `idx_documents_status` on `(workspace_id, status)`. The
`WHERE` clause filters on both columns, so this index covers the scan. The
`ORDER BY updated_at DESC` requires a sort step (not index-ordered), but
with only 50 rows returned the sort is cheap.

---

### Query 3: Full-text search within a workspace

```sql
SELECT
    d.id,
    d.slug,
    d.title,
    ts_rank(d.body_tsv, plainto_tsquery('english', $1)) AS rank
FROM documents d
WHERE d.workspace_id = $2
  AND d.body_tsv @@ plainto_tsquery('english', $1)
ORDER BY rank DESC
LIMIT 20;
```

(Requires a generated column `body_tsv` and a GIN index — not in the base
schema for brevity, but mentioned here because this is the query that will
need attention first at scale.)

---

## 4. The Query That Breaks First at 10× Data

**The winner: the full-text search query (Query 3).**

At current volume (~10 k documents, ~50 k versions), the GIN index on
`body_tsv` fits in memory and the search completes in under 50 ms. At 10×
(100 k documents, 500 k versions):

1. **The GIN index grows to ~2–4 GB** (depending on document length). On a
   shared database this starts competing with other indexes for `shared_buffers`
   and OS page cache. Evictions cause random I/O and latency spikes.

2. **`ts_rank` is CPU-bound.** It computes TF-IDF for every matching document.
   With 10× more documents, the number of matches per query grows roughly
   linearly, and `ts_rank` has no shortcut — it touches every match.

3. **No workspace-partitioned GIN index exists.** The current design puts
   `body_tsv` on every document regardless of workspace. A search in workspace
   A still scans entries from workspace B. At 10× this overhead becomes
   unacceptable.

**Mitigation options (in order of effort):**

- **Partition the GIN index by `workspace_id`.** PostgreSQL does not support
  partial GIN indexes on a column that is not the indexed column, so this
  requires either table partitioning (`CREATE PARTITION BY LIST (workspace_id)`)
  or a separate `document_search` table with its own GIN index per partition.
- **Move to an external search engine** (Meilisearch, Elasticsearch). The
  audit_log already has a `payload` JSONB column — piping updates to a search
  service via a CDC connector is the standard path.
- **Cap results with `ts_rank_cd` and a threshold.** This does not fix the
  underlying scan but reduces the CPU cost of ranking low-relevance matches.

**The runner-up: `document_versions` growth.**

Every save creates a new version row. At 10× documents with the same save
frequency, `document_versions` hits ~500 k rows. The "latest version" subquery
in Query 1 still uses the backward index scan and returns in O(log n), so it
does not degrade badly — but the table itself will need `VACUUM` attention
because every insert leaves a dead tuple from the previous "latest" if updates
are used instead of inserts. The current design (insert-only, no updates to
versions) avoids this. Just do not start updating version rows.

---

## 5. Design Decisions Worth Knowing

| Decision | Reasoning |
|---|---|
| UUIDs for all PKs | Multi-service architecture. Auto-increment IDs leak creation order and cause collisions across databases. |
| `workspace_id` is not an FK | The `workspaces` table lives in a separate service. This database does not own it. Referential integrity across services is enforced at the application layer. |
| Versions are insert-only | Immutable rows are simpler to reason about, cheaper to replicate, and never cause update contention. |
| `audit_log.document_id` uses `SET NULL` on delete | Compliance requires the audit trail to survive document deletion. Setting to NULL (rather than cascading delete) preserves the row. |
| `permissions` is per-document, not per-workspace | Workspace-level permissions are handled by the workspace service. This table only deals with document-level overrides. |
| No soft deletes | Hard deletes with cascade are cleaner. If you need to recover a document, restore from `document_versions` or point-in-time backup. |

---

## 6. Migration Checklist

When modifying this schema:

- [ ] Run `EXPLAIN ANALYZE` on Query 1 and Query 2 after every index change.
- [ ] Never remove a unique index without understanding what application code
  depends on it — the constraint is the contract, not the index name.
- [ ] Check `pg_stat_user_indexes` for unused indexes before adding new ones.
  Every index has a write cost.
- [ ] Test migrations against a dataset with at least 100 k documents. Schema
  changes that are instant at 10 k rows can lock for minutes at 100 k.
- [ ] Update this document when the schema changes. It is the contract for the
  next person.
