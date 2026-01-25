import request from 'supertest';
import { jest } from '@jest/globals';
import { app } from '../../../../app';
import { PendingOperation, LoginResponseType } from '@groceries/shared_types';
import { pool, query } from '../../../../database/connection';
import { decodeTokenFromRequest } from '../../../../resources/utils';
import {
  seedTestData,
  TEST_RELATIONS,
  TEST_USERS,
  TEST_TASKS,
  clearTestData,
} from '../../../../scripts/seed-test-data';
import { loginHandler } from '../../../../modules/auth/auth.controller';
import { getRelationById } from '../../../../modules/relations/relations.service';

jest.mock('../../../../resources/utils', () => {
  const originalModule = jest.requireActual('../../../../resources/utils');
  return {
    ...(originalModule as object),
    decodeTokenFromRequest: jest.fn(),
  };
});

jest.mock('../../../..', () => ({
  notifyCollaborators: jest.fn(),
}));

let user1: LoginResponseType;
let user2: LoginResponseType;
const taskId = '00000000-0000-0000-0000-000000000012';
const deletedTaskId = '00000000-0000-0000-0000-000000000099';
const operationId = '00000000-0000-0000-0000-000000000001';
const operationId2 = '00000000-0000-0000-0000-000000000002';
const operationId3 = '00000000-0000-0000-0000-000000000003';
const operationId4 = '00000000-0000-0000-0000-000000000004';
const operationId5 = '00000000-0000-0000-0000-000000000005';

const createTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  taskName: string = 'Test Task'
): PendingOperation => ({
  id: opId,
  type: 'task-create',
  data: {
    id: taskId,
    task: taskName,
    task_relations_id: relationId,
    order_idx: 0,
    last_modified: new Date().toISOString(),
    created_at: new Date().toISOString(),
    completed_at: null,
    completed_by: null,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

const editTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  taskName: string,
  lastModified: string
): PendingOperation => ({
  id: opId,
  type: 'task-edit',
  data: {
    id: taskId,
    task: taskName,
    task_relations_id: relationId,
    last_modified: lastModified,
    completed_at: null,
    completed_by: null,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

const toggleTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  lastModified: string,
  completedAt: string | null,
  completedBy: string | null
): PendingOperation => ({
  id: opId,
  type: 'task-toggle',
  data: {
    id: taskId,
    task_relations_id: relationId,
    last_modified: lastModified,
    completed_at: completedAt,
    completed_by: completedBy,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

const deleteTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  lastModified: string
): PendingOperation => ({
  id: opId,
  type: 'task-delete',
  data: {
    id: taskId,
    task_relations_id: relationId,
    last_modified: lastModified,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

const reorderTaskOperation = (
  opId: string,
  tasks: { id: string; order_idx: number; task_relations_id: string; last_modified: string }[]
): PendingOperation => ({
  id: opId,
  type: 'task-reorder',
  data: tasks,
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

const editRelationOperation = (
  opId: string,
  relationId: string,
  name: string,
  lastModified: string,
  createdAt: string
): PendingOperation => ({
  id: opId,
  type: 'relation-edit',
  data: {
    id: relationId,
    name: name,
    relation_location: 'Server' as const,
    created_at: createdAt,
    last_modified: lastModified,
    permission: 'owner' as const,
    shared_with: [],
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

const deleteRelationOperation = (
  opId: string,
  relationId: string,
  name: string,
  lastModified: string,
  createdAt: string
): PendingOperation => ({
  id: opId,
  type: 'relation-delete',
  data: {
    id: relationId,
    name: name,
    relation_location: 'Server' as const,
    created_at: createdAt,
    last_modified: lastModified,
    permission: 'owner' as const,
    shared_with: [],
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});
afterAll(async () => {
  await clearTestData();
  pool.end();
});
beforeEach(async () => {
  jest.resetAllMocks();
  await clearTestData();
  await seedTestData();
  user1 = await loginHandler(TEST_USERS[0]);
  user2 = await loginHandler(TEST_USERS[1]);
});
describe('Task operations', () => {
  describe('Create', () => {
    it('succeeds when relation exists and user authorized', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const { id: relationId } = TEST_RELATIONS[0]; // relation in database with owner permissions
      const operation = createTaskOperation(operationId, taskId, relationId, 'New Task');

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // Verify task was created in database
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [taskId]);
      expect(taskResult.rows).toHaveLength(1);
      expect(taskResult.rows[0].task).toBe('New Task');
    });

    it('fails when relation is deleted/doesnt exist', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });

      const operation = createTaskOperation(
        operationId,
        taskId,
        deletedTaskId, // deleted relation id
        'New Task'
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('relation deleted');
    });

    it('fails when user is unauthorized', async () => {
      const { token, id } = user2;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const { id: relationId } = TEST_RELATIONS[1]; // relation in database with no permission to user2
      const operation = createTaskOperation(operationId, taskId, relationId, 'New Task');

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });

    it('fails on UUID collision', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });

      const operation = createTaskOperation(
        operationId,
        taskId, // Same ID as existing task
        TEST_RELATIONS[0].id,
        'New Task'
      );
      const operation2 = createTaskOperation(
        operationId2,
        taskId, // Same ID as existing task
        TEST_RELATIONS[0].id,
        'New Task'
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation, operation2]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation2.id);
      expect(response.body.failed[0].reason).toBe('UUid collision');
    });
  });
  describe('Edit', () => {
    it('succeeds when client is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[0];
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = editTaskOperation(
        operationId,
        existingTask.id,
        existingTask.relation_id,
        'Updated Milk',
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // Verify task was updated in database
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      expect(taskResult.rows).toHaveLength(1);
      expect(taskResult.rows[0].task).toBe('Updated Milk');
    });

    it('fails when server is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[0];
      const task = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      const pastTime = new Date(task.rows[0].last_modified - 100000).toISOString();
      const operation = editTaskOperation(
        operationId,
        existingTask.id,
        existingTask.relation_id,
        'Outdated Edit',
        pastTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('Server version is more recent');

      // Verify task was NOT updated in database
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      expect(taskResult.rows[0].task).toBe('Milk');
    });

    it('fails when task is deleted', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = editTaskOperation(
        operationId,
        deletedTaskId,
        TEST_RELATIONS[0].id,
        'Edit Deleted Task',
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('task deleted');
    });

    it('fails when user is unauthorized', async () => {
      const { token, id } = user2;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[2]; // Screws task in Hardware Store (user2 has no access)
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = editTaskOperation(
        operationId,
        existingTask.id,
        existingTask.relation_id,
        'Unauthorized Edit',
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });
  });
  describe('Toggle', () => {
    it('succeeds when client is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[0];
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = toggleTaskOperation(
        operationId,
        existingTask.id,
        existingTask.relation_id,
        futureTime,
        futureTime,
        user1.id
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // Verify task was toggled in database
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      expect(taskResult.rows).toHaveLength(1);
      expect(taskResult.rows[0].completed_at).not.toBeNull();
      expect(taskResult.rows[0].completed_by).toBe(user1.id);
    });

    it('fails when server is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[0];
      const task = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      const pastTime = new Date(task.rows[0].last_modified - 100000).toISOString();

      const operation = toggleTaskOperation(
        operationId,
        existingTask.id,
        existingTask.relation_id,
        pastTime,
        pastTime,
        user1.id
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('Server version is more recent');

      // Verify task was not toggled
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      expect(taskResult.rows[0].completed_at).toBeNull();
    });

    it('fails when task is deleted', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = toggleTaskOperation(
        operationId,
        deletedTaskId,
        TEST_RELATIONS[0].id,
        futureTime,
        futureTime,
        user1.id
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('task deleted');
    });
    it('fails when user has no permission', async () => {
      const { token, id } = user2;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });

      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = toggleTaskOperation(
        operationId,
        deletedTaskId,
        TEST_RELATIONS[1].id,
        futureTime,
        futureTime,
        user1.id
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);
      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });
  });
  describe('Delete', () => {
    it('succeeds when client is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[0];
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = deleteTaskOperation(
        operationId,
        existingTask.id,
        existingTask.relation_id,
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // Verify task was deleted from database
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      expect(taskResult.rows).toHaveLength(0);
    });

    it('fails when server is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[0];
      const task = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      const pastTime = new Date(task.rows[0].last_modified - 100000).toISOString();

      const operation = deleteTaskOperation(
        operationId,
        existingTask.id,
        existingTask.relation_id,
        pastTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('Server version is more recent');

      // Verify task was NOT deleted from database
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      expect(taskResult.rows).toHaveLength(1);
    });
    it('fails when relation is deleted', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = deleteTaskOperation(
        operationId,
        TEST_TASKS[1].id,
        deletedTaskId, // deletedRelationId
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);
      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('Relation deleted');
    });
    it('succeeds when task is already deleted', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = deleteTaskOperation(
        operationId,
        deletedTaskId,
        TEST_RELATIONS[0].id,
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);
    });
    it('fails when user has no permission', async () => {
      const { token, id } = user2;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });

      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = deleteTaskOperation(
        operationId,
        deletedTaskId,
        TEST_RELATIONS[1].id,
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);
      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });
  });
  describe('Reorder', () => {
    it('succeeds for tasks where client is more recent', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const task1 = TEST_TASKS[0];
      const task2 = TEST_TASKS[1];
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = reorderTaskOperation(operationId, [
        {
          id: task1.id,
          order_idx: 1,
          task_relations_id: task1.relation_id,
          last_modified: futureTime,
        },
        {
          id: task2.id,
          order_idx: 0,
          task_relations_id: task2.relation_id,
          last_modified: futureTime,
        },
      ]);

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // tasks were reordered in database
      const task1Result = await query('SELECT * FROM task WHERE id = $1', [task1.id]);
      const task2Result = await query('SELECT * FROM task WHERE id = $1', [task2.id]);
      expect(task1Result.rows[0].order_idx).toBe(1);
      expect(task2Result.rows[0].order_idx).toBe(0);
    });

    it('skips tasks where server is more recent', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const task1 = TEST_TASKS[0];
      const task2 = TEST_TASKS[1];
      const dbTask1 = await query('SELECT * FROM task WHERE id = $1', [task1.id]);
      const pastTime = new Date(dbTask1.rows[0].last_modified - 100000).toISOString();
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = reorderTaskOperation(operationId, [
        {
          id: task1.id,
          order_idx: 5,
          task_relations_id: task1.relation_id,
          last_modified: pastTime,
        }, // outdated
        {
          id: task2.id,
          order_idx: 10,
          task_relations_id: task2.relation_id,
          last_modified: futureTime,
        }, // recent
      ]);

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);

      //task1 should keep original order_idx, task2 should be updated
      const task1Result = await query('SELECT * FROM task WHERE id = $1', [task1.id]);
      const task2Result = await query('SELECT * FROM task WHERE id = $1', [task2.id]);
      expect(task1Result.rows[0].order_idx).toBe(task1.order_idx); // unchanged
      expect(task2Result.rows[0].order_idx).toBe(10); // updated
    });

    it('skips deleted tasks', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingTask = TEST_TASKS[0];
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = reorderTaskOperation(operationId, [
        {
          id: existingTask.id,
          order_idx: 5,
          task_relations_id: existingTask.relation_id,
          last_modified: futureTime,
        },
        {
          id: deletedTaskId,
          order_idx: 10,
          task_relations_id: TEST_RELATIONS[0].id,
          last_modified: futureTime,
        },
      ]);

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);

      // existing task was reordered
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [existingTask.id]);
      expect(taskResult.rows[0].order_idx).toBe(5);
    });

    it('fails when user is unauthorized', async () => {
      const { token, id } = user2;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const task = TEST_TASKS[2]; // user2 has no access
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = reorderTaskOperation(operationId, [
        {
          id: task.id,
          order_idx: 5,
          task_relations_id: task.relation_id,
          last_modified: futureTime,
        },
      ]);

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });
  });
});

