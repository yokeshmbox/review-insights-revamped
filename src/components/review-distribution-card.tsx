

'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import type { Review } from './review-dashboard';
import { Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TopicCategory } from '@/ai/schemas';


interface ReviewDistributionCardProps {
  reviews: Review[];
}

const ALL_TOPICS: TopicCategory[] = ['Rooms', 'Amenities', 'Dining', 'Front Desk', 'Service', 'Other'];

export function ReviewDistributionCard({ reviews }: ReviewDistributionCardProps) {
  const reviewsByDept = useMemo(() => {
    const positiveCounts: { [key: string]: number } = {};
    const negativeCounts: { [key: string]: number } = {};

    ALL_TOPICS.forEach(topic => {
        positiveCounts[topic] = 0;
        negativeCounts[topic] = 0;
    });

    reviews.forEach(review => {
      if (review.topic) {
        if (review.sentiment === 'BEST' || review.sentiment === 'GOOD') {
            if (positiveCounts[review.topic] !== undefined) positiveCounts[review.topic]++;
        } else if (review.sentiment === 'FARE' || review.sentiment === 'BAD') {
            if (negativeCounts[review.topic] !== undefined) negativeCounts[review.topic]++;
        }
      }
    });

    return ALL_TOPICS.map(name => ({ 
        name, 
        Positive: positiveCounts[name],
        Negative: negativeCounts[name],
    }));
  }, [reviews]);
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background/90 backdrop-blur-sm border rounded-md shadow-lg text-sm">
          <p className="label font-bold mb-1">{label}</p>
          <p style={{ color: 'hsl(var(--chart-1))' }}>{`Positive: ${payload[0].value}`}</p>
          <p style={{ color: 'hsl(var(--chart-2))' }}>{`Negative: ${payload[1].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-none border-none">
        <CardContent>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reviewsByDept} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.05)' }} />
                    <Bar dataKey="Positive" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Negative" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
        </CardContent>
    </Card>
  );
}
