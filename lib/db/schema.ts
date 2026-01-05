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
export const extractionStatusEnum = pgEnum("extraction_status", [
  "extracted",
  "assigned",
  "used",
  "archived",
]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "pending",
  "in_progress",
  "completed",
]);
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

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 255 }),
  role: userRoleEnum("role").notNull().default("client"),
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
  profilePicture: text("profile_picture"), // URL or base64 data URL for profile image
  twitterHandle: varchar("twitter_handle", { length: 100 }),
  telegramHandle: varchar("telegram_handle", { length: 100 }),
  linkedinUrl: text("linkedin_url"),
  websiteUrl: text("website_url"),

  // Knowledge base (JSON for flexibility)
  knowledgeBase: jsonb("knowledge_base").default({}),
  // Stores: bio, products, past interviews, talking points, voice guidelines

  voiceStyle: text("voice_style"), // Extracted voice characteristics
  topicsOfExpertise: text("topics_of_expertise").array(), // Array of topics

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Competitors (for voice/style analysis)
export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  twitterHandle: varchar("twitter_handle", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }),

  // Scraped and analyzed data
  recentTweets: jsonb("recent_tweets").default([]),
  voiceAnalysis: jsonb("voice_analysis").default({}),
  // Stores: tone, topics, hooks, engagement patterns

  topics: text("topics").array(),
  avgEngagement: decimal("avg_engagement", { precision: 10, scale: 2 }),
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Question Bank (per client or global)
export const questionBank = pgTable("question_bank", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }), // NULL = global

  question: text("question").notNull(),
  category: questionCategoryEnum("category"),

  // Metadata for smart selection
  topics: text("topics").array(),
  difficulty: questionDifficultyEnum("difficulty"),
  expectedClipPotential: integer("expected_clip_potential"), // 1-10 rating
  web2Friendly: boolean("web2_friendly").default(false), // Good for non-crypto audience

  timesUsed: integer("times_used").default(0),
  avgQualityRating: decimal("avg_quality_rating", { precision: 3, scale: 2 }),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Interview Sessions
