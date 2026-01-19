import { NextFunction, Request, Response } from 'express';

import { PendingOperationSchema, TaskType } from '@groceries/shared_types';
import { decodeTokenFromRequest } from '../../resources/utils';
import {
  getUserPermission,
  getRelationById,
  removeRelation,
  editRelationsName,
  getCollaborators,
} from '../relations/relations.service';
import {
  AuthorizationError,
  DatabaseError as AppDatabaseError,
  NotFoundError,
} from '../../middleware/Error.types';
import {
  createTaskForRelation,
  editTask,
  getAllTasksByRelationId,
  getTaskById,
  removeTask,
  reorderTask,
} from '../tasks/tasks.service';
import { notifyCollaborators } from '../..';

type CheckPermissionAndRelationExistsResponse =
  | { conflict: false }
  | { conflict: true; response: { id: string; reason: 'deleted' | 'unauthorized' } };
const checkPermissionAndRelationExists = async (
  op_id: string,
  user_id: string,
  relation_id: string
): Promise<CheckPermissionAndRelationExistsResponse> => {
  try {
    await getRelationById(relation_id); // throws if not found
    await getUserPermission({ id: user_id }, { id: relation_id }); //throws if unauthorized
    return { conflict: false };
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return { conflict: true, response: { id: op_id, reason: 'unauthorized' } };
    }
    if (e instanceof NotFoundError) {
      return { conflict: true, response: { id: op_id, reason: 'deleted' } };
    }
    throw e;
  }
};

type GetTaskAndLasModified =
  | {
      conflict: false;
      task: TaskType;
    }
  | { conflict: true; response: { id: string; reason: string } };

const checkIfTaskExists = async (
  op_id: string,
  task_id: string,
  relation_id: string
): Promise<GetTaskAndLasModified> => {
  try {
    const serverTask = await getTaskById({ task_id, relation_id });
    return { conflict: false, task: serverTask };
  } catch (e) {
    if (e instanceof NotFoundError) {
      return { conflict: true, response: { id: op_id, reason: 'task deleted' } };
    }
    throw e;
  }
};

const handleTaskModificationCurrying =
  (user_id: string) =>
  async (
    op_id: string,
    task_relation_id: string,
    task_id: string,
    last_modified: string,
    callback: (serverTask: TaskType) => Promise<void>
  ): Promise<
    | { success: true; result: { id: string } }
    | { success: false; result: { id: string; reason: string } }
  > => {
    const conflict = await checkPermissionAndRelationExists(op_id, user_id, task_relation_id);
    if (conflict.conflict) {
      return { success: false, result: conflict.response };
    }

    const response = await checkIfTaskExists(op_id, task_id, task_relation_id);
    if (response.conflict) {
      return { success: false, result: response.response };
    }

    const { last_modified: server_last_modified } = response.task;

    if (new Date(last_modified) >= new Date(server_last_modified)) {
      // Client version is more recent - update
      console.log('llw success');
      await callback(response.task);
      return { success: true, result: { id: op_id } };
    } else {
      console.log('llw failed');

      // Server version is more recent - discard
      return { success: false, result: { id: op_id, reason: 'Server version is more recent' } };
    }
  };

type SyncResponse = {
  success: { id: string }[];
  failed: { id: string; reason: string }[];
};

