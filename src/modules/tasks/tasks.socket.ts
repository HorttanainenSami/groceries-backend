import {
  SocketType,
  ServerType,
  basicTaskSchema,
  editTaskSchema,
} from '@groceries/shared_types';
import {
  getRelationsById,
} from '../relations/relations.controller';
import { editTaskBy, postTaskToRelation, removeTaskFromRelation } from './tasks.controller';
import { notifyCollaborators } from '../..';


export const taskSocketHandlers = (io:ServerType, socket:SocketType) =>{
  const user_id = socket.data.id;
  socket.on('task:join', async ({relation_id}, cb) => {
    try {
      console.log('clients', io.engine.clientsCount);
      const relation = await getRelationsById(user_id, relation_id);
      socket.join(relation.id);
      cb({success:true, data: relation});
    } catch (error) {
      cb({ success: false, error:'Failed to join relation' });
    }
  });
  socket.on('task:create', async ({new_task}, callback) => {
    try {
      const parsed_task = basicTaskSchema.omit({ id: true }).parse(new_task);
      const stored_task = await postTaskToRelation(user_id, parsed_task);

      callback({success: true, data: stored_task});
      notifyCollaborators(new_task.task_relations_id, user_id, 'task:create', stored_task);
    } catch (error) {
      callback({success:false, error: 'Failed to create task' });
    }
  });

  socket.on('task:edit', async ({edited_task}, callback) => {
    try {
      const parsedTask = editTaskSchema.parse(edited_task);
      const new_task = await editTaskBy(
        user_id,
        parsedTask.task_relations_id,
        parsedTask.id,
        parsedTask
      );
      callback({success:true, data: new_task})
      notifyCollaborators(new_task.task_relations_id, user_id, 'task:edit', new_task);

    } catch (error) {
      callback({success: false, error: 'Failed to edit task' });
    }
  });

  socket.on('task:remove', async ({remove_tasks}, callback) => {
    try {
      const parsedTask = basicTaskSchema.array().parse(remove_tasks);
      const removed_tasks = await Promise.all(
        parsedTask.map((t) =>
          removeTaskFromRelation(user_id, t.task_relations_id, t.id)
        )
      );
      callback({success: true, data: removed_tasks})
      notifyCollaborators(parsedTask[0].task_relations_id, user_id, 'task:remove', removed_tasks);

    } catch (error) {
      socket.emit('error', { message: 'Failed to toggle task' });
    }
  });
}