
'use server';
/**
 * @fileOverview Generates a consolidated summary and key positives from reviews.
 *
 * - generateSummary - Generates the summary.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const GenerateSummaryInputSchema = z.object({
  reviews: z.array(z.string()).describe('An array of all customer review strings.'),
});
type GenerateSummaryInput = z.infer<typeof GenerateSummaryInputSchema>;

const GenerateSummaryOutputSchema = z.object({
  overallSummary: z.string().describe('A brief, overall summary (2-3 sentences) of all feedback.'),
  positiveSummary: z.string().describe('A bulleted list summarizing the recurring themes from positive reviews.'),
  negativeSummary: z.string().describe('A bulleted list summarizing the recurring themes from negative reviews.'),
  keyPositives: z.string().describe('A bulleted list of the top 3-5 key positive aspects mentioned. If none, return an empty string.'),
});
export type GenerateSummaryOutput = z.infer<typeof GenerateSummaryOutputSchema>;

export async function generateSummary(
  input: GenerateSummaryInput
): Promise<GenerateSummaryOutput> {
  return await generateSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSummaryPrompt',
  input: {schema: GenerateSummaryInputSchema},
  output: {schema: GenerateSummaryOutputSchema},
  model: 'googleai/gemini-2.5-flash-lite',
  system: `You are an expert hospitality analyst. Based on the provided reviews, generate:
1.  An 'overallSummary': A brief, neutral, consolidated summary (2-3 sentences) of the overall sentiment.
2.  A 'positiveSummary': A bulleted list summarizing the recurring themes from positive reviews.
3.  A 'negativeSummary': A bulleted list summarizing the recurring themes from negative reviews.
4.  A 'keyPositives' list: A bulleted list of the top 3-5 specific positive points. If there are no clear positive points, you MUST return an empty string.`,
  prompt: `
Reviews to analyze:
{{#each reviews}}
- {{{this}}}
{{/each}}
`,
});

const generateSummaryFlow = ai.defineFlow(
  {
    name: 'generateSummaryFlow',
    inputSchema: GenerateSummaryInputSchema,
    outputSchema: GenerateSummaryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI model failed to return a valid summary.');
    }
    return {
      overallSummary: output.overallSummary || 'No overall summary available.',
      positiveSummary: output.positiveSummary || 'No positive feedback summary available.',
      negativeSummary: output.negativeSummary || 'No negative feedback summary available.',
      keyPositives: output.keyPositives || '',
    };
  }
);
