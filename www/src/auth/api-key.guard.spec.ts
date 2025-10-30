import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: {
    headers: {
      'x-api-key'?: string;
    };
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ApiKeyGuard(reflector);

    // Mock request object
    mockRequest = {
      headers: {},
    };

    // Mock ExecutionContext
    mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NODE_ENV;
    delete process.env.CUSTOMER_API_KEYS_MAP;
  });

  describe('Public Routes', () => {
    beforeEach(() => {
      // Mock the route as public
      jest.spyOn(reflector, 'get').mockReturnValue(true);
    });

    it('should return true for public route with no API key', () => {
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should return true for public route with incorrect API key', () => {
      mockRequest.headers['x-api-key'] = 'wrong-key';
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should return true for public route with correct API key', () => {
      process.env.CUSTOMER_API_KEYS_MAP = JSON.stringify({ client1: 'valid-key' });
      mockRequest.headers['x-api-key'] = 'valid-key';
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should not check environment variables for public routes', () => {
      // No CUSTOMER_API_KEYS_MAP set
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      // Mock the route as NOT public
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      process.env.NODE_ENV = 'development';
    });

    it('should return true in development with no API key', () => {
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should return true in development with incorrect API key', () => {
      mockRequest.headers['x-api-key'] = 'wrong-key';
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should return true in development even if CUSTOMER_API_KEYS_MAP is not set', () => {
      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Protected Routes in Production', () => {
    beforeEach(() => {
      // Mock the route as NOT public
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      process.env.NODE_ENV = 'production';
    });

    describe('Missing or Invalid API Key Map', () => {
      it('should throw UnauthorizedException when CUSTOMER_API_KEYS_MAP is not set', () => {
        delete process.env.CUSTOMER_API_KEYS_MAP;

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('No API keys found');
      });

      it('should throw UnauthorizedException when CUSTOMER_API_KEYS_MAP is empty object', () => {
        process.env.CUSTOMER_API_KEYS_MAP = '{}';

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('No API keys found');
      });

      it('should throw UnauthorizedException when CUSTOMER_API_KEYS_MAP is empty string', () => {
        process.env.CUSTOMER_API_KEYS_MAP = '';

        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('No API keys found');
      });
    });

    describe('Missing or Invalid API Key Header', () => {
      beforeEach(() => {
        process.env.CUSTOMER_API_KEYS_MAP = JSON.stringify({
          client1: 'valid-key-123',
          client2: 'valid-key-456',
        });
      });

      it('should throw UnauthorizedException when API key header is missing', () => {
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid API Key');
      });

      it('should throw UnauthorizedException when API key header is empty string', () => {
        mockRequest.headers['x-api-key'] = '';
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid API Key');
      });

      it('should throw UnauthorizedException when API key is incorrect', () => {
        mockRequest.headers['x-api-key'] = 'wrong-key';
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid API Key');
      });

      it('should throw UnauthorizedException when API key is partially correct', () => {
        mockRequest.headers['x-api-key'] = 'valid-key';
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid API Key');
      });
    });

    describe('Valid API Key', () => {
      beforeEach(() => {
        process.env.CUSTOMER_API_KEYS_MAP = JSON.stringify({
          client1: 'valid-key-123',
          client2: 'valid-key-456',
        });
      });

      it('should return true with correct API key (first key)', () => {
        mockRequest.headers['x-api-key'] = 'valid-key-123';

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });

      it('should return true with correct API key (second key)', () => {
        mockRequest.headers['x-api-key'] = 'valid-key-456';

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });

      it('should be case sensitive', () => {
        mockRequest.headers['x-api-key'] = 'VALID-KEY-123';
        expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
        expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid API Key');
      });
    });
  });
});
