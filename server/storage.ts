import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, gte } from "drizzle-orm";
import pg from "pg";
import {
  users, type User, type InsertUser,
  uberEatsConnections, type UberEatsConnection, type InsertUberEatsConnection,
  restaurants, type Restaurant, type InsertRestaurant,
  taskDefinitions, type TaskDefinition, type InsertTaskDefinition,
  taskRuns, type TaskRun, type InsertTaskRun,
  chatMessages, type ChatMessage, type InsertChatMessage,
  systemConfig,
  channelBindings, type ChannelBinding, type InsertChannelBinding,
} from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPlan(id: string, planId: string): Promise<User>;
  updateUserCurrentRestaurant(id: string, restaurantId: string): Promise<User>;
  getUberEatsConnection(userId: string): Promise<UberEatsConnection | undefined>;
  saveUberEatsConnection(data: InsertUberEatsConnection): Promise<UberEatsConnection>;
  updateUberEatsConnection(userId: string, updates: Partial<UberEatsConnection>): Promise<void>;
  getRestaurants(userId: string): Promise<Restaurant[]>;
  createRestaurant(data: InsertRestaurant): Promise<Restaurant>;
  deleteRestaurant(id: string, userId: string): Promise<void>;
  seedTaskDefinitions(tasks: InsertTaskDefinition[]): Promise<void>;
  getTaskDefinitions(): Promise<TaskDefinition[]>;
  createTaskRun(data: InsertTaskRun): Promise<TaskRun>;
  getTaskRuns(userId: string): Promise<(TaskRun & { task: TaskDefinition | null })[]>;
  getChatHistory(userId: string, agentId: string): Promise<ChatMessage[]>;
  saveChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  saveChatMessages(data: InsertChatMessage[]): Promise<void>;
  clearChatHistory(userId: string, agentId: string): Promise<void>;
  getSystemConfig(): Promise<Record<string, string>>;
  setSystemConfig(updates: Record<string, string>): Promise<void>;
  getChannelBinding(userId: string, restaurantId: string, agentId: string, channelType: string): Promise<ChannelBinding | undefined>;
  getChannelBindings(userId: string, restaurantId: string, agentId: string): Promise<ChannelBinding[]>;
  getChannelBindingByToken(channelType: string, token: string): Promise<ChannelBinding | undefined>;
  saveChannelBinding(data: InsertChannelBinding): Promise<ChannelBinding>;
  updateChannelBindingConfig(id: string, patch: Record<string, string>): Promise<void>;
  deleteChannelBinding(userId: string, restaurantId: string, agentId: string, channelType: string): Promise<void>;
  getAllActiveChannelBindings(agentId: string, userId: string): Promise<ChannelBinding[]>;
  getAllActiveChannelBindingsByType(channelType: string): Promise<ChannelBinding[]>;
  getChannelBindingById(id: string): Promise<ChannelBinding | undefined>;
  deleteAllChannelBindingsByTypeAndUser(userId: string, channelType: string): Promise<string[]>;
  getAllUsers(): Promise<User[]>;
  getAllChatHistorySince(userId: string, since: Date): Promise<ChatMessage[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, email: insertUser.email.toLowerCase() })
      .returning();
    return user;
  }

  async updateUserPlan(id: string, planId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ selectedPlan: planId })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserCurrentRestaurant(id: string, restaurantId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ currentRestaurantId: restaurantId })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async getUberEatsConnection(userId: string): Promise<UberEatsConnection | undefined> {
    const [conn] = await db
      .select()
      .from(uberEatsConnections)
      .where(eq(uberEatsConnections.userId, userId));
    return conn;
  }

  async saveUberEatsConnection(data: InsertUberEatsConnection): Promise<UberEatsConnection> {
    const existing = await this.getUberEatsConnection(data.userId);
    if (existing) {
      const [updated] = await db
        .update(uberEatsConnections)
        .set(data)
        .where(eq(uberEatsConnections.userId, data.userId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(uberEatsConnections)
      .values(data)
      .returning();
    return created;
  }

  async updateUberEatsConnection(userId: string, updates: Partial<UberEatsConnection>): Promise<void> {
    await db
      .update(uberEatsConnections)
      .set(updates)
      .where(eq(uberEatsConnections.userId, userId));
  }

  async getRestaurants(userId: string): Promise<Restaurant[]> {
    return db
      .select()
      .from(restaurants)
      .where(eq(restaurants.userId, userId))
      .orderBy(restaurants.createdAt);
  }

  async createRestaurant(data: InsertRestaurant): Promise<Restaurant> {
    const [restaurant] = await db
      .insert(restaurants)
      .values(data)
      .returning();
    return restaurant;
  }

  async deleteRestaurant(id: string, userId: string): Promise<void> {
    await db
      .delete(restaurants)
      .where(eq(restaurants.id, id));
  }

  async seedTaskDefinitions(tasks: InsertTaskDefinition[]): Promise<void> {
    for (const task of tasks) {
      await db
        .insert(taskDefinitions)
        .values(task)
        .onConflictDoUpdate({
          target: taskDefinitions.id,
          set: {
            title: task.title,
            category: task.category,
            price: task.price,
            shortDesc: task.shortDesc,
            agentId: task.agentId,
          },
        });
    }
  }

  async getTaskDefinitions(): Promise<TaskDefinition[]> {
    return db.select().from(taskDefinitions);
  }

  async createTaskRun(data: InsertTaskRun): Promise<TaskRun> {
    const [run] = await db.insert(taskRuns).values(data).returning();
    return run;
  }

  async getTaskRuns(userId: string): Promise<(TaskRun & { task: TaskDefinition | null })[]> {
    const runs = await db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.userId, userId))
      .orderBy(desc(taskRuns.createdAt));

    const taskIds = [...new Set(runs.map((r) => r.taskId))];
    const defs = taskIds.length
      ? await db.select().from(taskDefinitions).where(
          taskIds.length === 1
            ? eq(taskDefinitions.id, taskIds[0])
            : taskDefinitions.id.in(taskIds)
        )
      : [];
    const defMap = Object.fromEntries(defs.map((d) => [d.id, d]));
    return runs.map((r) => ({ ...r, task: defMap[r.taskId] ?? null }));
  }

  async getChatHistory(userId: string, agentId: string): Promise<ChatMessage[]> {
    return db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.agentId, agentId)))
      .orderBy(chatMessages.id);
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getAllChatHistorySince(userId: string, since: Date): Promise<ChatMessage[]> {
    return db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), gte(chatMessages.createdAt, since)))
      .orderBy(chatMessages.id);
  }

  async saveChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [msg] = await db.insert(chatMessages).values(data).returning();
    return msg;
  }

  async saveChatMessages(data: InsertChatMessage[]): Promise<void> {
    if (!data.length) return;
    await db.insert(chatMessages).values(data);
  }

  async clearChatHistory(userId: string, agentId: string): Promise<void> {
    await db
      .delete(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.agentId, agentId)));
  }

  async getSystemConfig(): Promise<Record<string, string>> {
    const rows = await db.select().from(systemConfig);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setSystemConfig(updates: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(systemConfig)
        .values({ key, value })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value, updatedAt: new Date() } });
    }
  }

  async getChannelBinding(userId: string, restaurantId: string, agentId: string, channelType: string): Promise<ChannelBinding | undefined> {
    const [binding] = await db
      .select()
      .from(channelBindings)
      .where(
        and(
          eq(channelBindings.userId, userId),
          eq(channelBindings.restaurantId, restaurantId),
          eq(channelBindings.agentId, agentId),
          eq(channelBindings.channelType, channelType),
        )
      );
    return binding;
  }

  async getChannelBindings(userId: string, restaurantId: string, agentId: string): Promise<ChannelBinding[]> {
    return db
      .select()
      .from(channelBindings)
      .where(
        and(
          eq(channelBindings.userId, userId),
          eq(channelBindings.restaurantId, restaurantId),
          eq(channelBindings.agentId, agentId),
        )
      );
  }

  async getChannelBindingByToken(channelType: string, token: string): Promise<ChannelBinding | undefined> {
    const rows = await db
      .select()
      .from(channelBindings)
      .where(eq(channelBindings.channelType, channelType));
    return rows.find((r) => {
      const cfg = r.channelConfig as Record<string, unknown>;
      return cfg.botToken === token;
    });
  }

  async saveChannelBinding(data: InsertChannelBinding): Promise<ChannelBinding> {
    const existing = await this.getChannelBinding(data.userId, data.restaurantId, data.agentId, data.channelType);
    if (existing) {
      const [updated] = await db
        .update(channelBindings)
        .set({ channelConfig: data.channelConfig, active: data.active ?? true })
        .where(eq(channelBindings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(channelBindings).values(data).returning();
    return created;
  }

  async updateChannelBindingConfig(id: string, patch: Record<string, string>): Promise<void> {
    const [existing] = await db.select().from(channelBindings).where(eq(channelBindings.id, id));
    if (!existing) return;
    const merged = { ...(existing.channelConfig as Record<string, string>), ...patch };
    await db.update(channelBindings).set({ channelConfig: merged }).where(eq(channelBindings.id, id));
  }

  async getAllActiveChannelBindingsByType(channelType: string): Promise<ChannelBinding[]> {
    return db.select().from(channelBindings).where(
      and(eq(channelBindings.channelType, channelType), eq(channelBindings.active, true))
    );
  }

  async getChannelBindingById(id: string): Promise<ChannelBinding | undefined> {
    const [row] = await db.select().from(channelBindings).where(eq(channelBindings.id, id));
    return row;
  }

  async deleteAllChannelBindingsByTypeAndUser(userId: string, channelType: string): Promise<string[]> {
    const rows = await db.select({ id: channelBindings.id })
      .from(channelBindings)
      .where(and(eq(channelBindings.userId, userId), eq(channelBindings.channelType, channelType)));
    if (rows.length > 0) {
      await db.delete(channelBindings).where(
        and(eq(channelBindings.userId, userId), eq(channelBindings.channelType, channelType))
      );
    }
    return rows.map(r => r.id);
  }

  async getAllActiveChannelBindings(agentId: string, userId: string): Promise<ChannelBinding[]> {
    return db
      .select()
      .from(channelBindings)
      .where(
        and(
          eq(channelBindings.agentId, agentId),
          eq(channelBindings.userId, userId),
          eq(channelBindings.active, true),
        )
      );
  }

  async deleteChannelBinding(userId: string, restaurantId: string, agentId: string, channelType: string): Promise<void> {
    await db
      .delete(channelBindings)
      .where(
        and(
          eq(channelBindings.userId, userId),
          eq(channelBindings.restaurantId, restaurantId),
          eq(channelBindings.agentId, agentId),
          eq(channelBindings.channelType, channelType),
        )
      );
  }
}

export const storage = new DatabaseStorage();
