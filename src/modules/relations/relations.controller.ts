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
  editRelationNameBodySchema,
  UserType,
  ServerRelationType,
  LocalRelationWithTasksType,
  ServerRelationWithTasksType,
  createAndShareRelationsSchema,
  createAndShareRelationsType,
  getRelationsByIdPropsSchema,
  getRelationsByIdProps,
} from '@groceries/shared_types';
import { decodeTokenFromRequest } from '../../resources/utils';
import { transactionClient, transactionQuery } from '../../database/connection';
import { createTaskForRelation } from '../tasks/tasks.service';

export const postRelationAndShareWithUser = async (
  req: Request,
  res: Response<ServerRelationWithTasksType[]>,
  next: NextFunction
) => {
  try {
    const { task_relations, user_shared_with } = postRelationAndShareWithUserRequestSchema.parse(
      req.body
    );
    const { id } = decodeTokenFromRequest(req);
    const response = await create_and_share_relations({
      relationsWithTasks: task_relations,
      userSharedWith: user_shared_with,
      id,
    });
    return res.send(response);
  } catch (e) {
    next(e);
  }
};

export const create_and_share_relations = async (props: createAndShareRelationsType) => {
  const client = await transactionClient();
  const txQuery = transactionQuery(client);
  try {
    const { relationsWithTasks, id, userSharedWith } = createAndShareRelationsSchema.parse(props);

    await txQuery('BEGIN', []);
    //create relations
    const local_relations = relationsWithTasks.filter(
      (r) => r.relation_location === 'Local'
    ) as LocalRelationWithTasksType[];
    const server_relations = relationsWithTasks.filter(
      (r) => r.relation_location === 'Server'
    ) as ServerRelationWithTasksType[];
    const stored_local_relations_promise = local_relations.map(async (relation) =>
      createRelationAndGrantPermissions(id, userSharedWith, relation, txQuery)
    );
    const grant_permission_promise = server_relations.map((r) =>
      grantEditPermissionAndGetRelationWithTasks(id, userSharedWith, r, txQuery)
    );

    const response = await Promise.all([
      Promise.all(stored_local_relations_promise),
      Promise.all(grant_permission_promise),
    ]);

    await txQuery('COMMIT', []);
    return [...response[0], ...response[1]];
  } catch (e) {
    await txQuery('ROLLBACK', []);
    throw e;
  } finally {
    client.release();
  }
};
const createRelationAndGrantPermissions = async (
  id: string,
  userSharedWith: string,
  relation: LocalRelationWithTasksType,
  txQuery: typeof query
): Promise<ServerRelationWithTasksType> => {
  const newServerRelation = await createRelationWithOwnerPremission(id, relation, txQuery);
  const sharedRelation = await grantEditPermissionAndGetRelationWithTasks(
    id,
    userSharedWith,
    newServerRelation,
    txQuery
  );
  if (relation.tasks.length === 0) return sharedRelation;
  const initTasks = relation.tasks.map((task) => ({
    ...task,
    task_relations_id: newServerRelation.id,
  }));
  const serverStoredTasks = await createTaskForRelation(initTasks, txQuery);
  const returnTasks = serverStoredTasks
    ? Array.isArray(serverStoredTasks)
      ? serverStoredTasks
      : [serverStoredTasks]
    : [];
  return { ...sharedRelation, tasks: returnTasks };
};
const createRelationWithOwnerPremission = async (
  id: string,
  relation: LocalRelationWithTasksType,
  txQuery: typeof query
) => {
  const { id: relation_id } = await createTaskRelation(relation, txQuery);
  await grantRelationPermission({ id }, { id: relation_id }, { permission: 'owner' }, txQuery);
  const response = await getRelationWithTasks({ id: relation_id }, { id }, txQuery);
  return response;
};

const grantEditPermissionAndGetRelationWithTasks = async (
  id: string,
  userSharedWith: string,
  relation: ServerRelationType,
  txQuery: typeof query
): Promise<ServerRelationWithTasksType> => {
  await grantRelationPermission(
    { id: userSharedWith },
    { id: relation.id },
    { permission: 'edit' },
    txQuery
  );

  const response = await getRelationWithTasks({ id: relation.id }, { id }, txQuery);
  return response;
};

export const getRelationsById = async (
  props: getRelationsByIdProps
): Promise<ServerRelationWithTasksType> => {
  try {
    const { userId, relationId } = getRelationsByIdPropsSchema.parse(props);
    await getUserPermission({ id: userId.id }, { id: relationId.id });
    const relation = await getRelationWithTasks({ id: relationId.id }, { id: userId.id });
    return relation;
  } catch (e) {
    console.error('Error fetching relation by ID:', e);
    throw e;
  }
};
export const getRelations = async (
  req: Request,
  res: Response<ServerRelationType[]>,
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
    const relationId = deleteRelationParamsSchema.parse(req.params);
    if (Array.isArray(relationId)) {
      const responses = await removeMultipleRelations({ id }, relationId);
      return res.status(200).send(responses);
    }
    const response = await removeRelationFromServer(id, relationId.id);
    res.status(200).send(response);
  } catch (e) {
    next(e);
  }
};
export const removeMultipleRelations = async (
  { id: userId }: Pick<UserType, 'id'>,
  ids: Pick<ServerRelationType, 'id'>[]
) => {
  const promises = ids.map(({ id }) => removeRelationFromServer(userId, id));
  const responses = await Promise.all(promises);
  return responses;
};
export const removeRelationFromServer = async (
  userId: string,
  relationId: string
): Promise<[boolean, string]> => {
  try {
    await getUserPermission({ id: userId }, { id: relationId });
    //remove relation
    const response = await removeRelation({ id: relationId });

    return [true, response.id];
  } catch (e) {
    console.error('Error removing relation from server:', e);
    return [false, relationId];
  }
};
export const changeRelationNameHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = decodeTokenFromRequest(req);
    const { relation_id, new_name } = editRelationNameBodySchema.parse(req.body);
    await getUserPermission({ id }, { id: relation_id });
    const response = await changeRelationName(relation_id, new_name, id);
    res.send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};
export const changeRelationName = async (
  relationId: string,
  newName: string,
  userId: string
): Promise<ServerRelationType> => {
  const client = await transactionClient();
  const txQuery = transactionQuery(client);
  try {
    await txQuery('BEGIN', []);
    const updatedRelation = await editRelationsName(relationId, newName, userId, txQuery);
    await txQuery('COMMIT', []);
    return updatedRelation;
  } catch (e) {
    console.error('Error changing relation name:', e);
    await txQuery('ROLLBACK', []);
    throw e;
  } finally {
    client.release();
  }
};
