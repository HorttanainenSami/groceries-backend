import { AuthenticationError } from '../../middleware/Error.types';
import { NextFunction, Request, Response } from 'express';
import { query } from '../../database/connection';
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
  deleteRelationParamsSchema,
  getRelationsResponseSchema,
  BasicRelationWithTasksType,
  editRelationNameBodySchema,
  getRelationsResponseType,
  BasicRelationType,
  UserType,
  ServerRelationType,
  ServerRelationWithTasksType
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
  try {
    console.log(req.body);
    const { task_relations, user_shared_with } =
    postRelationAndShareWithUserRequestSchema.parse(req.body);
    const { id } = decodeTokenFromRequest(req);
    const response = await create_and_share_relations( task_relations, user_shared_with, id);
    return res.send(response);
    
  } catch (e) {
    console.log('ROLLING BACK ', e);
    next(e);
  }
};
export const create_and_share_relations = async (task_relations:BasicRelationWithTasksType[], user_shared_with: string, id: string ) => {
  const client = await transactionClient();
  const txQuery = transactionQuery(client);

  try{
    await txQuery('BEGIN', []);
    //create relations
    const initialRelations = await Promise.all(
      task_relations.map(async (relation) => create_relation_and_grant_permissions(id, user_shared_with, relation, txQuery))
    );
    await txQuery('COMMIT', []);
    console.log('COMMITED');
    const sharedWith = await getUserById(user_shared_with, txQuery);
    client.release();
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
    return parsedResponse;
  } catch (e) {
    await txQuery('ROLLBACK', []);
    console.log('ROLLING BACK ', e);
    client.release();
    throw Error('something went wrong')
  }
}
const create_relation_and_grant_permissions = async (id: string, user_shared_with: string, relation: BasicRelationWithTasksType, txQuery: typeof query) => {
  const newRelation = await createTaskRelation(relation,
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
}


export const getRelationsById = async (
  user_id: string,
  relation_id: string
): Promise<ServerRelationWithTasksType> => {
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
    console.log(req.params);
    const relation_id = deleteRelationParamsSchema.parse(req.params);
    if (Array.isArray(relation_id)) {
      const responses = await removeMultipleRelations({id}, relation_id)
      return res.status(200).send(responses);
    }
    const response = await removeRelationFromServer(id, relation_id.id);
    res.status(200).send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};
export const removeMultipleRelations= async ({id:user_id}: Pick<UserType, 'id'>, ids: Pick<BasicRelationType, 'id'>[]) => {
  const promises = ids.map(({id }) => removeRelationFromServer(user_id, id));
  const responses = await Promise.all(promises);
  return responses;
}
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
): Promise<ServerRelationType> => {
  try {
    const updatedRelation = await editRelationsName(relation_id, newName);
    return updatedRelation;
  } catch (e) {
    console.error('Error changing relation name:', e);
    throw e;
  }
};