describe('Relation operations', () => {
  describe('Edit', () => {
    it('succeeds when client is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingRelation = TEST_RELATIONS[0];
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const createdAt = new Date().toISOString();

      const operation = editRelationOperation(
        operationId,
        existingRelation.id,
        'Updated Groceries',
        futureTime,
        createdAt
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // Verify relation was updated in database
      const relationResult = await query('SELECT * FROM task_relation WHERE id = $1', [
        existingRelation.id,
      ]);
      expect(relationResult.rows).toHaveLength(1);
      expect(relationResult.rows[0].name).toBe('Updated Groceries');
    });

    it('fails when server is more recent (LWW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingRelation = TEST_RELATIONS[0];
      const relation = await query('SELECT * FROM task_relation WHERE id = $1', [
        existingRelation.id,
      ]);
      const pastTime = new Date(relation.rows[0].last_modified - 100000).toISOString();
      const createdAt = new Date().toISOString();

      const operation = editRelationOperation(
        operationId,
        existingRelation.id,
        'Outdated Name',
        pastTime,
        createdAt
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('Server version is more recent');

      // Verify relation was NOT updated in database
      const relationResult = await query('SELECT * FROM task_relation WHERE id = $1', [
        existingRelation.id,
      ]);
      expect(relationResult.rows[0].name).toBe('Groceries');
    });

    it('fails when relation is deleted', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const createdAt = new Date().toISOString();

      const operation = editRelationOperation(
        operationId,
        deletedTaskId, //deleted relation id
        'Edit Deleted Relation',
        futureTime,
        createdAt
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('relation deleted');
    });

    it('fails when user is unauthorized', async () => {
      const { token, id } = user2;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingRelation = TEST_RELATIONS[1]; // Hardware Store (user2 has no access)
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const createdAt = new Date().toISOString();

      const operation = editRelationOperation(
        operationId,
        existingRelation.id,
        'Unauthorized Edit',
        futureTime,
        createdAt
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });
  });

  describe('Delete', () => {
    it('succeeds when client is more recent (LLW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingRelation = TEST_RELATIONS[0];
      const stored_relation = await getRelationById(existingRelation.id);
      const futureTime = new Date(
        new Date(stored_relation.created_at).getTime() + 10000
      ).toISOString();

      const operation = deleteRelationOperation(
        operationId,
        existingRelation.id,
        existingRelation.name,
        futureTime,
        stored_relation.created_at.toISOString()
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);
      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // relation was deleted from database
      const relationResult = await query('SELECT * FROM task_relation WHERE id = $1', [
        existingRelation.id,
      ]);
      expect(relationResult.rows).toHaveLength(0);
    });
    it('fails when server is more recent (LLW)', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingRelation = TEST_RELATIONS[0];
      const stored_relation = await getRelationById(existingRelation.id);
      const pastTime = new Date(
        new Date(stored_relation.created_at).getTime() - 10000
      ).toISOString();

      const operation = deleteRelationOperation(
        operationId,
        existingRelation.id,
        existingRelation.name,
        pastTime,
        stored_relation.created_at.toISOString()
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);

      // relation was not deleted from database
      const relationResult = await query('SELECT * FROM task_relation WHERE id = $1', [
        existingRelation.id,
      ]);
      expect(relationResult.rows).toHaveLength(1);
    });

    it('succeeds when relation already deleted', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const futureTime = new Date(Date.now() + 10000).toISOString();

      const operation = deleteRelationOperation(
        operationId,
        deletedTaskId, //deleted relation id
        'Already Deleted',
        futureTime,
        futureTime
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);
    });

    it('fails when user is unauthorized', async () => {
      const { token, id } = user2;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const existingRelation = TEST_RELATIONS[1]; // Hardware Store (user2 has no access)
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const createdAt = new Date().toISOString();

      const operation = deleteRelationOperation(
        operationId,
        existingRelation.id,
        existingRelation.name,
        futureTime,
        createdAt
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(0);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].id).toBe(operation.id);
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });
  });
});

