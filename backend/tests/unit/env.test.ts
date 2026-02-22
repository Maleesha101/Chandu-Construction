import { validateEnvironment } from '../../src/config/env';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should validate successfully with all required variables', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpassword';
    process.env.JWT_SECRET = 'test_secret_key_that_is_long_enough_for_production';
    process.env.NODE_ENV = 'development';

    expect(() => validateEnvironment()).not.toThrow();
  });

  it('should throw error when DB_PASSWORD is missing', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.JWT_SECRET = 'test_secret_key_that_is_long_enough';
    delete process.env.DB_PASSWORD;

    expect(() => validateEnvironment()).toThrow('Environment validation failed');
  });

  it('should throw error when JWT_SECRET is missing', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpassword';
    delete process.env.JWT_SECRET;

    expect(() => validateEnvironment()).toThrow('Missing required environment variable: JWT_SECRET');
  });

  it('should reject short JWT_SECRET in production', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpassword';
    process.env.JWT_SECRET = 'short';
    process.env.NODE_ENV = 'production';

    expect(() => validateEnvironment()).toThrow('JWT_SECRET must be at least 32 characters in production');
  });

  it('should accept valid PORT number', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpassword';
    process.env.JWT_SECRET = 'test_secret_key_that_is_long_enough';
    process.env.PORT = '3000';

    const config = validateEnvironment();
    expect(config.PORT).toBe(3000);
  });
});
