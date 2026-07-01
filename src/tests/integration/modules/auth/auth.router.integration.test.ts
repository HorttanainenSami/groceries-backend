import request from 'supertest';
import { app } from '../../../../app';
import { clearTestData, seedTestData, TEST_USERS } from '../../../../scripts/seed-test-data';
import { pool, query } from '../../../../database/connection';

afterAll(async () => {
  await pool.end();
});

describe('Auth integration', () => {
  beforeEach(async () => {
    await clearTestData();
    await seedTestData();
  });

  describe('POST /refresh', () => {
    it('should return new tokens when given a valid refresh token', async () => {
      const loginRes = await request(app).post('/login').send({
        email: TEST_USERS[0].email,
        password: TEST_USERS[0].password,
      });
      expect(loginRes.status).toBe(200);
      const { refreshToken } = loginRes.body;

      const refreshRes = await request(app).post('/refresh').send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.body).toHaveProperty('refreshToken');
      expect(refreshRes.body.refreshToken).not.toBe(refreshToken);
    });

    it('should store new refresh token and remove old one from DB after rotation', async () => {
      const loginRes = await request(app).post('/login').send({
        email: TEST_USERS[0].email,
        password: TEST_USERS[0].password,
      });
      const { refreshToken: oldToken } = loginRes.body;

      const refreshRes = await request(app).post('/refresh').send({ refreshToken: oldToken });
      const { refreshToken: newToken } = refreshRes.body;

      const oldInDb = await query('SELECT 1 FROM refresh_tokens WHERE token=$1', [oldToken]);
      const newInDb = await query('SELECT 1 FROM refresh_tokens WHERE token=$1', [newToken]);

      expect(oldInDb.rows.length).toBe(0);
      expect(newInDb.rows.length).toBe(1);
    });

    it('should reject old refresh token after rotation', async () => {
      const loginRes = await request(app).post('/login').send({
        email: TEST_USERS[0].email,
        password: TEST_USERS[0].password,
      });
      const { refreshToken: oldToken } = loginRes.body;

      await request(app).post('/refresh').send({ refreshToken: oldToken });

      const reuseRes = await request(app).post('/refresh').send({ refreshToken: oldToken });

      expect(reuseRes.status).toBe(403);
    });

    it('should return 403 for an invalid refresh token', async () => {
      const res = await request(app).post('/refresh').send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(403);
    });

    it('should return 401 if no refresh token provided', async () => {
      const res = await request(app).post('/refresh').send({});

      expect(res.status).toBe(401);
    });
  });
});
