import { NextFunction, Request, Response } from 'express';

import {
  FailedOperationType,
  PendingOperation,
  PendingOperationSchema,
  RelationType,
  ServerRelationType,
  SyncBatchResponse,
  TaskType,
} from '@groceries/shared_types';
import { decodeTokenFromRequest } from '../../resources/utils';

import {
  getUserPermission,
  getRelationWithPermissionsById,
  removeRelation,
  editRelationsName,
  getRelationById,
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

// Per-relation locks to prevent concurrent syncs on the same relation
const relationLocks = new Map<string, Promise<void>>();

/**
 * Acquires a lock for a specific relation to prevent concurrent modifications
 * Returns a release function that MUST be called to unlock
 */
async function acquireRelationLock(relationId: string): Promise<() => void> {
  // Wait for any existing lock on this relation
  while (relationLocks.has(relationId)) {
    await relationLocks.get(relationId);
  }

  // Create a new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  relationLocks.set(relationId, lockPromise);

  // Return the release function
  return () => {
    relationLocks.delete(relationId);
    releaseLock!();
  };
}
// Custom error to signal a sync operation conflict
class SyncConflictError extends Error {
  constructor(public failedOperation: FailedOperationType) {
    super('Sync conflict');
    this.name = 'SyncConflictError';
  }
}

export const checkPermissionAndRelationExists = async (
  op_id: string,
  user_id: string,
  relation_id: string
): Promise<RelationType> => {
  try {
    await getRelationById(relation_id); // can throw NotFoundError
    await getUserPermission({ id: user_id }, { id: relation_id }); //can throw AuthorizationError
    return await getRelationWithPermissionsById(user_id, relation_id);
  } catch (e) {
    if (e instanceof AuthorizationError) {
      throw new SyncConflictError({ id: op_id, type: 'simple', reason: 'Unauthorized' });
    }
    if (e instanceof NotFoundError) {
      throw new SyncConflictError({ id: op_id, type: 'simple', reason: 'Relation deleted' });
    }
    throw e;
  }
};

const checkIfTaskExists = async (
  op_id: string,
  task_id: string,
  relation_id: string
): Promise<TaskType> => {
  try {
    const serverTask = await getTaskById({ task_id, relation_id });
    return serverTask;
  } catch (e) {
    if (e instanceof NotFoundError) {
      throw new SyncConflictError({ id: op_id, type: 'simple', reason: 'task deleted' });
    }
    throw e;
  }
};

type TaskModificationOperation = Extract<
  PendingOperation,
  { type: 'task-edit' | 'task-toggle' | 'task-delete' }
>;

const handleTaskModificationCurrying =
  (user_id: string) =>
  async (
    op: TaskModificationOperation,
    callback: (data: TaskModificationOperation['data'], serverTask: TaskType) => Promise<void>
  ): Promise<{ id: string }> => {
    const { task_relations_id, id: task_id, last_modified } = op.data;
    const releaseLock = await acquireRelationLock(task_relations_id);
    try {
      await checkPermissionAndRelationExists(op.id, user_id, task_relations_id);

      const serverTask = await checkIfTaskExists(op.id, task_id, task_relations_id);
      console.log(serverTask);

      const { last_modified: server_last_modified } = serverTask;

      if (new Date(last_modified) >= new Date(server_last_modified)) {
        // Client version is more recent - update
        console.log('llw success');
        await callback(op.data, serverTask);
        return { id: op.id };
      } else {
        // Server version is more recent - discard
        throw new SyncConflictError({
          id: op.id,
          type: 'task',
          serverTask: serverTask,
          reason: 'Server version is more recent',
        });
      }
    } finally {
      releaseLock();
    }
  };
type RelationModificationOperation = Extract<
  PendingOperation,
  { type: 'relation-edit' | 'relation-reorder' | 'relation-delete' }
>;

const handleRelationModificationCurrying =
  (user_id: string) =>
  async (
    op: RelationModificationOperation,
    callback: (
      data: RelationModificationOperation['data'],
      serverRelation: ServerRelationType
    ) => Promise<void>
  ): Promise<{ id: string }> => {
    const { id, last_modified } = op.data;
    const releaseLock = await acquireRelationLock(id);
    try {
      const relation = (await checkPermissionAndRelationExists(
        op.id,
        user_id,
        id
      )) as ServerRelationType;

      const { last_modified: server_last_modified } = relation;

      if (new Date(last_modified) >= new Date(server_last_modified)) {
        // Client version is more recent - update
        console.log('llw success');
        await callback(op.data, relation);
        return { id: op.id };
      } else {
        // Server version is more recent - discard
        throw new SyncConflictError({
          id: op.id,
          type: 'relation',
          serverRelations: relation,
          reason: 'Server version is more recent',
        });
      }
    } finally {
      releaseLock();
    }
  };
export const syncBatch = async (
  req: Request,
  res: Response<SyncBatchResponse>,
  next: NextFunction
) => {
  try {
    console.log(JSON.stringify(req.body, null, 2));
    const parsedBody = PendingOperationSchema.array().parse(req.body);
    const { id: user_id } = decodeTokenFromRequest(req);
    const success: { id: string }[] = [];
    const failed: FailedOperationType[] = [];
    const handleTaskModification = handleTaskModificationCurrying(user_id);
    const handleRelationModification = handleRelationModificationCurrying(user_id);
    console.log(JSON.stringify(parsedBody, null, 2));

    //handle sync per operation
    for (const op of parsedBody) {
      switch (op.type) {
        case 'task-create':
          {
            const {
              data: { task_relations_id },
            } = op;
            const releaseLock = await acquireRelationLock(task_relations_id);
            try {
              await checkPermissionAndRelationExists(op.id, user_id, task_relations_id);
              const stored_task = await createTaskForRelation(op.data);
              success.push({ id: op.id });
              notifyCollaborators(task_relations_id, user_id, 'task:create', {
                data: stored_task,
              });
            } catch (e) {
              if (e instanceof SyncConflictError) {
                failed.push(e.failedOperation);
              } else if (e instanceof AppDatabaseError && e.databaseError.code === '23505') {
                failed.push({ id: op.id, type: 'simple', reason: 'UUid collision' });
              } else {
                failed.push({ id: op.id, type: 'simple', reason: 'Database error' });
                console.error('Error creating task:', e);
              }
            } finally {
              releaseLock();
            }
          }
          break;
        case 'task-edit': {
          try {
            await handleTaskModification(op, async (data, serverTask) => {
              const response = await editTask({
                ...serverTask,
                ...data,
              });

              notifyCollaborators(response.task_relations_id, user_id, 'task:edit', {
                edited_task: response,
              });
            });
            success.push({ id: op.id });
          } catch (e) {
            if (e instanceof SyncConflictError) {
              failed.push(e.failedOperation);
            } else {
              failed.push({ id: op.id, type: 'simple', reason: 'Database error' });
              console.error('Error editing task:', e);
            }
          }
          break;
        }
        case 'task-toggle': {
          try {
            await handleTaskModification(op, async (data, serverTask) => {
              const response = await editTask({
                ...serverTask,
                ...data,
              });
              notifyCollaborators(response.task_relations_id, user_id, 'task:edit', {
                edited_task: response,
              });
            });
            success.push({ id: op.id });
          } catch (e) {
            if (e instanceof SyncConflictError) {
              failed.push(e.failedOperation);
            } else {
              failed.push({ id: op.id, type: 'simple', reason: 'Database error' });
              console.error('Error toggling task:', e);
            }
          }
          break;
        }

        case 'task-delete': {
          try {
            await handleTaskModification(op, async (data) => {
              const response = await removeTask({ id: data.id });
              notifyCollaborators(response.task_relations_id, user_id, 'task:remove', {
                remove_tasks: [response],
              });
            });
            success.push({ id: op.id });
          } catch (e) {
            if (e instanceof SyncConflictError) {
              // If task was already deleted, consider it a success
              if (e.failedOperation.reason === 'task deleted') {
                success.push({ id: op.id });
              } else {
                failed.push(e.failedOperation);
              }
            } else {
              failed.push({ id: op.id, type: 'simple', reason: 'Database error' });
              console.error('Error deleting task:', e);
            }
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
          const releaseLock = await acquireRelationLock(task_relations_id);
          try {
            await checkPermissionAndRelationExists(op.id, user_id, task_relations_id);

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

            notifyCollaborators(task_relations_id, user_id, 'task:reorder', {
              reordered_tasks: response,
            });
            success.push({ id: op.id });
          } catch (e) {
            if (e instanceof SyncConflictError) {
              failed.push(e.failedOperation);
            } else {
              failed.push({ id: op.id, type: 'simple', reason: 'Database error' });
              console.error('Error reordering tasks:', e);
            }
          } finally {
            releaseLock();
          }
          break;
        }

        case 'relation-delete': {
          try {
            await handleRelationModification(op, async (data, relation) => {
              await removeRelation({ id: data.id });
              if (relation.shared_with) {
                notifyCollaborators(
                  relation.id,
                  user_id,
                  'relations:delete',
                  [[true, relation.id]],
                  relation.shared_with
                );
              }
            });
            success.push({ id: op.id });
          } catch (e) {
            if (e instanceof SyncConflictError) {
              // If relation was already deleted, consider it a success
              if (e.failedOperation.reason === 'Relation deleted') {
                success.push({ id: op.id });
              } else {
                failed.push(e.failedOperation);
              }
            } else {
              failed.push({ id: op.id, type: 'simple', reason: 'Database error' });
              console.error('Error deleting relation:', e);
            }
          }
          break;
        }

        case 'relation-edit': {
          try {
            await handleRelationModification(op, async (data) => {
              const response = await editRelationsName({
                relationId: data.id,
                newName: data.name,
                userId: user_id,
                last_modified: data.last_modified,
              });
              notifyCollaborators(response.id, user_id, 'relations:change_name', response);
            });
            success.push({ id: op.id });
          } catch (e) {
            if (e instanceof SyncConflictError) {
              failed.push(e.failedOperation);
            } else if (e instanceof NotFoundError) {
              failed.push({
                id: op.id,
                type: 'simple',
                reason: 'Relation already deleted from server',
              });
            } else {
              failed.push({ id: op.id, type: 'simple', reason: 'Database error' });
              console.error('Error editing relation:', e);
            }
          }
          break;
        }

        case 'relation-reorder': {
          failed.push({ id: op.id, type: 'simple', reason: 'Not yet implemented' });
          break;
        }
        default: {
          // This should never happen due to discriminated union, but TypeScript needs it
          const exhaustiveCheck: never = op;
          failed.push({
            id: (exhaustiveCheck as any).id,
            type: 'simple',
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
