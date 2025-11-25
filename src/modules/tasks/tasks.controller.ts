import { editRelationsTaskByIdReqBodySchema, editRelationsTaskByIdReqParamsSchema, patchTaskSchema, postTaskToRelationReqSchema, removeTaskFromRelationReqParams, TaskType } from "@groceries/shared_types";
import { NextFunction, Request, Response } from "express";
import { decodeTokenFromRequest } from "../../resources/utils";
import { getUserPermission } from "../relations/relations.service";
import { createTaskForRelation, editTask, getTaskById, removeTask } from "./tasks.service";
import { AuthenticationError } from "../../middleware/Error.types";



export const editTaskByIdHandler = async (
  req: Request,
  res: Response<TaskType>,
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

export const removeTaskFromRelation = async (
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


export const postTaskToRelationHandler = async (
  req: Request,
  res: Response<TaskType[]|TaskType>,
  next: NextFunction
) => {
  try {
    const { task } = postTaskToRelationReqSchema.parse(req.body);
    const { id } = decodeTokenFromRequest(req);
    //check if user had permission to edit
    const savedTask = await postTaskToRelation(id, task);
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