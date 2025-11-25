import { TaskType } from "@groceries/shared_types";
import { query } from '../../database/connection';
import { ApplicationError, DatabaseError } from "../../middleware/Error.types";
import { DatabaseError as pgError } from 'pg';



export const createTaskForRelation = async (
  task: Omit<TaskType, 'id'> | Omit<TaskType, 'id'>[],
  queryOrTxQuery?: typeof query
) => {
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
  task: Omit<TaskType, 'id'>,
  queryOrTxQuery?: typeof query
) => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  const q = await queryOrTxQuery<TaskType>(
    `
      INSERT INTO Task (task, created_at, completed_at, completed_by, task_relations_id)
      values ($1,$2,$3,$4,$5) RETURNING *;
    `,
    [
      task.task,
      task.created_at,
      task.completed_at,
      task.completed_by,
      task.task_relations_id,
    ]
  );
  return q.rows[0];
};
export const createMultipleTaskForRelation = async (
  task: Omit<TaskType, 'id'>[],
  queryOrTxQuery?: typeof query
) => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  const dynamicValues = task
    .map(
      (_, idx) =>
        `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${
          idx * 5 + 4
        }, $${idx * 5 + 5})`
    )
    .join(', ');
  const dynamicParameters = task.flatMap(
    ({ task, created_at, completed_at, completed_by, task_relations_id }) => [
      task,
      created_at,
      completed_at,
      completed_by,
      task_relations_id,
    ]
  );
  const queryString = `INSERT INTO Task (task, created_at, completed_at, completed_by, task_relations_id)
    values ${dynamicValues} RETURNING *;`;
  console.log('queryString', queryString, dynamicValues, task);
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
}: Pick<TaskType, 'completed_at' | 'completed_by' | 'task' | 'id'>) => {
  try {
    const update_query = `
      UPDATE TASK SET task=$2, completed_by=$3, completed_at=$4 WHERE id = $1 RETURNING *;
      `;
    console.log(update_query, [id, task, completed_by, completed_at]);
    const q = await query<TaskType>(update_query, [
      id,
      task,
      completed_by,
      completed_at,
    ]);
    console.log('query', q.rows[0]);
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
  const q = await query<TaskType>(
    'SELECT * from Task WHERE id=$1 AND task_relations_id=$2',
    [task_id, relation_id]
  );
  return q.rows[0];
};

