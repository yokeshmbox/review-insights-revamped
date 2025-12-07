
'use server';
/**
 * @fileOverview Answers a specific question based on a set of reviews.
 *
 * - answerQuestion - Answers a question about a list of review texts.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const AnswerQuestionInputSchema = z.object({
  reviews: z.array(z.string()).describe('An array of all customer review strings.'),
  question: z.string().describe('The specific question to be answered based on the reviews.'),
});
type AnswerQuestionInput = z.infer<typeof AnswerQuestionInputSchema>;

const AnswerQuestionOutputSchema = z.object({
  answer: z.string().describe('A detailed, evidence-based answer to the question, formatted in markdown.'),
});
type AnswerQuestionOutput = z.infer<typeof AnswerQuestionOutputSchema>;

export async function answerQuestion(
  input: AnswerQuestionInput
): Promise<AnswerQuestionOutput> {
  return await answerQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerQuestionPrompt',
  input: {schema: AnswerQuestionInputSchema},
  output: {schema: AnswerQuestionOutputSchema},
  model: 'googleai/gemini-2.5-flash-lite',
  system: `You are an expert hospitality analyst. Your task is to answer a specific question based SOLELY on the provided customer reviews.

- You MUST base your answer only on the information present in the reviews. Do not invent information.
- Provide a concise, helpful, and direct answer to the user's question.
- If the reviews contain direct quotes that support your answer, use them as evidence.
- Format your answer using markdown for clear readability (e.g., bullet points, bold text).
- If the reviews do not contain enough information to answer the question, you MUST state that and explain why.`,
  prompt: `Based on the reviews below, please provide a detailed answer to the following question:

Question: "{{{question}}}"

Reviews to analyze:
{{#each reviews}}
- {{{this}}}
{{/each}}
`,
});

const answerQuestionFlow = ai.defineFlow(
  {
    name: 'answerQuestionFlow',
    inputSchema: AnswerQuestionInputSchema,
    outputSchema: AnswerQuestionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI model failed to return a valid answer.');
    }

    return {
      answer: output.answer || "Sorry, I couldn't generate an answer for that question at this time.",
    };
  }
);
