import z from 'zod';
export const loginReqBodySchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .toLowerCase()
    .email({ message: 'Invalid email adress' }),
  password: z.string(),
});

export const userSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  id: z.string().uuid(),
});
export const registerReqBodySchema = userSchema.pick({
  email: true,
  password: true,
  name: true,
});
export type newUserType = z.infer<typeof registerReqBodySchema>;
export type UserType = z.infer<typeof userSchema>;
