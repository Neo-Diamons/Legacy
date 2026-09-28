import { z } from '@hono/zod-openapi';

export const UserResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi('User');
export type UserResponse = z.infer<typeof UserResponseSchema>;

export const RegisterUserBodySchema = z
  .object({ email: z.email(), name: z.string().min(1), password: z.string().min(12) })
  .strict()
  .openapi('RegisterUser');
export type RegisterUserBody = z.infer<typeof RegisterUserBodySchema>;

export const LoginBodySchema = z
  .object({ email: z.email(), password: z.string().min(1) })
  .strict()
  .openapi('Login');

export const UpdateUserBodySchema = z
  .object({ email: z.email().optional(), name: z.string().min(1).optional(), password: z.string().min(12).optional() })
  .strict()
  .openapi('UpdateUser');
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;

export const UserParamsSchema = z.object({ id: z.uuid() });
export const TokenResponseSchema = z.object({ token: z.string(), user: UserResponseSchema }).openapi('TokenResponse');
export const UserExportResponseSchema = z
  .object({ user: UserResponseSchema, projects: z.array(z.unknown()), items: z.array(z.unknown()) })
  .openapi('UserExport');
