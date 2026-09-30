import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolveMigrationsFolder } from '@db/config.js';
import { verifyPassword } from '@utils/password.js';

/**
 * Applies the real sqlite migrations to scratch databases. Data is inserted between two stages so the data
 * migrations (ownership, projects, legacy account) run against realistic pre-existing rows.
 */
const LEGACY_ID = '00000000-0000-4000-8000-000000000000';
const REAL_USER = '11111111-1111-4111-8111-111111111111';

const source = resolveMigrationsFolder('sqlite');
const journal = JSON.parse(readFileSync(path.join(source, 'meta', '_journal.json'), 'utf8')) as {
  entries: { idx: number; tag: string }[];
};

let scratch: string;
let db: Database.Database;

beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), 'migrations-'));
  db = new Database(path.join(scratch, 'test.db'));
});

afterEach(() => {
  db.close();
  rmSync(scratch, { recursive: true, force: true });
});

/** Applies the migrations up to and including `lastTag` (all of them when omitted). */
function migrateTo(lastTag?: string) {
  let folder = source;
  if (lastTag) {
    const last = journal.entries.find((e) => e.tag === lastTag);
    if (!last) throw new Error(`unknown migration ${lastTag}`);
    folder = path.join(scratch, `upto-${last.idx}`);
    mkdirSync(path.join(folder, 'meta'), { recursive: true });
    const kept = journal.entries.filter((e) => e.idx <= last.idx);
    for (const entry of kept) cpSync(path.join(source, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
    writeFileSync(
      path.join(folder, 'meta', '_journal.json'),
      JSON.stringify({ ...JSON.parse(readFileSync(path.join(source, 'meta', '_journal.json'), 'utf8')), entries: kept })
    );
  }
  migrate(drizzle(db), { migrationsFolder: folder });
}

const rows = <T = Record<string, unknown>>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
const columns = (table: string) =>
  rows<{ name: string }>(`PRAGMA table_info(${table})`)
    .map((c) => c.name)
    .sort();

describe('a fresh database', () => {
  beforeEach(() => migrateTo());

  it('has the expected tables and columns', () => {
    expect(columns('users')).toEqual(
      [
        'created_at',
        'email',
        'id',
        'must_change_password',
        'name',
        'password_hash',
        'privacy_consent_at',
        'privacy_policy_version',
        'token_version',
      ].sort()
    );
    expect(columns('projects')).toEqual(['color', 'created_at', 'id', 'name', 'user_id']);
    expect(columns('todo_items')).toEqual(
      ['completed', 'created_at', 'description', 'due_date', 'id', 'name', 'priority', 'project_id', 'user_id'].sort()
    );
  });

  it('enforces unique emails', () => {
    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES ('a', 'x@example.com', 'X', 'h')").run();
    expect(() =>
      db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES ('b', 'x@example.com', 'Y', 'h')").run()
    ).toThrow(/UNIQUE/);
  });

  it('starts new accounts with token version 0 and no forced password change', () => {
    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES ('a', 'x@example.com', 'X', 'h')").run();
    expect(rows('SELECT token_version, must_change_password FROM users WHERE id = ?', 'a')).toEqual([
      { token_version: 0, must_change_password: 0 },
    ]);
  });

  it('cascades deletes from users to projects and items, and from projects to items', () => {
    db.pragma('foreign_keys = ON');
    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES ('u', 'u@example.com', 'U', 'h')").run();
    db.prepare("INSERT INTO projects (id, user_id, name, color) VALUES ('p1', 'u', 'P1', '#000')").run();
    db.prepare("INSERT INTO projects (id, user_id, name, color) VALUES ('p2', 'u', 'P2', '#000')").run();
    db.prepare("INSERT INTO todo_items (id, user_id, project_id, name) VALUES ('i1', 'u', 'p1', 'a')").run();
    db.prepare("INSERT INTO todo_items (id, user_id, project_id, name) VALUES ('i2', 'u', 'p2', 'b')").run();

    db.prepare("DELETE FROM projects WHERE id = 'p1'").run();
    expect(rows('SELECT id FROM todo_items')).toEqual([{ id: 'i2' }]);

    db.prepare("DELETE FROM users WHERE id = 'u'").run();
    expect(rows('SELECT id FROM todo_items')).toEqual([]);
    expect(rows("SELECT id FROM projects WHERE user_id = 'u'")).toEqual([]);
  });

  it('refuses items without an owner or a project', () => {
    db.pragma('foreign_keys = ON');
    expect(() => db.prepare("INSERT INTO todo_items (id, name) VALUES ('i', 'x')").run()).toThrow(/NOT NULL/);
  });

  it('refuses items pointing to a project or user that does not exist', () => {
    db.pragma('foreign_keys = ON');
    expect(() =>
      db.prepare("INSERT INTO todo_items (id, user_id, project_id, name) VALUES ('i', 'ghost', 'ghost', 'x')").run()
    ).toThrow(/FOREIGN KEY/);
  });

  it('seeds the documented legacy account, flagged for a forced password change', async () => {
    const [legacy] = rows<{ id: string; email: string; password_hash: string; must_change_password: number }>(
      'SELECT * FROM users WHERE id = ?',
      LEGACY_ID
    );

    expect(legacy).toMatchObject({ email: 'legacy@local.invalid', must_change_password: 1 });
    expect(await verifyPassword('LegacyUser123!', legacy.password_hash)).toBe(true);
  });

  it('seeds no other account and no items', () => {
    expect(rows('SELECT id FROM users')).toEqual([{ id: LEGACY_ID }]);
    expect(rows('SELECT id FROM todo_items')).toEqual([]);
  });
});

describe('a database created before accounts existed', () => {
  const items = [
    { id: 'a1', name: 'Buy milk', description: 'Oat', completed: 0, priority: 'high', due_date: 1790000000 },
    { id: 'a2', name: 'Call mum', description: null, completed: 1, priority: 'low', due_date: null },
    { id: 'a3', name: '', description: null, completed: 0, priority: 'medium', due_date: null },
  ];

  beforeEach(() => {
    migrateTo('0004_many_paladin');
    const insert = db.prepare(
      'INSERT INTO todo_items (id, name, description, completed, priority, due_date) VALUES (@id, @name, @description, @completed, @priority, @due_date)'
    );
    for (const item of items) insert.run(item);
    migrateTo();
  });

  it('keeps every item with all of its content', () => {
    const kept = rows('SELECT id, name, description, completed, priority, due_date FROM todo_items ORDER BY id');
    expect(kept).toEqual(items);
  });

  it('gives every item an owner that exists', () => {
    expect(rows('SELECT DISTINCT user_id FROM todo_items')).toEqual([{ user_id: LEGACY_ID }]);
    expect(rows('SELECT id FROM users WHERE id = ?', LEGACY_ID)).toHaveLength(1);
  });

  it('gives every item a project that belongs to the same owner', () => {
    const orphans = rows(
      `SELECT t.id FROM todo_items t
       LEFT JOIN projects p ON p.id = t.project_id AND p.user_id = t.user_id
       WHERE p.id IS NULL`
    );
    expect(orphans).toEqual([]);
  });

  it('leaves the database consistent', () => {
    expect(rows('PRAGMA foreign_key_check')).toEqual([]);
    expect(rows('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });

  it('lets the documented legacy account log in and flags it for a password change', async () => {
    const [legacy] = rows<{ password_hash: string; must_change_password: number; token_version: number }>(
      'SELECT * FROM users WHERE id = ?',
      LEGACY_ID
    );

    expect(await verifyPassword('LegacyUser123!', legacy.password_hash)).toBe(true);
    expect(legacy.must_change_password).toBe(1);
    expect(legacy.token_version).toBe(0);
  });
});

describe('items that cannot be traced to an owner or project', () => {
  beforeEach(() => {
    migrateTo('0011_moaning_abomination');
    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, 'real@example.com', 'Real', 'h')").run(
      REAL_USER
    );
    db.prepare("INSERT INTO projects (id, user_id, name, color) VALUES ('p-real', ?, 'Real project', '#000')").run(
      REAL_USER
    );
    const insert = db.prepare('INSERT INTO todo_items (id, user_id, project_id, name) VALUES (?, ?, ?, ?)');
    insert.run('with-project', REAL_USER, 'p-real', 'keeps its project');
    insert.run('no-project', REAL_USER, null, 'has no project');
    insert.run('foreign-project', REAL_USER, 'p-elsewhere', 'project does not exist');
    insert.run('no-owner', 'ghost-user', null, 'owner does not exist');
    migrateTo();
  });

  it('leaves items that already have a project untouched', () => {
    expect(rows('SELECT user_id, project_id FROM todo_items WHERE id = ?', 'with-project')).toEqual([
      { user_id: REAL_USER, project_id: 'p-real' },
    ]);
  });

  it('moves items without a valid project into a project of the same owner', () => {
    for (const id of ['no-project', 'foreign-project']) {
      const [item] = rows<{ user_id: string; project_id: string }>(
        'SELECT user_id, project_id FROM todo_items WHERE id = ?',
        id
      );
      const [project] = rows<{ user_id: string; name: string }>(
        'SELECT user_id, name FROM projects WHERE id = ?',
        item.project_id
      );

      expect(item.user_id).toBe(REAL_USER);
      expect(project).toEqual({ user_id: REAL_USER, name: 'Unassigned (migrated)' });
    }
  });

  it('reuses one catch-all project per owner rather than creating one per item', () => {
    expect(
      rows("SELECT id FROM projects WHERE user_id = ? AND name = 'Unassigned (migrated)'", REAL_USER)
    ).toHaveLength(1);
  });

  it('hands items whose owner no longer exists to the legacy account instead of losing them', () => {
    const [item] = rows<{ user_id: string; project_id: string }>(
      'SELECT user_id, project_id FROM todo_items WHERE id = ?',
      'no-owner'
    );

    expect(item.user_id).toBe(LEGACY_ID);
    expect(rows('SELECT user_id FROM projects WHERE id = ?', item.project_id)).toEqual([{ user_id: LEGACY_ID }]);
  });

  it('keeps all four items and a consistent database', () => {
    expect(rows('SELECT id FROM todo_items')).toHaveLength(4);
    expect(rows('PRAGMA foreign_key_check')).toEqual([]);
  });
});

describe('the token version migration', () => {
  it('gives every existing account version 0', () => {
    migrateTo('0012_require_item_owner_and_project');
    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES ('u1', 'a@example.com', 'A', 'h')").run();
    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES ('u2', 'b@example.com', 'B', 'h')").run();

    migrateTo();

    expect(rows('SELECT DISTINCT token_version FROM users')).toEqual([{ token_version: 0 }]);
  });
});

describe('re-running the migrations', () => {
  it('is a no-op the second time', () => {
    migrateTo();
    db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES ('u1', 'a@example.com', 'A', 'h')").run();
    const before = rows('SELECT * FROM users ORDER BY id');

    migrateTo();

    expect(rows('SELECT * FROM users ORDER BY id')).toEqual(before);
    expect(rows('SELECT id FROM users WHERE id = ?', LEGACY_ID)).toHaveLength(1);
  });
});
