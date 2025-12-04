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
  BasicRelationWithTasksType,
  editRelationNameBodySchema,
  getRelationsResponseType,
  BasicRelationType,
  UserType,
  ServerRelationType,
  ServerRelationWithTasksType,
  LocalRelationWithTasksType,
  ServerRelationWithTasksAndPermissionsType
} from '@groceries/shared_types';
import { decodeTokenFromRequest } from '../../resources/utils';
import { transactionClient, transactionQuery } from '../../database/connection';
import { createTaskForRelation } from '../tasks/tasks.service';

export const postRelationAndShareWithUser = async (
  req: Request,
  res: Response<ServerRelationWithTasksAndPermissionsType[]>,
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
    next(e);
  }
};
export const create_and_share_relations = async (relations_with_tasks:BasicRelationWithTasksType[], user_shared_with: string, id: string ) => {
  const client = await transactionClient();
  const txQuery = transactionQuery(client);

  try{
    await txQuery('BEGIN', []);
    //create relations
    const local_relations= relations_with_tasks.filter(r => r.relation_location==='Local') as LocalRelationWithTasksType[];
    const server_relations = relations_with_tasks.filter(r => r.relation_location ==='Server') as ServerRelationWithTasksType[];
    const stored_local_relations_promise = local_relations
        .map(async (relation) => create_relation_and_grant_permissions(id, user_shared_with, relation, txQuery));
    const grant_permission_promise = server_relations.map(r => grant_permission_and_get_relation_with_tasks(id, user_shared_with, r, txQuery));
    
    const response = await Promise.all([Promise.all(stored_local_relations_promise), Promise.all(grant_permission_promise)]);

    await txQuery('COMMIT', []);
    console.log('COMMITED');
    client.release();
    console.log('parsedResponse', response);
    return [...response[0], ...response[1]];
  } catch (e) {
    await txQuery('ROLLBACK', []);
    console.log('ROLLING BACK ', e);
    client.release();
    throw Error('something went wrong')
  }
}
const create_relation_and_grant_permissions = async (id: string, user_shared_with: string, relation: LocalRelationWithTasksType, txQuery: typeof query):Promise<ServerRelationWithTasksAndPermissionsType>  => {
  const new_server_relation = await createTaskRelation(relation,
    txQuery
  );
  const server_relation_with_info = await grant_permission_and_get_relation_with_tasks(id, user_shared_with, new_server_relation, txQuery);
  if (relation.tasks.length === 0) return server_relation_with_info;
  const init_tasks = relation.tasks.map((task) => ({
    ...task,
    task_relations_id: new_server_relation.id,
  }));
  const server_stored_tasks = await createTaskForRelation(init_tasks, txQuery);
  const return_tasks = server_stored_tasks ?
   Array.isArray(server_stored_tasks)
   ?server_stored_tasks:
   [server_stored_tasks]
   :[];
  const response = {...server_relation_with_info, tasks: return_tasks};
  return response;
}

const grant_permission_and_get_relation_with_tasks = async (id: string, user_shared_with: string, relation: ServerRelationType, txQuery: typeof query):Promise<ServerRelationWithTasksAndPermissionsType>  => {
  
  await grantRelationPermission(
    { id },
    { id: relation.id },
    { permission: 'owner' },
    txQuery
  );
  await grantRelationPermission(
    { id: user_shared_with },
    { id: relation.id },
    { permission: 'edit' },
    txQuery
  );
 
  const response = await getRelationWithTasks({id: relation.id},{id}, txQuery);
  return response;
}
export const getRelationsById = async (
  user_id: string,
  relation_id: string
): Promise<ServerRelationWithTasksAndPermissionsType> => {
  try {
    await getUserPermission({ id: user_id }, { id: relation_id });
    const relation = await getRelationWithTasks({ id: relation_id }, {id: user_id});
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
    const response = await changeRelationName(relation_id, new_name, id);
    res.send(response);
  } catch (e) {
    console.log(e);
    next(e);
  }
};
export const changeRelationName = async (
  relation_id: string,
  newName: string,
  user_id: string
): Promise<getRelationsResponseType> => {
  const client = await transactionClient();
  const txQuery = transactionQuery(client);
  try {
    await txQuery('BEGIN', []);
    const updatedRelation = await editRelationsName( relation_id, newName,user_id, txQuery);
    await txQuery('COMMIT', []);
    return updatedRelation;
  } catch (e) {
    console.error('Error changing relation name:', e);
    await txQuery('ROLLBACK',[]);
    throw e;
  } finally{
    client.release();
  }
};
