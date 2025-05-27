import { AuthenticationError } from '../../middleware/Error.types';
import { NextFunction, Request, Response } from 'express';
import {
  grantRelationPermission,
  createTaskForRelation,
  createTaskRelation,
  getRelationWithTasks,
  getUserPermission,
  getAllRelations,
  editTask,
  removeTask,
  getTaskById,
  removeRelation,
} from './relations.service';
import {
  postRelationAndShareWithUserRequestSchema,
  postTaskToRelationReqSchema,
  shareRelationWithUserReqSchema,
  editRelationsTaskByIdReqParamsSchema,
  editRelationsTaskByIdReqBodySchema,
  getRelationsByIdReqParams,
  removeTaskFromRelationReqParams,
  patchTaskSchema,
  deleteRelationParamsSchema,
  TaskType,
} from './relations.schema';
import { decodeTokenFromRequest } from '../../resources/utils';
import { transactionClient, transactionQuery } from '../../database/connection';

export const postRelationAndShareWithUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('Hello from postRelationAndShareWithUser');
  const txQuery = transactionQuery(await transactionClient());
  try {
    await txQuery('BEGIN', []);
    console.log(req.body);
    const { task_relations, user_shared_with } =
      postRelationAndShareWithUserRequestSchema.parse(req.body);

    const { id } = decodeTokenFromRequest(req);

    //create relations
    const initialRelations = await Promise.all(
      task_relations.map(async (relation) => {
        const newRelation = await createTaskRelation(
          {
            ...relation,
            created_at: new Date(),
          },
          txQuery
        );
        await grantRelationPermission(
          { id },
          { id: newRelation.id },
          { permission: 'owner' },
          txQuery
        );
        await grantRelationPermission(
          { id: user_shared_with },
          { id: newRelation.id },
          { permission: 'edit' },
          txQuery
        );
        if (relation.tasks.length === 0) return newRelation;
        const tasks = relation.tasks.map((task) => ({
          ...task,
          task_relations_id: newRelation.id,
        }));
        await createTaskForRelation(tasks, txQuery);

        return newRelation;
      })
    );
    await txQuery('COMMIT', []);
    console.log('COMMITED');
    //add collaboratiors for relations
    res.send(initialRelations);
  } catch (e) {
    await txQuery('ROLLBACK', []);
    console.log('ROLLING BACK ', e);
    next(e);
  }
};

export const postTaskToRelationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { task } = postTaskToRelationReqSchema.parse(req.body);
    const { id } = decodeTokenFromRequest(req);
    //check if user had permission to edit
    const savedTask = postTaskToRelation(id, task);
    res.send(savedTask);
  } catch (e) {
    next(e);
  }
};
export const postTaskToRelation = async (
  id: string,
  task: Omit<TaskType, 'id'>
) => {
  try {
    //check if user had permission to edit
    const permission = await getUserPermission(
      { id },
      { id: task.task_relations_id }
    );
    if (!permission)
      throw new AuthenticationError(
        'User does not have permission to edit this relation'
      );

    const promise = await createTaskForRelation(task);
    //send lists to server
    return promise;
  } catch (e) {
    throw e;
  }
};

export const shareRelationWithUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { task_relations_id, user_id } = shareRelationWithUserReqSchema.parse(
      req.body
    );

    const { id } = decodeTokenFromRequest(req);
    //check if token owner is owner of relation
    const { permission } = await getUserPermission(
      { id },
      { id: task_relations_id }
    );
    if (permission !== 'owner')
      throw new AuthenticationError(
        'User does not have permission to edit this list'
      );

    //share relation with user
    await grantRelationPermission(
      { id: user_id },
      { id: task_relations_id },
      { permission: 'edit' }
    );

    res.status(200).json({ message: 'Relation shared successfully' });
  } catch (e) {
    next(e);
  }
};

export const getRelationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const params = req.params;
    const { relation_id } = getRelationsByIdReqParams.parse(params);
    const { id } = decodeTokenFromRequest(req);
    await getUserPermission({ id }, { id: relation_id });
    const relation = await getRelationWithTasks({ id: relation_id });
    res.send(relation);
  } catch (e) {
    next(e);
  }
};
export const getRelations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = decodeTokenFromRequest(req);
    const relation = await getAllRelations({ id });
    res.send(relation);
  } catch (e) {
    next(e);
  }
};
//**************************
//
// tee schema

// */

export const editTaskByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log(req.body);
    const taskWithoutId = editRelationsTaskByIdReqBodySchema.parse(req.body);
    const { relation_id, task_id } = editRelationsTaskByIdReqParamsSchema.parse(
      req.params
    );
    const { id } = decodeTokenFromRequest(req);
    const response = await editTaskBy(id, relation_id, task_id, taskWithoutId);
    res.send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};

export const editTaskBy = async (
  id: string,
  relation_id: string,
  task_id: string,
  task_without_id: Partial<
    Pick<TaskType, 'completed_by' | 'completed_at' | 'task'>
  >
) => {
  try {
    await getUserPermission({ id }, { id: relation_id });
    console.log('relation_id', relation_id);
    const serverTask = await getTaskById({ task_id, relation_id });
    console.log('serverTask', serverTask);
    const patchedTask = patchTaskSchema.parse({ ...task_without_id });
    console.log('patchedTask', patchedTask);
    const response = await editTask({ ...serverTask, ...patchedTask });
    return response;
  } catch (e) {
    console.error('Error editing task:', e);
    throw e;
  }
};

export const removeTaskFromRelationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { relation_id, task_id } = removeTaskFromRelationReqParams.parse(
      req.params
    );
    const { id } = decodeTokenFromRequest(req);
    const response = await removeTaskFromRelation(id, relation_id, task_id);
    res.send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};

export const removeTaskFromRelation =  async (
  id: string, 
  relation_id: string,
  task_id: string
) => {
  try {
    await getUserPermission({ id }, { id: relation_id });
    const relation = await removeTask({ id: task_id });
    return relation;
  } catch (e) {
    console.log(e);
    throw e;
  }
};

export const removeRelationFromServer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = decodeTokenFromRequest(req);
    const { relation_id } = deleteRelationParamsSchema.parse(req.params);
    await getUserPermission({ id }, { id: relation_id });
    //remove relation
    await removeRelation({ id: relation_id });

    res.send('ok');
  } catch (e) {
    console.log(e);
    next(e);
  }
};