export const syncBatch = async (req: Request, res: Response<SyncResponse>, next: NextFunction) => {
  try {
    console.log(JSON.stringify(req.body, null, 2));
    const parsedBody = PendingOperationSchema.array().parse(req.body);
    const { id } = decodeTokenFromRequest(req);
    const success = [];
    const failed = [];
    const handleTaskModification = handleTaskModificationCurrying(id);
    console.log(JSON.stringify(parsedBody, null, 2));

    //handle sync per operation
    for (const op of parsedBody) {
      switch (op.type) {
        case 'task-create':
          {
            const {
              data: { task_relations_id },
            } = op;
            try {
              const conflict = await checkPermissionAndRelationExists(op.id, id, task_relations_id);
              if (conflict.conflict) {
                failed.push(conflict.response);
                break;
              }
              const stored_task = await createTaskForRelation(op.data);
              success.push({ id: op.id });
              notifyCollaborators(task_relations_id, id, 'task:create', { data: stored_task });
            } catch (e) {
              if (e instanceof AppDatabaseError && e.databaseError.code === '23505') {
                failed.push({ id: op.id, reason: 'UUid collision' });
              } else {
                failed.push({ id: op.id, reason: 'Database error' });
                console.error('Error creating task:', e);
              }
            }
          }
          break;
        case 'task-edit': {
          const {
            data: { id: task_id, task_relations_id, last_modified },
          } = op;
          let response: TaskType | null = null;
          try {
            const result = await handleTaskModification(
              op.id,
              task_relations_id,
              task_id,
              last_modified,
              async (serverTask: TaskType) => {
                response = await editTask({
                  ...serverTask,
                  ...op.data,
                });
              }
            );

            if (result.success) {
              if (response) {
                notifyCollaborators(task_relations_id, id, 'task:edit', { edited_task: response });
              }
              success.push(result.result);
            } else {
              failed.push(result.result);
            }
          } catch (e) {
            failed.push({ id: op.id, reason: 'Database error' });
            console.error('Error editing task:', e);
          }
          break;
        }
        case 'task-toggle': {
          const {
            data: { id: task_id, task_relations_id, last_modified },
          } = op;

          try {
            let response: TaskType | null = null;
            const result = await handleTaskModification(
              op.id,
              task_relations_id,
              task_id,
              last_modified,
              async (serverTask: TaskType) => {
                response = await editTask({
                  ...serverTask,
                  ...op.data,
                });
              }
            );

            if (result.success) {
              if (response) {
                notifyCollaborators(task_relations_id, id, 'task:edit', { edited_task: response });
              }
              success.push(result.result);
            } else {
              failed.push(result.result);
            }
          } catch (e) {
            failed.push({ id: op.id, reason: 'Database error' });
            console.error('Error toggling task:', e);
          }
          break;
        }

        case 'task-delete': {
          const {
            data: { id: task_id, task_relations_id, last_modified },
          } = op;
          let response: TaskType | null = null;
          try {
            const result = await handleTaskModification(
              op.id,
              task_relations_id,
              task_id,
              last_modified,
              async (serverTask: TaskType) => {
                response = await removeTask({ id: serverTask.id });
              }
            );
            if (result.success) {
              if (response) {
                notifyCollaborators(task_relations_id, id, 'task:remove', {
                  remove_tasks: [response],
                });
              }
              success.push(result.result);
            } else {
              // Server modified after delete was queued
              failed.push({ id: op.id, reason: 'Server modified after delete queued' });
            }
          } catch (e) {
            failed.push({ id: op.id, reason: 'Database error' });
            console.error('Error deleting task:', e);
          }
          break;
        }

        case 'task-reorder': {
          const { data: tasks } = op;
          if (tasks.length === 0) {
            success.push({ id: op.id });
            break;
          }

          const task_relations_id = tasks[0].task_relations_id;
          const conflict = await checkPermissionAndRelationExists(op.id, id, task_relations_id);
          if (conflict.conflict) {
            failed.push(conflict.response);
            break;
          }

          try {
            const serverTasks = await getAllTasksByRelationId(task_relations_id);

            const serverTasksMap = new Map(
              serverTasks.map((t) => [t.id, new Date(t.last_modified)])
            );

            // Filter out deleted items and items modified after reorder
            const validTasks = tasks.filter((task) => {
              const serverLastModified = serverTasksMap.get(task.id);
              if (!serverLastModified) return false; // Deleted
              return new Date(task.last_modified) >= serverLastModified; // Reorder is recent enough
            });

            // Update order_idx for valid tasks
            const response = await Promise.all(validTasks.map((task) => reorderTask(task)));

            notifyCollaborators(task_relations_id, id, 'task:reorder', {
              reordered_tasks: response,
            });
            success.push({ id: op.id });
          } catch (e) {
            failed.push({ id: op.id, reason: 'Database error' });
            console.error('Error reordering tasks:', e);
          }
          break;
        }

        case 'relation-delete': {
          const {
            data: { id: relation_id },
          } = op;
          try {
            await getUserPermission({ id }, { id: relation_id }); //throws if no authorization
            console.log('pemission success');
            // Try to delete
            const collaborators = await getCollaborators({ id }, { id: relation_id });
            console.log(collaborators);
            await removeRelation({ id: relation_id });
            success.push({ id: op.id });
            console.log('notify, current user: ', id);
            notifyCollaborators(
              relation_id,
              id,
              'relations:delete',
              [[true, relation_id]],
              collaborators
            );
          } catch (e) {
            if (e instanceof NotFoundError) {
              // Already deleted - success
              success.push({ id: op.id });
            } else if (e instanceof AuthorizationError) {
              failed.push({ id: op.id, reason: 'unauthorized' });
            } else {
              failed.push({ id: op.id, reason: 'Database error' });
              console.error('Error deleting relation:', e);
            }
          }
          break;
        }

        case 'relation-edit': {
          const {
            data: { id: relation_id, last_modified, name },
          } = op;

          const conflict = await checkPermissionAndRelationExists(op.id, id, relation_id);
          if (conflict.conflict) {
            failed.push(conflict.response);
            break;
          }

          try {
            const serverRelation = await getRelationById(relation_id); //throws NotFoundError

            // LWW
            if (new Date(last_modified) > new Date(serverRelation.last_modified)) {
              const response = await editRelationsName({
                relationId: relation_id,
                newName: name,
                userId: id,
                last_modified,
              });
              success.push({ id: op.id });
              notifyCollaborators(relation_id, id, 'relations:change_name', response);
            } else {
              failed.push({ id: op.id, reason: 'Server version is newer' });
            }
          } catch (e) {
            if (e instanceof NotFoundError) {
              failed.push({ id: op.id, reason: 'Relation already deleted from server' });
            } else {
              failed.push({ id: op.id, reason: 'Database error' });
              console.error('Error editing relation:', e);
            }
          }
          break;
        }

        case 'relation-reorder': {
          failed.push({ id: op.id, reason: 'Not yet implemented' });
          break;
        }
        default: {
          // This should never happen due to discriminated union, but TypeScript needs it
          const exhaustiveCheck: never = op;
          failed.push({
            id: (exhaustiveCheck as any).id,
            reason: `Operation type not supported!`,
          });
          break;
        }
      }
    }

    return res.json({ success, failed });
  } catch (e) {
    console.log(e);
    next(e);
  }
};
