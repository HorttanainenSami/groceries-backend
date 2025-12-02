import { patchTaskSchema,TaskType } from "@groceries/shared_types";
import { getUserPermission } from "../relations/relations.service";
import { createSingleTaskForRelation, editTask, getTaskById, removeTask } from "./tasks.service";
import { AuthenticationError } from "../../middleware/Error.types";

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



export const postTaskToRelation = async (
  id: string,
  task: Omit<TaskType, 'id'>
):Promise<TaskType> => {
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

    const promise = await createSingleTaskForRelation(task);
    //send lists to server
    return promise;
  } catch (e) {
    throw e;
  }
};