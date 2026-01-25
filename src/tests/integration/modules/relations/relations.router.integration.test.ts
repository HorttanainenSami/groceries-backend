import request from 'supertest';
import { decodeTokenFromRequest } from '../../../../resources/utils';
import { jest } from '@jest/globals';
import { app } from '../../../../app';
import {
  RelationType,
  TaskType,
  LocalRelationWithTasksType,
  LoginResponseType,
} from '@groceries/shared_types';
import { clearTestData, seedTestData, TEST_USERS } from '../../../../scripts/seed-test-data';
import { loginHandler } from '../../../../modules/auth/auth.controller';
import { pool } from '../../../../database/connection';

// Mock decodeToken to simulate authentication
jest.mock('../../../../resources/utils', () => {
  const originalModule = jest.requireActual('../../../../resources/utils');
  return {
    ...(originalModule as object),
    decodeTokenFromRequest: jest.fn(),
  };
});
let user1: LoginResponseType;
let user2: LoginResponseType;

const tasks: TaskType[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    task: 'Test Task',
    created_at: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    completed_at: null,
    completed_by: null,
    task_relations_id: '00000000-0000-0000-0000-000000000001',
    order_idx: 99,
    last_modified: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    task: 'Test Task 3',
    created_at: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    completed_at: null,
    completed_by: null,
    task_relations_id: '00000000-0000-0000-0000-000000000001',
    order_idx: 99,
    last_modified: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  },
];
const relations: LocalRelationWithTasksType = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Relation',
  relation_location: 'Local',
  created_at: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  tasks: tasks,
  last_modified: new Date('2024-01-01T00:00:00.000Z').toISOString(),
};
afterAll(async () => {
  await pool.end();
  jest.clearAllMocks();
});

describe('POST /relations/share', () => {
  beforeEach(async () => {
    await clearTestData();
    await seedTestData();
    jest.resetAllMocks();
    user1 = await loginHandler(TEST_USERS[0]);
    user2 = await loginHandler(TEST_USERS[1]);
  });
  describe('authenticated user', () => {
    it('should throw error when not authenticated', async () => {
      // Mock decodeToken to simulate unauthenticated user
      (decodeTokenFromRequest as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/relations/share')
        .send({
          task_relations: [{ name: 'Test Relation', tasks: [] }],
          user_shared_with: 'shared-user-id',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access Token Required');
    });
    it('should have user in database', async () => {
      const { token, id } = user1;
      const { name: name1 } = TEST_USERS[0];
      const { name: name2 } = TEST_USERS[1];
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const response = await request(app)
        .get('/user/search?name=')
        .set('Authorization', 'Bearer ' + token)
        .send();
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: id,
          name: name1,
        },
        {
          id: user2.id,
          name: name2,
        },
      ]);
    });
  });
  describe('user with permission', () => {
    it('should create relations and share them with a user', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });

      const response = await request(app)
        .post('/relations/share')
        .set('Authorization', 'Bearer ' + token)
        .send({
          task_relations: [relations],
          user_shared_with: user2.id,
        });

      expect(response.status).toBe(200);

      const body = response.body.map(
        ({ name, relation_location }: Omit<RelationType, 'tasks'>) => ({
          name,
          relation_location,
        })
      );
      expect(body).toEqual([
        {
          name: relations.name,
          relation_location: 'Server',
        },
      ]);
    });
    it('should not create relations when user doesnt exist', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });
      const user_id_not_exist = '10000000-0000-0000-0000-000000000001';

      const response_1 = await request(app)
        .post('/relations/share')
        .set('Authorization', 'Bearer ' + token)
        .send({
          task_relations: [relations],
          user_shared_with: user_id_not_exist,
        });
      expect(response_1.status).toBe(404);
      expect(response_1.body.error).toBe('User not found');

      const response_2 = await request(app)
        .post('/relations/share')
        .set('Authorization', 'Bearer ' + token)
        .send({
          task_relations: [relations],
          user_shared_with: user2.id,
        });

      expect(response_2.status).toBe(200);
    });
  });
});

describe('GET /relations', () => {
  beforeEach(async () => {
    await clearTestData();
    await seedTestData();
    jest.resetAllMocks();
    user1 = await loginHandler(TEST_USERS[0]);
    user2 = await loginHandler(TEST_USERS[1]);
  });
  describe('authenticated user', () => {
    it('should throw error when not authenticated', async () => {
      // Mock decodeToken to simulate unauthenticated user
      (decodeTokenFromRequest as jest.Mock).mockReturnValueOnce(null);

      const response = await request(app).get('/relations').send();

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access Token Required');
    });
  });
  describe('user with permission', () => {
    it('should get all relations for the user', async () => {
      const { token, id } = user1;
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id });

      const response_1 = await request(app)
        .get('/relations')
        .set('Authorization', 'Bearer ' + token);
      expect(response_1.status).toBe(200);

      expect(response_1.body.length).toEqual(3);

      const response_2 = await request(app)
        .post('/relations/share')
        .set('Authorization', 'Bearer ' + token)
        .send({
          task_relations: [relations],
          user_shared_with: user2.id,
        });

      expect(response_2.status).toBe(200);

      const response_3 = await request(app)
        .get('/relations')
        .set('Authorization', 'Bearer ' + token);
      expect(response_3.status).toBe(200);

      expect(response_3.body.length).toEqual(4);
    });
  });
});
