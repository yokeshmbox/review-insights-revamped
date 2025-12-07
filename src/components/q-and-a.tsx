
'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, Sparkles } from 'lucide-react';
import { answerQuestion } from '@/ai/flows/answer-question-flow';
import type { Review } from './review-dashboard';
import { marked } from 'marked';

interface QAndAProps {
  reviews: Review[];
}

const suggestedQuestions = [
    "What are the main complaints about rooms?",
    "Summarize feedback on breakfast.",
    "Were there positive comments about staff?",
    "What's the most common WiFi issue?"
];

export function QAndA({ reviews }: QAndAProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAskQuestion = async (q: string) => {
    if (!q.trim()) return;
    setQuestion(q); // Set the question in the input field

    setIsLoading(true);
    setError(null);
    setAnswer('');

    try {
      const reviewTexts = reviews.map(r => r.text);
      const result = await answerQuestion({ reviews: reviewTexts, question: q });
      const htmlAnswer = marked.parse(result.answer) as string;
      setAnswer(htmlAnswer);
    } catch (e: any) {
      setError('Failed to get an answer. Please try again.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
        <div className="flex gap-2 mb-4">
            <Input
            type="text"
            placeholder="e.g., 'What was the main issue with WiFi?'"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion(question)}
            disabled={isLoading}
            />
            <Button onClick={() => handleAskQuestion(question)} disabled={isLoading || !question.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
            </Button>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="font-semibold">Suggestions:</p>
            <div className="flex gap-2 flex-wrap">
                {suggestedQuestions.map((q, i) => (
                    <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => handleAskQuestion(q)}>
                        {q}
                    </Button>
                ))}
            </div>
        </div>


        {isLoading && (
            <div className="text-center py-4 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">Searching for answers...</p>
            </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {answer && (
             <div className="prose prose-sm max-w-none text-foreground bg-secondary/20 p-4 rounded-lg border">
                 <div dangerouslySetInnerHTML={{ __html: answer }} />
            </div>
        )}
    </div>
  );
}
