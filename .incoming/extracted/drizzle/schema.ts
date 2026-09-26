import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  openId: varchar('openId', { length: 64 }).notNull().unique(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: mysqlEnum('role', ['user', 'admin']).default('user').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow().notNull(),
});

export const planRequests = mysqlTable('planRequests', {
  id: int('id').autoincrement().primaryKey(),
  studentId: int('studentId').notNull(),
  studentName: varchar('studentName', { length: 160 }).notNull(),
  studentEmail: varchar('studentEmail', { length: 320 }),
  planId: mysqlEnum('planId', ['premium', 'plus']).notNull(),
  amountCents: int('amountCents').notNull(),
  status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending').notNull(),
  proofUrl: text('proofUrl'),
  rejectionReason: text('rejectionReason'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  reviewedAt: timestamp('reviewedAt'),
  reviewedBy: int('reviewedBy'),
});

export const subscriptions = mysqlTable('subscriptions', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull(),
  planId: mysqlEnum('planId', ['premium', 'plus']).notNull(),
  status: mysqlEnum('status', ['active', 'expired', 'canceled']).default('active').notNull(),
  startedAt: timestamp('startedAt').defaultNow().notNull(),
  renewalAt: timestamp('renewalAt').notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdUnique: uniqueIndex('subscriptions_user_id_unique').on(table.userId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PlanRequest = typeof planRequests.$inferSelect;
export type InsertPlanRequest = typeof planRequests.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
