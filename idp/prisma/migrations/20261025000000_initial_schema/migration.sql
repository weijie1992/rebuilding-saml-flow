-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("user_id","group_id")
);

-- CreateTable
CREATE TABLE "service_providers" (
    "entity_id" TEXT NOT NULL,
    "acs_url" TEXT NOT NULL,
    "slo_url" TEXT,
    "name_id_format" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("entity_id")
);

-- CreateTable
CREATE TABLE "sso_sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "authn_instant" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sso_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sp_session_index" (
    "session_index" TEXT NOT NULL,
    "sso_session_id" TEXT NOT NULL,
    "sp_entity_id" TEXT NOT NULL,
    "name_id" TEXT NOT NULL,

    CONSTRAINT "sp_session_index_pkey" PRIMARY KEY ("session_index")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sp_session_index" ADD CONSTRAINT "sp_session_index_sso_session_id_fkey" FOREIGN KEY ("sso_session_id") REFERENCES "sso_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sp_session_index" ADD CONSTRAINT "sp_session_index_sp_entity_id_fkey" FOREIGN KEY ("sp_entity_id") REFERENCES "service_providers"("entity_id") ON DELETE CASCADE ON UPDATE CASCADE;
