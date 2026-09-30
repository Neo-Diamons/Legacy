import { and, eq } from 'drizzle-orm';
import { useMysql, sqlite, mysql } from '@db';
import { projects as sqliteProjects, type Project as SqliteProject } from '@model/project.sqlite.model.js';
import { projects as mysqlProjects, type Project as MysqlProject } from '@model/project.mysql.model.js';
import { todoItems as sqliteItems } from '@model/item.sqlite.model.js';
import { todoItems as mysqlItems } from '@model/item.mysql.model.js';

export type Project = SqliteProject | MysqlProject;
type ProjectInput = { id: string; userId: string; name: string; color: string; createdAt: Date };
type ProjectUpdate = Partial<Pick<ProjectInput, 'name' | 'color'>>;

interface ProjectService {
  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string, userId: string): Promise<Project | undefined>;
  createProject(project: ProjectInput): Promise<void>;
  updateProject(id: string, userId: string, update: ProjectUpdate): Promise<number>;
  deleteProject(id: string, userId: string): Promise<number>;
}

const sqliteService: ProjectService = {
  async getProjects(userId) {
    return sqlite.db.select().from(sqliteProjects).where(eq(sqliteProjects.userId, userId)).all();
  },
  async getProject(id, userId) {
    return sqlite.db
      .select()
      .from(sqliteProjects)
      .where(and(eq(sqliteProjects.id, id), eq(sqliteProjects.userId, userId)))
      .get();
  },
  async createProject(project) {
    sqlite.db.insert(sqliteProjects).values(project).run();
  },
  async updateProject(id, userId, update) {
    return sqlite.db
      .update(sqliteProjects)
      .set({ name: update.name, color: update.color })
      .where(and(eq(sqliteProjects.id, id), eq(sqliteProjects.userId, userId)))
      .run().changes;
  },
  async deleteProject(id, userId) {
    return sqlite.db.transaction((tx) => {
      tx.delete(sqliteItems)
        .where(and(eq(sqliteItems.projectId, id), eq(sqliteItems.userId, userId)))
        .run();
      return tx
        .delete(sqliteProjects)
        .where(and(eq(sqliteProjects.id, id), eq(sqliteProjects.userId, userId)))
        .run().changes;
    });
  },
};

const mysqlService: ProjectService = {
  async getProjects(userId) {
    return mysql.db.select().from(mysqlProjects).where(eq(mysqlProjects.userId, userId));
  },
  async getProject(id, userId) {
    return (
      await mysql.db
        .select()
        .from(mysqlProjects)
        .where(and(eq(mysqlProjects.id, id), eq(mysqlProjects.userId, userId)))
        .limit(1)
    )[0];
  },
  async createProject(project) {
    await mysql.db.insert(mysqlProjects).values(project);
  },
  async updateProject(id, userId, update) {
    const [result] = await mysql.db
      .update(mysqlProjects)
      .set({ name: update.name, color: update.color })
      .where(and(eq(mysqlProjects.id, id), eq(mysqlProjects.userId, userId)));
    return result.affectedRows;
  },
  async deleteProject(id, userId) {
    return mysql.db.transaction(async (tx) => {
      await tx.delete(mysqlItems).where(and(eq(mysqlItems.projectId, id), eq(mysqlItems.userId, userId)));
      const [result] = await tx
        .delete(mysqlProjects)
        .where(and(eq(mysqlProjects.id, id), eq(mysqlProjects.userId, userId)));
      return result.affectedRows;
    });
  },
};

export const projectService: ProjectService = useMysql ? mysqlService : sqliteService;
