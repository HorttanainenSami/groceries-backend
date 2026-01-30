exports.up = (pgm) => {
  // Enable UUID extension
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  pgm.createTable('users', {
    id: {
      type: 'UUID',
      primaryKey: true,
      unique: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: {
      type: 'VARCHAR',
      notNull: true,
      unique: true,
    },
    password: {
      type: 'VARCHAR',
      notNull: true,
    },
    name: {
      type: 'VARCHAR',
      notNull: true,
      unique: true,
    },
  });

  pgm.createTable('task_relation', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
      unique: true,
    },
    name: {
      type: 'VARCHAR',
      notNull: true,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    relation_location: {
      type: 'VARCHAR',
      check: "relation_location IN ('Server')",
      default: 'Server',
    },
  });

  pgm.createTable('task', {
    id: {
      type: 'UUID',
      primaryKey: true,
      unique: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    task: {
      type: 'VARCHAR',
      notNull: true,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    completed_at: {
      type: 'TIMESTAMPTZ',
    },
    completed_by: {
      type: 'UUID',
      references: 'users(id)',
    },
    task_relations_id: {
      type: 'UUID',
      references: 'task_relation(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.createTable('task_permissions', {
    id: {
      type: 'UUID',
      primaryKey: true,
      unique: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    task_relation_id: {
      type: 'UUID',
      notNull: true,
      references: 'task_relation(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    permission: {
      type: 'VARCHAR(10)',
      notNull: true,
      check: "permission IN ('owner', 'edit')",
    },
  });

  pgm.addConstraint('task_permissions', 'task_permissions_unique', {
    unique: ['task_relation_id', 'user_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('task_permissions');
  pgm.dropTable('task');
  pgm.dropTable('task_relation');
  pgm.dropTable('users');
};
