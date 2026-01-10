exports.up = (pgm) => {
  pgm.addColumns('task', {
    last_modified: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  pgm.addColumns('task_relation', {
    last_modified: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('task', 'last_modified');
  pgm.dropColumn('task_relation', 'last_modified');
};
