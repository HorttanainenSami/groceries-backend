import { TaskType } from '@groceries/shared_types';
import { query } from '../../database/connection';
import { ApplicationError, DatabaseError, NotFoundError } from '../../middleware/Error.types';
import { DatabaseError as pgError } from 'pg';

export const createTaskForRelation = async (
  task: TaskType | TaskType[],
  queryOrTxQuery?: typeof query
): Promise<TaskType[]> => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  try {
    if (Array.isArray(task)) {
      return createMultipleTaskForRelation(task, queryOrTxQuery);
    } else {
      return createSingleTaskForRelation(task, queryOrTxQuery);
    }
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error; // Rethrow the error to be handled by the caller
    } else if (error instanceof pgError) {
      throw new DatabaseError('Failed to create task', error);
    }
    throw error;
  }
};
export const createSingleTaskForRelation = async (
  task: TaskType,
  queryOrTxQuery?: typeof query
): Promise<TaskType[]> => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  try {
    const q = await queryOrTxQuery<TaskType>(
      `
      INSERT INTO Task (id, task, created_at, completed_at, completed_by, task_relations_id, order_idx, last_modified)
      values ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;
      `,
      [
        task.id,
        task.task,
        task.created_at,
        task.completed_at,
        task.completed_by,
        task.task_relations_id,
        task.order_idx,
        task.last_modified,
      ]
    );
    return q.rows;
  } catch (error) {
    if (error instanceof pgError) {
      if (error.code === '23505') {
        throw new DatabaseError(`Unique constraint violation ${error.constraint}`, error);
      }
      throw new DatabaseError('Error creating task for relation', error);
    }
    throw error;
  }
};
export const createMultipleTaskForRelation = async (
  task: TaskType[],
  queryOrTxQuery?: typeof query
): Promise<TaskType[]> => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  const dynamicValues = task
    .map(
      (_, idx) =>
        `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`
    )
    .join(', ');
  const dynamicParameters = task.flatMap(
    ({
      id,
      task,
      created_at,
      completed_at,
      completed_by,
      task_relations_id,
      order_idx,
      last_modified,
    }) => [
      id,
      task,
      created_at,
      completed_at,
      completed_by,
      task_relations_id,
      order_idx,
      last_modified,
    ]
  );
  const queryString = `INSERT INTO Task (id, task, created_at, completed_at, completed_by, task_relations_id, order_idx, last_modified)
    values ${dynamicValues} RETURNING *;`;
  return (await queryOrTxQuery<TaskType>(queryString, dynamicParameters)).rows;
};
export const removeTask = async (task_id: Pick<TaskType, 'id'>) => {
  try {
    const q = await query<TaskType>(
      `
        DELETE FROM Task WHERE id = $1 RETURNING *;
      `,
      [task_id.id]
    );
    return q.rows[0];
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to delete task', error);
    }
    console.error('Error deleting task:', error);
    throw error;
  }
};

export const editTask = async ({
  id,
  task,
  completed_at,
  completed_by,
  order_idx,
  last_modified,
}: TaskType) => {
  try {
    const update_query = `
      UPDATE TASK SET task=$2, completed_by=$3, completed_at=$4, order_idx=$5, last_modified=$6 WHERE id = $1 RETURNING *;
      `;
    const q = await query<TaskType>(update_query, [
      id,
      task,
      completed_by,
      completed_at,
      order_idx,
      last_modified ?? new Date().toISOString(),
    ]);
    return q.rows[0];
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to edit task', error);
    }
    console.error('Error editing task:', error);
    throw error;
  }
};
export const getTaskById = async ({
  task_id,
  relation_id,
}: {
  task_id: string;
  relation_id: string;
}) => {
  try {
    const q = await query<TaskType>('SELECT * from Task WHERE id=$1 AND task_relations_id=$2', [
      task_id,
      relation_id,
    ]);
    if (q.rows.length === 0) {
      throw new NotFoundError('No such task found');
    }
    return q.rows[0];
  } catch (error) {
    if (error instanceof pgError) {
      throw new DatabaseError('Failet to get task by id', error);
    }
    throw error;
  }
};

export const getAllTasksByRelationId = async (relation_id: string): Promise<TaskType[]> => {
  try {
    const q = await query<TaskType>('SELECT * from Task WHERE task_relations_id=$1', [relation_id]);
    return q.rows;
  } catch (error) {
    if (error instanceof pgError) {
      throw new DatabaseError('Failet to get task by id', error);
    }
    throw error;
  }
};
export const reorderTask = async ({
  id,
  order_idx,
  last_modified,
}: Pick<TaskType, 'id' | 'order_idx' | 'last_modified'>) => {
  try {
    const update_query = `
      UPDATE TASK SET order_idx=$1, last_modified=$2 WHERE id = $3 RETURNING *;
      `;
    const q = await query<TaskType>(update_query, [
      order_idx,
      last_modified ?? new Date().toISOString(),
      id,
    ]);
    return q.rows[0];
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to reorder task', error);
    }
    console.error('Error editing task:', error);
    throw error;
  }
};
