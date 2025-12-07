
import {z} from 'genkit';

const DEPARTMENTS = ['Rooms', 'Amenities', 'Dining', 'Front Desk', 'Service', 'Other'] as const;

// Shared Schemas
export const AnalyzedReviewSchema = z.object({
  id: z.number().describe('The original index of the review within the provided batch.'),
  text: z.string().describe('The original review text.'),
  rating: z.number().min(0).max(5).describe('The rating for this specific review on a scale from 0.0 to 5.0.'),
  sentiment: z.enum(['BEST', 'GOOD', 'FARE', 'BAD', 'Other']).describe('The sentiment category (or sentiment) for this review.'),
  topic: z.enum(DEPARTMENTS).optional().describe('The main topic of this review.'),
});
export type AnalyzedReview = z.infer<typeof AnalyzedReviewSchema>;

export const TopicSuggestionSchema = z.object({
  topic: z.enum(DEPARTMENTS).describe('The topic for the suggestion.'),
  suggestion: z.string().describe('The actionable suggestion for this topic.'),
});
export type TopicSuggestion = z.infer<typeof TopicSuggestionSchema>;

export const SuggestionSchema = z.object({
    suggestion: z.string().describe('The actionable suggestion for this topic.'),
    priority: z.number().min(1).max(3).describe('The priority of the suggestion (1=high, 2=medium, 3=low).')
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const GroupedTopicSuggestionSchema = z.object({
  topic: z.enum(DEPARTMENTS).describe('The topic for the suggestion.'),
  suggestions: z.array(SuggestionSchema).describe('A list of actionable suggestions for this topic.'),
});
export type GroupedTopicSuggestion = z.infer<typeof GroupedTopicSuggestionSchema>;

export const TopicAnalysisSchema = z.object({
    topic: z.enum(DEPARTMENTS),
    positiveSummary: z.string().describe('A summary of the positive feedback for this topic.'),
    negativeSummary: z.string().describe('A summary of the negative feedback for this topic.'),
    suggestions: z.array(z.string()).describe('A list of actionable suggestions for this topic.'),
});
export type TopicAnalysis = z.infer<typeof TopicAnalysisSchema>;


// Shared types
export type RatingCategory = z.infer<typeof AnalyzedReviewSchema.shape.sentiment>;
export type TopicCategory = z.infer<typeof TopicSuggestionSchema.shape.topic>;
