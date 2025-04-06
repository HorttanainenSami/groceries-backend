import z from 'zod';
export const loginSchema = z.object({
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
export const newUserSchema = userSchema.pick({
  email: true,
  password: true,
  name:true,
});
export type newUserType = z.infer<typeof newUserSchema>;
