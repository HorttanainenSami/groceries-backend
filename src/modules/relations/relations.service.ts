import { query } from '../../database/connection';
import { DatabaseError as pgError } from 'pg';
import {
  ApplicationError,
  AuthorizationError,
  DatabaseError,
} from '../../middleware/Error.types';
import {
  permissionSchema,
  TaskRelationType,
  TaskType,
  PermissionType,
  getRelationByIdQueryResponseType,
  getRelationsType,
} from './relations.schema';
import { User } from '../../types';

export const createTaskRelation = async (
  relation: TaskRelationType,
  queryOrTxQuery?: typeof query
) => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  try {
    const create_relation_query = await queryOrTxQuery<
      Omit<TaskRelationType, 'tasks'>
    >(
      `
      INSERT INTO Task_relation( name, created_at)
      values ($1,$2) RETURNING *;
    `,
      [relation.name, relation.created_at]
    );

    return create_relation_query.rows[0];
  } catch (error) {
    if (error instanceof ApplicationError) {
      console.error('Application error:', error);
      throw error; // Rethrow the error to be handled by the caller
    } else if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to create task relation', error);
    }
    console.error('Error creating task relation:', error);
    throw error;
  }
};

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

export const getRelationWithTasks = async (
  task_relation_id: Pick<TaskRelationType, 'id'>,
  txQuery?: typeof query
) => {
  if (txQuery === undefined) {
    txQuery = query;
  }
  try {
    const queryRelationById = await txQuery<getRelationByIdQueryResponseType>(
      `
        SELECT tr.id as relation_id, tr.name, tr.created_at as relation_created_at,tr.relation_location,
         task.id, task.task, task.created_at, task.completed_at, task.completed_by,
          task.task_relations_id
           FROM task_relation
            AS tr LEFT JOIN task
            ON tr.id=task.task_relations_id
             WHERE tr.id=$1;
      `,
      [task_relation_id.id]
    );
    const { relation_id, name, shared, relation_created_at } =
      queryRelationById.rows[0];
    console.log(queryRelationById.rows);
    const tasks = queryRelationById.rows.map(
      ({
        id,
        task,
        created_at,
        completed_at,
        completed_by,
        task_relations_id,
      }) => ({
        id,
        task,
        created_at,
        completed_at,
        completed_by,
        task_relations_id,
      })
    );
    return {
      id: relation_id,
      name,
      shared,
      created_at: relation_created_at,
      tasks,
    };
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to fetch relation with tasks', error);
    }
    console.error('Error fetching relation with tasks:', error);
    throw error;
  }
};
export const removeRelation = async (
  task_relation_id: Pick<TaskRelationType, 'id'>
) => {
  try {
    const q = await query(
      `
        DELETE FROM Task_relation WHERE id = $1 RETURNING *;
      `,
      [task_relation_id.id]
    );
    return q.rows[0];
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to delete relation', error);
    }
    console.error('Error deleting relation:', error);
    throw error;
  }
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
export const getAllRelations = async (user_id: Pick<User, 'id'>) => {
  try {
    console.log(user_id);
    const q = await query<Omit<getRelationsType, 'tasks'>>(
      `
      SELECT 
        r.*, 
        me.permission AS my_permission, 
        users.id as shared_with_id,
        users.name as shared_with_name,
        users.email as shared_with_email
      FROM task_relation r

      LEFT JOIN task_permissions me 
        ON me.task_relation_id = r.id 
        AND me.user_id = $1

      LEFT JOIN task_permissions other 
        ON other.task_relation_id = r.id 
        AND other.user_id != $1

      LEFT JOIN users ON users.id=other.user_id
      WHERE me.user_id IS NOT NULL;

      `,

      [user_id.id]
    );
    return q.rows;
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to fetch relations', error);
    }
    console.error('Error fetching relations:', error);
    throw error;
  }
};

export const getUserPermission = async (
  user_id: Pick<User, 'id'>,
  task_relation_id: Pick<TaskRelationType, 'id'>
): Promise<PermissionType> => {
  try {
    const q = await query<PermissionType>(
      `
        SELECT permission FROM task_permissions WHERE user_id = $1 AND task_relation_id = $2;
      `,
      [user_id.id, task_relation_id.id]
    );

    console.log(
      'hello from user permission',
      user_id,
      task_relation_id,
      q.rows[0],
      q.rows.length
    );

    if (q.rows.length === 0)
      throw new AuthorizationError(
        'User does not have permission to edit this list'
      );

    const editPermission = permissionSchema.parse(q.rows[0]);
    return editPermission;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      console.error('User does not have permission:', error);
      throw error; // Rethrow the error to be handled by the caller
    } else if (error instanceof pgError) {
      console.error('Error fetching user permission:', error);
      throw new DatabaseError('Failed to fetch user permission', error);
    }
    throw error;
  }
};

export const grantRelationPermission = async (
  user_id: Pick<User, 'id'>,
  task_relation_id: Pick<TaskRelationType, 'id'>,
  permission: PermissionType,
  queryOrTxQuery?: typeof query
) => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  try {
    console.log(
      'adding relation collaborator',
      user_id,
      task_relation_id,
      permission
    );

    const q = await queryOrTxQuery(
      `
        INSERT INTO task_permissions (user_id, task_relation_id, permission)
        values ($1, $2, $3) RETURNING *;
      `,
      [user_id.id, task_relation_id.id, permission.permission]
    );

    return q.rows[0];
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to add relation collaborator', error);
    }
    console.error('Error adding relation collaborator:', error);
    throw error;
  }
};
