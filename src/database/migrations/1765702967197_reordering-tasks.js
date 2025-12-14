exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('task', {
    order_idx: {
      type: 'integer',
      notNull: true,
      default: 9999,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('task', 'order_idx');
};
