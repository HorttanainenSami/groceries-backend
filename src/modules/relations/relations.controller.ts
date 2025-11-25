import { AuthenticationError } from '../../middleware/Error.types';
import { NextFunction, Request, Response } from 'express';
import {
  grantRelationPermission,
  createTaskRelation,
  getRelationWithTasks,
  getUserPermission,
  getAllRelations,
  removeRelation,
  editRelationsName,
} from './relations.service';
import {
  postRelationAndShareWithUserRequestSchema,
  shareRelationWithUserReqSchema,
  deleteRelationParamsSchema,
  getRelationsResponseSchema,
  TaskRelationType,
  editRelationNameBodySchema,
  getRelationsResponseType
} from '@groceries/shared_types';
import { decodeTokenFromRequest } from '../../resources/utils';
import { transactionClient, transactionQuery } from '../../database/connection';
import { getUserById } from '../user/user.service';
import { createTaskForRelation } from '../tasks/tasks.service';

export const postRelationAndShareWithUser = async (
  req: Request,
  res: Response<getRelationsResponseType[]>,
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

    const create_relation_and_grant_permissions = async (relation: TaskRelationType) => {
      const newRelation = await createTaskRelation(relation,
        txQuery
      );
      console.log(newRelation, "******************", newRelation.created_at, " typeof ", typeof newRelation.created_at)
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
    }

    //create relations
    const initialRelations = await Promise.all(
      task_relations.map(async (relation) => create_relation_and_grant_permissions(relation))
    );
    await txQuery('COMMIT', []);
    console.log('COMMITED');
    const sharedWith = await getUserById(user_shared_with, txQuery);
    //add collaboratiors for relations
    console.log(initialRelations[0].created_at, " ******************* ", typeof initialRelations[0].created_at)
    const parsedResponse = getRelationsResponseSchema
      .array()
      .parse(
        initialRelations.map((r) => ({
          ...r,
          my_permission: 'owner',
          shared_with_id: sharedWith.id,
          shared_with_name: sharedWith.name,
          shared_with_email: sharedWith.email,
        }))
      );
    console.log('parsedResponse', parsedResponse);
    res.send(parsedResponse);
  } catch (e) {
    await txQuery('ROLLBACK', []);
    console.log('ROLLING BACK ', e);
    next(e);
  }
};


export const shareRelationWithUser = async (
  req: Request,
  res: Response<{message: string}>,
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

export const getRelationsById = async (
  user_id: string,
  relation_id: string
): Promise<TaskRelationType> => {
  try {
    await getUserPermission({ id: user_id }, { id: relation_id });
    const relation = await getRelationWithTasks({ id: relation_id });
    if (!relation) {
      throw new Error('Relation not found');
    }
    return relation;
  } catch (e) {
    console.error('Error fetching relation by ID:', e);
    throw e;
  }
};
export const getRelations = async (
  req: Request,
  res: Response<Omit<getRelationsResponseType, 'tasks'>[]>,
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



export const removeRelationFromServerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = decodeTokenFromRequest(req);
    const { relation_id } = deleteRelationParamsSchema.parse(req.params);
    if (Array.isArray(relation_id)) {
      const promises = relation_id.map((relId) =>
        removeRelationFromServer(id, relId)
      );
      const responses = await Promise.all(promises);
      return res.status(200).send(responses);
    }
    const response = await removeRelationFromServer(id, relation_id);
    res.status(200).send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};
export const removeRelationFromServer = async (
  user_id: string,
  relation_id: string
): Promise<[boolean, string]> => {
  try {
    await getUserPermission({ id: user_id }, { id: relation_id });
    //remove relation
    const response = await removeRelation({ id: relation_id });

    return [true, response.id];
  } catch (e) {
    console.error('Error removing relation from server:', e);
    return [false, relation_id];
  }
};
export const changeRelationNameHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = decodeTokenFromRequest(req);
    const { relation_id, new_name } = editRelationNameBodySchema.parse(
      req.body
    );
    await getUserPermission({ id }, { id: relation_id });
    const response = await changeRelationName(relation_id, new_name);
    res.send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};
export const changeRelationName = async (
  relation_id: string,
  newName: string
): Promise<Omit<TaskRelationType, 'tasks'>> => {
  try {
    const updatedRelation = await editRelationsName(relation_id, newName);
    return updatedRelation;
  } catch (e) {
    console.error('Error changing relation name:', e);
    throw e;
  }
};
