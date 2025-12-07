
'use server';
/**
 * @fileOverview Analyzes a batch of reviews for sentiment, topic, and rating.
 *
 * - analyzeReviews - Analyzes a list of review texts.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  AnalyzedReviewSchema,
  type AnalyzedReview,
} from '@/ai/schemas';
import { googleAI } from '@genkit-ai/googleai';

const AnalyzeReviewsInputSchema = z.object({
  reviews: z.array(z.string()).describe('An array of all customer review strings.'),
});
type AnalyzeReviewsInput = z.infer<typeof AnalyzeReviewsInputSchema>;

const AnalyzeReviewsOutputSchema = z.object({
  analyzedReviews: z.array(AnalyzedReviewSchema).describe('An array of individually analyzed reviews.'),
});
type AnalyzeReviewsOutput = z.infer<typeof AnalyzeReviewsOutputSchema>;


export async function analyzeReviews(
  input: AnalyzeReviewsInput
): Promise<AnalyzeReviewsOutput> {
  return await analyzeReviewsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeReviewsPrompt',
  input: {schema: AnalyzeReviewsInputSchema},
  output: {schema: AnalyzeReviewsOutputSchema},
  model: 'googleai/gemini-2.5-flash-lite',
  system: `You are an expert hospitality analyst. Your task is to analyze a BATCH of customer reviews for a hotel.

For EACH review in the batch, you must:
a.  Assign a 'rating' from 0.0 to 5.0.
b.  Categorize the 'sentiment' as 'BEST', 'GOOD', 'FARE', 'BAD', or 'Other'. If a specific sentiment cannot be determined, you MUST assign it to 'Other'.
c.  Categorize the main 'topic' as 'Rooms', 'Amenities', 'Dining', 'Front Desk', 'Service', or 'Other'. If a specific topic cannot be determined, you MUST assign it to 'Other'.
d.  Preserve the original text in the 'text' field and its original index in the 'id' field. This is a mandatory requirement.
e.  You MUST NOT include the original index (e.g., "[0]") in the returned 'text' field.
`,
  prompt: `
Reviews to analyze:
{{#each reviews}}
- [{{@index}}] {{{this}}}
{{/each}}
`,
});

const analyzeReviewsFlow = ai.defineFlow(
  {
    name: 'analyzeReviewsFlow',
    inputSchema: AnalyzeReviewsInputSchema,
    outputSchema: AnalyzeReviewsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output || !Array.isArray(output.analyzedReviews)) {
      throw new Error('The AI model failed to return a valid analysis for the reviews.');
    }

    // Post-process and validate each item to ensure it conforms to the schema.
    // This prevents errors if the model returns incomplete objects in the array.
    const validatedReviews = output.analyzedReviews.map(review => {
        const result = AnalyzedReviewSchema.safeParse(review);
        return result.success ? result.data : null;
    }).filter((item): item is AnalyzedReview => item !== null);

    return {
      analyzedReviews: validatedReviews,
    };
  }
);
