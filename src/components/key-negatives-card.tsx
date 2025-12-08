
'use client';
import { useMemo, useState } from 'react';
import type { Review } from './review-dashboard';
import { ShieldAlert, Target, Lightbulb } from 'lucide-react';
import type { TopicCategory, GroupedTopicSuggestion } from '@/ai/schemas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ImprovementSuggestionsCard } from './improvement-suggestions-card';


interface KeyNegativesCardProps {
  reviews: Review[];
  suggestions: GroupedTopicSuggestion[];
}

export function KeyNegativesCard({ reviews, suggestions = [] }: KeyNegativesCardProps) {
  const [selectedTopic, setSelectedTopic] = useState<TopicCategory | null>(null);

  const negativeFeedback = useMemo(() => {
    const feedbackByTopic: Record<string, { count: number, texts: string[] }> = {};

    reviews.forEach(review => {
      if (review.topic && (review.sentiment === 'FARE' || review.sentiment === 'BAD')) {
        if (!feedbackByTopic[review.topic]) {
          feedbackByTopic[review.topic] = { count: 0, texts: [] };
        }
        feedbackByTopic[review.topic].count++;
        feedbackByTopic[review.topic].texts.push(review.text);
      }
    });

    const sortedFeedback = Object.entries(feedbackByTopic)
      .map(([topic, data]) => ({
        topic: topic as TopicCategory,
        count: data.count,
        summary: data.texts.length > 0 ? data.texts[0] : 'No specific feedback available.', // Simple summary
      }))
      .sort((a, b) => b.count - a.count);
    
    // Set the default selected topic to the one with the most negative feedback
    if (!selectedTopic && sortedFeedback.length > 0) {
      setSelectedTopic(sortedFeedback[0].topic);
    }
    
    return sortedFeedback;
  }, [reviews, selectedTopic]);
  
  const getPriority = (index: number) => {
    const colors = [
      { label: 'CRITICAL', badgeClass: 'bg-red-100 text-red-700', borderClass: 'border-l-red-500 bg-red-50', hoverBorder: 'hover:border-red-500', selectedBorder: 'border-red-500', colorKey: 0 },
      { label: 'HIGH', badgeClass: 'bg-amber-100 text-amber-700', borderClass: 'border-l-amber-500 bg-amber-50', hoverBorder: 'hover:border-amber-500', selectedBorder: 'border-amber-500', colorKey: 1 },
      { label: 'MEDIUM', badgeClass: 'bg-sky-100 text-sky-700', borderClass: 'border-l-sky-500 bg-sky-50', hoverBorder: 'hover:border-sky-500', selectedBorder: 'border-sky-500', colorKey: 2 },
      { label: 'PRIORITY', badgeClass: 'bg-purple-100 text-purple-700', borderClass: 'border-l-purple-500 bg-purple-50', hoverBorder: 'hover:border-purple-500', selectedBorder: 'border-purple-500', colorKey: 3 },
      { label: 'ATTENTION', badgeClass: 'bg-green-100 text-green-700', borderClass: 'border-l-green-500 bg-green-50', hoverBorder: 'hover:border-green-500', selectedBorder: 'border-green-500', colorKey: 4 },
      { label: 'REVIEW', badgeClass: 'bg-pink-100 text-pink-700', borderClass: 'border-l-pink-500 bg-pink-50', hoverBorder: 'hover:border-pink-500', selectedBorder: 'border-pink-500', colorKey: 5 },
    ];
    return colors[index % colors.length];
  };

  const selectedSuggestions = useMemo(() => {
    if (!selectedTopic) {
        const allSuggestions = suggestions.filter(s => negativeFeedback.some(nf => nf.topic === s.topic));
        return allSuggestions;
    }
    return suggestions.filter(s => s.topic === selectedTopic);
  }, [selectedTopic, suggestions, negativeFeedback]);

  const selectedPriorityIndex = useMemo(() => {
    const topicIndex = negativeFeedback.findIndex(item => item.topic === selectedTopic);
    return topicIndex !== -1 ? topicIndex : 0;
  }, [selectedTopic, negativeFeedback]);

  const selectedColorKey = useMemo(() => {
    const priority = getPriority(selectedPriorityIndex);
    return priority.colorKey;
  }, [selectedPriorityIndex]);

  return (
    <Card className="shadow-none border-none h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardHeader className="p-0">
          <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 text-destructive" />
              <CardDescription> Click an area to see AI-powered suggestions.</CardDescription>
          </div>
        </CardHeader>
        {/* <CardHeader className="p-0">
           <div className="flex items-center gap-3">
              <Lightbulb className="h-6 w-6 text-primary" />
              <CardDescription>Action Plan for {selectedTopic || 'All Issues'}</CardDescription>
          </div>
        </CardHeader> */}
      </div>
      <CardContent className="p-0 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: List of Negative Topics */}
          <div>
            {negativeFeedback.length > 0 ? (
              <ul className="space-y-3">
                {negativeFeedback.map((item, index) => {
                  const priority = getPriority(index);
                  const isSelected = selectedTopic === item.topic;
                  return (
                    <li 
                      key={item.topic} 
                      className={cn(
                        `p-4 rounded-lg flex justify-between items-center border-l-4 cursor-pointer transition-all`,
                        priority.borderClass,
                        priority.hoverBorder,
                        isSelected ? `border-2 ${priority.selectedBorder}` : 'border border-transparent'
                      )}
                      onClick={() => setSelectedTopic(item.topic)}
                    >
                      <div>
                        <div className="font-semibold text-gray-800">{item.topic}</div>
                        <p className="text-sm text-gray-600 leading-relaxed">{item.summary}</p>
                      </div>
                      <div className="text-2xl font-bold text-destructive text-center min-w-[50px]">
                        {item.count}
                        <div className="text-xs font-normal text-gray-500">mentions</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <p className="text-muted-foreground">No significant negative feedback found.</p>
              </div>
            )}
          </div>
          
          {/* Right Column: Suggestions for Selected Topic */}
          <div>
            <ImprovementSuggestionsCard suggestions={selectedSuggestions} isLoading={false} priorityIndex={selectedColorKey} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
