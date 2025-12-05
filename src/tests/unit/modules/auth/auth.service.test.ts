import { query } from '../../../../database/connection';
import { AuthenticationError, DatabaseError } from '../../../../middleware/Error.types';
import AuthService from '../../../../modules/auth/auth.service';
import { DatabaseError as pgError } from 'pg';
import bcrypt from 'bcrypt';

jest.mock('../../../../database/connection');
jest.mock('bcrypt');

describe('AuthService', () => {
  describe('createUser', () => {
    it('should return user with id', async () => {
      const mockUser = {
        email: 'test@test.com',
        name: 'Test User',
        password: 'hashed-password',
      };
      const mockResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@test.com',
        name: 'Test User',
        password: 'hashed-password',
      };
      (query as jest.Mock).mockResolvedValue({
        rows: [mockResponse],
        rowCount: 1,
      });
      const response = await AuthService.createUser(mockUser);
      expect(query).toHaveBeenCalledWith(
        'INSERT INTO users (email, password, name ) values ($1, $2, $3) RETURNING *;',
        [mockUser.email, mockUser.password, mockUser.name]
      );
      expect(response).toEqual(mockResponse);
    });
    it('should throw DatabaseError if query fails', async () => {
      const mockUser = {
        email: 'test@test.com',
        name: 'Test User',
        password: 'hashed-password',
      };
      const mockError = new pgError('Database error', 1, 'parseComplete');
      const mockResponseError = new DatabaseError('Failed to create user', mockError);
      (query as jest.Mock).mockRejectedValue(mockError);

      await expect(AuthService.createUser(mockUser)).rejects.toThrow(mockResponseError);
    });
  });

  describe('getUserByEmail', () => {
    it('should return User with correct credentials', async () => {
      const mockUser = {
        email: 'test@test.com',
        password: 'hashed-password',
      };
      const mockResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'test',
        email: 'test@test.com',
        password: 'hashed-password',
      };

      (query as jest.Mock).mockResolvedValue({
        rows: [mockResponse],
        rowCount: 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(AuthService.getUserByEmail(mockUser)).resolves.toStrictEqual(mockResponse);
    });
    it('should return AuthenticationError if email is not correct', async () => {
      const mockUser = {
        email: 'test@test.com',
        password: 'hashed-password',
      };
      const mockError = new AuthenticationError('Email and/or password is wrong!');

      (query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await expect(AuthService.getUserByEmail(mockUser)).rejects.toThrow(mockError);
    });
    it('should return AuthenticationError if passwords doesnt match', async () => {
      const mockUser = {
        email: 'test@test.com',
        password: 'incorrect-password',
      };
      const mockServerUser = {
        email: 'test@test.com',
        password: 'hashed-password',
      };
      const mockError = new AuthenticationError('Email and/or password is wrong!');

      (query as jest.Mock).mockResolvedValue({
        rows: [mockServerUser],
        rowCount: 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(AuthService.getUserByEmail(mockUser)).rejects.toThrow(mockError);
    });
  });
});
