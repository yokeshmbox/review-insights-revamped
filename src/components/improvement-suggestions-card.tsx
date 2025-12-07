
'use client';
import type { GroupedTopicSuggestion } from '@/ai/schemas';
import { Target, Building2, Utensils, Settings, User, HelpCircle, Loader2, Dumbbell } from 'lucide-react';

interface ImprovementSuggestionsCardProps {
  suggestions: GroupedTopicSuggestion[];
  isLoading?: boolean;
  priorityIndex?: number;
}

const priorityConfig = {
    0: { label: 'CRITICAL', className: 'border-l-red-500 bg-red-50', numberClass: 'bg-red-200 text-red-800', borderColor: 'border-red-200' },
    1: { label: 'HIGH', className: 'border-l-amber-500 bg-amber-50', numberClass: 'bg-amber-200 text-amber-800', borderColor: 'border-amber-200' },
    2: { label: 'MEDIUM', className: 'border-l-sky-500 bg-sky-50', numberClass: 'bg-sky-200 text-sky-800', borderColor: 'border-sky-200' },
    3: { label: 'PRIORITY', className: 'border-l-purple-500 bg-purple-50', numberClass: 'bg-purple-200 text-purple-800', borderColor: 'border-purple-200' },
    4: { label: 'ATTENTION', className: 'border-l-green-500 bg-green-50', numberClass: 'bg-green-200 text-green-800', borderColor: 'border-green-200' },
    5: { label: 'REVIEW', className: 'border-l-pink-500 bg-pink-50', numberClass: 'bg-pink-200 text-pink-800', borderColor: 'border-pink-200' },
};

const topicIcons: { [key: string]: React.ElementType } = {
    'Rooms': Building2,
    'Amenities': Dumbbell,
    'Dining': Utensils,
    'Front Desk': User,
    'Service': Settings, // Using Settings icon for general service
    'Other': HelpCircle
};

export function ImprovementSuggestionsCard({ suggestions, isLoading = false, priorityIndex = 0 }: ImprovementSuggestionsCardProps) {
  const sortedSuggestions = (suggestions || [])
    .filter(group => group && Array.isArray(group.suggestions) && group.suggestions.length > 0) // Defensive check
    .map(group => ({
      ...group,
      // Find the highest priority (lowest number) in each group for sorting
      highestPriority: Math.min(...group.suggestions.map(s => s.priority)),
    }))
    .sort((a, b) => a.highestPriority - b.highestPriority);
  
  // Use the priorityIndex to determine which color scheme to use
  const selectedPriorityConfig = priorityConfig[priorityIndex as keyof typeof priorityConfig] || priorityConfig[2];

  return (
    <div className="h-full">
      <div className="p-0">
        {isLoading ? (
            <div className="text-center py-10 text-gray-500 h-48 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="font-semibold text-foreground">Generating Action Plan...</p>
                <p className="text-sm">Analyzing feedback to find actionable insights.</p>
            </div>
        ) : sortedSuggestions.length > 0 ? (
          <div className="w-full space-y-6">
            {sortedSuggestions.map((group, groupIndex) => {
              const Icon = topicIcons[group.topic] || Target;
              return (
                <div key={`${group.topic}-${groupIndex}`} className="space-y-3">
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold text-gray-800">{group.topic}</h3>
                  </div>
                  <ul className="space-y-3">
                    {group.suggestions
                      .sort((a, b) => a.priority - b.priority)
                      .map((item, index) => {
                        return (
                          <li key={index} className={`p-4 rounded-lg flex gap-4 items-start border-l-4 border ${selectedPriorityConfig.className} ${selectedPriorityConfig.borderColor}`}>
                            <div>
                              <p className="text-sm text-gray-600 leading-relaxed">{item.suggestion}</p>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 h-48 flex items-center justify-center">
            <p>No specific suggestions generated for this context.</p>
          </div>
        )}
      </div>
    </div>
  );
}
