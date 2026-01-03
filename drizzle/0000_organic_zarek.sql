CREATE TYPE "public"."assignment_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('extracted', 'assigned', 'used', 'archived');--> statement-breakpoint
CREATE TYPE "public"."interview_mode" AS ENUM('live_video', 'text_chat');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('scheduled', 'in_progress', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('interviewer', 'client');--> statement-breakpoint
CREATE TYPE "public"."question_category" AS ENUM('origin_story', 'failure_story', 'success_story', 'turning_point', 'hot_take', 'contrarian_view', 'industry_critique', 'prediction', 'technical', 'framework', 'how_to', 'lessons', 'values', 'habits', 'influences', 'advice');--> statement-breakpoint
CREATE TYPE "public"."question_difficulty" AS ENUM('easy', 'medium', 'deep');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'client', 'writer');--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid,
	"client_id" uuid,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100),
	"endpoint" varchar(255),
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer,
	"cost_cents" numeric(10, 4),
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"brand_name" varchar(255),
	"twitter_handle" varchar(100),
	"telegram_handle" varchar(100),
	"linkedin_url" text,
	"website_url" text,
	"knowledge_base" jsonb DEFAULT '{}'::jsonb,
	"voice_style" text,
	"topics_of_expertise" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"twitter_handle" varchar(100) NOT NULL,
	"name" varchar(255),
	"recent_tweets" jsonb DEFAULT '[]'::jsonb,
	"voice_analysis" jsonb DEFAULT '{}'::jsonb,
	"topics" text[],
	"avg_engagement" numeric(10, 2),
	"last_scraped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid,
	"message_id" uuid,
	"client_id" uuid,
	"content_type" "question_category" NOT NULL,
	"topics" text[] DEFAULT '{}',
	"question_asked" text,
	"raw_response" text NOT NULL,
	"key_quote" text,
	"summary" text,
	"tweet_draft" text,
	"thread_outline" jsonb DEFAULT '[]'::jsonb,
	"linkedin_draft" text,
	"web2_friendly" boolean DEFAULT false,
	"technical_depth" integer,
	"controversy_level" integer,
	"storytelling_potential" integer,
	"suggested_formats" text[] DEFAULT '{}',
	"status" "extraction_status" DEFAULT 'extracted' NOT NULL,
	"used_in" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"writer_id" uuid,
	"status" "assignment_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"content_produced" jsonb DEFAULT '[]'::jsonb,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "interview_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"audio_url" text,
	"timestamp_start" numeric(10, 3),
	"timestamp_end" numeric(10, 3),
	"question_id" uuid,
	"targeted_content_type" "question_category",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"mode" "interview_mode" NOT NULL,
	"status" "interview_status" DEFAULT 'scheduled' NOT NULL,
	"title" varchar(255),
	"share_token" varchar(64),
	"share_token_expires_at" timestamp,
	"guest_name" varchar(255),
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"total_duration_seconds" integer,
	"recording_url" text,
	"transcript" text,
	"transcript_json" jsonb,
	"questions_count" integer DEFAULT 0,
	"extractions_count" integer DEFAULT 0,
	"questions_asked" jsonb DEFAULT '[]'::jsonb,
	"current_question_index" integer DEFAULT 0,
	"session_state" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_id" uuid NOT NULL,
	"user_id" uuid,
	"user_name" varchar(255) NOT NULL,
	"user_role" varchar(50) NOT NULL,
	"comment_text" text NOT NULL,
	"selected_text" text,
	"start_offset" integer,
	"end_offset" integer,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"question" text NOT NULL,
	"category" "question_category",
	"topics" text[],
	"difficulty" "question_difficulty",
	"expected_clip_potential" integer,
	"web2_friendly" boolean DEFAULT false,
	"times_used" integer DEFAULT 0,
	"avg_quality_rating" numeric(3, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"name" varchar(255),
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid,
	"message_id" uuid,
	"client_id" uuid,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"file_size_bytes" integer,
	"title" varchar(255),
	"description" text,
	"transcript" text,
	"start_timestamp" numeric(10, 3),
	"end_timestamp" numeric(10, 3),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_extractions" ADD CONSTRAINT "content_extractions_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_extractions" ADD CONSTRAINT "content_extractions_message_id_interview_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."interview_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_extractions" ADD CONSTRAINT "content_extractions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_assignments" ADD CONSTRAINT "interview_assignments_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_assignments" ADD CONSTRAINT "interview_assignments_writer_id_users_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_messages" ADD CONSTRAINT "interview_messages_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_messages" ADD CONSTRAINT "interview_messages_question_id_question_bank_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question_bank"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_extraction_id_content_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."content_extractions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_message_id_interview_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."interview_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_clips" ADD CONSTRAINT "video_clips_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;