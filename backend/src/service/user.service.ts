import { eq, sql } from 'drizzle-orm';
import { useMysql, sqlite, mysql } from '@db';
import { users as sqliteUsers, type User as SqliteUser } from '@model/user.sqlite.model.js';
import { users as mysqlUsers, type User as MysqlUser } from '@model/user.mysql.model.js';
import { todoItems as sqliteItems } from '@model/item.sqlite.model.js';
import { todoItems as mysqlItems } from '@model/item.mysql.model.js';
import { projects as sqliteProjects } from '@model/project.sqlite.model.js';
import { projects as mysqlProjects } from '@model/project.mysql.model.js';

export type User = SqliteUser | MysqlUser;
export type PublicUser = Omit<User, 'passwordHash' | 'tokenVersion'>;
type UserInput = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  mustChangePassword: boolean;
  tokenVersion: number;
  createdAt: Date;
};
type UserUpdate = Partial<Pick<UserInput, 'email' | 'name' | 'passwordHash' | 'mustChangePassword'>>;
export type UserDataExport = { user: PublicUser; projects: unknown[]; items: unknown[] };

interface UserService {
  getUser(id: string): Promise<PublicUser | undefined>;
  getTokenVersion(id: string): Promise<number | undefined>;
  emailExists(email: string): Promise<boolean>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: UserInput): Promise<void>;
  updateUser(id: string, update: UserUpdate): Promise<number>;
  deleteUser(id: string): Promise<number>;
  exportUserData(id: string): Promise<UserDataExport | undefined>;
}

const sqliteService: UserService = {
  async getUser(id) {
    return sqlite.db
      .select({
        id: sqliteUsers.id,
        email: sqliteUsers.email,
        name: sqliteUsers.name,
        mustChangePassword: sqliteUsers.mustChangePassword,
        createdAt: sqliteUsers.createdAt,
      })
      .from(sqliteUsers)
      .where(eq(sqliteUsers.id, id))
      .get();
  },
  async getTokenVersion(id) {
    return sqlite.db.select({ v: sqliteUsers.tokenVersion }).from(sqliteUsers).where(eq(sqliteUsers.id, id)).get()?.v;
  },
  async emailExists(email) {
    return (
      sqlite.db.select({ id: sqliteUsers.id }).from(sqliteUsers).where(eq(sqliteUsers.email, email)).get() !== undefined
    );
  },
  async getUserByEmail(email) {
    return sqlite.db.select().from(sqliteUsers).where(eq(sqliteUsers.email, email)).get();
  },
  async getUserById(id) {
    return sqlite.db.select().from(sqliteUsers).where(eq(sqliteUsers.id, id)).get();
  },
  async createUser(user) {
    sqlite.db.insert(sqliteUsers).values(user).run();
  },
  async updateUser(id, update) {
    const values = update.passwordHash ? { ...update, tokenVersion: sql`${sqliteUsers.tokenVersion} + 1` } : update;
    return sqlite.db.update(sqliteUsers).set(values).where(eq(sqliteUsers.id, id)).run().changes;
  },
  async deleteUser(id) {
    return sqlite.db.transaction((tx) => {
      tx.delete(sqliteItems).where(eq(sqliteItems.userId, id)).run();
      tx.delete(sqliteProjects).where(eq(sqliteProjects.userId, id)).run();
      return tx.delete(sqliteUsers).where(eq(sqliteUsers.id, id)).run().changes;
    });
  },
  async exportUserData(id) {
    const user = await this.getUser(id);
    if (!user) return undefined;
    return {
      user,
      projects: sqlite.db.select().from(sqliteProjects).where(eq(sqliteProjects.userId, id)).all(),
      items: sqlite.db.select().from(sqliteItems).where(eq(sqliteItems.userId, id)).all(),
    };
  },
};

const mysqlService: UserService = {
  async getUser(id) {
    return (
      await mysql.db
        .select({
          id: mysqlUsers.id,
          email: mysqlUsers.email,
          name: mysqlUsers.name,
          mustChangePassword: mysqlUsers.mustChangePassword,
          createdAt: mysqlUsers.createdAt,
        })
        .from(mysqlUsers)
        .where(eq(mysqlUsers.id, id))
        .limit(1)
    )[0];
  },
  async getTokenVersion(id) {
    return (
      await mysql.db.select({ v: mysqlUsers.tokenVersion }).from(mysqlUsers).where(eq(mysqlUsers.id, id)).limit(1)
    )[0]?.v;
  },
  async emailExists(email) {
    return (
      (await mysql.db.select({ id: mysqlUsers.id }).from(mysqlUsers).where(eq(mysqlUsers.email, email)).limit(1))
        .length > 0
    );
  },
  async getUserByEmail(email) {
    return (await mysql.db.select().from(mysqlUsers).where(eq(mysqlUsers.email, email)).limit(1))[0];
  },
  async getUserById(id) {
    return (await mysql.db.select().from(mysqlUsers).where(eq(mysqlUsers.id, id)).limit(1))[0];
  },
  async createUser(user) {
    await mysql.db.insert(mysqlUsers).values(user);
  },
  async updateUser(id, update) {
    const values = update.passwordHash ? { ...update, tokenVersion: sql`${mysqlUsers.tokenVersion} + 1` } : update;
    const [result] = await mysql.db.update(mysqlUsers).set(values).where(eq(mysqlUsers.id, id));
    return result.affectedRows;
  },
  async deleteUser(id) {
    return mysql.db.transaction(async (tx) => {
      await tx.delete(mysqlItems).where(eq(mysqlItems.userId, id));
      await tx.delete(mysqlProjects).where(eq(mysqlProjects.userId, id));
      const [result] = await tx.delete(mysqlUsers).where(eq(mysqlUsers.id, id));
      return result.affectedRows;
    });
  },
  async exportUserData(id) {
    const user = await this.getUser(id);
    if (!user) return undefined;
    return {
      user,
      projects: await mysql.db.select().from(mysqlProjects).where(eq(mysqlProjects.userId, id)),
      items: await mysql.db.select().from(mysqlItems).where(eq(mysqlItems.userId, id)),
    };
  },
};

export const userService: UserService = useMysql ? mysqlService : sqliteService;