describe('Batch operations', () => {
  it('handles mixed batch with 3 successful and 2 failed operations', async () => {
    const { token, id } = user1;
    (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
    const futureTime = new Date(Date.now() + 10000).toISOString();

    const existingTask = await query('SELECT * FROM task WHERE id = $1', [TEST_TASKS[0].id]);
    const pastTime = new Date(existingTask.rows[0].last_modified - 100000).toISOString();

    // should succeed
    const createOp = createTaskOperation(operationId, taskId, TEST_RELATIONS[0].id, 'New Task 1');

    // should succeed
    const editOp = editTaskOperation(
      operationId2,
      TEST_TASKS[0].id,
      TEST_RELATIONS[0].id,
      'Edited 1',
      futureTime
    );

    //  should fail (past time)
    const editFailOp = editTaskOperation(
      operationId3,
      TEST_TASKS[1].id,
      TEST_RELATIONS[0].id,
      'Edited 2',
      pastTime
    );

    // should succeed
    const toggleOp = toggleTaskOperation(
      operationId4,
      TEST_TASKS[1].id,
      TEST_RELATIONS[0].id,
      futureTime,
      futureTime,
      user1.id
    );

    // should succeed (task not found)
    const deleteOp = deleteTaskOperation(
      operationId5,
      deletedTaskId,
      TEST_RELATIONS[0].id,
      futureTime
    );

    const operations = [createOp, editOp, editFailOp, toggleOp, deleteOp];

    const response = await request(app)
      .post('/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send(operations);

    expect(response.status).toBe(200);
    expect(response.body.success).toHaveLength(4);
    expect(response.body.failed).toHaveLength(1);

    // Verify successful operations
    const successIds = response.body.success.map((s: { id: string }) => s.id);
    expect(successIds).toContain(createOp.id);
    expect(successIds).toContain(editOp.id);
    expect(successIds).toContain(toggleOp.id);
    expect(successIds).toContain(deleteOp.id);

    // Verify failed operations
    const failedIds = response.body.failed.map((f: { id: string }) => f.id);
    expect(failedIds).toContain(editFailOp.id);

    // Verify database state
    const newTask = await query('SELECT * FROM task WHERE id = $1', [taskId]);
    expect(newTask.rows).toHaveLength(1);
    expect(newTask.rows[0].task).toBe('New Task 1');

    const editedTask = await query('SELECT * FROM task WHERE id = $1', [TEST_TASKS[0].id]);
    expect(editedTask.rows[0].task).toBe('Edited 1');

    const toggledTask = await query('SELECT * FROM task WHERE id = $1', [TEST_TASKS[1].id]);
    expect(toggledTask.rows[0].completed_at).not.toBeNull();

    const failedTask = await query('SELECT * FROM task WHERE id = $1', [TEST_TASKS[0].id]);
    expect(failedTask.rows[0].task).not.toBe('Edited 2');

    const deletedTask = await query('SELECT * FROM task WHERE id = $1', [deletedTaskId]);
    expect(deletedTask.rows[0]).toBeUndefined();
  });

  it('succeeds with empty batch', async () => {
    const { token, id } = user1;
    (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });

    const response = await request(app)
      .post('/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send([]);

    expect(response.status).toBe(200);
    expect(response.body.success).toHaveLength(0);
    expect(response.body.failed).toHaveLength(0);
  });
});
