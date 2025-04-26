import { getTokenFrom } from '../../../resources/utils';
import { JsonWebTokenError } from 'jsonwebtoken';

type MockedRequest = {
  headers?: { authorization?: string };
};

describe('utils', () => {
  describe('getTokenFrom', () => {
    let req: MockedRequest;

    beforeEach(() => {
      req = {};
    });

    it('should return the token from the request headers', () => {
      req.headers = {
        authorization: 'Bearer test-token',
      };

      const token = getTokenFrom(req as any);
      expect(token).toBe('test-token');
    });

    it('should throw JsonWebTokenError if the authorization header is missing', () => {
      req.headers = {};

      expect(() => getTokenFrom(req as any)).toThrow(
				new JsonWebTokenError('Token required')
			);
    });

    it('should throw JsonWebTokenError if the authorization header is not a Bearer token', () => {
      req.headers = {
        authorization: 'Basic test-token',
      };

      expect(() => getTokenFrom(req as any)).toThrow(
				new JsonWebTokenError('Token required'));
    });

    it('should throw JsonWebTokenError if the headers object is undefined', () => {
			expect(() => getTokenFrom(req as any)).toThrow(
				new JsonWebTokenError('Token required'));
    });

    it('should throw JsonWebTokenError if the authorization header is undefined', () => {
      req.headers = {
        authorization: undefined,
      };

      expect(() => getTokenFrom(req as any)).toThrow(
				new JsonWebTokenError('Token required'));
    });
  });
});