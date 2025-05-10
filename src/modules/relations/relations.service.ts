
import { query } from '../../database/connection';
import { DatabaseError as pgError} from 'pg';
import { ApplicationError, AuthorizationError, DatabaseError } from '../../middleware/Error.types';
import { permissionSchema, TaskRelationType, TaskType, PermissionType,  newTaskSchema } from './relations.schema';
import { User } from '../../types';

export const createTaskRelationWithTasks = async (relation: TaskRelationType, owner: Pick<User, 'id'>) => {
    //need to generate new id because locally generated can allready be in use. lets make uuid so locally generated serial id and backend generated ids cannot collide
    try {
      
      const create_relation_query = await query<Omit<TaskRelationType, 'tasks'>>(`
            INSERT INTO Task_relation( name, created_at)
            values ($1,$2) RETURNING *;
          `, [relation.name, relation.created_at]
          );
    
      const initialRelation = create_relation_query.rows[0];
      await addRelationCollaborator({id: owner.id}, {id: initialRelation.id}, {permission: 'owner'});
      console.log('collaborator owner added');

      //link tasks to serverside relation id 
      const tasks = await Promise.all(
        relation.tasks.map(async task => {
          return await createTaskForRelation(newTaskSchema.parse({...task,task_relations_id: initialRelation.id}))
        }
        
      ));
      console.log('tasks', tasks);
      return { ...initialRelation, tasks};

      
  } catch (error) {
    if(error instanceof ApplicationError) {
      console.error('Application error:', error);
      throw error; // Rethrow the error to be handled by the caller
    }else if (error instanceof pgError) {
      console.error('Database error:', error);
      throw new DatabaseError('Failed to create task relation', error);
    }
    console.error('Error creating task relation:', error);
    throw error;
  }
  };
  
  export const createTaskForRelation = async (task: Omit<TaskType, 'id'>) => {
    try{
      //need to generate new id because locally generated can allready be in use. lets make uuid so locally generated serial id and backend generated ids cannot collide
      if (task.completed_by && task.completed_at) {
        const q = await query<TaskType>(`
          INSERT INTO Task (task, created_at, completed_at, completed_by, task_relations_id)
          values ($1,$2,$3,$4,$5) RETURNING *;
        `, [task.task, task.created_at, task.completed_at, task.completed_by, task.task_relations_id]
        );
        return q.rows[0];
      }
      const q = await query<TaskType>(`
          INSERT INTO Task (task, created_at, task_relations_id)
          values ($1,$2,$3) RETURNING *;
        `, [task.task, task.created_at, task.task_relations_id]
      );
      return q.rows[0];
    } catch (error) {
      if(error instanceof ApplicationError) {
        throw error; // Rethrow the error to be handled by the caller
      }else if (error instanceof pgError) {
        throw new DatabaseError('Failed to create task', error);
      }
      throw error;
    }
  };
  export const getRelationWithTasks = async (task_relation_id: Pick<TaskRelationType, 'id'>) => {
    try {
      const queryRelationById = await query<Omit<TaskRelationType, 'tasks'>>(`
        SELECT * FROM Task_relation WHERE id = $1;
      `, [task_relation_id.id]);

      const tasks = await query<TaskType>(`
        SELECT * FROM Task WHERE task_relations_id = $1;
      `, [task_relation_id.id]);

      const tasksWithRelationId = tasks.rows.map(task => ({ ...task, task_relations_id: task_relation_id.id }));
      const relation = { ...queryRelationById.rows[0], tasks: tasksWithRelationId };
      return relation;
    } catch (error) {
      if (error instanceof pgError) {
        console.error('Database error:', error);
        throw new DatabaseError('Failed to fetch relation with tasks', error);
      }
      console.error('Error fetching relation with tasks:', error);
      throw error;
    }
  };
  export const removeRelation = async (task_relation_id: Pick<TaskRelationType, 'id'>) => {
    try {
      const q = await query(`
        DELETE FROM Task_relation WHERE id = $1 RETURNING *;
      `, [task_relation_id.id]);
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
      const q = await query<TaskType>(`
        DELETE FROM Task WHERE id = $1 RETURNING *;
      `, [task_id.id]);
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

  
  export const editTask = async ({id, task, completed_at, completed_by}: Pick<TaskType, "completed_at"|"completed_by"|"task"|"id">) => {
    try {
      const update_query = `
      UPDATE TASK SET task=$2, completed_by=$3, completed_at=$4 WHERE id = $1 RETURNING *;
      `
      console.log(update_query, [id, task, completed_by, completed_at ]);
      const q = await query<TaskType>(update_query, [id, task, completed_by, completed_at ]);
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
  export const getTaskById = async ({task_id, relation_id}: {task_id: string, relation_id:string}) => {
    try {
      const q = await query<TaskType>('SELECT * from Task WHERE id=$1 AND task_relations_id=$2',[task_id, relation_id])
      return q.rows[0];
    }catch(e){
      throw e;
    }
  }
  export const getAllRelations = async (user_id: Pick<User, 'id'>) => {
    try {
      console.log(user_id);
      const q = await query<Omit<TaskRelationType, 'tasks'>>(`
        SELECT * FROM task_relation WHERE id IN (
          SELECT task_relation_id FROM task_permissions WHERE user_id = $1
        );
      `, [user_id.id]);
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

  export const getUserPermission = async (user_id: Pick<User, 'id'>, task_relation_id: Pick<TaskRelationType, 'id'>): Promise<PermissionType> => {
    try {
      const q = await query<PermissionType>(`
        SELECT permission FROM task_permissions WHERE user_id = $1 AND task_relation_id = $2;
      `, [user_id.id, task_relation_id.id]);

      console.log('hello from user permission', user_id, task_relation_id, q.rows[0], q.rows.length);

      if (q.rows.length === 0) throw new AuthorizationError('User does not have permission to edit this list');

      const editPermission = permissionSchema.parse(q.rows[0]);
      return editPermission;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        console.error('User does not have permission:', error);
        throw error; // Rethrow the error to be handled by the caller
      } else if(error instanceof pgError) {
        console.error('Error fetching user permission:', error);
        throw new DatabaseError('Failed to fetch user permission', error);
      }
      throw error;
    }
  };

  export const addRelationCollaborator = async (user_id: Pick<User, 'id'>, task_relation_id: Pick<TaskRelationType, 'id'>, permission: PermissionType) => {
    try {
      console.log('adding relation collaborator', user_id, task_relation_id, permission);

      const q = await query(`
        INSERT INTO task_permissions (user_id, task_relation_id, permission)
        values ($1, $2, $3) RETURNING *;
      `, [user_id.id, task_relation_id.id, permission.permission]);

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