import { SocketType, ServerType, basicTaskSchema, editTaskSchema } from '@groceries/shared_types';
import { getRelationsById } from '../relations/relations.controller';
import { editTaskBy, postTaskToRelation, removeTaskFromRelation } from './tasks.controller';
import { notifyCollaborators } from '../..';
import { handleSocketError } from '../../middleware/ErrorHandler';

export const taskSocketHandlers = (io: ServerType, socket: SocketType) => {
  const user_id = socket.data.id;
  socket.on('task:join', async ({ relation_id }, callback) => {
    try {
      const relation = await getRelationsById({
        userId: { id: user_id },
        relationId: { id: relation_id },
      });
      socket.join(relation.id);
      callback({ success: true, data: relation });
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      const response = handleSocketError(e);
      callback(response);
    }
  });
  socket.on('task:create', async ({ new_task }, callback) => {
    try {
      const parsed_task = basicTaskSchema.omit({ id: true }).parse(new_task);
      const stored_task = await postTaskToRelation(user_id, parsed_task);

      callback({ success: true, data: stored_task });
      notifyCollaborators(new_task.task_relations_id, user_id, 'task:create', stored_task);
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      const response = handleSocketError(e);
      callback(response);
    }
  });

  socket.on('task:edit', async ({ edited_task }, callback) => {
    try {
      const parsedTask = editTaskSchema.parse(edited_task);
      const new_task = await editTaskBy(
        user_id,
        parsedTask.task_relations_id,
        parsedTask.id,
        parsedTask
      );
      callback({ success: true, data: new_task });
      notifyCollaborators(new_task.task_relations_id, user_id, 'task:edit', new_task);
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      const response = handleSocketError(e);
      callback(response);
    }
  });

  socket.on('task:remove', async ({ remove_tasks }, callback) => {
    try {
      const parsedTask = basicTaskSchema.array().parse(remove_tasks);
      const removed_tasks = await Promise.all(
        parsedTask.map((t) => removeTaskFromRelation(user_id, t.task_relations_id, t.id))
      );
      callback({ success: true, data: removed_tasks });
      if (removed_tasks.length !== 0) {
        notifyCollaborators(
          removed_tasks[0].task_relations_id,
          user_id,
          'task:remove',
          removed_tasks
        );
      }
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      const response = handleSocketError(e);
      callback(response);
    }
  });

  socket.on('task:reorder', async ({ reodred_tasks }, callback) => {
    try {
      const parsedTask = basicTaskSchema.array().parse(reodred_tasks);
      const updatedTasks = await Promise.all(
        parsedTask.map((t) =>
          editTaskBy(user_id, t.task_relations_id, t.id, { order_idx: t.order_idx })
        )
      );
      if (updatedTasks.length !== 0) {
        notifyCollaborators(
          updatedTasks[0].task_relations_id,
          user_id,
          'task:reorder',
          updatedTasks
        );
      }
      callback({ success: true, data: updatedTasks });
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      const response = handleSocketError(e);
      callback(response);
    }
  });
};
