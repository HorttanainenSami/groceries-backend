import { Request, Response, NextFunction } from 'express';
import requireAuth from '../../../src/middleware/requireAuth';
import jwt from 'jsonwebtoken';
import { AuthorizationError, TokenExpiredError } from '../../../src/middleware/Error.types';
import { secret } from '../../../src/resources/utils';

jest.mock('jsonwebtoken');
jest.mock('../../../src/resources/utils', () => ({
  secret: jest.fn(() => 'test-secret'),
  getTokenFrom: jest.fn((req: Request) => req.headers['authorization']?.split(' ')[1]),
}));
type MockedRequest = Partial<Request> & {
    headers: { [key: string]: string };
};
describe('requireAuth middleware', () => {
  let req: MockedRequest;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {};
    next = jest.fn();
  });

  it('should call next with AuthorizationError if no token is provided', () => {
    requireAuth(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(new AuthorizationError('Access Token Required'));
  });

  it('should call next with TokenExpiredError if the token is expired', () => {
    const mockToken = 'expired-token';
    req.headers['authorization'] = `Bearer ${mockToken}`;
    
    (jwt.verify as jest.Mock).mockImplementation(() => {
      const error = new Error('TokenExpiredError');
      error.name = 'TokenExpiredError';
      throw error;
    });

    requireAuth(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(TokenExpiredError));
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(TokenExpiredError);
    expect(error.message).toBe('Error: token expired');
  });

  it('should call next with no arguments if the token is valid', () => {
    const mockToken = 'valid-token';
    req.headers['authorization'] = `Bearer ${mockToken}`;

    (jwt.verify as jest.Mock).mockReturnValue({ id: '12345' });

    requireAuth(req as Request, res as Response, next as NextFunction);

    expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-secret');
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with an error if jwt.verify throws an unexpected error', () => {
    const mockToken = 'invalid-token';
    req.headers['authorization'] = `Bearer ${mockToken}`;

    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    requireAuth(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const error = next.mock.calls[0][0];
    expect(error.message).toBe('Unexpected error');
  });
});