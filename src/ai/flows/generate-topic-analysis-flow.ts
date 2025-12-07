
'use server';
/**
 * @fileOverview Generates detailed analysis for each review topic.
 *
 * - generateTopicAnalysis - Generates the topic analysis.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  TopicAnalysisSchema,
} from '@/ai/schemas';
import { googleAI } from '@genkit-ai/googleai';

const GenerateTopicAnalysisInputSchema = z.object({
  topics: z.array(z.object({
    topic: z.string().describe('The topic category name'),
    reviews: z.array(z.string()).describe('An array of customer review strings for this topic'),
  })).describe('An array of topics with their associated reviews'),
});
type GenerateTopicAnalysisInput = z.infer<typeof GenerateTopicAnalysisInputSchema>;

const GenerateTopicAnalysisOutputSchema = z.object({
    detailedTopicAnalysis: z.array(TopicAnalysisSchema).describe('A detailed analysis for each topic category.')
});
type GenerateTopicAnalysisOutput = z.infer<typeof GenerateTopicAnalysisOutputSchema>;


export async function generateTopicAnalysis(
  input: GenerateTopicAnalysisInput
): Promise<GenerateTopicAnalysisOutput> {
    return await generateTopicAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTopicAnalysisPrompt',
  input: {schema: GenerateTopicAnalysisInputSchema},
  output: {schema: GenerateTopicAnalysisOutputSchema},
  model: 'googleai/gemini-2.5-flash-lite',
  system: `You are an expert hospitality analyst. The user will provide multiple topics, each with their associated reviews.

For EACH topic provided, you MUST analyze ONLY the reviews provided for that specific topic and perform the following:
1.  Use the provided topic name.
2.  Create a 'positiveSummary': A SINGLE, BRIEF, AND CONCISE (max 10 words) sentence summarizing positive feedback.
3.  Create a 'negativeSummary': A SINGLE, BRIEF, AND CONCISE (max 10 words) sentence summarizing negative feedback.
4.  Create a 'suggestions' list: Provide 1-2 DETAILED, DESCRIPTIVE, and PRACTICAL steps for improvement or enhancement. Each suggestion should be a full sentence explaining the 'what' and 'why'.

IMPORTANT RULES:
- If no reviews are provided for a topic, you MUST return "No feedback provided for this topic." for both summaries and an empty array for suggestions.
- If there is no positive feedback for a topic, the positiveSummary MUST be "No positive feedback provided.".
- If there is no negative feedback for a topic, the negativeSummary MUST be "No negative feedback provided.".
- If no actionable suggestions can be made, the suggestions array MUST be empty.
- Your entire output must conform to the JSON schema. Do not invent feedback.
- You MUST return an analysis for EVERY topic provided in the input, even if it has no reviews.`,
  prompt: `
Analyze the following topics and their reviews:

{{#each topics}}
Topic: {{this.topic}}
Reviews:
{{#each this.reviews}}
- {{{this}}}
{{/each}}

{{/each}}
`,
});

const generateTopicAnalysisFlow = ai.defineFlow(
  {
    name: 'generateTopicAnalysisFlow',
    inputSchema: GenerateTopicAnalysisInputSchema,
    outputSchema: GenerateTopicAnalysisOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI model failed to return a valid topic analysis.');
    }
    return {
        detailedTopicAnalysis: output.detailedTopicAnalysis || []
    };
  }
);
