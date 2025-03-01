import z from 'zod';


export const searchSchema = z.object({
  name: z.string(),
});


export type searchType = z.infer<typeof searchSchema>;
