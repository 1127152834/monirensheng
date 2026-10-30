// Business-owned schema. Never query Twenty internal tables for authorization.
export const FOUNDATION_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS foundation_customers (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, display_name text NOT NULL,
 owner_user_id uuid NOT NULL, owner_version integer NOT NULL DEFAULT 1 CHECK(owner_version>0),
 revision bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS foundation_events (
 id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES foundation_customers(id),
 workspace_id uuid NOT NULL, actor_user_id uuid NOT NULL, action text NOT NULL,
 owner_version integer NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS foundation_outbox (
 id uuid PRIMARY KEY REFERENCES foundation_events(id), customer_id uuid NOT NULL REFERENCES foundation_customers(id),
 delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0, last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);`;
