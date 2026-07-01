exports.up = (pgm) => {
  pgm.createTable('refresh_tokens', {
    token: {
      type: 'VARCHAR',
      primaryKey: true,
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    expires_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('refresh_tokens');
};
