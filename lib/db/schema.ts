import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "client", "writer"]);
export const interviewModeEnum = pgEnum("interview_mode", ["live_video", "text_chat"]);
export const interviewStatusEnum = pgEnum("interview_status", [
  "scheduled",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
]);
export const messageRoleEnum = pgEnum("message_role", ["interviewer", "client"]);
export const questionCategoryEnum = pgEnum("question_category", [
  "origin_story",
  "failure_story",
  "success_story",
  "turning_point",
  "hot_take",
  "contrarian_view",
  "industry_critique",
  "prediction",
  "technical",
  "framework",
  "how_to",
  "lessons",
  "values",
  "habits",
  "influences",
  "advice",
]);
export const questionDifficultyEnum = pgEnum("question_difficulty", [
  "easy",
  "medium",
  "deep",
]);

// Users table (admin only)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 255 }),
  role: userRoleEnum("role").notNull().default("admin"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Clients (Founders) table
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  brandName: varchar("brand_name", { length: 255 }),
  profilePicture: text("profile_picture"),
  twitterHandle: varchar("twitter_handle", { length: 100 }),
  telegramHandle: varchar("telegram_handle", { length: 100 }),
  linkedinUrl: text("linkedin_url"),
  websiteUrl: text("website_url"),

  knowledgeBase: jsonb("knowledge_base").default({}),
  voiceStyle: text("voice_style"),
  topicsOfExpertise: text("topics_of_expertise").array(),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Question Bank (per client or global)
export const questionBank = pgTable("question_bank", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),

  question: text("question").notNull(),
  category: questionCategoryEnum("category"),

  topics: text("topics").array(),
  difficulty: questionDifficultyEnum("difficulty"),
  expectedClipPotential: integer("expected_clip_potential"),
  web2Friendly: boolean("web2_friendly").default(false),

  timesUsed: integer("times_used").default(0),
  avgQualityRating: decimal("avg_quality_rating", { precision: 3, scale: 2 }),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Interview Sessions
export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),

  mode: interviewModeEnum("mode").notNull(),
  audioOnly: boolean("audio_only").default(true),
  status: interviewStatusEnum("status").notNull().default("scheduled"),
  title: varchar("title", { length: 255 }),

  shareToken: varchar("share_token", { length: 64 }).unique(),
  shareTokenExpiresAt: timestamp("share_token_expires_at"),
  guestName: varchar("guest_name", { length: 255 }),

  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalDurationSeconds: integer("total_duration_seconds"),

  transcript: text("transcript"),
  transcriptJson: jsonb("transcript_json"),
  transcriptMarkdown: text("transcript_markdown"),

  questionsCount: integer("questions_count").default(0),

  questionsAsked: jsonb("questions_asked").default([]),

  currentQuestionIndex: integer("current_question_index").default(0),
  sessionState: jsonb("session_state").default({}),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Interview Messages (for text mode and detailed tracking)
export const interviewMessages = pgTable("interview_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .references(() => interviews.id, { onDelete: "cascade" })
    .notNull(),

  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),

  audioUrl: text("audio_url"),
  timestampStart: decimal("timestamp_start", { precision: 10, scale: 3 }),
  timestampEnd: decimal("timestamp_end", { precision: 10, scale: 3 }),

  questionId: uuid("question_id").references(() => questionBank.id, {
    onDelete: "set null",
  }),
  targetedContentType: questionCategoryEnum("targeted_content_type"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// API Usage Tracking
export const apiUsage = pgTable("api_usage", {
  id: uuid("id").primaryKey().defaultRandom(),

  interviewId: uuid("interview_id").references(() => interviews.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),

  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }),
  endpoint: varchar("endpoint", { length: 255 }),

  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  durationMs: integer("duration_ms"),

  costCents: decimal("cost_cents", { precision: 10, scale: 4 }),

  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  client: one(clients, {
    fields: [users.id],
    references: [clients.userId],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  questions: many(questionBank),
  interviews: many(interviews),
}));

export const questionBankRelations = relations(questionBank, ({ one }) => ({
  client: one(clients, {
    fields: [questionBank.clientId],
    references: [clients.id],
  }),
}));

export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  client: one(clients, {
    fields: [interviews.clientId],
    references: [clients.id],
  }),
  messages: many(interviewMessages),
}));

export const interviewMessagesRelations = relations(
  interviewMessages,
  ({ one }) => ({
    interview: one(interviews, {
      fields: [interviewMessages.interviewId],
      references: [interviews.id],
    }),
    question: one(questionBank, {
      fields: [interviewMessages.questionId],
      references: [questionBank.id],
    }),
  })
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Question = typeof questionBank.$inferSelect;
export type NewQuestion = typeof questionBank.$inferInsert;
export type Interview = typeof interviews.$inferSelect;
export type NewInterview = typeof interviews.$inferInsert;
export type InterviewMessage = typeof interviewMessages.$inferSelect;
export type NewInterviewMessage = typeof interviewMessages.$inferInsert;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type NewApiUsage = typeof apiUsage.$inferInsert;
