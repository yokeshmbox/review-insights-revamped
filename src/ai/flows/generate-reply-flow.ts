
'use server';
/**
 * @fileOverview Generates a suggested reply to a single customer review.
 *
 * - generateReply - Generates a suggested reply.
 */
import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { googleAI } from '@genkit-ai/googleai';

const GenerateReplyInputSchema = z.object({
  review: z.string().describe('The customer review text to reply to.'),
});
export type GenerateReplyInput = z.infer<typeof GenerateReplyInputSchema>;

const GenerateReplyOutputSchema = z.object({
  reply: z.string().describe('The suggested reply to the customer review.'),
});
export type GenerateReplyOutput = z.infer<typeof GenerateReplyOutputSchema>;

export async function generateReply(
  input: GenerateReplyInput
): Promise<GenerateReplyOutput> {
  return await generateReplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReplyPrompt',
  input: {schema: GenerateReplyInputSchema},
  output: {schema: GenerateReplyOutputSchema},
  model: 'googleai/gemini-2.5-flash-lite',
  system: `You are a helpful and empathetic customer service manager for a hotel. Your task is to write a short, professional, and personalized reply to a customer review.

- If the review is positive, thank the guest and highlight something they enjoyed.
- If the review is negative, apologize for the specific issue, show empathy, and briefly mention that you are looking into it.
- Do not make promises you can't keep.
- Keep the reply concise (2-4 sentences).`,
  prompt: `Please generate a reply for the following review:

"{{{review}}}"
`,
});


const generateReplyFlow = ai.defineFlow(
  {
    name: 'generateReplyFlow',
    inputSchema: GenerateReplyInputSchema,
    outputSchema: GenerateReplyOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI model failed to return a valid reply.');
    }
    return {
      reply: output.reply || "Sorry, we couldn't generate a reply at this time.",
    };
  }
);
