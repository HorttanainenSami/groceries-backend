import request from 'supertest';
import { jest } from '@jest/globals';
import { app } from '../../../../app';
import { PendingOperation, LoginResponseType } from '@groceries/shared_types';
import { pool, query } from '../../../../database/connection';
import { decodeTokenFromRequest } from '../../../../resources/utils';
import { seedTestData, TEST_USERS } from '../../../../scripts/seed-test-data';
import { loginHandler } from '../../../../modules/auth/auth.controller';

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
let relationId: string;
seedTestData();

const cleanDatabase = async () => {
  await query(
    'TRUNCATE TABLE users, task_relation, task, task_permissions RESTART IDENTITY CASCADE',
    []
  );
};

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

describe('Task operations', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await cleanDatabase();
    user1 = await loginHandler(TEST_USERS[0]);
    user2 = await loginHandler(TEST_USERS[1]);
  });

  afterAll(async () => {
    await cleanDatabase();
    pool.end();
  });

  describe('Create', () => {
    it('succeeds when relation exists and user authorized', async () => {
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id: user1.id });
      const { token } = user1;

      const operation = createTaskOperation(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        relationId,
        'New Task'
      );

      const response = await request(app)
        .post('/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send([operation]);

      expect(response.status).toBe(200);
      expect(response.body.success).toHaveLength(1);
      expect(response.body.success[0].id).toBe(operation.id);
      expect(response.body.failed).toHaveLength(0);

      // Verify task was created in database
      const taskId = '00000000-0000-0000-0000-000000000002';
      const taskResult = await query('SELECT * FROM task WHERE id = $1', [taskId]);
      expect(taskResult.rows).toHaveLength(1);
      expect(taskResult.rows[0].task).toBe('New Task');
    });

    it('fails when relation is deleted', async () => {
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id: user1.id });
      const token = getAuthToken(user1);

      const deletedRelationId = '00000000-0000-0000-0000-000000000099';

      const operation = createTaskOperation(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        deletedRelationId,
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
      expect(response.body.failed[0].reason).toBe('deleted');
    });

    it('fails when user is unauthorized', async () => {
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id: user2.id });
      const token = getAuthToken(user2);

      const operation = createTaskOperation(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        relationId,
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
      expect(response.body.failed[0].reason).toBe('unauthorized');
    });

    it('fails on UUID collision', async () => {
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id: user1.id });
      const token = getAuthToken(user1);

      const existingTaskId = '00000000-0000-0000-0000-000000000002';
      await createTask(existingTaskId, relationId, 'Existing Task', new Date().toISOString());

      const operation = createTaskOperation(
        '00000000-0000-0000-0000-000000000001',
        existingTaskId, // Same ID as existing task
        relationId,
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
      console.error(response.body.failed[0].reason);
      console.log(response.body.failed);
      expect(response.body.failed[0].reason).toBe('UUid collision');
    });
  });
  describe('Edit', () => {
    it('succeeds when client is more recent (LWW)', () => {});
    it('fails when server is more recent (LWW)', () => {});
    it('fails when task is deleted', () => {});
    it('fails when user is unauthorized', () => {});
  });
  describe('Toggle', () => {
    it('succeeds when client is more recent (LWW)', () => {});
    it('fails when server is more recent (LWW)', () => {});
    it('fails when task is deleted', () => {});
  });
  describe('Delete', () => {
    it('succeeds when client is more recent (LWW)', () => {});
    it('fails when server is more recent (LWW)', () => {});
    it('fails when task is already deleted', () => {});
  });
  describe('Reorder', () => {
    it('succeeds for tasks where client is more recent', () => {});
    it('skips tasks where server is more recent', () => {});
    it('skips deleted tasks', () => {});
    it('fails when user is unauthorized', () => {});
  });
});

describe('Relation operations', () => {
  describe('Edit', () => {
    it('succeeds when client is more recent (LWW)', () => {});
    it('fails when server is more recent (LWW)', () => {});
    it('fails when relation is deleted', () => {});
    it('fails when user is unauthorized', () => {});
  });
  describe('Delete', () => {
    it('succeeds when relation exists', () => {});
    it('succeeds when relation already deleted (idempotent)', () => {});
    it('fails when user is unauthorized', () => {});
  });
});
