import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, numeric, jsonb, serial, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  selectedPlan: text("selected_plan"),
  currentRestaurantId: varchar("current_restaurant_id"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;

export const bookCallSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  restaurantName: z.string().min(1, "Restaurant or business name is required"),
  city: z.string().min(1, "City is required"),
  primaryChallenge: z.string().min(1, "Please select your primary challenge"),
});

export type BookCallForm = z.infer<typeof bookCallSchema>;

export const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  restaurantName: z.string().min(1, "Restaurant or business name is required"),
  phone: z.string().optional(),
  primaryChallenge: z.string().min(1, "Please select your primary challenge"),
  message: z.string().min(10, "Please share at least a sentence about your restaurant"),
});

export type ContactForm = z.infer<typeof contactFormSchema>;

// ─── UberEats OAuth connections ───────────────────────────────────────────────

export const uberEatsConnections = pgTable("ubereats_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"),
  selectedStoreId: text("selected_store_id"),
});

export type UberEatsConnection = typeof uberEatsConnections.$inferSelect;
export type InsertUberEatsConnection = typeof uberEatsConnections.$inferInsert;

// ─── Restaurants ──────────────────────────────────────────────────────────────

export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  cuisine: text("cuisine"),
  rating: text("rating"),
  reviewCount: integer("review_count"),
  googleUrl: text("google_url"),
  yelpUrl: text("yelp_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
});

export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

// ─── Task Market ───────────────────────────────────────────────────────────────

export const taskDefinitions = pgTable("task_definitions", {
  id: varchar("id", { length: 100 }).primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  shortDesc: text("short_desc").notNull(),
  agentId: varchar("agent_id", { length: 50 }),
});

export type TaskDefinition = typeof taskDefinitions.$inferSelect;
export type InsertTaskDefinition = typeof taskDefinitions.$inferInsert;

export const taskRuns = pgTable("task_runs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: varchar("task_id", { length: 100 }).notNull().references(() => taskDefinitions.id),
  inputs: jsonb("inputs"),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TaskRun = typeof taskRuns.$inferSelect;
export type InsertTaskRun = typeof taskRuns.$inferInsert;

// ─── Agent Chat History ────────────────────────────────────────────────────────

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id", { length: 50 }).notNull(),
  role: text("role").notNull(),
  text: text("text").notNull(),
  ts: text("ts").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("chat_user_agent_idx").on(t.userId, t.agentId)]);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── System Config ─────────────────────────────────────────────────────────────

export const systemConfig = pgTable("system_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;

// ─── Channel Bindings ──────────────────────────────────────────────────────────

export const channelBindings = pgTable("channel_bindings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  restaurantId: varchar("restaurant_id").notNull(),
  agentId: varchar("agent_id", { length: 50 }).notNull(),
  channelType: varchar("channel_type", { length: 30 }).notNull(), // "telegram" | "discord" | "slack" ...
  channelConfig: jsonb("channel_config").notNull(),               // platform-specific: { botToken, botUsername, ... }
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("channel_bindings_user_idx").on(t.userId, t.restaurantId, t.agentId),
]);

export type ChannelBinding = typeof channelBindings.$inferSelect;
export type InsertChannelBinding = typeof channelBindings.$inferInsert;
