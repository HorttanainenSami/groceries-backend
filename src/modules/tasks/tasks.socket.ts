import { SocketType, ServerType } from '@groceries/shared_types';
import { getRelationsById } from '../relations/relations.controller';
import { handleSocketError } from '../../middleware/ErrorHandler';

export const taskSocketHandlers = (_io: ServerType, socket: SocketType) => {
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
};
