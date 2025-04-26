import { register, login } from '../../../../modules/auth/auth.controller';
import userApi from '../../../../modules/auth/auth.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { secret } from '../../../../resources/utils';
import { AuthenticationError } from '../../../../middleware/Error.types';
import { Request, Response, NextFunction } from 'express';

jest.mock('../../../../modules/auth/auth.service');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../../../resources/utils', () => ({
  secret: jest.fn(() => 'test-secret'),
}));

describe('Auth Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {};
    res = {
      send: jest.fn(),
      
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new user and return the user without the password', async () => {
      const mockUser = { email: 'test@example.com', name: 'Test User', password: 'hashed-password' };
      const mockCreatedUser = { email: 'test@example.com', name: 'Test User', id: 1 };

      req.body = { email: 'test@example.com', name: 'Test User', password: 'password123' };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (userApi.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      await register(req as Request, res as Response, next as NextFunction);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userApi.createUser).toHaveBeenCalledWith(mockUser);
      expect(res.send).toHaveBeenCalledWith(mockCreatedUser);
    });

    it('should call next with an error if user creation fails', async () => {
      const mockError = new Error('User creation failed');
      req.body = { email: 'test@example.com', name: 'Test User', password: 'password123' };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (userApi.createUser as jest.Mock).mockRejectedValue(mockError);

      await register(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledWith(mockError);
    });
    it('should call next with an error if invalid data is provided', async () => {
      const mockError = new Error('User creation failed');
      req.body = { email: 'test@example', name: 'Test User', password: 'password123' };

      (userApi.createUser as jest.Mock).mockRejectedValue(mockError);

      await register(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  describe('login', () => {
    it('should return a token and user details for valid credentials', async () => {
      const mockUser = { id: 1, email: 'test@example.com', password: 'hashed-password' };
      const mockToken = 'test-token';

      req.body = { email: 'test@example.com', password: 'password123' };

      (userApi.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      await login(req as Request, res as Response, next as NextFunction);

      expect(userApi.getUserByEmail).toHaveBeenCalledWith(req.body);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(jwt.sign).toHaveBeenCalledWith(
        { email: 'test@example.com', id: 1 },
        'test-secret',
        { expiresIn: '24h' }
      );
      expect(res.send).toHaveBeenCalledWith({
        token: mockToken,
        email: 'test@example.com',
        id: 1,
      });
    });

    it('should call next with AuthenticationError for invalid credentials', async () => {
      req.body = { email: 'test@example.com', password: 'wrong-password' };

      (userApi.getUserByEmail as jest.Mock).mockResolvedValue(null);

      await login(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid credentials');
    });

    it('should call next with an error if bcrypt.compare fails', async () => {
      const mockUser = { id: 1, email: 'test@example.com', password: 'hashed-password' };
      const mockError = new Error('bcrypt error');

      req.body = { email: 'test@example.com', password: 'password123' };

      (userApi.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockRejectedValue(mockError);

      await login(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledWith(mockError);
    });

    it('should call next with an error if jwt.sign fails', async () => {
      const mockUser = { id: 1, email: 'test@example.com', password: 'hashed-password' };
      const mockError = new Error('JWT error');

      req.body = { email: 'test@example.com', password: 'password123' };

      (userApi.getUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      await login(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledWith(mockError);
    });
    it('should call next with an AuthenticationError if provided credentials are wrong type', async () => {
      const mockError = new AuthenticationError('Invalid credentials');

      req.body = { email: 'test@example.com'};

      await login(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });
});