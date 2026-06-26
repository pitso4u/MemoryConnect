import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import { prisma } from '../lib/prisma';

// Create a test app with auth routes
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('Auth API', () => {
  beforeAll(async () => {
    // Setup test database if needed
    // For now, we'll skip DB tests and just test validation
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should reject registration with invalid email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        funeralHomeName: 'Test Funeral Home',
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should reject registration with short password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        funeralHomeName: 'Test Funeral Home',
        name: 'John Doe',
        email: 'test@example.com',
        password: 'short',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should reject login with invalid email format', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'not-an-email',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
