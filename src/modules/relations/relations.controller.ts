import { AuthenticationError } from '../../middleware/Error.types';
import { NextFunction, Request, Response } from 'express';
import { addRelationCollaborator, createTaskForRelation, createTaskRelationWithTasks, getRelationWithTasks, getUserPermission, getAllRelations, editTask, removeTask } from './relations.service';
import { editTaskQuerySchema, LocalTaskRelationSchema, LocalTaskSchema, NewTaskSchema, TaskRelationSchema, TaskSchema } from './relations.schema';
import { decodeToken } from '../../resources/utils';
import { userSchema } from '../auth/auth.schema';

export const postRelationAndShareWithUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    console.log('Hello from postRelationAndShareWithUser');

    try{
      const { task_relations, user_shared_with } = req.body;
      console.log(task_relations, user_shared_with);
      console.log(req.body);

      const parsed_relations = LocalTaskRelationSchema.array().parse(task_relations);
      console.log('parsed relations successfully');
      const parsed_user = userSchema.pick({ id: true }).parse(user_shared_with);
      console.log('parsed user successfully');
      const { id } = decodeToken(req);
    
    //push relations to server
      console.log('pushing relations to server');
      const promise = await Promise.all(parsed_relations.map(relation => createTaskRelationWithTasks(relation, { id })));
      console.log('pushing relations to server successfully');
      
      //share relation with user
      console.log('sharing relation with user');
      await Promise.all(promise.map((newRelations) => addRelationCollaborator({ id:parsed_user.id }, { id:newRelations.id }, { permission: 'edit'})));
      console.log('sharing relation with user successfully');
      //push tasks to relations
      res.send(promise);
    }
    catch(e) {
      next(e);
    }
  };
  
  export const postTaskToRelation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try{

    const { task_relations_id, ...task } = req.body;
    const parsedBody = TaskRelationSchema.pick({ id: true }).parse({id: task_relations_id});
    console.log({...task, task_relations_id: parsedBody.id});
    const parsedTask = NewTaskSchema.parse({...task, task_relations_id: parsedBody.id});
    const { id } = decodeToken(req);
    //if not friend add to friend
    //check if user had permission to edit
    const permission = await getUserPermission({id} ,{id: parsedBody.id});
    console.log('permission', permission);
    if(!permission) throw new AuthenticationError('User does not have permission to edit this relation');
  
    const promise = await createTaskForRelation(parsedTask);
    console.log(promise);
  
    //send lists to server
    res.send(promise);
    } catch(e) {
        next(e);
    }
  }
  
  export const shareRelationWithUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try{

    const { task_relations_id, user_id } = req.body;
    const parsed_relation_id = TaskRelationSchema.pick({ id: true }).parse(task_relations_id);
    const parsed_user_id = userSchema.pick({ id: true }).parse(user_id);
    const { id } = decodeToken(req);
    //check if token owner is owner of relation
    const {permission} = await getUserPermission({ id }, { id: parsed_user_id.id });
    if (permission !== 'owner') throw new AuthenticationError('User does not have permission to edit this list');


    //share relation with user
    await addRelationCollaborator({ id }, { id: parsed_relation_id.id }, { permission: 'edit'});

    res.status(200).json({ message: 'Relation shared successfully' });
    } catch(e) {
        next(e);
    }
  }

  export const getRelationById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try{
    const params = req.params;
    console.log(req.params, req.body, req.query);
    const parsedBody = TaskRelationSchema.pick({id: true}).parse({id: params.id});
    console.log(parsedBody);
    const { id } = decodeToken(req);
    await getUserPermission({ id }, { id: parsedBody.id })
    const relation = await getRelationWithTasks({ id: parsedBody.id });
    res.send(relation);
    } catch(e) {
      console.log(e);
        next(e);
    }
  };
   export const getRelations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try{
    const { id } = decodeToken(req);
    const relation = await getAllRelations({ id });
    res.send(relation);
    } catch(e) {
        next(e);
    }
  };
  
  export const editRelationsTaskById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try{
    const body = req.body;
    const { relation_id, id: task_id } = req.params;
    const { id } = decodeToken(req);
    const initialTask = {...body, task_relations_id: relation_id, id: task_id};
    //check if token owner is owner of relation

    await getUserPermission({ id }, { id: relation_id });
    const response = await editTask(initialTask);
    res.send(response);
    } catch(e) {
        next(e);
    }
  }
  export const removeTaskFromRelation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {  
    try{
    const { relation_id, id: task_id } = req.params;
    const { id } = decodeToken(req);
    await getUserPermission({ id }, { id: relation_id });
    const relation = await removeTask({ id:task_id });
    res.send(relation);
    } catch(e) {
        next(e);
    }
  }