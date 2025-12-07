
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Review } from './review-dashboard';


export interface SentimentTrendData {
    name: string;
    'Avg. Rating': number;
}

interface SentimentTrendCardProps {
  data: SentimentTrendData[];
  rating: number;
  reviews: Review[];
}

export function SentimentTrendCard({ data, rating, reviews }: SentimentTrendCardProps) {
    const trendStats = useMemo(() => {
        if (data.length < 2) {
            return { change: 0, direction: 'flat' as const, positivePercent: 0, decliningTopic: null };
        }
        const last = data[data.length - 1]['Avg. Rating'];
        const secondLast = data[data.length - 2]['Avg. Rating'];
        const change = parseFloat((last - secondLast).toFixed(2));
        const direction = change > 0 ? 'improving' : change < 0 ? 'declining' : 'flat';
        
        const positiveReviews = data.filter(d => d['Avg. Rating'] >= 4).length;
        const positivePercent = Math.round((positiveReviews / data.length) * 100);

        let decliningTopic: string | null = null;
        if (direction === 'declining') {
            const lastWeekName = data[data.length-1].name;
            const lastWeekReviews = reviews.filter(r => {
                if (typeof r.date === 'string' && r.date.toLowerCase().startsWith('week')) {
                    return r.date === lastWeekName;
                }
                // This part requires date-fns, if not available in this scope, might need adjustment
                // For now, we assume string-based week matching from mock data
                return false;
            });
            
            const negativeTopics = lastWeekReviews
                .filter(r => r.sentiment === 'BAD' || r.sentiment === 'FARE')
                .map(r => r.topic);

            if (negativeTopics.length > 0) {
                const topicCounts = negativeTopics.reduce((acc, topic) => {
                    acc[topic] = (acc[topic] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                decliningTopic = Object.keys(topicCounts).reduce((a, b) => topicCounts[a] > topicCounts[b] ? a : b);
            }
        }

        return { change, direction, positivePercent, decliningTopic };
    }, [data, reviews]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background/80 backdrop-blur-sm border rounded-md shadow-lg text-sm">
          <p className="label font-semibold">{label}</p>
          <p className="intro" style={{color: 'hsl(var(--primary))'}}>{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };
    
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <CardTitle className="text-lg font-bold">Sentiment Trend</CardTitle>
            <CardDescription className="text-xs">Weekly average scores and improvement trajectory</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 pb-4 border-b">
              <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{rating.toFixed(1)}</div>
                  <div className="text-xs text-gray-500 mt-1">Current Rating</div>
              </div>
              <div className="text-center">
                  <div className={`text-3xl font-bold flex items-center justify-center gap-1 ${trendStats.direction === 'improving' ? 'text-green-600' : trendStats.direction === 'declining' ? 'text-red-600' : 'text-gray-600'}`}>
                      {trendStats.direction === 'improving' && <ArrowUp size={20} />}
                      {trendStats.direction === 'declining' && <ArrowDown size={20} />}
                      {Math.abs(trendStats.change)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Week-over-Week</div>
              </div>
              <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{trendStats.positivePercent}%</div>
                  <div className="text-xs text-gray-500 mt-1">Positive Weeks (weeks with greater than 4 rating)</div>
              </div>
              <div className="text-center">
                  <div className={`text-3xl font-bold capitalize flex items-center justify-center gap-2 ${trendStats.direction === 'improving' ? 'text-green-600' : trendStats.direction === 'declining' ? 'text-red-600' : 'text-gray-600'}`}>
                    <span>{trendStats.direction}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Trend Direction</div>
              </div>
          </div>

          <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[1, 5]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false}/>
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Line 
                          type="monotone" 
                          dataKey="Avg. Rating" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={3} 
                          activeDot={{ r: 8, style: { fill: 'hsl(var(--primary))', stroke: 'white', strokeWidth: 2 } }} 
                          dot={{r: 5, fill: 'hsl(var(--primary))', stroke: 'white', strokeWidth: 2}} 
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
      </CardContent>
    </Card>
  );
}