export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),

  // Session info
  mode: interviewModeEnum("mode").notNull(),
  audioOnly: boolean("audio_only").default(true), // For live_video mode: true = audio only, false = video avatar
  status: interviewStatusEnum("status").notNull().default("scheduled"),
  title: varchar("title", { length: 255 }),

  // Shareable link token (for no-login access)
  shareToken: varchar("share_token", { length: 64 }).unique(),
  shareTokenExpiresAt: timestamp("share_token_expires_at"),
  guestName: varchar("guest_name", { length: 255 }), // Name provided by guest user

  // Timing
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalDurationSeconds: integer("total_duration_seconds"),

  // Recording & Transcript
  recordingUrl: text("recording_url"),
  transcript: text("transcript"),
  transcriptJson: jsonb("transcript_json"), // Timestamped transcript

  // Stats
  questionsCount: integer("questions_count").default(0),
  extractionsCount: integer("extractions_count").default(0),

  // Questions asked (for reference)
  questionsAsked: jsonb("questions_asked").default([]),
  // Array of: { question, response, content_type_targeted }

  // Current state for pause/resume
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

  // For audio/video mode
  audioUrl: text("audio_url"),
  timestampStart: decimal("timestamp_start", { precision: 10, scale: 3 }), // Seconds from interview start
  timestampEnd: decimal("timestamp_end", { precision: 10, scale: 3 }),

  // Question metadata (if this is a question)
  questionId: uuid("question_id").references(() => questionBank.id, {
    onDelete: "set null",
  }),
  targetedContentType: questionCategoryEnum("targeted_content_type"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Content Extractions (the actual output)
export const contentExtractions = pgTable("content_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id").references(() => interviews.id, {
    onDelete: "cascade",
  }),
  messageId: uuid("message_id").references(() => interviewMessages.id, {
    onDelete: "set null",
  }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),

  // Classification
  contentType: questionCategoryEnum("content_type").notNull(),
  topics: text("topics").array().default([]),

  // The content
  questionAsked: text("question_asked"),
  rawResponse: text("raw_response").notNull(), // Full founder response
  keyQuote: text("key_quote"), // Best soundbite
  summary: text("summary"), // 1-2 sentence summary

  // AI-generated drafts for writers
  tweetDraft: text("tweet_draft"),
  threadOutline: jsonb("thread_outline").default([]), // Array of thread points
  linkedinDraft: text("linkedin_draft"),

  // Ratings (1-5)
  web2Friendly: boolean("web2_friendly").default(false),
  technicalDepth: integer("technical_depth"),
  controversyLevel: integer("controversy_level"),
  storytellingPotential: integer("storytelling_potential"),

  // Suggested output formats
  suggestedFormats: text("suggested_formats").array().default([]), // ['tweet', 'thread', 'linkedin', 'blog']

  // Writer workflow
  status: extractionStatusEnum("status").notNull().default("extracted"),
  usedIn: jsonb("used_in").default([]), // Links to content created from this

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Video Clips (individual recordings from interviews)
export const videoClips = pgTable("video_clips", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id").references(() => interviews.id, {
    onDelete: "cascade",
  }),
  messageId: uuid("message_id").references(() => interviewMessages.id, {
    onDelete: "set null",
  }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),

  // Video info
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  fileSizeBytes: integer("file_size_bytes"),

  // Metadata
  title: varchar("title", { length: 255 }),
  description: text("description"),
  transcript: text("transcript"),

  // For clipping
  startTimestamp: decimal("start_timestamp", { precision: 10, scale: 3 }),
  endTimestamp: decimal("end_timestamp", { precision: 10, scale: 3 }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Writer Assignments
export const interviewAssignments = pgTable("interview_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .references(() => interviews.id, { onDelete: "cascade" })
    .notNull(),
  writerId: uuid("writer_id").references(() => users.id, {
    onDelete: "set null",
  }),

  status: assignmentStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  contentProduced: jsonb("content_produced").default([]), // Links to created content

  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Post Comments (for tweet mockup review)
export const postComments = pgTable("post_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  extractionId: uuid("extraction_id")
    .references(() => contentExtractions.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

  // Comment metadata
  userName: varchar("user_name", { length: 255 }).notNull(),
  userRole: varchar("user_role", { length: 50 }).notNull(), // admin, client, writer

  // Comment content
  commentText: text("comment_text").notNull(),
  selectedText: text("selected_text"), // Text being commented on
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),

  // Status
  resolved: boolean("resolved").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// API Usage Tracking
export const apiUsage = pgTable("api_usage", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Context
  interviewId: uuid("interview_id").references(() => interviews.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),

  // API details
  provider: varchar("provider", { length: 50 }).notNull(), // openrouter, heygen, deepgram, openai
  model: varchar("model", { length: 100 }), // claude-3-haiku, etc
  endpoint: varchar("endpoint", { length: 255 }), // follow-up, personalize, transcribe, tts

  // Usage metrics
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  durationMs: integer("duration_ms"),

  // Cost (in USD, stored as cents for precision)
  costCents: decimal("cost_cents", { precision: 10, scale: 4 }),

  // Status
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  client: one(clients, {
    fields: [users.id],
    references: [clients.userId],
  }),
  assignments: many(interviewAssignments),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  competitors: many(competitors),
  questions: many(questionBank),
  interviews: many(interviews),
  extractions: many(contentExtractions),
}));

export const competitorsRelations = relations(competitors, ({ one }) => ({
  client: one(clients, {
    fields: [competitors.clientId],
    references: [clients.id],
  }),
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
  extractions: many(contentExtractions),
  assignments: many(interviewAssignments),
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

export const contentExtractionsRelations = relations(
  contentExtractions,
  ({ one, many }) => ({
    interview: one(interviews, {
      fields: [contentExtractions.interviewId],
      references: [interviews.id],
    }),
    message: one(interviewMessages, {
      fields: [contentExtractions.messageId],
      references: [interviewMessages.id],
    }),
    client: one(clients, {
      fields: [contentExtractions.clientId],
      references: [clients.id],
    }),
    comments: many(postComments),
  })
);

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  extraction: one(contentExtractions, {
    fields: [postComments.extractionId],
    references: [contentExtractions.id],
  }),
  user: one(users, {
    fields: [postComments.userId],
    references: [users.id],
  }),
}));

export const interviewAssignmentsRelations = relations(
  interviewAssignments,
  ({ one }) => ({
    interview: one(interviews, {
      fields: [interviewAssignments.interviewId],
      references: [interviews.id],
    }),
    writer: one(users, {
      fields: [interviewAssignments.writerId],
      references: [users.id],
    }),
  })
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
export type Question = typeof questionBank.$inferSelect;
export type NewQuestion = typeof questionBank.$inferInsert;
export type Interview = typeof interviews.$inferSelect;
export type NewInterview = typeof interviews.$inferInsert;
export type InterviewMessage = typeof interviewMessages.$inferSelect;
export type NewInterviewMessage = typeof interviewMessages.$inferInsert;
export type ContentExtraction = typeof contentExtractions.$inferSelect;
export type NewContentExtraction = typeof contentExtractions.$inferInsert;
export type InterviewAssignment = typeof interviewAssignments.$inferSelect;
export type NewInterviewAssignment = typeof interviewAssignments.$inferInsert;
export type VideoClip = typeof videoClips.$inferSelect;
export type NewVideoClip = typeof videoClips.$inferInsert;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type NewApiUsage = typeof apiUsage.$inferInsert;
export type PostComment = typeof postComments.$inferSelect;
export type NewPostComment = typeof postComments.$inferInsert;
