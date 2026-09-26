import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { InsertPlanRequest, InsertSubscription, InsertUser, planRequests, subscriptions, users } from '../drizzle/schema';
import { ENV } from './_core/env';
import { getNextMonthlyRenewal } from '../shared/subscriptions';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn('[Database] Failed to connect:', error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error('User openId is required for upsert');
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ['name', 'email', 'loginMethod'] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPlanRequest(data: InsertPlanRequest) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(planRequests).values(data);
  return { created: true } as const;
}

export async function listPlanRequests(status?: 'pending' | 'approved' | 'rejected') {
  const db = await getDb();
  if (!db) return [];
  const where = status ? eq(planRequests.status, status) : undefined;
  return db.select().from(planRequests).where(where).orderBy(desc(planRequests.createdAt));
}

export async function updatePlanRequestStatus(id: number, status: 'approved' | 'rejected', reviewedBy: number, rejectionReason?: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const request = await db.select().from(planRequests).where(and(eq(planRequests.id, id), eq(planRequests.status, 'pending'))).limit(1);
  if (request.length === 0) throw new Error('Plan request not found or already reviewed');
  await db.update(planRequests).set({ status, reviewedAt: new Date(), reviewedBy, rejectionReason: rejectionReason ?? null }).where(and(eq(planRequests.id, id), eq(planRequests.status, 'pending')));
  if (status === 'approved') {
    const startedAt = new Date();
    const renewalAt = getNextMonthlyRenewal(startedAt);
    const subscription: InsertSubscription = { userId: request[0].studentId, planId: request[0].planId, status: 'active', startedAt, renewalAt };
    await db.insert(subscriptions).values(subscription).onDuplicateKeyUpdate({ set: { planId: subscription.planId, status: 'active', startedAt, renewalAt, updatedAt: new Date() } });
  }
  return { id, status };
}

export async function listStudents() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
    subscription: subscriptions,
  }).from(users).leftJoin(subscriptions, eq(users.id, subscriptions.userId)).where(eq(users.role, 'user')).orderBy(desc(users.createdAt));
}
