
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, Award, Heart, Sparkles, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyPositivesCardProps {
  positives: string;
}

const positiveIcons: {icon: LucideIcon, color: string, bg: string}[] = [
    { icon: Award, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { icon: Heart, color: 'text-red-600', bg: 'bg-red-100' },
    { icon: Sparkles, color: 'text-blue-600', bg: 'bg-blue-100' },
    { icon: Star, color: 'text-amber-600', bg: 'bg-amber-100' },
    { icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-100' },
];

export function KeyPositivesCard({ positives }: KeyPositivesCardProps) {
  // Simple markdown-to-html for bullet points
  const formatText = (text: string) => {
    return text.split('\n').map(line => line.trim().replace(/^[-*]\s*/, '').trim()).filter(line => line);
  };

  const positivePoints = formatText(positives);

  return (
    <Card className="shadow-none border-none h-full">
      <CardHeader className="p-0 mb-4">
        <div className="flex items-center gap-3">
            <ThumbsUp className="h-6 w-6 text-primary" />
             <CardDescription>What guests loved the most.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {positivePoints.length > 0 ? (
            <div className="space-y-4">
                {positivePoints.map((point, index) => {
                    const { icon: Icon, color, bg } = positiveIcons[index % positiveIcons.length];
                    return (
                        <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border/80 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                            <div className={cn("flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center", bg)}>
                                <Icon className={cn("h-6 w-6", color)} />
                            </div>
                            <p className="text-foreground font-medium leading-relaxed">
                                {point}
                            </p>
                        </div>
                    );
                })}
            </div>
        ) : (
             <div className="h-48 w-full flex items-center justify-center">
                <p className="text-muted-foreground">No specific positives were highlighted.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
