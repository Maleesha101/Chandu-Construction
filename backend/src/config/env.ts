import dotenv from 'dotenv';

// Load environment variables
const result = dotenv.config();
if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
}

interface EnvironmentConfig {
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  
  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  
  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  
  // CORS
  CORS_ORIGIN: string;
}

/**
 * Validates that all required environment variables are present
 * Throws an error if any required variables are missing
 */
export function validateEnvironment(): EnvironmentConfig {
  const errors: string[] = [];
  
  // Required variables
  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET',
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }
  
  // Validate JWT_SECRET strength in production
  const jwtSecret = process.env.JWT_SECRET || '';
  if (process.env.NODE_ENV === 'production') {
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }
    if (jwtSecret.includes('secret') || jwtSecret.includes('change')) {
      errors.push('JWT_SECRET appears to be a default/example value - change it in production');
    }
  }
  
  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`);
  }
  
  // Validate port
  const port = parseInt(process.env.PORT || '5000');
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535`);
  }
  
  // Validate DB_PORT
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
    errors.push(`Invalid DB_PORT: ${process.env.DB_PORT}. Must be a number between 1 and 65535`);
  }
  
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(err => console.error(`   - ${err}`));
    throw new Error('Environment validation failed. Please check your .env file.');
  }
  
  console.log('✅ Environment validation passed');
  
  return {
    PORT: port,
    NODE_ENV: (nodeEnv || 'development') as 'development' | 'production' | 'test',
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: dbPort,
    DB_NAME: process.env.DB_NAME!,
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  };
}

// Export validated config
export const config = validateEnvironment();
