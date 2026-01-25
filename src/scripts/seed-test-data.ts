import { query, transactionClient } from '../database/connection';
import bcrypt from 'bcrypt';
import path from 'path';

export const TEST_USERS = [
  {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  },
  {
    email: 'friend@example.com',
    password: 'password123',
    name: 'Test Friend',
  },
];
export const TEST_RELATIONS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Groceries',
    owner_email: 'test@example.com',
    editor_emails: ['friend@example.com'],
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Hardware Store',
    owner_email: 'test@example.com',
    editor_emails: [],
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Shared List',
    owner_email: 'friend@example.com',
    editor_emails: ['test@example.com'],
  },
];

export const TEST_TASKS = [
  // Groceries list
  {
    id: 'aaaa1111-1111-1111-1111-111111111111',
    task: 'Milk',
    relation_id: '11111111-1111-1111-1111-111111111111',
    order_idx: 0,
  },
  {
    id: 'aaaa2222-2222-2222-2222-222222222222',
    task: 'Bread',
    relation_id: '11111111-1111-1111-1111-111111111111',
    order_idx: 1,
  },
  // Hardware Store list
  {
    id: 'bbbb1111-1111-1111-1111-111111111111',
    task: 'Screws',
    relation_id: '22222222-2222-2222-2222-222222222222',
    order_idx: 0,
  },
  {
    id: 'bbbb2222-2222-2222-2222-222222222222',
    task: 'Hammer',
    relation_id: '22222222-2222-2222-2222-222222222222',
    order_idx: 1,
  },
  // Shared List
  {
    id: 'cccc1111-1111-1111-1111-111111111111',
    task: 'Call mom',
    relation_id: '33333333-3333-3333-3333-333333333333',
    order_idx: 0,
  },
  {
    id: 'cccc2222-2222-2222-2222-222222222222',
    task: 'Pay bills',
    relation_id: '33333333-3333-3333-3333-333333333333',
    order_idx: 1,
  },
];

export async function runMigrations() {
  console.log('📦 Running migrations...\n');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment');
  }

  try {
    const { runner } = await import('node-pg-migrate');

    await runner({
      databaseUrl: process.env.DATABASE_URL,
      migrationsTable: 'pgmigrations',
      dir: path.resolve(__dirname, '../database/migrations'),
      direction: 'up',
      count: Infinity,
    });

    console.log('✓ Migrations completed\n');
  } catch (error: any) {
    console.error('❌ Migration error:', error.message);
    throw error;
  }
}
export async function seedData() {
  try {
    await runMigrations();
    await seedUsers();
    await seedTestRelationsAndTasks();
    process.exit(0);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
}
export async function seedTestData() {
  await seedUsers();
  await seedTestRelationsAndTasks();
}
export async function seedUsers() {
  console.log('🌱 Setting up test database...\n');

  try {
    // Create test users
    for (const user of TEST_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      try {
        const result = await query(
          'INSERT INTO Users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
          [user.email, hashedPassword, user.name]
        );
        console.log(`✓ Created user: ${result.rows[0].email} (ID: ${result.rows[0].id})`);
      } catch (error: any) {
        if (error.code === '23505') {
          // Unique constraint violation - user already exists
          console.log(`→ User already exists: ${user.email}`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Test data seeded successfully!');
    console.log('\nTest credentials for Maestro:');
    console.log('  Email: test@example.com');
    console.log('  Password: password123\n');
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw Error();
  }
}
export async function seedTestRelationsAndTasks() {
  const tx = await transactionClient();

  try {
    await tx.query('BEGIN');

    // Insert relations
    for (const relation of TEST_RELATIONS) {
      try {
        await tx.query(`INSERT INTO task_relation (id, name) VALUES ($1, $2)`, [
          relation.id,
          relation.name,
        ]);

        // Get owner user id and create permission
        const userResult = await tx.query(`SELECT id FROM users WHERE email = $1`, [
          relation.owner_email,
        ]);
        if (userResult.rows[0]) {
          await tx.query(
            `INSERT INTO task_permissions (task_relation_id, user_id, permission) VALUES ($1, $2, 'owner')`,
            [relation.id, userResult.rows[0].id]
          );
        }

        // Add editor permissions
        for (const editorEmail of relation.editor_emails) {
          const editorResult = await tx.query(`SELECT id FROM users WHERE email = $1`, [
            editorEmail,
          ]);
          if (editorResult.rows[0]) {
            await tx.query(
              `INSERT INTO task_permissions (task_relation_id, user_id, permission) VALUES ($1, $2, 'edit')`,
              [relation.id, editorResult.rows[0].id]
            );
          }
        }
        tx.query('COMMIT');
      } catch (error: any) {
        tx.query('ROLLBACK');
        if (error.code === '23505') {
          console.log(`→ Relation already exists: ${relation.name}`);
        } else {
          throw error;
        }
      }
    }

    // Insert tasks
    for (const task of TEST_TASKS) {
      try {
        await tx.query(
          `INSERT INTO task (id, task, task_relations_id, order_idx) VALUES ($1, $2, $3, $4)`,
          [task.id, task.task, task.relation_id, task.order_idx]
        );
      } catch (error: any) {
        if (error.code === '23505') {
          console.log(`→ Task already exists: ${task.task}`);
        } else {
          throw error;
        }
      }
    }

    await tx.query('COMMIT');
    console.log('\n✅ Relations and tasks seeded successfully!');
  } catch (error) {
    await tx.query('ROLLBACK');
    throw error;
  } finally {
    tx.release();
  }
}
export async function clearTestData() {
  await query(
    'TRUNCATE TABLE users, task_relation, task, task_permissions RESTART IDENTITY CASCADE',
    []
  );
}
if (require.main === module) {
  seedData();
}
