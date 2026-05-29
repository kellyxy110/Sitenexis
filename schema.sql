-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'starter', 'pro', 'agency', 'enterprise');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('queued', 'running', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('critical', 'warning', 'info');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'queued',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "page_count" INTEGER,
    "crawl_duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "title" TEXT,
    "meta_description" TEXT,
    "h1" TEXT,
    "canonical_url" TEXT,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "is_indexable" BOOLEAN NOT NULL DEFAULT true,
    "robots_directive" TEXT,
    "internal_links" INTEGER NOT NULL DEFAULT 0,
    "external_links" INTEGER NOT NULL DEFAULT 0,
    "internal_links_out" JSONB NOT NULL DEFAULT '[]',
    "page_rank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seo_score" DOUBLE PRECISION,
    "seo_issues" JSONB NOT NULL DEFAULT '[]',
    "ai_score" DOUBLE PRECISION,
    "ai_status" TEXT NOT NULL DEFAULT 'pending',
    "schema_data" JSONB NOT NULL DEFAULT '[]',
    "crawled_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "page_id" TEXT,
    "page_url" TEXT,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_scores" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "seo_score" DOUBLE PRECISION NOT NULL,
    "ai_score" DOUBLE PRECISION NOT NULL,
    "schema_score" DOUBLE PRECISION NOT NULL,
    "link_graph_score" DOUBLE PRECISION NOT NULL,
    "performance_score" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "audit_id" TEXT,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_chunks" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "same_as_urls" TEXT[],
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "consistency_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disambiguation_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relationships" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenced_by_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_visibility_scores" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "ai_visibility_score" DOUBLE PRECISION NOT NULL,
    "machine_readability_score" DOUBLE PRECISION NOT NULL,
    "entity_confidence_score" DOUBLE PRECISION NOT NULL,
    "retrieval_readiness_score" DOUBLE PRECISION NOT NULL,
    "citation_probability_score" DOUBLE PRECISION NOT NULL,
    "semantic_trust_score" DOUBLE PRECISION NOT NULL,
    "recommendation_confidence" DOUBLE PRECISION NOT NULL,
    "provider_scores" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_visibility_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perception_graph_snapshots" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "nodes_json" JSONB NOT NULL,
    "edges_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perception_graph_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retrieval_simulations" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "page_url" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "simulation_error_reason" TEXT,
    "retrieval_quality_score" DOUBLE PRECISION,
    "chunk_stability_index" DOUBLE PRECISION,
    "answer_formation_probability" DOUBLE PRECISION,
    "summarisation_loss_score" DOUBLE PRECISION,
    "citation_eligibility_score" DOUBLE PRECISION,
    "fragile_claims_count" INTEGER NOT NULL DEFAULT 0,
    "retrieval_failures" JSONB NOT NULL DEFAULT '[]',
    "truncation_zone_warnings" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retrieval_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_trust_scores" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "entity_credibility_score" DOUBLE PRECISION NOT NULL,
    "schema_trust_alignment_score" DOUBLE PRECISION NOT NULL,
    "external_validation_score" DOUBLE PRECISION NOT NULL,
    "contradiction_absence_score" DOUBLE PRECISION,
    "trust_degradation_resistance" DOUBLE PRECISION NOT NULL,
    "cross_source_validation_index" DOUBLE PRECISION NOT NULL,
    "trust_issues" JSONB NOT NULL DEFAULT '[]',
    "degradation_signals" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temporal_authority_records" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,
    "authority_velocity_score" DOUBLE PRECISION,
    "trust_stability_index" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "content_freshness_impact_factor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "semantic_drift_index" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "update_frequency_classification" TEXT NOT NULL,
    "stale_pages_at_risk" TEXT[],
    "drifted_pages" JSONB NOT NULL DEFAULT '[]',
    "temporal_issues" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temporal_authority_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_surface_maps" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "overall_surface_score" DOUBLE PRECISION NOT NULL,
    "ai_overviews_probability" DOUBLE PRECISION NOT NULL,
    "ai_overviews_status" TEXT NOT NULL,
    "chat_probability" DOUBLE PRECISION NOT NULL,
    "chat_status" TEXT NOT NULL,
    "voice_probability" DOUBLE PRECISION NOT NULL,
    "voice_status" TEXT NOT NULL,
    "agent_probability" DOUBLE PRECISION NOT NULL,
    "agent_status" TEXT NOT NULL,
    "coverage_gaps" JSONB NOT NULL DEFAULT '[]',
    "missing_channels" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_surface_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synthetic_entity_flags" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "synthetic_risk_score" DOUBLE PRECISION NOT NULL,
    "entity_authenticity_confidence" DOUBLE PRECISION NOT NULL,
    "network_integrity_score" DOUBLE PRECISION NOT NULL,
    "detected_patterns" JSONB NOT NULL DEFAULT '[]',
    "flagged_entities" JSONB NOT NULL DEFAULT '[]',
    "recommendations" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synthetic_entity_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "audits_user_id_idx" ON "audits"("user_id");

-- CreateIndex
CREATE INDEX "audits_domain_idx" ON "audits"("domain");

-- CreateIndex
CREATE INDEX "audits_status_idx" ON "audits"("status");

-- CreateIndex
CREATE INDEX "pages_audit_id_idx" ON "pages"("audit_id");

-- CreateIndex
CREATE INDEX "issues_audit_id_idx" ON "issues"("audit_id");

-- CreateIndex
CREATE INDEX "issues_severity_idx" ON "issues"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "audit_scores_audit_id_key" ON "audit_scores"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_audit_id_key" ON "reports"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "usage_logs_user_id_idx" ON "usage_logs"("user_id");

-- CreateIndex
CREATE INDEX "usage_logs_created_at_idx" ON "usage_logs"("created_at");

-- CreateIndex
CREATE INDEX "page_chunks_page_id_idx" ON "page_chunks"("page_id");

-- CreateIndex
CREATE INDEX "page_chunks_audit_id_idx" ON "page_chunks"("audit_id");

-- CreateIndex
CREATE INDEX "entities_audit_id_idx" ON "entities"("audit_id");

-- CreateIndex
CREATE INDEX "entities_normalized_name_idx" ON "entities"("normalized_name");

-- CreateIndex
CREATE INDEX "entity_relationships_audit_id_idx" ON "entity_relationships"("audit_id");

-- CreateIndex
CREATE INDEX "entity_relationships_source_entity_id_idx" ON "entity_relationships"("source_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_visibility_scores_audit_id_key" ON "ai_visibility_scores"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "perception_graph_snapshots_audit_id_key" ON "perception_graph_snapshots"("audit_id");

-- CreateIndex
CREATE INDEX "retrieval_simulations_audit_id_idx" ON "retrieval_simulations"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "machine_trust_scores_audit_id_key" ON "machine_trust_scores"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "temporal_authority_records_audit_id_key" ON "temporal_authority_records"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_surface_maps_audit_id_key" ON "recommendation_surface_maps"("audit_id");

-- CreateIndex
CREATE INDEX "synthetic_entity_flags_audit_id_idx" ON "synthetic_entity_flags"("audit_id");

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scores" ADD CONSTRAINT "audit_scores_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_chunks" ADD CONSTRAINT "page_chunks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_source_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_visibility_scores" ADD CONSTRAINT "ai_visibility_scores_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perception_graph_snapshots" ADD CONSTRAINT "perception_graph_snapshots_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retrieval_simulations" ADD CONSTRAINT "retrieval_simulations_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_trust_scores" ADD CONSTRAINT "machine_trust_scores_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporal_authority_records" ADD CONSTRAINT "temporal_authority_records_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_surface_maps" ADD CONSTRAINT "recommendation_surface_maps_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synthetic_entity_flags" ADD CONSTRAINT "synthetic_entity_flags_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

