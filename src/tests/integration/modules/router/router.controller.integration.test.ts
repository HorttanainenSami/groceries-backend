import request from 'supertest';
import { decodeTokenFromRequest } from '../../../../resources/utils';
import { jest } from '@jest/globals';
import { app } from '../../../../app';
import {
  TaskRelationType,
  TaskType,
} from '../../../../modules/relations/relations.schema';
import { UserType } from '../../../../modules/auth/auth.schema';
import jwt from 'jsonwebtoken';
import { pool, query } from '../../../../database/connection';

// Mock decodeToken to simulate authentication
jest.mock('../../../../resources/utils', () => {
  const originalModule = jest.requireActual('../../../../resources/utils');
  return {
    ...(originalModule as object),
    decodeToken: jest.fn(),
  };
});
let user_1: UserType;
let user_2: UserType;
const populate_database_with_users = async () => {
  const user1 = {
    email: 'test_1@test.fi',
    password: 'test_1',
    name: 'test_1',
  };
  const user2 = {
    email: 'test_2@test.fi',
    password: 'test_2',
    name: 'test_2',
  };
  const password = jwt.sign(user1.password, process.env.SECRET || 'secret');
  await query(
    'INSERT INTO users (email, password, name ) values ($1, $2, $3) returning *;',
    [user1.email, password, user1.name]
  ).then((result) => {
    user_1 = { ...result.rows[0] } as UserType;
  });
  const password_2 = jwt.sign(user2.password, process.env.SECRET || 'secret');
  await query(
    'INSERT INTO users (email, password, name ) values ($1, $2, $3) returning *;',
    [user2.email, password_2, user2.name]
  ).then((result) => {
    user_2 = { ...result.rows[0] } as UserType;
  });
};
const clean_database = async () => {
  await query(
    'TRUNCATE TABLE users, task_relation, task, task_permissions RESTART IDENTITY CASCADE;',
    []
  );
};
const log_db = async () => {
  await query('select * from users;', []).then((result) => {
    console.log('user', result.rows);
  });
};
describe('POST /relations/share', () => {
  afterAll(() => {
    jest.clearAllMocks();
    //pool.end();
  });
  beforeEach(async () => {
    jest.resetAllMocks();
    await clean_database();
    await populate_database_with_users();
    await log_db();
    //await log_db();
    user_1 = user_1 as UserType;
    user_2 = user_2 as UserType;
  });
  describe('authenticated user', () => {
    it('should throw error when not authenticated', async () => {
      // Mock decodeToken to simulate unauthenticated user
      (decodeTokenFromRequest as jest.Mock).mockReturnValueOnce(null);

      const response = await request(app)
        .post('/relations/share')
        .send({
          task_relations: [{ name: 'Test Relation', tasks: [] }],
          user_shared_with: 'shared-user-id',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access Token Required');
    });
    it('should have user in database', async () => {
      const response = await request(app)
        .get('/user/search?name=')
        .set(
          'Authorization',
          'Bearer ' + jwt.sign(user_1, process.env.SECRET || 'secret')
        )
        .send();
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: user_1.id,
          name: user_1.name,
        },
        {
          id: user_2.id,
          name: user_2.name,
        },
      ]);
    });
  });
  describe('user with permission', () => {
    it('should create relations and share them with a user', async () => {
      // Mock decodeToken to simulate authenticated user

      const tasks: TaskType[] = [
        {
          id: '00000000-0000-0000-0000-000000000001',
          task: 'Test Task',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          completed_at: new Date('2024-01-01T00:00:00.000Z'),
          completed_by: user_2.id,
          task_relations_id: '00000000-0000-0000-0000-000000000001',
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          task: 'Test Task 2',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          completed_at: null,
          completed_by: user_1.id,
          task_relations_id: '00000000-0000-0000-0000-000000000001',
        },
        {
          id: '00000000-0000-0000-0000-000000000003',
          task: 'Test Task 3',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          completed_at: null,
          completed_by: null,
          task_relations_id: '00000000-0000-0000-0000-000000000001',
        },
      ];
      const relations: TaskRelationType = {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Relation',
        relation_location: 'Server',
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        tasks: tasks,
      };
      const token = jwt.sign(user_1, process.env.SECRET || 'secret');
      (decodeTokenFromRequest as jest.Mock).mockReturnValueOnce({ id: user_1.id });

      const response = await request(app)
        .post('/relations/share')
        .set('Authorization', 'Bearer ' + token)
        .send({
          task_relations: [relations],
          user_shared_with: user_2.id,
        });

      expect(response.status).toBe(200);
      // eslint-disable-next-line
      const body = response.body.map(
        ({
          id: _id,
          created_at: _created_at,
          ...rest
        }: Omit<TaskRelationType, 'tasks'>) => ({
          ...rest,
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
      const tasks: TaskType[] = [
        {
          id: '00000000-0000-0000-0000-000000000003',
          task: 'Test Task 3',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          completed_at: null,
          completed_by: null,
          task_relations_id: '00000000-0000-0000-0000-000000000001',
        },
      ];
      const relations: TaskRelationType = {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Relation',
        relation_location: 'Server',
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        tasks: tasks,
      };
      const token = jwt.sign(user_1, process.env.SECRET || 'secret');
      (decodeTokenFromRequest as jest.Mock).mockReturnValue(user_1.id);
      const user_id_not_exist = '10000000-0000-0000-0000-000000000001';

      const response_1 = await request(app)
        .get('/relations')
        .set('Authorization', 'Bearer ' + token);

      expect(response_1.status).toBe(200);
      expect(response_1.body).toEqual([]);
      const response_2 = await request(app)
        .post('/relations/share')
        .set('Authorization', 'Bearer ' + token)
        .send({
          task_relations: [relations],
          user_shared_with: user_id_not_exist,
        });
      expect(response_2.status).toBe(500);
      expect(response_2.body.error).toBe(
        'Error in communicating with database'
      );

      const response_3 = await request(app)
        .get('/relations')
        .set('Authorization', 'Bearer ' + token);

      expect(response_3.status).toBe(200);
      expect(response_3.body).toEqual([]);
    });
  });
});

describe('GET /relations', () => {
  afterAll(() => {
    jest.clearAllMocks();
    pool.end();
  });
  beforeEach(async () => {
    jest.resetAllMocks();
    await clean_database();
    await populate_database_with_users();
    await log_db();
    //await log_db();
    user_1 = user_1 as UserType;
    user_2 = user_2 as UserType;
  });
  describe('authenticated user', () => {
    it('should throw error when not authenticated', async () => {
      // Mock decodeToken to simulate unauthenticated user
      (decodeTokenFromRequest as jest.Mock).mockReturnValueOnce(null);

      const response = await request(app).get('/relations').send();

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access Token Required');
    });
  });
  describe('user with permission', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      await clean_database();
      await populate_database_with_users();
      await log_db();
      //await log_db();
      user_1 = user_1 as UserType;
      user_2 = user_2 as UserType;
    });
    it('should get all relations for the user', async () => {
      const token = jwt.sign(user_1, process.env.SECRET || 'secret');
      (decodeTokenFromRequest as jest.Mock).mockReturnValue({ id: user_1.id });

      const relations: TaskRelationType[] = [
        {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Test Relation',
          relation_location: 'Local',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          tasks: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              task: 'Test Task',
              created_at: new Date('2024-01-01T00:00:00.000Z'),
              completed_at: new Date('2024-01-01T00:00:00.000Z'),
              completed_by: user_2.id,
              task_relations_id: '00000000-0000-0000-0000-000000000000',
            },
          ],
        },
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Test Relation',
          relation_location: 'Local',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          tasks: [
            {
              id: '00000000-0000-0000-0000-000000000002',
              task: 'Test Task 2',
              created_at: new Date('2024-01-01T00:00:00.000Z'),
              completed_at: null,
              completed_by: user_1.id,
              task_relations_id: '00000000-0000-0000-0000-000000000001',
            },
          ],
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          name: 'Test Relation',
          relation_location: 'Local',
          created_at: new Date('2024-01-01T00:00:00.000Z'),
          tasks: [
            {
              id: '00000000-0000-0000-0000-000000000003',
              task: 'Test Task',
              created_at: new Date('2024-01-01T00:00:00.000Z'),
              completed_at: new Date('2024-01-01T00:00:00.000Z'),
              completed_by: user_2.id,
              task_relations_id: '00000000-0000-0000-0000-000000000002',
            },
          ],
        },
      ];

      const response_1 = await request(app)
        .post('/relations/share')
        .set('Authorization', 'Bearer ' + token)
        .send({
          task_relations: relations,
          user_shared_with: user_2.id,
        });

      expect(response_1.status).toBe(200);

      const response = await request(app)
        .get('/relations')
        .set('Authorization', 'Bearer ' + token)
        .send();
      expect(response.status).toBe(200);
      // eslint-disable-next-line
      expect(response.body.length).toEqual(3);
    });
  });
});
