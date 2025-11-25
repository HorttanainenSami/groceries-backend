import { Socket, Server } from 'socket.io';
import {
  baseTaskSchema,
  editTaskSchema,
  TaskType,
} from '@groceries/shared_types';
import {
  getRelationsById,
} from '../relations/relations.controller';
import { editTaskBy, postTaskToRelation, removeTaskFromRelation } from './tasks.controller';


export const taskHandlers = (io:Server, socket:Socket) =>{
  const user_id = socket.data.user_id;
  socket.on('task:join', async (relation_id: string) => {
    try {
      console.log('clients', io.engine.clientsCount);
      const relation = await getRelationsById(user_id, relation_id);
      if (!relation) {
        throw new Error('Relation not found');
      }
      socket.join(relation.id);
      io.of('/user').to(user_id).emit('task:join:success', relation);
    } catch (error) {
      socket.emit('error', { message: 'Failed to join relation' });
    }
  });
  socket.on('task:create', async (data: TaskType) => {
    try {
      const parsedTask = baseTaskSchema.omit({ id: true }).parse(data);
      const sql_data = await postTaskToRelation(user_id, parsedTask);

      io.of('/user').to(data.task_relations_id).emit('task:created', sql_data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to create task' });
    }
  });

  socket.on('task:edit', async (data: TaskType) => {
    try {
      const parsedTask = editTaskSchema.parse(data);
      const sql_data = await editTaskBy(
        user_id,
        parsedTask.task_relations_id,
        parsedTask.id,
        parsedTask
      );
      io.of('/user').to(data.task_relations_id).emit('task:edited', sql_data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to edit task' });
    }
  });

  socket.on('task:remove', async (data: TaskType[]) => {
    try {
      const parsedTask = baseTaskSchema.array().parse(data);
      const sql_data = await Promise.all(
        parsedTask.map((t) =>
          removeTaskFromRelation(user_id, t.task_relations_id, t.id)
        )
      );
      console.log(data[0].task_relations_id, 'sql_data', sql_data);
      io.of('/user')
        .to(data[0].task_relations_id)
        .emit('task:removed', sql_data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to toggle task' });
    }
  });
}