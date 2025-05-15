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
} from './relations.schema';
import { decodeToken } from '../../resources/utils';

export const postRelationAndShareWithUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('Hello from postRelationAndShareWithUser');

  try {
    console.log(req.body);
    const { task_relations, user_shared_with } =
      postRelationAndShareWithUserRequestSchema.parse(req.body);

    const { id } = decodeToken(req);

    //create relations
    const initialRelations = await Promise.all(
      task_relations.map(async (relation) => {
        const newRelation = await createTaskRelation({
          ...relation,
          created_at: new Date(),
        });
        await grantRelationPermission(
          { id },
          { id: newRelation.id },
          { permission: 'owner' }
        );
        await grantRelationPermission(
          { id: user_shared_with },
          { id: newRelation.id },
          { permission: 'edit' }
        );
        await createTaskForRelation(
          relation.tasks.map((task) => ({
            ...task,
            task_relations_id: newRelation.id,
          }))
        );
        return newRelation;
      })
    );
    //add collaboratiors for relations
    res.send(initialRelations);
  } catch (e) {
    console.log(e);
    next(e);
  }
};

export const postTaskToRelation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { task } = postTaskToRelationReqSchema.parse(req.body);
    const { id } = decodeToken(req);
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
    res.send(promise);
  } catch (e) {
    next(e);
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

    const { id } = decodeToken(req);
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
    const { id } = decodeToken(req);
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
    const { id } = decodeToken(req);
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

export const editTaskById = async (
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
    const { id } = decodeToken(req);
    //check if token owner is owner of relation

    await getUserPermission({ id }, { id: relation_id });
    const serverTask = await getTaskById({ task_id, relation_id });
    console.log(serverTask, taskWithoutId);
    const patchedTask = patchTaskSchema.parse({ ...taskWithoutId });

    const response = await editTask({ ...serverTask, ...patchedTask });
    res.send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};

export const removeTaskFromRelation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { relation_id, task_id } = removeTaskFromRelationReqParams.parse(
      req.params
    );
    const { id } = decodeToken(req);
    await getUserPermission({ id }, { id: relation_id });
    const relation = await removeTask({ id: task_id });
    res.send(relation);
  } catch (e) {
    console.log(e);
    next(e);
  }
};
