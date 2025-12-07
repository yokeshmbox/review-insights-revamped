
'use server';
/**
 * @fileOverview Generates actionable suggestions based on customer reviews.
 *
 * - generateSuggestions - Generates suggestions.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  GroupedTopicSuggestionSchema,
  TopicSuggestion,
} from '@/ai/schemas';
import { googleAI } from '@genkit-ai/googleai';

const GenerateSuggestionsInputSchema = z.object({
  reviews: z.array(z.string()).describe('An array of all customer review strings.'),
});
type GenerateSuggestionsInput = z.infer<typeof GenerateSuggestionsInputSchema>;


const GenerateSuggestionsOutputSchema = z.object({
  suggestions: z.array(GroupedTopicSuggestionSchema).describe('A list of actionable suggestions for improvement, grouped by topic. If none, return an empty array.'),
});
type GenerateSuggestionsOutput = z.infer<typeof GenerateSuggestionsOutputSchema>;


export async function generateSuggestions(
  input: GenerateSuggestionsInput
): Promise<GenerateSuggestionsOutput> {
    return await generateSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSuggestionsPrompt',
  input: {schema: GenerateSuggestionsInputSchema},
  output: {schema: GenerateSuggestionsOutputSchema},
  model: 'googleai/gemini-2.5-flash-lite',
  system: `You are an expert hospitality analyst. Your task is to provide actionable suggestions based on a provided set of customer reviews. The reviews have been pre-filtered for a specific context (e.g., only negative, or only positive).

The possible topics are: 'Rooms', 'Amenities', 'Dining', 'Front Desk', 'Service', 'Other'.

YOUR BEHAVIOR DEPENDS ON THE REVIEW SENTIMENT:

1.  **If the reviews are mostly NEGATIVE:**
    *   You MUST provide a list of the most **critical, actionable suggestions for IMMEDIATE IMPROVEMENT**. This is a mandatory requirement.
    *   Synthesize feedback into 1 or 2 unique, high-impact suggestions per topic.
    *   Assign a 'priority' of 1 (most urgent) to 3 (least urgent) for each suggestion.

2.  **If the reviews are mostly POSITIVE:**
    *   You MUST provide suggestions on how to **AMPLIFY and REINFORCE these strengths**. Think about marketing, staff recognition, or enhancing the praised feature.
    *   Frame suggestions positively (e.g., "Showcase the popular breakfast buffet in marketing materials" instead of "Fix breakfast").
    *   Synthesize the praise into 1 or 2 unique, high-impact suggestions per topic.
    *   Assign a 'priority' of 3 (low urgency, as it's about enhancement) for these suggestions.

**IMPORTANT RULES FOR ALL SCENARIOS:**
*   You MUST group all suggestions for the same topic into a single object with a 'suggestions' array.
*   For NEGATIVE reviews, you MUST always provide suggestions. Do not return an empty array if there is negative feedback to analyze.`,
  prompt: `
Reviews to analyze:
{{#each reviews}}
- {{{this}}}
{{/each}}
`,
});

const generateSuggestionsFlow = ai.defineFlow(
  {
    name: 'generateSuggestionsFlow',
    inputSchema: GenerateSuggestionsInputSchema,
    outputSchema: GenerateSuggestionsOutputSchema,
  },
  async (input) => {
    // Do not process if there are no reviews to avoid empty/hallucinated suggestions
    if (input.reviews.length === 0) {
        return { suggestions: [] };
    }
    
    const {output} = await prompt(input);
    if (!output || !Array.isArray(output.suggestions)) {
      throw new Error('The AI model failed to return valid suggestions.');
    }
    
    return {
        suggestions: output.suggestions,
    };
  }
);
