import { query } from '../database/connection';
import bcrypt from 'bcrypt';
import path from 'path';

const TEST_USERS = [
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

async function runMigrations() {
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

async function seedTestData() {
  console.log('🌱 Setting up test database...\n');

  try {
    // 1. Run migrations to create tables
    await runMigrations();
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

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  }
}

seedTestData();
