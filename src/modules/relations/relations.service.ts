import { query } from '../../database/connection';
import { DatabaseError as pgError } from 'pg';
import { ApplicationError, AuthorizationError, DatabaseError } from '../../middleware/Error.types';
import {
  UserType,
  permissionSchema,
  BasicRelationWithTasksType,
  PermissionType,
  getRelationByIdQueryResponseType,
  getRelationsResponseType,
  BasicRelationType,
  ServerRelationType,
  ServerRelationWithTasksAndPermissionsType,
} from '@groceries/shared_types';

type CreateTaskRelationResponseType = Omit<ServerRelationType, 'created_at'> & { created_at: Date };
export const createTaskRelation = async (
  relation: BasicRelationWithTasksType,
  queryOrTxQuery?: typeof query
): Promise<ServerRelationType> => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  try {
    const create_relation_query = await queryOrTxQuery<CreateTaskRelationResponseType>(
      `
      INSERT INTO Task_relation( name, created_at)
      values ($1,$2) RETURNING *;
    `,
      [relation.name, relation.created_at]
    );
    if (create_relation_query.rowCount === 0) throw Error('Could not create relation');

    return create_relation_query.rows.map((item) => ({
      ...item,
      created_at: item.created_at.toISOString(),
    }))[0];
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
export const getRelationWithTasks = async (
  task_relation_id: Pick<BasicRelationWithTasksType, 'id'>,
  user_id: Pick<UserType, 'id'>,
  txQuery?: typeof query
): Promise<ServerRelationWithTasksAndPermissionsType> => {
  if (txQuery === undefined) {
    txQuery = query;
  }
  try {
    //relations info and permission
    const collaborators = await getCollaborators(user_id, task_relation_id, txQuery);
    const user_permission = await getUserPermission(user_id, task_relation_id, txQuery);
    const queryRelationById = await txQuery<getRelationByIdQueryResponseType>(
      `
        SELECT 
          tr.id as relation_id,
          tr.name as relation_name,
          tr.created_at as relation_created_at,
          tr.relation_location as relation_location,
          task.id as task_id, 
          task.task as task_task,
          task.created_at as task_created_at,
          task.completed_at as task_completed_at, 
          task.completed_by as task_completed_by,
          task.task_relations_id as task_relations_id
           FROM task_relation
            AS tr LEFT JOIN task
            ON tr.id=task.task_relations_id
             WHERE tr.id=$1;
      `,
      [task_relation_id.id]
    );
    const tasks = queryRelationById.rows.map(
      ({
        task_id,
        task_task,
        task_created_at,
        task_completed_at,
        task_completed_by,
        task_relations_id,
      }) => ({
        id: task_id,
        task: task_task,
        created_at: task_created_at?.toISOString(),
        completed_at: task_completed_at?.toISOString() || null,
        completed_by: task_completed_by || null,
        task_relations_id: task_relations_id,
      })
    );
    if (queryRelationById.rows.length === 0) {
      throw new Error('Relation not found');
    }
    return {
      id: queryRelationById.rows[0].relation_id,
      name: queryRelationById.rows[0].relation_name,
      created_at: queryRelationById.rows[0].relation_created_at.toISOString(),
      relation_location: queryRelationById.rows[0].relation_location,
      permission: user_permission.permission,
      shared_with: collaborators,
      tasks: tasks.filter((t) => t.id !== null),
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
export const removeRelation = async (taskRelationId: Pick<BasicRelationWithTasksType, 'id'>) => {
  try {
    const q = await query<Pick<BasicRelationType, 'id'>>(
      `
        DELETE FROM Task_relation WHERE id = $1 RETURNING id;
      `,
      [taskRelationId.id]
    );
    if (q.rowCount === 0) throw new Error('Relation not found');
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
type GetAllRelationsResponseType = Omit<getRelationsResponseType, 'created_at'> & {
  created_at: Date;
};
export const getAllRelations = async (user: Pick<UserType, 'id'>) => {
  try {
    console.log(user);
    const q = await query<GetAllRelationsResponseType>(
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

      [user.id]
    );
    return q.rows.map((i) => ({ ...i, created_at: i.created_at.toISOString() }));
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
  userId: Pick<UserType, 'id'>,
  taskRelationId: Pick<BasicRelationWithTasksType, 'id'>,
  txQuery?: typeof query
): Promise<PermissionType> => {
  try {
    if (!txQuery) txQuery = query;
    const q = await txQuery<PermissionType>(
      `
        SELECT permission FROM task_permissions WHERE user_id = $1 AND task_relation_id = $2;
      `,
      [userId.id, taskRelationId.id]
    );

    if (q.rows.length === 0)
      throw new AuthorizationError('User does not have permission to edit this list');
    console.log('hello from user permission', userId, taskRelationId, q.rows[0], q.rows.length);

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
  userId: Pick<UserType, 'id'>,
  taskRelationId: Pick<BasicRelationWithTasksType, 'id'>,
  permission: PermissionType,
  queryOrTxQuery?: typeof query
) => {
  if (queryOrTxQuery === undefined) {
    queryOrTxQuery = query;
  }
  try {
    console.log('adding relation collaborator', userId, taskRelationId, permission);

    const q = await queryOrTxQuery(
      `
        INSERT INTO task_permissions (user_id, task_relation_id, permission)
        values ($1, $2, $3) RETURNING *;
      `,
      [userId.id, taskRelationId.id, permission.permission]
    );
    if (q.rowCount === 0 || !q.rows[0]) {
      throw new Error('Failed to grant permission');
    }
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
type GetCollaboratorsType = Omit<UserType, 'password'> & PermissionType;

export const getCollaborators = async (
  { id }: Pick<UserType, 'id'>,
  relations: Pick<ServerRelationType, 'id'>,
  txQuery?: typeof query
): Promise<Omit<UserType, 'password'>[]> => {
  if (!txQuery) txQuery = query;
  try {
    const q = await txQuery<GetCollaboratorsType>(
      `
        SELECT users.id as id, users.email as email, users.name as name, task_permissions.permission as permission  
        FROM task_permissions
        LEFT JOIN users ON users.id=task_permissions.user_id
        WHERE task_relation_id = $1 AND task_permissions.user_id != $2;
      `,
      [relations.id, id]
    );
    return q.rows;
  } catch (e) {
    throw Error('Error' + e);
  }
};

type EditRelationsNameResponseType = Omit<ServerRelationType, 'created_at'> & { created_at: Date };
export const editRelationsName = async (
  id: string,
  newName: string,
  userId: string,
  txQuery: typeof query
): Promise<getRelationsResponseType> => {
  if (txQuery === undefined) {
    txQuery = query;
  }
  try {
    await txQuery<EditRelationsNameResponseType>(
      'UPDATE task_relation SET name = $1 WHERE id = $2 RETURNING *',
      [newName, id]
    );
    const updated_response = await txQuery<GetAllRelationsResponseType>(
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
      WHERE me.user_id IS NOT NULL AND r.id = $2;

      `,

      [userId, id]
    );
    if (updated_response.rowCount === 0) {
      throw new Error('Relation not found after update');
    }

    return updated_response.rows.map((i) => ({ ...i, created_at: i.created_at.toISOString() }))[0];
  } catch (error) {
    if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to change relation name', error);
    }
    console.error('Error changing relation name:', error);
    throw error;
  }
};
