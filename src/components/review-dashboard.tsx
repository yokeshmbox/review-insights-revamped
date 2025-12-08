
'use client';

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileUploader } from '@/components/file-uploader';
import { Loader2, Download, Upload, FileCode, X, Lightbulb, ThumbsUp, ThumbsDown, MessageSquare, Send, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { marked } from 'marked';
import Image from 'next/image';
import companyLogoImg from '@/app/agilysys_company_logo.png';
import { GoogleIcon, TripAdvisorIcon, YelpIcon, AgilysysIcon } from '@/components/platform-icons';

import { SentimentTrendCard, type SentimentTrendData } from './sentiment-trend-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, parse, getISOWeek, startOfWeek } from 'date-fns';
import { analyzeReviews } from '@/ai/flows/analyze-reviews-flow';
import { generateSummary, type GenerateSummaryOutput } from '@/ai/flows/generate-summary-flow';
import { generateSuggestions } from '@/ai/flows/generate-suggestions-flow';
import { generateTopicAnalysis } from '@/ai/flows/generate-topic-analysis-flow';

import type { AnalyzedReview, GroupedTopicSuggestion, TopicCategory, RatingCategory, TopicAnalysis, Suggestion } from '@/ai/schemas';

import { ReviewsListCard, categoryConfig } from './reviews-list-card';
import { KpiCard, typeConfig as kpiTypeConfig } from './kpi-card';
import { ReviewDistributionCard } from './review-distribution-card';
import { ScrollArea } from './ui/scroll-area';
import { StarRating } from './ui/star-rating';
import { Badge } from './ui/badge';
import { KeyPositivesCard } from './key-positives-card';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { QAndA } from './q-and-a';
import { ReplyDialog } from './reply-dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { ImprovementSuggestionsCard } from './improvement-suggestions-card';
import { KeyNegativesCard } from './key-negatives-card';
import { getPlatformIcon, getPlatformName } from '@/components/platform-icons';


export interface Review extends Omit<AnalyzedReview, 'rating' | 'topic'> {
  guestName?: string;
  rating: number;
  date?: Date | string;
  topic: TopicCategory;
}

export interface ConsolidatedReviewData extends GenerateSummaryOutput {
  analyzedReviews: Review[];
  overallRating: number;
  suggestions: GroupedTopicSuggestion[];
}

export interface DetailedTopicAnalysis {
    topic: TopicCategory;
    total: number;
    positive: number;
    negative: number;
    analysis: TopicAnalysis;
}

interface ExportedDashboardData {
    reviews: Review[];
    consolidatedReviewData: ConsolidatedReviewData;
    sentimentTrend: SentimentTrendData[];
    detailedAnalysis: DetailedTopicAnalysis[];
    cachedKpiSuggestions?: Record<string, GroupedTopicSuggestion[]>;
}

interface SurveyRecord {
    id: string;
    surveyResponses: Record<string, string | number>;
    createTime: string;
}

export interface PerformanceMetrics {
    best: DetailedTopicAnalysis | null;
    worst: DetailedTopicAnalysis | null;
}

type KpiType = 'total' | 'satisfaction' | 'praise' | 'critical';

const ALL_TOPICS: TopicCategory[] = ['Rooms', 'Amenities', 'Dining', 'Front Desk', 'Service', 'Other'];
const REVIEW_BATCH_SIZE = 50; 

const RATING_MAP: Record<RatingCategory, number> = {
  'BEST': 5,
  'GOOD': 4,
  'FARE': 2.5,
  'BAD': 1,
  'Other': 3
};

export function ReviewDashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExported, setIsExported] = useState(false);
  const [consolidatedReviewData, setConsolidatedReviewData] = useState<ConsolidatedReviewData | null>(null);
  const [sentimentTrend, setSentimentTrend] = useState<SentimentTrendData[]>([]);
  const [detailedAnalysis, setDetailedAnalysis] = useState<DetailedTopicAnalysis[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({ best: null, worst: null });
  const { toast } = useToast();
  const [loadingMessage, setLoadingMessage] = useState("Let's turn your data into delight ✨");
  const [loadingSubMessage, setLoadingSubMessage] = useState("Just a moment, we're firing up the AI to analyze your reviews!");
  const [selectedKpi, setSelectedKpi] = useState<KpiType | null>(null);
  const [kpiSuggestions, setKpiSuggestions] = useState<GroupedTopicSuggestion[]>([]);
  const [isKpiSuggestionsLoading, setIsKpiSuggestionsLoading] = useState(false);
  const [cachedKpiSuggestions, setCachedKpiSuggestions] = useState<Record<string, GroupedTopicSuggestion[]>>({});
  const [selectedReviewForReply, setSelectedReviewForReply] = useState<Review | null>(null);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [isTestData, setIsTestData] = useState(false);

  const handleReplyClick = (review: Review) => {
    setSelectedReviewForReply(review);
    setIsReplyDialogOpen(true);
  };


  useEffect(() => {
    if(reviews.length > 0) {
      setSelectedKpi('total');
    }
  }, [reviews]);

  const getSatisfactionRate = () => {
    if (reviews.length === 0) {
      return { rate: '0%', trend: '', insight: 'No reviews to analyze.' };
    }
    const positiveCount = reviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD').length;
    const negativeCount = reviews.filter(r => r.sentiment === 'FARE' || r.sentiment === 'BAD').length;
    const satisfactionRate = Math.round((positiveCount / reviews.length) * 100);
    
    let trend = '';
    let insight = '';
    if (sentimentTrend.length >= 2) {
      const lastWeek = sentimentTrend[sentimentTrend.length - 1]['Avg. Rating'];
      const previousWeek = sentimentTrend[sentimentTrend.length - 2]['Avg. Rating'];
      const change = ((lastWeek - previousWeek) / previousWeek * 100).toFixed(1);
      const changeValue = parseFloat(change);
    // const change = (lastWeek - previousWeek).toFixed(1);
    // const changeValue = parseFloat(change);
      
      if (lastWeek > previousWeek) {
        trend = `↑ ${change} pts`;
        insight = `Guest satisfaction improved by ${Math.abs(changeValue).toFixed(1)} pts from previous week.`;
      } else if (lastWeek < previousWeek) {
        trend = `↓ ${Math.abs(changeValue)} pts`;
        insight = `Guest satisfaction decreased by ${Math.abs(changeValue).toFixed(1)} pts from previous week.`;
      } else {
        trend = 'No change';
        insight = 'Guest satisfaction remained stable compared to previous week.';
      }
    } else {
      insight = `Based on ${reviews.length} reviews with ${satisfactionRate}% positive sentiment.`;
    }
    
    return { rate: `${satisfactionRate}%`, trend, insight };
  };

  const getKpiData = () => {
    const negativeReviewsCount = reviews.filter(r => r.sentiment === 'FARE' || r.sentiment === 'BAD').length;
    const positiveReviewsCount = reviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD').length;
    const topCriticalIssue = getTopCriticalIssue();
    const topPraiseArea = getTopPraiseArea();
    const satisfaction = getSatisfactionRate();

    const negativeReviewsByTopic = reviews
      .filter(r => r.sentiment === 'BAD' || r.sentiment === 'FARE')
      .reduce((acc, review) => {
          const topic = review.topic || 'Other';
          if (!acc[topic]) {
              acc[topic] = 0;
          }
          acc[topic]++;
          return acc;
      }, {} as Record<TopicCategory, number>);

    const positiveReviewsByTopic = reviews
        .filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD')
        .reduce((acc, review) => {
            const topic = review.topic || 'Other';
            if (!acc[topic]) {
                acc[topic] = 0;
            }
            acc[topic]++;
            return acc;
        }, {} as Record<TopicCategory, number>);

    const departmentsWithIssues = Object.values(negativeReviewsByTopic).filter(count => count >= 50).length;
    const departmentsWithPraise = Object.values(positiveReviewsByTopic).filter(count => count >= 50).length;

    const criticalTopicsBreakdown = Object.entries(negativeReviewsByTopic)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([topic, count]) => ({ topic, count }));

    const praiseTopicsBreakdown = Object.entries(positiveReviewsByTopic)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([topic, count]) => ({ topic, count }));

    const totalAreas = ALL_TOPICS.length;
    const criticalAreasCount = criticalTopicsBreakdown.length;
    
    let criticalInsight = '';
    if (negativeReviewsCount >= 50) {
        criticalInsight = `${departmentsWithIssues} issue areas out of ${totalAreas} total areas.`;
    } else {
        criticalInsight = `${criticalAreasCount} issue area${criticalAreasCount !== 1 ? 's' : ''} out of ${totalAreas} total areas. Top issue is '${topCriticalIssue.topic}'.`;
    }

    const praiseAreasCount = praiseTopicsBreakdown.length;
    
    let praiseInsight = '';
    if (positiveReviewsCount >= 50) {
        praiseInsight = `${departmentsWithPraise} excellent areas out of ${totalAreas} total areas.`;
    } else {
        praiseInsight = `${praiseAreasCount} excellence area${praiseAreasCount !== 1 ? 's' : ''} out of ${totalAreas} total areas. Top praise is '${topPraiseArea.topic}'.`;
    }

    return {
      totalReviews: { 
          value: `${Math.round((positiveReviewsCount / reviews.length) * 100)}%`, 
          insight: `Based on ${reviews.length} total reviews analyzed.`,
      },
      satisfaction: { value: satisfaction.rate, trend: satisfaction.trend, insight: satisfaction.insight },
      praise: {
          value: `${positiveReviewsCount >= 50 ? departmentsWithPraise : 1} Area${(positiveReviewsCount >= 50 && departmentsWithPraise > 1) ? 's' : ''} of Excellence`,
          trend: `Top: ${topPraiseArea.topic}`,
          insight: praiseInsight,
          areaCount: positiveReviewsCount >= 50 ? departmentsWithPraise : 1,
      },
      critical: { 
        value: `${negativeReviewsCount >= 50 ? departmentsWithIssues : 1} Area${(negativeReviewsCount >= 50 && departmentsWithIssues > 1) ? 's Needs Attention' : ''}`, 
        trend: `Top: ${topCriticalIssue.topic}`, 
        insight: criticalInsight,
        areaCount: negativeReviewsCount >= 50 ? departmentsWithIssues : 1,
      },
    };
  };

  useEffect(() => {
    const fetchKpiSuggestions = async () => {
        if (!selectedKpi || reviews.length === 0) {
            setKpiSuggestions([]);
            return;
        }

        // Check if we already have cached suggestions for this KPI
        if (cachedKpiSuggestions[selectedKpi]) {
            setKpiSuggestions(cachedKpiSuggestions[selectedKpi]);
            return;
        }

        // Use hardcoded suggestions for test data
        if (isTestData) {
            setIsKpiSuggestionsLoading(true);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
            
            if (selectedKpi === 'critical') {
                const criticalSuggestions: GroupedTopicSuggestion[] = [
                    {
                        topic: 'Rooms',
                        suggestions: [
                            { suggestion: 'Implement a preventative maintenance schedule for all bathroom plumbing to avoid future flooding incidents.', priority: 1 },
                            { suggestion: 'Establish a 24/7 emergency response team to address maintenance issues within 15 minutes.', priority: 1 },
                            { suggestion: 'Conduct quarterly room inspections to identify and fix potential issues before guests encounter them.', priority: 2 }
                        ]
                    },
                    {
                        topic: 'Amenities',
                        suggestions: [
                            { suggestion: 'Upgrade the WiFi infrastructure to provide a more stable and reliable connection, especially for business travelers.', priority: 1 },
                            { suggestion: 'Install enterprise-grade routers and access points throughout the property.', priority: 1 },
                            { suggestion: 'Provide technical support staff during business hours for immediate troubleshooting.', priority: 2 }
                        ]
                    }
                ];
                setKpiSuggestions(criticalSuggestions);
                setCachedKpiSuggestions(prev => ({ ...prev, critical: criticalSuggestions }));
            } else if (selectedKpi === 'praise') {
                const praiseSuggestions: GroupedTopicSuggestion[] = [
                    {
                        topic: 'Dining',
                        suggestions: [
                            { suggestion: 'Continue maintaining the high quality of breakfast buffet offerings and consider expanding menu variety.', priority: 1 },
                            { suggestion: 'Train additional staff on the omelette station to reduce wait times during peak hours.', priority: 2 },
                            { suggestion: 'Gather guest feedback to add seasonal or regional specialties to the menu.', priority: 2 }
                        ]
                    },
                    {
                        topic: 'Service',
                        suggestions: [
                            { suggestion: 'Recognize and reward spa staff for their exceptional service to maintain high standards.', priority: 1 },
                            { suggestion: 'Implement a training program to share best practices from top-performing team members.', priority: 2 },
                            { suggestion: 'Create a guest recognition program for repeat visitors to enhance personalized service.', priority: 2 }
                        ]
                    }
                ];
                setKpiSuggestions(praiseSuggestions);
                setCachedKpiSuggestions(prev => ({ ...prev, praise: praiseSuggestions }));
            } else {
                setKpiSuggestions([]);
            }
            
            setIsKpiSuggestionsLoading(false);
            return;
        }

        if (selectedKpi === 'critical') {
            // Get all critical areas to show in KPI card
            const negativeReviewsByTopic = reviews
                .filter(r => r.sentiment === 'BAD' || r.sentiment === 'FARE')
                .reduce((acc, review) => {
                    const topic = review.topic || 'Other';
                    if (!acc[topic]) {
                        acc[topic] = [];
                    }
                    acc[topic].push(review.text);
                    return acc;
                }, {} as Record<TopicCategory, string[]>);

            const criticalAreasList = Object.entries(negativeReviewsByTopic)
                .filter(([_, reviews]) => reviews.length > 0)
                .sort(([, a], [, b]) => b.length - a.length);

            // Calculate areaCount inline
            const negativeCount = reviews.filter(r => r.sentiment === 'BAD' || r.sentiment === 'FARE').length;
            const departmentsWithIssues = Object.values(negativeReviewsByTopic).filter(reviews => reviews.length >= 50).length;
            const areaCount = negativeCount >= 50 ? departmentsWithIssues : 1;

            const criticalAreas = criticalAreasList.slice(0, areaCount);

            if (criticalAreas.length > 0) {
                setIsKpiSuggestionsLoading(true);
                try {
                    const suggestionPromises = criticalAreas.map(([topic, reviewTexts]) =>
                        generateSuggestions({ reviews: reviewTexts }).then(result => ({
                            topic: topic as TopicCategory,
                            suggestions: result.suggestions?.[0]?.suggestions || []
                        }))
                    );
                    const results = await Promise.all(suggestionPromises);
                    setKpiSuggestions(results);
                    setCachedKpiSuggestions(prev => ({ ...prev, critical: results }));
                } catch (error) {
                    console.error(`Failed to generate suggestions for critical areas:`, error);
                    setKpiSuggestions([]);
                } finally {
                    setIsKpiSuggestionsLoading(false);
                }
            } else {
                setKpiSuggestions([]);
            }
        } 
        else if (selectedKpi === 'praise') {
            // Get all praise areas to show in KPI card
            const positiveReviewsByTopic = reviews
                .filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD')
                .reduce((acc, review) => {
                    const topic = review.topic || 'Other';
                    if (!acc[topic]) {
                        acc[topic] = [];
                    }
                    acc[topic].push(review.text);
                    return acc;
                }, {} as Record<TopicCategory, string[]>);

            const praiseAreasList = Object.entries(positiveReviewsByTopic)
                .filter(([_, reviews]) => reviews.length > 0)
                .sort(([, a], [, b]) => b.length - a.length);

            // Calculate areaCount inline
            const positiveCount = reviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD').length;
            const departmentsWithPraise = Object.values(positiveReviewsByTopic).filter(reviews => reviews.length >= 50).length;
            const areaCount = positiveCount >= 50 ? departmentsWithPraise : 1;

            const praiseAreas = praiseAreasList.slice(0, areaCount);

            if (praiseAreas.length > 0) {
                setIsKpiSuggestionsLoading(true);
                try {
                    const suggestionPromises = praiseAreas.map(([topic, reviewTexts]) =>
                        generateSuggestions({ reviews: reviewTexts }).then(result => ({
                            topic: topic as TopicCategory,
                            suggestions: result.suggestions?.[0]?.suggestions || []
                        }))
                    );
                    const results = await Promise.all(suggestionPromises);
                    setKpiSuggestions(results);
                    setCachedKpiSuggestions(prev => ({ ...prev, praise: results }));
                } catch (error) {
                    console.error(`Failed to generate suggestions for praise areas:`, error);
                    setKpiSuggestions([]);
                } finally {
                    setIsKpiSuggestionsLoading(false);
                }
            } else {
                setKpiSuggestions([]);
            }
        } else {
            setKpiSuggestions([]);
        }
    };
    
    fetchKpiSuggestions();
    }, [selectedKpi, reviews, isTestData]);
  const getPerformanceTopics = (detailedAnalyses: DetailedTopicAnalysis[]): PerformanceMetrics => {
    if (!detailedAnalyses || detailedAnalyses.length === 0) {
        return { best: null, worst: null };
    }

    let best: DetailedTopicAnalysis | null = null;
    let worst: DetailedTopicAnalysis | null = null;

    // Filter out topics with no reviews
    const relevantTopics = detailedAnalyses.filter(da => da.total > 0);

    if (relevantTopics.length > 0) {
        // Find worst topic (highest negative count)
        worst = relevantTopics.reduce((prev, current) => (prev.negative > current.negative ? prev : current));
        if (worst.negative === 0) worst = null; // No negatives found

        // Find best topic (highest positive count)
        best = relevantTopics.reduce((prev, current) => (prev.positive > current.positive ? prev : current));
        if (best.positive === 0) best = null;
    }
    
    return { best, worst };
  };

  const processReviews = async (items: {id: number, text: string, date: Date | string, rating?: number, guestName?: string }[]) => {
      
      try {
        setLoadingMessage("Connecting with your customers...");
        setLoadingSubMessage(`Reading ${items.length} reviews. This may take a moment...`);

        const reviewBatches = [];
        for (let i = 0; i < items.length; i += REVIEW_BATCH_SIZE) {
            reviewBatches.push(items.slice(i, i + REVIEW_BATCH_SIZE));
        }

        let analyzedReviewsFromAI: AnalyzedReview[] = [];
        for (let i = 0; i < reviewBatches.length; i++) {
            const batch = reviewBatches[i];
            const reviewTexts = batch.map(item => item.text);
            
            setLoadingSubMessage(`Analyzing review batch ${i + 1} of ${reviewBatches.length}...`);

            const result = await analyzeReviews({ reviews: reviewTexts });

            if (result && result.analyzedReviews) {
                const mappedReviews = result.analyzedReviews.map(ar => {
                    const originalItem = batch.find(item => item.id % REVIEW_BATCH_SIZE === ar.id);
                    const uniqueId = originalItem ? originalItem.id : parseFloat(`${i}${ar.id}${Math.random().toString().substring(2)}`);
                    return { ...ar, id: uniqueId };
                });
                analyzedReviewsFromAI.push(...mappedReviews);
            }
        }
        
        const allAnalyzedReviews = (analyzedReviewsFromAI || []).map((ar) => {
          const originalItem = items.find(item => item.id === ar.id);
          return {
              ...ar,
              topic: ar.topic || 'Other',
              rating: originalItem?.rating ?? (RATING_MAP[ar.sentiment] || 3),
              id: ar.id,
              date: originalItem?.date,
              guestName: originalItem?.guestName
          } as Review;
        });

        const reviewTexts = items.map(item => item.text);

        setLoadingMessage('Finding the story in the data...');
        setLoadingSubMessage('Weaving together feedback to see the big picture for you.');
        const summaryPromise = generateSummary({ reviews: reviewTexts });
        
        setLoadingMessage('Crafting your path to five stars...');
        setLoadingSubMessage("We're turning insights into your next steps for success.");

        const topicsWithNegativeReviews = [...new Set(allAnalyzedReviews
            .filter(r => r.sentiment === 'BAD' || r.sentiment === 'FARE')
            .map(r => r.topic))];

        // Add delays between suggestion requests to avoid rate limits
        const suggestionResults = [];
        for (let i = 0; i < topicsWithNegativeReviews.length; i++) {
            const topic = topicsWithNegativeReviews[i];
            const topicReviewTexts = allAnalyzedReviews
                .filter(r => r.topic === topic && (r.sentiment === 'BAD' || r.sentiment === 'FARE'))
                .map(r => r.text);
            
            if (i > 0) {
                // Wait 10 seconds between requests to avoid overloading the server
                console.log(`⏳ Waiting 10 seconds before processing topic ${i + 1}/${topicsWithNegativeReviews.length}...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                console.log(`✅ Proceeding with topic: ${topic}`);
            }
            
            console.log(`🔄 Generating suggestions for topic: ${topic}`);
            const result = await generateSuggestions({ reviews: topicReviewTexts });
            suggestionResults.push(result);
            console.log(`✅ Completed suggestions for topic: ${topic}`);
        }

        const summaryResult = await summaryPromise;

        if (!summaryResult) {
            throw new Error("The AI model failed to return a valid analysis for the reviews.");
        }
        
        const allSuggestionsRaw = suggestionResults.flatMap(res => res.suggestions || []);
        
        // Consolidate suggestions
        const suggestionsMap = new Map<TopicCategory, Suggestion[]>();
        allSuggestionsRaw.forEach(group => {
            if (group && group.topic && Array.isArray(group.suggestions)) {
                const existing = suggestionsMap.get(group.topic) || [];
                suggestionsMap.set(group.topic, [...existing, ...group.suggestions]);
            }
        });

        const allSuggestions: GroupedTopicSuggestion[] = Array.from(suggestionsMap.entries()).map(([topic, suggestions]) => ({
            topic,
            suggestions
        }));

        const reviewsByTopic = new Map<TopicCategory, string[]>();
        allAnalyzedReviews.forEach(review => {
            const topic = review.topic || 'Other';
            if(review.text) {
                if (!reviewsByTopic.has(topic)) {
                    reviewsByTopic.set(topic, []);
                }
                reviewsByTopic.get(topic)!.push(review.text);
            }
        });

        const topicAnalysisPayloads = ALL_TOPICS.map(topic => ({
            topic,
            reviews: reviewsByTopic.get(topic) || []
        }));

        setLoadingMessage('Almost there, just polishing the gems...');
        setLoadingSubMessage("Your insights are being prepared. This is where the magic happens!");
        
        // Consolidate all topics into a single API call
        console.log(`🔄 Analyzing all topics in one request...`);
        const topicAnalysisResult = await generateTopicAnalysis({ topics: topicAnalysisPayloads });
        console.log(`✅ Completed analysis for all topics`);

        if (!topicAnalysisResult) {
            throw new Error("The AI model failed to return a valid analysis for the reviews.");
        }
        
        setLoadingMessage('Your new dashboard is ready!');
        setLoadingSubMessage('Thanks for your patience. Here are the insights you were waiting for!');

        const detailedTopicAnalyses = ALL_TOPICS.map((topic) => {
            const topicReviews = allAnalyzedReviews.filter(r => r.topic === topic);
            const totalMentions = topicReviews.length;
            
            const analysis = topicAnalysisResult.detailedTopicAnalysis.find((a: TopicAnalysis) => a.topic === topic);

            const detailedAnalysisItem: DetailedTopicAnalysis = {
                topic: topic,
                total: totalMentions,
                positive: topicReviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD').length,
                negative: topicReviews.filter(r => r.sentiment === 'FARE' || r.sentiment === 'BAD').length,
                analysis: (totalMentions > 0 && analysis) ? { ...analysis, topic } : {
                    topic: topic,
                    positiveSummary: 'No feedback provided for this topic.',
                    negativeSummary: 'No negative feedback provided for this topic.',
                    suggestions: [],
                },
            };
            return detailedAnalysisItem;
        }).filter((item): item is DetailedTopicAnalysis => !!item && !!item.topic);
        
        setDetailedAnalysis(detailedTopicAnalyses);
        setPerformanceMetrics(getPerformanceTopics(detailedTopicAnalyses));

        const overallRating = calculateOverallRating(allAnalyzedReviews);
        
        setReviews(allAnalyzedReviews);
        setConsolidatedReviewData({
          overallSummary: summaryResult.overallSummary || "No summary available.",
          positiveSummary: summaryResult.positiveSummary || 'No positive summary available.',
          negativeSummary: summaryResult.negativeSummary || 'No negative summary available.',
          keyPositives: summaryResult.keyPositives || "No positives identified.",
          analyzedReviews: allAnalyzedReviews,
          overallRating: overallRating,
          suggestions: allSuggestions,
        });
        setSentimentTrend(calculateSentimentTrend(allAnalyzedReviews));
        setSelectedKpi('total');
      } catch (e: any) {
        console.error(e);
        toast({
          variant: "destructive",
          title: "An error occurred",
          description: e.message || "Failed to analyze the reviews. The request may have timed out. Please try a smaller file.",
        });
        resetState();
      }
  };

  const calculateOverallRating = (reviews: Review[]): number => {
      if (reviews.length === 0) return 0;
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      return totalRating / reviews.length;
  };
  
  const handleSurveyFileUpload = async (file: File) => {
    setIsLoading(true);
    resetState(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                throw new Error('File could not be read.');
            }
            const json: SurveyRecord[] = JSON.parse(text);

            if (!Array.isArray(json) || json.length === 0) {
                throw new Error('Invalid survey file format. Expected a JSON array.');
            }
            
            const parsedData = json.map((record, index) => {
                let rating: number | null = null;
                const textParts: string[] = [];
                
                if (record.surveyResponses) {
                    for (const [question, answer] of Object.entries(record.surveyResponses)) {
                         const stringAnswer = String(answer || '').trim();
                        if (question.toLowerCase().includes('rate') && !isNaN(Number(stringAnswer))) {
                            rating = Number(stringAnswer);
                        } else if (stringAnswer) {
                            textParts.push(stringAnswer);
                        }
                    }
                }
                
                if (textParts.length === 0 && rating === null) {
                    return null;
                }

                const date = new Date(record.createTime);
                
                return {
                    id: index,
                    text: textParts.join('. '),
                    date: date,
                    rating: rating,
                };
            }).filter(item => item !== null && (item.text.trim() !== '' || item.rating !== null));


            if (parsedData.length === 0) {
                toast({
                    variant: "destructive",
                    title: "No Valid Surveys Found",
                    description: "The file doesn't seem to contain valid survey data in the expected format.",
                });
                resetState();
                return;
            }

            await processReviews(parsedData as any);
        } catch (err: any) {
            console.error("Error processing survey file:", err);
            toast({
                variant: "destructive",
                title: "Error Processing Survey File",
                description: err.message || "Please ensure the file is a valid JSON file with the correct survey format.",
            });
            resetState();
        } finally {
            setIsLoading(false);
        }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    resetState(true);

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error('File could not be read.');
                }
                const data: ExportedDashboardData = JSON.parse(text);

                if (!data.reviews || !data.consolidatedReviewData || !data.sentimentTrend) {
                   throw new Error('Invalid analysis file format.');
                }
                
                // When loading from JSON, dates might be strings, so we convert them back to Date objects.
                const reviewsWithDates = data.reviews.map(r => ({ ...r, date: r.date ? new Date(r.date) : undefined }));
                const loadedDetailedAnalysis = data.detailedAnalysis.map(da => ({ ...da, analysis: { ...da.analysis, topic: da.topic } }));

                setReviews(reviewsWithDates);
                setConsolidatedReviewData(data.consolidatedReviewData);
                setSentimentTrend(data.sentimentTrend);
                setDetailedAnalysis(loadedDetailedAnalysis || []);
                setPerformanceMetrics(getPerformanceTopics(loadedDetailedAnalysis));
                
                // Restore cached KPI suggestions if available
                if (data.cachedKpiSuggestions) {
                    setCachedKpiSuggestions(data.cachedKpiSuggestions);
                }

                toast({
                    title: "Analysis Loaded",
                    description: "Successfully loaded previous analysis from file.",
                });
                setSelectedKpi('total');
            } catch (err: any) {
                console.error(err);
                toast({
                    variant: "destructive",
                    title: "Failed to load analysis file",
                    description: err.message || "The file may be corrupt or in the wrong format.",
                });
                resetState();
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
        return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, {type: 'array', cellDates: true});
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });

      const headers = (json[0] || []).map(h => String(h || '').trim().toLowerCase());
      
      const findHeaderIndex = (possibleNames: string[]): number => {
          for (const name of possibleNames) {
              const index = headers.indexOf(name);
              if (index !== -1) return index;
          }
          return -1;
      };

      const reviewIndex = findHeaderIndex(['review text', 'review']);
      const dateIndex = findHeaderIndex(['date']);
      const guestNameIndex = findHeaderIndex(['guest name', 'guest', 'name']);


      if (reviewIndex === -1) {
        toast({
            variant: "destructive",
            title: "Invalid File Format",
            description: "Could not find a 'review text' or 'review' column in the Excel file.",
        });
        resetState();
        return;
      }
      
      const parsedData = json
        .slice(1) 
        .map((row, index) => {
            if (!row || row.length === 0 || row.every(cell => cell === null || String(cell).trim() === '')) return null;
            
            const text = String(row[reviewIndex] || '');
            let dateValue: string | Date | null = dateIndex > -1 ? String(row[dateIndex] || '') : null;
            
            // Check if the date column contains a week label
            if (typeof dateValue === 'string' && dateValue.toLowerCase().startsWith('week')) {
                // Keep it as a string
            } else {
                 let date: Date | null = new Date(); // Default to today if no date is found
            
                if (dateIndex > -1 && row[dateIndex]) {
                    const excelDateValue = row[dateIndex];
                    if (excelDateValue instanceof Date && !isNaN(excelDateValue.getTime())) {
                        date = excelDateValue;
                    } else if (typeof excelDateValue === 'number') { // Handle Excel serial numbers
                        const excelEpoch = new Date(1899, 11, 30);
                        date = new Date(excelEpoch.getTime() + excelDateValue * 24 * 60 * 60 * 1000);
                    } else {
                        // Fallback for strings if cellDates fails
                        const dateString = String(excelDateValue);
                        const dateFormats = ['dd/MM/yyyy', 'dd/MM/yy', 'MM/dd/yyyy', 'MM/dd/yy', 'yyyy-MM-dd'];
                        let parsedDate: Date | null = null;
                        
                        for (const fmt of dateFormats) {
                            const dt = parse(dateString, fmt, new Date());
                            if (!isNaN(dt.getTime())) {
                                parsedDate = dt;
                                break;
                            }
                        }
                        date = parsedDate;
                    }
                }
                dateValue = date;
            }
            
            if (!dateValue) return null;

            const guestName = guestNameIndex > -1 ? String(row[guestNameIndex] || '') : '';

            if (text.trim() === '') {
                return null;
            }
            return { id: index, text, date: dateValue, guestName };
        })
        .filter((item): item is { id: number; text: string; date: Date | string; guestName: string } => item !== null);

      if (parsedData.length === 0) {
        toast({
          variant: "destructive",
          title: "No Valid Reviews Found",
          description: "No processable reviews could be found. Check for a 'Review Text' and 'Date' column.",
        });
        resetState();
        return;
      }
      
      await processReviews(parsedData);

    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: e.message || "Failed to read or process the file. Please ensure it is a valid .xlsx or .csv file.",
      });
      resetState();
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTestData = async () => {
    setIsLoading(true);
    resetState(true);
    setIsTestData(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // simulate loading

    // Utility to generate random November 2025 dates
    const getRandomNovDate = () => {
      const day = Math.floor(Math.random() * 30) + 1; // 1-30
      return new Date(2025, 10, day); // Month 10 = November
    };

    const mockReviews: Review[] = [
        // ROOMS - Critical Issues (40 reviews)
        { id: 1, guestName: 'John Davis', text: "Room flooded due to bathroom plumbing issue. Called maintenance but took 45 minutes to respond. Water damage to furniture. Very frustrating experience.", sentiment: 'BAD', topic: 'Rooms', rating: 1.0, date: getRandomNovDate() },
        { id: 2, guestName: 'Maria Garcia', text: "Air conditioning broken for entire stay. Room temperature was unbearable at 85 degrees. Front desk offered no alternative room.", sentiment: 'BAD', topic: 'Rooms', rating: 1.5, date: getRandomNovDate() },
        { id: 3, guestName: 'Robert Kim', text: "Bed sheets had visible stains. Towels smelled musty. Room cleanliness was far below acceptable standards for a 4-star hotel.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 4, guestName: 'Jennifer Lee', text: "Loud noise from HVAC system made sleep impossible. Complained twice but issue not resolved during 3-night stay.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 5, guestName: 'Michael Torres', text: "Shower drain completely clogged. Water pooled 4 inches deep. Had to wait 2 hours for maintenance.", sentiment: 'BAD', topic: 'Rooms', rating: 1.5, date: getRandomNovDate() },
        { id: 6, guestName: 'Lisa Wang', text: "Room key card stopped working 3 times. Very inconvenient having to go to front desk repeatedly.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 7, guestName: 'David Brown', text: "Mattress was extremely uncomfortable and sagging in the middle. Woke up with severe back pain.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 8, guestName: 'Sarah Johnson', text: "Bathroom light fixture hanging by wires. Clear safety hazard that should have been caught by housekeeping.", sentiment: 'BAD', topic: 'Rooms', rating: 1.0, date: getRandomNovDate() },
        { id: 9, guestName: 'James Wilson', text: "Carpet stains throughout room. Furniture scratched and dated. Room needs serious renovation.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 10, guestName: 'Patricia Martinez', text: "Window wouldn't close properly. Road noise kept us awake all night. Requested room change but none available.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 11, guestName: 'Thomas Anderson', text: "TV remote didn't work. Called front desk but no batteries brought for 6 hours.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 12, guestName: 'Amanda White', text: "Heater fan was incredibly loud. Temperature controls didn't work properly. Very uncomfortable stay.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 13, guestName: 'Daniel Harris', text: "Hair dryer broken. Coffee maker leaked all over counter. Multiple appliance failures in one room.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 14, guestName: 'Michelle Clark', text: "Mold visible in bathroom corners. Strong musty smell. Health concern that needs immediate attention.", sentiment: 'BAD', topic: 'Rooms', rating: 1.5, date: getRandomNovDate() },
        { id: 15, guestName: 'Christopher Lewis', text: "Pillows were flat and lumpy. Bedding felt cheap and scratchy. Couldn't get comfortable sleep.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 101, guestName: 'Gary Peterson', text: "Room smelled like smoke despite requesting non-smoking. Had to change rooms twice.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 102, guestName: 'Helen Murphy', text: "Bathroom sink constantly dripping. Kept us awake at night. Maintenance never fixed it.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 103, guestName: 'Ian Cooper', text: "Closet door fell off hinges when opened. Room clearly not inspected before our arrival.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 104, guestName: 'Julia Rivera', text: "Mini-fridge was broken and smelled terrible. Had to throw away all our perishables.", sentiment: 'BAD', topic: 'Amenities', rating: 1.5, date: getRandomNovDate() },
        { id: 105, guestName: 'Keith Bailey', text: "Curtains didn't close all the way. Morning sun woke us up at 5 AM every day.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 106, guestName: 'Linda Foster', text: "Room phone didn't work. Had to use cell phone for everything including calling front desk.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 107, guestName: 'Marcus Gray', text: "Toilet kept running constantly. Wasted water and created loud noise all night.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 108, guestName: 'Nina Howard', text: "Shower curtain was moldy and torn. Basic hygiene standards not met.", sentiment: 'BAD', topic: 'Rooms', rating: 1.5, date: getRandomNovDate() },
        { id: 109, guestName: 'Oscar Jenkins', text: "Thermostat stuck at 72 degrees. Room too warm but couldn't adjust temperature.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 110, guestName: 'Paula Kelly', text: "Desk lamp bulb burned out. No spare bulbs provided despite calling housekeeping.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 111, guestName: 'Quinn Long', text: "Bathtub surface was peeling and grimy. Clearly needs resurfacing or replacement.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 112, guestName: 'Rita Mason', text: "Alarm clock broken. Almost late for important meeting. Basic amenities failing.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 113, guestName: 'Sam Nelson', text: "Room door lock malfunctioned. Felt unsafe. Had to get security to let us in.", sentiment: 'BAD', topic: 'Rooms', rating: 1.5, date: getRandomNovDate() },
        { id: 114, guestName: 'Tina Owen', text: "Sink faucet handle came off in my hand. Old fixtures need replacing throughout.", sentiment: 'BAD', topic: 'Rooms', rating: 2.0, date: getRandomNovDate() },
        { id: 115, guestName: 'Ulysses Perry', text: "Bed frame squeaked loudly with any movement. Impossible to sleep comfortably.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        
        // AMENITIES - Critical Issues (35 reviews)
        { id: 16, guestName: 'Sarah Miller', text: "Connection dropped 4 times during video conferences. This is unacceptable for business guests. Attempted tech support but no solution provided.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 17, guestName: 'Kevin Rodriguez', text: "WiFi completely unavailable for 8 hours. Business center closed. Had to work from coffee shop down the street.", sentiment: 'BAD', topic: 'Amenities', rating: 1.5, date: getRandomNovDate() },
        { id: 18, guestName: 'Rachel Green', text: "Fitness center equipment broken. Three treadmills out of order. Weight room extremely limited.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 19, guestName: 'Brian Taylor', text: "Pool was ice cold and clearly not heated as advertised. Kids couldn't swim. Very disappointing.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 20, guestName: 'Jessica Moore', text: "Parking garage full every evening. Had to park 3 blocks away and walk. Not safe at night.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 21, guestName: 'Andrew Jackson', text: "Business center printer jammed constantly. Scanners not working. Couldn't complete urgent work documents.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 22, guestName: 'Emily Thompson', text: "Gym closes too early at 9 PM. For business travelers, this is very inconvenient.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 23, guestName: 'Matthew White', text: "Vending machines empty or broken on multiple floors. No snacks available late night.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 24, guestName: 'Nicole Martin', text: "Laundry room washers out of order. Dryers eating quarters without drying clothes. Total waste of money.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 25, guestName: 'Joshua Garcia', text: "WiFi password changed without notice. Spent 30 minutes calling front desk to reconnect all devices.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 116, guestName: 'Victor Quinn', text: "Pool area had broken tiles and dirty lounge chairs. Not maintained to acceptable standards.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 117, guestName: 'Wendy Ross', text: "Business center computers running slow outdated software. Couldn't access files I needed.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 118, guestName: 'Xavier Sanders', text: "Gym water fountain broken for entire week. No bottled water provided as alternative.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 119, guestName: 'Yolanda Turner', text: "WiFi kept disconnecting in conference room during important client presentation. Embarrassing.", sentiment: 'BAD', topic: 'Amenities', rating: 1.5, date: getRandomNovDate() },
        { id: 120, guestName: 'Zachary Underwood', text: "Pool towels ran out by noon. Had to use room towels. Poor inventory management.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 121, guestName: 'Alice Vincent', text: "Parking garage elevator broken. Had to carry luggage up 3 flights of stairs.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 122, guestName: 'Bruce Wallace', text: "Gym only has 2 yoga mats for 300-room hotel. Equipment selection very limited.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 123, guestName: 'Carmen West', text: "Business center printer out of paper and toner. Staff didn't know how to refill it.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 124, guestName: 'Derek Young', text: "WiFi speed so slow couldn't stream video calls. Advertised speeds completely inaccurate.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 125, guestName: 'Elena Adams', text: "Pool closed unexpectedly for maintenance. No notice given to guests. Ruined our plans.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 126, guestName: 'Felix Blake', text: "Gym equipment visibly dirty. Sanitizing wipes empty. Hygiene concerns during flu season.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 127, guestName: 'Grace Cole', text: "Parking garage poorly lit. Felt unsafe walking to car at night. Security concerns.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 128, guestName: 'Henry Dixon', text: "Conference WiFi couldn't support 20 simultaneous connections. Totally inadequate for business.", sentiment: 'BAD', topic: 'Amenities', rating: 1.5, date: getRandomNovDate() },
        { id: 129, guestName: 'Iris Evans', text: "Pool water cloudy and chemicals smell too strong. Water quality questionable.", sentiment: 'BAD', topic: 'Amenities', rating: 2.0, date: getRandomNovDate() },
        { id: 130, guestName: 'Jack Ford', text: "Fitness center closes at 10 PM on weekends. Too early for guests wanting evening workout.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 131, guestName: 'Karen Gray', text: "Business center chairs uncomfortable for working. No proper desk setup for laptops.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 132, guestName: 'Leo Hill', text: "Pool area music too loud. Couldn't relax. No volume control or quiet zones.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 133, guestName: 'Megan Irwin', text: "Gym equipment reservation system confusing. Couldn't figure out how to book time slot.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 134, guestName: 'Nathan Jones', text: "WiFi requires re-authentication every 2 hours. Extremely annoying for work.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 135, guestName: 'Olivia King', text: "Pool area has no shade structures. Unbearable during afternoon heat.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        
        // FRONT DESK - Mixed (30 reviews: 15 bad, 15 excellent)
        { id: 26, guestName: 'Emily White', text: "Long wait times during peak hours for check-in. The front desk seemed understaffed and overwhelmed.", sentiment: 'FARE', topic: 'Front Desk', rating: 3.0, date: getRandomNovDate() },
        { id: 27, guestName: 'Amanda Johnson', text: "As a returning guest, I can confirm the hotel maintains excellent standards. Fresh linens, spotless bathroom, and the front desk team went above and beyond.", sentiment: 'BEST', topic: 'Front Desk', rating: 5.0, date: getRandomNovDate() },
        { id: 28, guestName: 'Steven Davis', text: "Front desk agent was rude and dismissive when I reported room issues. Made me feel like a burden.", sentiment: 'BAD', topic: 'Front Desk', rating: 2.0, date: getRandomNovDate() },
        { id: 29, guestName: 'Karen Williams', text: "Check-in line took 45 minutes. Only one agent working during busy Friday evening arrival.", sentiment: 'BAD', topic: 'Front Desk', rating: 2.0, date: getRandomNovDate() },
        { id: 30, guestName: 'Richard Martinez', text: "Front desk staff remembered my name from previous visit. Upgraded my room without asking. Outstanding service!", sentiment: 'BEST', topic: 'Front Desk', rating: 5.0, date: getRandomNovDate() },
        { id: 31, guestName: 'Laura Chen', text: "Reservation was lost in system. Had to wait while agent manually entered everything. Poor organization.", sentiment: 'FARE', topic: 'Front Desk', rating: 3.0, date: getRandomNovDate() },
        { id: 32, guestName: 'George Thompson', text: "Jessica at front desk went above and beyond to help with local restaurant recommendations. So helpful and friendly!", sentiment: 'BEST', topic: 'Front Desk', rating: 5.0, date: getRandomNovDate() },
        { id: 33, guestName: 'Diana Rodriguez', text: "Late checkout request denied without explanation. Felt unwelcome and rushed.", sentiment: 'FARE', topic: 'Front Desk', rating: 3.0, date: getRandomNovDate() },
        { id: 34, guestName: 'Paul Jackson', text: "Front desk team handled our wedding group with professionalism. Coordinated everything perfectly. Couldn't have been better!", sentiment: 'BEST', topic: 'Front Desk', rating: 5.0, date: getRandomNovDate() },
        { id: 35, guestName: 'Monica Taylor', text: "Wake-up call never came. Almost missed important meeting. Front desk offered no apology.", sentiment: 'BAD', topic: 'Front Desk', rating: 2.0, date: getRandomNovDate() },
        
        // DINING - Excellent (50 reviews, mostly positive)
        { id: 36, guestName: 'Chris Green', text: "The breakfast buffet was outstanding. Great variety and very fresh. The omelette station was a highlight.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 37, guestName: 'Susan Miller', text: "Restaurant chef personally came to our table to ensure everything was perfect. Food quality exceptional!", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 38, guestName: 'Mark Anderson', text: "Best hotel breakfast I've ever had. Fresh fruit, hot entrees, amazing pastries. Will come back just for this!", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 39, guestName: 'Barbara Wilson', text: "Evening room service was prompt and food arrived hot. Portions generous and presentation beautiful.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 40, guestName: 'Donald Harris', text: "Restaurant accommodated all our dietary restrictions perfectly. Gluten-free options were delicious.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 41, guestName: 'Carol Martinez', text: "Lunch menu had amazing variety. Salmon was cooked to perfection. Server was attentive and knowledgeable.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 42, guestName: 'Joseph Lee', text: "Bar menu exceeded expectations. Craft cocktails were creative and well-balanced. Great atmosphere too.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 43, guestName: 'Nancy Brown', text: "Breakfast buffet quality consistent every morning. Staff kept stations stocked and clean throughout service.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 44, guestName: 'William Garcia', text: "Sunday brunch was incredible. Live cooking stations, fresh seafood, unlimited champagne. Worth every penny!", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 45, guestName: 'Sandra Kim', text: "Coffee quality outstanding. Barista made perfect cappuccinos. Nice to have quality coffee in hotel.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 46, guestName: 'Edward Clark', text: "Dinner service in restaurant was elegant. Wine pairing suggestions were spot on. Memorable dining experience.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 47, guestName: 'Helen Davis', text: "Kids menu was creative and healthy options available. My children actually ate vegetables here!", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 48, guestName: 'Raymond White', text: "Breakfast server Maria remembered my order from previous day. Personal touches make all the difference.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 49, guestName: 'Betty Rodriguez', text: "Room service breakfast arrived exactly on time. Everything hot and fresh. Great way to start the day.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 50, guestName: 'Frank Thomas', text: "Restaurant wine list impressive. Sommelier helped us choose perfect bottle for our anniversary dinner.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 136, guestName: 'Peter Lane', text: "Pancakes at breakfast were fluffy and delicious. Syrup selection impressive with real maple.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 137, guestName: 'Quinn Miller', text: "Lunch salad bar fresh with high-quality ingredients. Dressings made in-house were amazing.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 138, guestName: 'Rose Nash', text: "Dinner steak cooked to perfection. Chef came out to check on our meal personally.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 139, guestName: 'Steve Owen', text: "Breakfast eggs benedict best I've had. Hollandaise sauce perfectly balanced.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 140, guestName: 'Tara Phillips', text: "Restaurant ambiance romantic and elegant. Perfect for our anniversary celebration.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 141, guestName: 'Uma Quinn', text: "Room service presentation worthy of fine dining. Food temperature perfect on arrival.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 142, guestName: 'Vince Ross', text: "Breakfast pastries clearly made fresh daily. Croissants rival best Parisian bakeries.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 143, guestName: 'Wilma Stone', text: "Lunch soup of the day changes daily and always delicious. Chef's creativity impressive.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 144, guestName: 'Xavier Turner', text: "Restaurant server remembered dietary restrictions from previous visit. Excellent attention to detail.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 145, guestName: 'Yvonne Underwood', text: "Breakfast smoothies made fresh to order. Healthy options plentiful and delicious.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 166, guestName: 'Aaron Barnes', text: "Dinner desserts were extraordinary. Chocolate lava cake melted perfectly. Five-star quality.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 167, guestName: 'Bella Carter', text: "Lunch portions generous and perfectly plated. Every dish looked and tasted restaurant-quality.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        
        // SERVICE - Excellent (42 reviews)
        { id: 51, guestName: 'David Chen', text: "My massage at the spa was incredibly relaxing. The therapist was professional and skilled. A truly five-star experience.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 52, guestName: 'Lisa Thompson', text: "Concierge secured impossible-to-get theater tickets for us. Went above and beyond expectations!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 53, guestName: 'Michael Brown', text: "Housekeeping staff was exceptional. Room always immaculate. Left thoughtful notes and extra amenities.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 54, guestName: 'Patricia Garcia', text: "Valet service was incredibly efficient. Staff friendly and cars always ready quickly. Professional operation.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 55, guestName: 'Robert Martinez', text: "Spa facial was amazing. Products used were high-quality. Esthetician explained everything thoroughly.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 56, guestName: 'Jennifer Wilson', text: "Bell staff helped with all our luggage and gave great local tips. Made check-in so smooth.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 57, guestName: 'William Lee', text: "Turndown service was lovely. Chocolates, fresh towels, lights dimmed. Nice touch of luxury.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 58, guestName: 'Mary Anderson', text: "Concierge arranged perfect day trip itinerary. Every recommendation was excellent. Such valuable service.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 59, guestName: 'Charles Davis', text: "Doorman greeted us by name every time we returned. Small gesture but made us feel special.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 60, guestName: 'Elizabeth White', text: "Spa staff accommodated last-minute couples massage. Treatment was blissful. Best spa experience ever!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 146, guestName: 'Zane Vincent', text: "Bellhop helped carry groceries to room even though not required. Went beyond call of duty.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 147, guestName: 'Amy Wallace', text: "Housekeeping arranged flowers in vase for our anniversary without being asked. Thoughtful touch!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 148, guestName: 'Blake West', text: "Concierge booked hard-to-get spa appointment at external location. Impressive connections!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 149, guestName: 'Cora Young', text: "Valet remembered our car and had it ready before we asked. Exceptional attention to detail.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 150, guestName: 'Dean Adams', text: "Maintenance fixed issue within 10 minutes of calling. Quick response time impressive.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 151, guestName: 'Emma Blake', text: "Spa aromatherapy massage melted away stress. Therapist understood exactly what I needed.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 152, guestName: 'Frank Cole', text: "Concierge created custom walking tour map with all our interests marked. Above and beyond!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 153, guestName: 'Gina Dixon', text: "Housekeeping folded our clothes that were left on chair. Unexpected and appreciated service.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 154, guestName: 'Hugo Evans', text: "Bell staff arranged surprise birthday cake delivery to room. Made the day extra special!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 155, guestName: 'Ivy Ford', text: "Spa facial used organic products and felt luxurious. Skin glowed for days afterward.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 156, guestName: 'Jake Gray', text: "Concierge tracked down sold-out concert tickets for us. Went to extraordinary lengths.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 157, guestName: 'Kate Hill', text: "Housekeeping staff greeted us warmly every morning. Created welcoming atmosphere.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 158, guestName: 'Luke Irwin', text: "Valet service handled our vintage car with extra care. Clear respect for guests' property.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 159, guestName: 'Maya Jones', text: "Spa manicure lasted two weeks without chipping. High-quality products and skilled technician.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 160, guestName: 'Noah King', text: "Concierge remembered details from previous stay and made personalized recommendations. Impressive!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 161, guestName: 'Opal Lane', text: "Bellhop helped elderly parents with wheelchairs and luggage. Compassionate and patient service.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 162, guestName: 'Paul Miller', text: "Housekeeping replaced worn towels without being asked. Proactive attention to quality.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 163, guestName: 'Quinn Nash', text: "Spa couples massage perfectly synchronized. Both therapists equally skilled. Romantic experience.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 164, guestName: 'Ruby Owen', text: "Valet handled our rental car return coordination. Made checkout process seamless.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 165, guestName: 'Sam Phillips', text: "Concierge printed and organized all our travel documents. Saved us so much time!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        
        // OTHER - Mixed (remaining reviews to reach 100)
        { id: 61, guestName: 'Mike Brown', text: "Fairways poorly maintained & greens inconsistent. For a resort of this caliber, the pool area was a major letdown.", sentiment: 'BAD', topic: 'Other', rating: 2.0, date: getRandomNovDate() },
        { id: 62, guestName: 'Laura Wilson', text: "The pool area was clean and the water temperature was perfect. However, it was a bit crowded in the afternoon.", sentiment: 'GOOD', topic: 'Other', rating: 4.0, date: getRandomNovDate() },
        { id: 63, guestName: 'Jason Miller', text: "Hotel location is perfect. Walking distance to everything. Neighborhood felt safe even late at night.", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
        { id: 64, guestName: 'Michelle Taylor', text: "Lobby design is beautiful and welcoming. Great place to meet clients. Comfortable seating areas.", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
        { id: 65, guestName: 'Daniel Kim', text: "Noise from construction next door started at 7 AM every day. Hotel should have warned guests.", sentiment: 'FARE', topic: 'Other', rating: 3.0, date: getRandomNovDate() },
        { id: 66, guestName: 'Angela Rodriguez', text: "Pet-friendly policy was wonderful. Dog bed and treats provided. Our pet felt welcome!", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
        { id: 67, guestName: 'Timothy Jackson', text: "Hotel smelled like smoke despite being non-smoking. Very unpleasant throughout our stay.", sentiment: 'BAD', topic: 'Other', rating: 2.0, date: getRandomNovDate() },
        { id: 68, guestName: 'Rebecca Harris', text: "Elevator wait times excessive during busy periods. Only 2 elevators for 15-story building.", sentiment: 'FARE', topic: 'Other', rating: 3.0, date: getRandomNovDate() },
        { id: 69, guestName: 'Kenneth White', text: "Christmas decorations were absolutely stunning. Festive atmosphere made our holiday trip special.", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
        { id: 70, guestName: 'Dorothy Martinez', text: "Hallway carpets badly stained and worn. Common areas need serious attention and updating.", sentiment: 'FARE', topic: 'Other', rating: 3.0, date: getRandomNovDate() },
        
        // Additional DINING reviews
        { id: 71, guestName: 'Anthony Clark', text: "Breakfast wait time was 40 minutes. Restaurant understaffed for hotel size. Food good but service slow.", sentiment: 'FARE', topic: 'Dining', rating: 3.0, date: getRandomNovDate() },
        { id: 72, guestName: 'Stephanie Lewis', text: "Vegetarian options at breakfast were creative and delicious. Chef clearly understands plant-based cuisine.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 73, guestName: 'Gregory Walker', text: "Happy hour appetizers were generous and tasty. Great value and fun atmosphere in the bar.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        { id: 74, guestName: 'Victoria Young', text: "In-room dining menu limited. Prices extremely high for average quality food. Expected better selection.", sentiment: 'FARE', topic: 'Dining', rating: 3.0, date: getRandomNovDate() },
        { id: 75, guestName: 'Brian Allen', text: "Breakfast buffet replenished constantly. Everything fresh throughout service. Staff worked seamlessly.", sentiment: 'BEST', topic: 'Dining', rating: 5.0, date: getRandomNovDate() },
        
        // Additional SERVICE reviews  
        { id: 76, guestName: 'Christina King', text: "Housekeeping missed our room two days in a row. Had to call front desk both times to request service.", sentiment: 'FARE', topic: 'Service', rating: 3.0, date: getRandomNovDate() },
        { id: 77, guestName: 'Scott Wright', text: "Bellhop went out of his way to help us find lost phone. Searched thoroughly and found it. Grateful for the effort!", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 78, guestName: 'Deborah Scott', text: "Spa booking system confusing. Had to call multiple times to confirm appointment. Better online system needed.", sentiment: 'FARE', topic: 'Service', rating: 3.0, date: getRandomNovDate() },
        { id: 79, guestName: 'Ronald Green', text: "Maintenance staff fixed our AC issue within 15 minutes. Quick response and professional service.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        { id: 80, guestName: 'Sharon Adams', text: "Lost item turned in by housekeeping. Honesty and integrity of staff is commendable.", sentiment: 'BEST', topic: 'Service', rating: 5.0, date: getRandomNovDate() },
        
        // Additional AMENITIES reviews
        { id: 81, guestName: 'Eric Baker', text: "Rooftop terrace views are spectacular. Great place to unwind in the evening. Hidden gem!", sentiment: 'BEST', topic: 'Amenities', rating: 5.0, date: getRandomNovDate() },
        { id: 82, guestName: 'Cynthia Nelson', text: "Hot tub was lukewarm and jets barely working. Disappointing after long day of sightseeing.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 83, guestName: 'Jerry Carter', text: "Sauna and steam room were clean and well-maintained. Perfect addition to fitness center.", sentiment: 'BEST', topic: 'Amenities', rating: 5.0, date: getRandomNovDate() },
        { id: 84, guestName: 'Ruth Mitchell', text: "Conference room technology was outdated. Projector quality poor. Not suitable for professional presentations.", sentiment: 'FARE', topic: 'Amenities', rating: 3.0, date: getRandomNovDate() },
        { id: 85, guestName: 'Gerald Perez', text: "Bike rental program excellent. Well-maintained bikes and great trail maps provided. Explored entire city!", sentiment: 'BEST', topic: 'Amenities', rating: 5.0, date: getRandomNovDate() },
        
        // Additional ROOMS reviews
        { id: 86, guestName: 'Pamela Roberts', text: "Blackout curtains worked perfectly. Room stayed dark and cool. Best sleep I've had in a hotel.", sentiment: 'BEST', topic: 'Rooms', rating: 5.0, date: getRandomNovDate() },
        { id: 87, guestName: 'Larry Turner', text: "USB charging ports at bedside were so convenient. Modern touches appreciated. Smart room design.", sentiment: 'BEST', topic: 'Rooms', rating: 5.0, date: getRandomNovDate() },
        { id: 88, guestName: 'Brenda Phillips', text: "Bathroom shower pressure was weak. Temperature fluctuated constantly. Frustrating start to each day.", sentiment: 'FARE', topic: 'Rooms', rating: 3.0, date: getRandomNovDate() },
        { id: 89, guestName: 'Walter Campbell', text: "Suite upgrade was spectacular. Separate living area perfect for work. City views breathtaking!", sentiment: 'BEST', topic: 'Rooms', rating: 5.0, date: getRandomNovDate() },
        { id: 90, guestName: 'Carolyn Parker', text: "Room had everything we needed. Mini-fridge, microwave, coffee maker all worked great. Very functional.", sentiment: 'BEST', topic: 'Rooms', rating: 5.0, date: getRandomNovDate() },
        
        // Additional FRONT DESK reviews
        { id: 91, guestName: 'Albert Evans', text: "Check-out process took forever. System was down and agent had to do everything manually.", sentiment: 'FARE', topic: 'Front Desk', rating: 3.0, date: getRandomNovDate() },
        { id: 92, guestName: 'Donna Edwards', text: "Front desk printed boarding passes and called cab for us. Small gestures that made travel easier.", sentiment: 'BEST', topic: 'Front Desk', rating: 5.0, date: getRandomNovDate() },
        { id: 93, guestName: 'Roy Collins', text: "Night shift front desk person was unhelpful and seemed annoyed by questions. Poor customer service.", sentiment: 'BAD', topic: 'Front Desk', rating: 2.0, date: getRandomNovDate() },
        { id: 94, guestName: 'Jacqueline Stewart', text: "Sarah at front desk handled our group check-in flawlessly. Organized, efficient, and friendly. A+!", sentiment: 'BEST', topic: 'Front Desk', rating: 5.0, date: getRandomNovDate() },
        { id: 95, guestName: 'Harold Morris', text: "Package delivery was held safely. Front desk staff courteous when retrieving it. Secure process.", sentiment: 'BEST', topic: 'Front Desk', rating: 5.0, date: getRandomNovDate() },
        
        // Additional OTHER reviews
        { id: 96, guestName: 'Joyce Rogers', text: "Outdoor fire pit area was perfect for evening relaxation. S'mores kit provided was fun touch!", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
        { id: 97, guestName: 'Carl Reed', text: "Ice machines on multiple floors broken. Had to walk to different floor every time. Basic amenity failure.", sentiment: 'FARE', topic: 'Other', rating: 3.0, date: getRandomNovDate() },
        { id: 98, guestName: 'Frances Cook', text: "Artwork throughout hotel is beautiful and clearly curated with care. Adds to upscale ambiance.", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
        { id: 99, guestName: 'Eugene Morgan', text: "Security presence made us feel safe. Staff professional and unobtrusive. Peace of mind appreciated.", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
        { id: 100, guestName: 'Theresa Bell', text: "Overall value for money was excellent. Quality exceeded price point. Would definitely return!", sentiment: 'BEST', topic: 'Other', rating: 5.0, date: getRandomNovDate() },
    ];
    setReviews(mockReviews);

    const overallRating = calculateOverallRating(mockReviews);
    
    const allSuggestions: GroupedTopicSuggestion[] = [
        { topic: 'Rooms', suggestions: [{suggestion: 'Implement a preventative maintenance schedule for all bathroom plumbing to avoid future flooding incidents.', priority: 1}] },
        { topic: 'Amenities', suggestions: [{suggestion: 'Upgrade the WiFi infrastructure to provide a more stable and reliable connection, especially for business travelers.', priority: 1}] },
        { topic: 'Front Desk', suggestions: [{suggestion: 'Review staffing levels during peak check-in hours to reduce guest wait times.', priority: 2}] },
      ];
    
    setConsolidatedReviewData({
      overallSummary: "Overall feedback is polarized. While service and food receive high praise, significant operational issues like plumbing, WiFi, and pool maintenance are causing guest dissatisfaction.",
      positiveSummary: "* Guests consistently praise the excellent staff service.\n* The high-quality breakfast buffet is a highlight.\n* Room cleanliness is frequently mentioned as a positive.",
      negativeSummary: "* Recurring plumbing issues in rooms are a major concern.\n* Unreliable WiFi affects guest satisfaction, especially for business travelers.\n* The pool area is reported as poorly maintained.",
      keyPositives: "* Amazing and helpful hotel staff\n* High-quality breakfast buffet with great variety\n* Spotlessly clean rooms and bathrooms",
      analyzedReviews: mockReviews,
      overallRating: overallRating,
      suggestions: allSuggestions,
    });

    const mockDetailedAnalysis: DetailedTopicAnalysis[] = ALL_TOPICS.map(topic => {
      const topicReviews = mockReviews.filter(r => r.topic === topic);
      const positiveReviews = topicReviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD');
      const negativeReviews = topicReviews.filter(r => r.sentiment === 'FARE' || r.sentiment === 'BAD');
      return {
        topic: topic,
        total: topicReviews.length,
        positive: positiveReviews.length,
        negative: negativeReviews.length,
        analysis: {
          topic: topic,
          positiveSummary: topicReviews.length > 0 ? `High praise for ${topic} from multiple guests.` : 'No positive feedback provided.',
          negativeSummary: topicReviews.length > 0 ? `Some guests reported issues with ${topic}.` : 'No negative feedback provided.',
          suggestions: topicReviews.length > 0 ? [`Focus on improving the guest experience in the ${topic} area based on feedback.`] : [],
        },
      };
    });
    setDetailedAnalysis(mockDetailedAnalysis);
    setPerformanceMetrics(getPerformanceTopics(mockDetailedAnalysis));
    
    setSentimentTrend(calculateSentimentTrend(mockReviews));
    
    setIsLoading(false);
    setSelectedKpi('total');
  };
  
  const calculateSentimentTrend = (reviews: Review[]): SentimentTrendData[] => {
    if (reviews.length === 0) return [];

    const weeklyData: { [weekLabel: string]: { totalRating: number; count: number } } = {};

    reviews.forEach(review => {
        let weekKey: string | null = null;
        
        if (typeof review.date === 'string' && review.date.toLowerCase().startsWith('week')) {
            weekKey = review.date;
        } else if (review.date instanceof Date) {
            // Find the start of the week (assuming week starts on Monday)
            const weekStartDate = startOfWeek(review.date, { weekStartsOn: 1 });
            // Get the ISO week number for that week's start date
            const weekNumber = getISOWeek(weekStartDate);
            weekKey = `Week ${weekNumber}`;
        }
        
        if (weekKey && review.rating) {
            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { totalRating: 0, count: 0 };
            }
            weeklyData[weekKey].totalRating += review.rating;
            weeklyData[weekKey].count++;
        }
    });

    const sortedWeeks = Object.entries(weeklyData)
      .map(([name, data]) => ({
          name,
          avgRating: parseFloat((data.totalRating / data.count).toFixed(2)),
          weekNumber: parseInt(name.replace('Week ', ''), 10)
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber);
  
    return sortedWeeks.map(item => ({ name: item.name, 'Avg. Rating': item.avgRating }));
  };


  const resetState = (loading = false) => {
    setReviews([]);
    setConsolidatedReviewData(null);
    setSentimentTrend([]);
    setDetailedAnalysis([]);
    setPerformanceMetrics({ best: null, worst: null });
    setIsLoading(loading);
    setIsExported(false);
    setSelectedKpi(null);
    setIsTestData(false);
    setCachedKpiSuggestions({});
    setLoadingMessage("Let's turn your data into delight ✨");
    setLoadingSubMessage("Just a moment, we're firing up the AI to analyze your reviews!");
  };

  const handleExport = () => {
    if (!consolidatedReviewData) return;

    const exportData: ExportedDashboardData = {
        reviews,
        consolidatedReviewData,
        sentimentTrend,
        detailedAnalysis,
        cachedKpiSuggestions
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = 'hospitality-pulse-analysis.json';

    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    linkElement.remove();

    toast({
        title: "Export Successful",
        description: "Your dashboard analysis has been downloaded.",
    });
  };

  const handleExportHtml = () => {
    const pageHtml = document.documentElement.outerHTML;
    
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch (e) {
          return '';
        }
      })
      .join('\n');
      
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Peak Performance AI - Dashboard Export</title>
          <style>${styles}</style>
        </head>
        <body>
          ${pageHtml}
        </body>
      </html>
    `;
    
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dashboard-export.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "HTML Export Successful",
      description: "A static HTML snapshot of your dashboard has been downloaded.",
    });
    
    setIsExported(true);
  };

  const handleKpiCardClick = async (kpi: KpiType) => {
    if (selectedKpi === kpi) {
        setSelectedKpi(null); // Toggle off if the same card is clicked
    } else {
        setSelectedKpi(kpi);
    }
  };

  const getTopCriticalIssue = () => {
    if (!detailedAnalysis || detailedAnalysis.length === 0) return { topic: 'None', count: 0 };

    const worst = detailedAnalysis
        .filter(da => da.total > 0 && da.negative > 0)
        .sort((a, b) => {
            if (b.negative !== a.negative) {
                return b.negative - a.negative; // Primary sort by count
            }
            // Tie-breaker: prefer higher negative ratio
            const aNegativeRatio = a.total > 0 ? a.negative / a.total : 0;
            const bNegativeRatio = b.total > 0 ? b.negative / b.total : 0;
            return bNegativeRatio - aNegativeRatio;
        })[0];

    return worst ? { topic: worst.topic, count: worst.negative } : { topic: 'None', count: 0 };
  };
  
  const getTopPraiseArea = () => {
    if (!detailedAnalysis || detailedAnalysis.length === 0) return { topic: 'None', count: 0 };

    const best = detailedAnalysis
        .filter(da => da.total > 0 && da.positive > 0)
        .sort((a, b) => {
            if (b.positive !== a.positive) {
                return b.positive - a.positive; // Primary sort by count
            }
            // Tie-breaker: prefer lower negative ratio
            const aNegativeRatio = a.total > 0 ? a.negative / a.total : 1;
            const bNegativeRatio = b.total > 0 ? b.negative / b.total : 1;
            return aNegativeRatio - bNegativeRatio;
        })[0];
    
    return best ? { topic: best.topic, count: best.positive } : { topic: 'None', count: 0 };
  };


  // Utility function to interleave reviews by topic (round-robin)
  // This ensures all areas appear early in the list
  const interleaveReviewsByTopic = (reviewsList: Review[]): Review[] => {
    // Group reviews by topic
    const reviewsByTopic = reviewsList.reduce((acc, review) => {
      const topic = review.topic || 'Other';
      if (!acc[topic]) {
        acc[topic] = [];
      }
      acc[topic].push(review);
      return acc;
    }, {} as Record<string, Review[]>);

    // Sort reviews within each topic by date (descending - newest first)
    Object.keys(reviewsByTopic).forEach(topic => {
      reviewsByTopic[topic].sort((a, b) => {
        const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
        const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime(); // Descending order
      });
    });

    // Get all topics
    const topics = Object.keys(reviewsByTopic);
    const interleaved: Review[] = [];
    
    // Round-robin: take one review from each topic in turn
    let maxLength = Math.max(...Object.values(reviewsByTopic).map(arr => arr.length));
    for (let i = 0; i < maxLength; i++) {
      for (const topic of topics) {
        if (reviewsByTopic[topic][i]) {
          interleaved.push(reviewsByTopic[topic][i]);
        }
      }
    }
    
    return interleaved;
  };

  // Memoize interleaved reviews to prevent re-shuffling on every render
  const interleavedPraiseReviews = useMemo(() => {
    const positiveReviewsByTopicForFilter = reviews
      .filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD')
      .reduce((acc, review) => {
        const topic = review.topic || 'Other';
        if (!acc[topic]) {
          acc[topic] = [];
        }
        acc[topic].push(review);
        return acc;
      }, {} as Record<TopicCategory, Review[]>);
    
    const topicsWithEnoughPraise = Object.entries(positiveReviewsByTopicForFilter)
      .filter(([_, reviews]) => reviews.length >= 50)
      .map(([topic]) => topic);
    
    return interleaveReviewsByTopic(reviews.filter(r => 
      (r.sentiment === 'BEST' || r.sentiment === 'GOOD') && 
      topicsWithEnoughPraise.includes(r.topic || 'Other')
    ));
  }, [reviews]);

  const interleavedCriticalReviews = useMemo(() => {
    const negativeReviewsByTopicForFilter = reviews
      .filter(r => r.sentiment === 'BAD' || r.sentiment === 'FARE')
      .reduce((acc, review) => {
        const topic = review.topic || 'Other';
        if (!acc[topic]) {
          acc[topic] = [];
        }
        acc[topic].push(review);
        return acc;
      }, {} as Record<TopicCategory, Review[]>);
    
    const topicsWithEnoughIssues = Object.entries(negativeReviewsByTopicForFilter)
      .filter(([_, reviews]) => reviews.length >= 50)
      .map(([topic]) => topic);
    
    return interleaveReviewsByTopic(reviews.filter(r => 
      (r.sentiment === 'FARE' || r.sentiment === 'BAD') && 
      topicsWithEnoughIssues.includes(r.topic || 'Other')
    ));
  }, [reviews]);

  const getKpiDetails = (kpi: KpiType | null) => {
    if (!kpi) return null;

    let title = '';
    let filteredReviews: Review[] = [];

    switch (kpi) {
        case 'total':
            title = 'Executive Summary';
            filteredReviews = reviews;
            break;
        case 'satisfaction':
            title = 'Satisfaction Overview';
            filteredReviews = reviews;
            break;
        case 'praise':
            title = 'Top Praise Areas';
            filteredReviews = interleavedPraiseReviews;
            break;
        case 'critical':
            title = 'Critical Issue Areas';
            filteredReviews = interleavedCriticalReviews;
            break;
    }
    
    return { title, reviews: filteredReviews };
  };

  
  const kpiData = getKpiData();
  const kpiDetails = getKpiDetails(selectedKpi);

  // Compute variables needed for KPI cards
  const positiveReviewsCount = reviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD').length;
  const negativeReviewsCount = reviews.filter(r => r.sentiment === 'FARE' || r.sentiment === 'BAD').length;

  const negativeReviewsByTopic = reviews
    .filter(r => r.sentiment === 'BAD' || r.sentiment === 'FARE')
    .reduce((acc, review) => {
        const topic = review.topic || 'Other';
        if (!acc[topic]) {
            acc[topic] = 0;
        }
        acc[topic]++;
        return acc;
    }, {} as Record<TopicCategory, number>);

  const positiveReviewsByTopic = reviews
      .filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD')
      .reduce((acc, review) => {
          const topic = review.topic || 'Other';
          if (!acc[topic]) {
              acc[topic] = 0;
          }
          acc[topic]++;
          return acc;
      }, {} as Record<TopicCategory, number>);

  const criticalTopicsBreakdown = Object.entries(negativeReviewsByTopic)
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([topic, count]) => ({ topic, count }));

  const praiseTopicsBreakdown = Object.entries(positiveReviewsByTopic)
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([topic, count]) => ({ topic, count }));

  const getPraiseTopicAnalysis = () => {
    const topPraiseArea = getTopPraiseArea();
    if (!detailedAnalysis || topPraiseArea.topic === 'None') return null;
    return detailedAnalysis.find(da => da.topic === topPraiseArea.topic);
  };
  const praiseTopicAnalysis = getPraiseTopicAnalysis();

  const getCriticalTopicAnalysis = () => {
    const topCriticalIssue = getTopCriticalIssue();
    if (!detailedAnalysis || topCriticalIssue.topic === 'None') return null;
    return detailedAnalysis.find(da => da.topic === topCriticalIssue.topic);
  };
  const criticalTopicAnalysis = getCriticalTopicAnalysis();


  const arrowPosition: Record<KpiType, string> = {
    total: 'left-[12.5%]',
    critical: 'left-[37.5%]',
    satisfaction: 'left-[62.5%]',
    praise: 'left-[87.5%]'
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg font-semibold text-foreground">{loadingMessage}</p>
            <p className="text-muted-foreground mt-1">{loadingSubMessage}</p>
        </div>
    );
  }

  if (reviews.length === 0) {
      return (
        <div className="container mx-auto p-5">
            <header className="relative bg-gradient-to-r from-blue-600 to-indigo-800 text-white p-8 rounded-lg mb-8 flex justify-between items-center shadow-lg overflow-hidden h-48">
              <div className="relative z-10 flex items-center gap-6">
                <div className="bg-white p-3 rounded-xl shadow-xl">
                    <Image src={companyLogoImg} alt="Company Logo" width={80} height={80} className="object-contain" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold">⛷️ Igloo Skiing Resort</h1>
                    <p className="text-lg mt-2 opacity-90">AI Powered Review Insights - November Month</p>
                </div>
              </div>
               <div className="relative z-10">
                    <p className="text-xs text-white/60 mb-3 text-right tracking-wide uppercase">Sources</p>
                    <div className="flex items-center gap-3">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                        <AgilysysIcon className="h-5 w-5"/>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Agilysys ADM</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                        <GoogleIcon className="h-5 w-5" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Google</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                        <TripAdvisorIcon className="h-5 w-5" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>TripAdvisor</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                        <YelpIcon className="h-5 w-5"/>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Yelp</p>
                                </TooltipContent>
                            </Tooltip>
                            
                        </TooltipProvider>
                    </div>
                </div>
            </header>
            <FileUploader onFileUpload={handleFileUpload} onSurveyUpload={handleSurveyFileUpload} onTest={handleTestData} />
        </div>
      );
  }
  
  return (
    <div id="dashboard-container" className="container mx-auto p-5">
       <header className="relative bg-gradient-to-r from-blue-600 to-indigo-800 text-white p-8 rounded-lg mb-8 flex justify-between items-center shadow-lg overflow-hidden h-48">
          <div className="relative z-10 flex items-center gap-6">
            <div className="bg-white p-3 rounded-xl shadow-xl">
                <Image src={companyLogoImg} alt="Company Logo" width={80} height={80} className="object-contain" />
            </div>
            <div>
                <h1 className="text-4xl font-bold">⛷️ Igloo Skiing Resort</h1>
                <p className="text-lg mt-2 opacity-90">AI Powered Review Insights - November Month</p>
            </div>
          </div>
           <div className="relative z-10">
                <p className="text-xs text-white/50 mb-3 text-left tracking-wide uppercase">Sources</p>
                <div className="flex items-center gap-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                    <AgilysysIcon className="h-5 w-5"/>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Agilysys ADM</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                    <GoogleIcon className="h-5 w-5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Google</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                    <TripAdvisorIcon className="h-5 w-5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>TripAdvisor</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="bg-white p-2 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all cursor-pointer border-2 border-white/20">
                                    <YelpIcon className="h-5 w-5"/>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Yelp</p>
                            </TooltipContent>
                        </Tooltip>
                        
                    </TooltipProvider>
                </div>
            </div>
        </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard 
              title="Total Reviews" 
              value={kpiData.totalReviews.value} 
              trend="" 
              insight={kpiData.totalReviews.insight} 
              type="total" 
              onClick={() => handleKpiCardClick('total')} 
              isSelected={selectedKpi === 'total'}
              positiveCount={positiveReviewsCount}
              negativeCount={negativeReviewsCount}
              totalCount={reviews.length}
          />
          <KpiCard title="Critical Issue Area" value={kpiData.critical.value} trend={kpiData.critical.trend} insight={kpiData.critical.insight} type="critical" onClick={() => handleKpiCardClick('critical')} isSelected={selectedKpi === 'critical'} topicBreakdown={criticalTopicsBreakdown.slice(0, kpiData.critical.areaCount)}/>
          <KpiCard title="Guest Satisfaction Rate" value={kpiData.satisfaction.value} trend={kpiData.satisfaction.trend} insight={kpiData.satisfaction.insight} type="satisfaction" onClick={() => handleKpiCardClick('satisfaction')} isSelected={selectedKpi === 'satisfaction'} trendData={sentimentTrend} />
          <KpiCard title="Top Praise Area" value={kpiData.praise.value} trend={kpiData.praise.trend} insight={kpiData.praise.insight} type="praise" onClick={() => handleKpiCardClick('praise')} isSelected={selectedKpi === 'praise'} topicBreakdown={praiseTopicsBreakdown.slice(0, kpiData.praise.areaCount)} />
      </section>

      {selectedKpi && kpiDetails && (
        <section className="mb-8 relative transition-all duration-300 ease-in-out animate-in fade-in-0">
            {selectedKpi && (
                <div className={cn('absolute -top-2 w-0 h-0 border-x-8 border-x-transparent border-b-8 -translate-x-1/2', arrowPosition[selectedKpi])} style={{ borderBottomColor: `hsl(var(${kpiTypeConfig[selectedKpi].borderColor.replace('border-','--')}))` }}></div>
            )}
            <Card className={cn("animate-in fade-in-0 zoom-in-95 border-2", selectedKpi && kpiTypeConfig[selectedKpi].borderColor)}>
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        {selectedKpi === 'satisfaction' ? (
                            <CardTitle>A Detailed Breakdown of Review Volume Per Area</CardTitle>
                        ) : (
                            <div className="flex flex-col">
                                <div><CardTitle>{kpiDetails.title}</CardTitle></div>
                                {/* <CardDescription>
                                    Showing {kpiDetails.reviews.length} related reviews.
                                </CardDescription> */}
                            </div>
                         )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedKpi(null)}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {selectedKpi === 'satisfaction' ? (
                        <ReviewDistributionCard reviews={reviews} />
                    ) : selectedKpi === 'total' ? (
                        <div className="space-y-6">
                            {consolidatedReviewData && (
                                <div className="border-l-4 p-4 rounded-md border-blue-500 bg-blue-50">
                                    <div className="flex items-start gap-3">
                                        <Lightbulb className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold">Insights at a Glance</h4>
                                            <p className="text-sm text-muted-foreground leading-snug">{consolidatedReviewData.overallSummary}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {consolidatedReviewData && (
                                    <>
                                        <div className="border-l-4 p-4 rounded-md border-green-500 bg-green-50">
                                            <div className="flex items-start gap-3">
                                                <ThumbsUp className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                                                <div>
                                                    <h4 className="font-semibold text-green-800">Positive Summary</h4>
                                                    <div className="prose prose-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: marked.parse(consolidatedReviewData.positiveSummary) }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="border-l-4 p-4 rounded-md border-red-500 bg-red-50">
                                            <div className="flex items-start gap-3">
                                                <ThumbsDown className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
                                                <div>
                                                    <h4 className="font-semibold text-red-800">Negative Summary</h4>
                                                    <div className="prose prose-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: marked.parse(consolidatedReviewData.negativeSummary) }} />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {selectedKpi === 'critical' ? (
                                // For critical: Recommendations on right, reviews on left
                                <>
                                    
                                    <ScrollArea className="h-full max-h-[480px] pr-4">
                                        <div className="space-y-4">
                                            {kpiDetails.reviews.length > 0 ? kpiDetails.reviews.map((review: Review) => {
                                                const config = categoryConfig[review.sentiment as keyof typeof categoryConfig];
                                                const PlatformIcon = getPlatformIcon(review.id);
                                                const platformName = getPlatformName(review.id);
                                                return (
                                                    <div key={review.id} className={cn("border p-4 rounded-lg", `border-${config.color.split('-')[1]}-500`)}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <p className="font-semibold text-sm">{review.guestName || `Guest ${review.id}`}</p>
                                                                {review.date && <p className="text-xs text-muted-foreground">{format(typeof review.date === 'string' ? new Date(review.date) : review.date, 'MMM d, yyyy')}</p>}
                                                            </div>
                                                            <StarRating rating={review.rating} size={16} />
                                                        </div>
                                                        <p className="text-sm text-muted-foreground italic mb-3">"{review.text}"</p>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex gap-2 flex-wrap items-center">
                                                                 <Badge variant="outline" className={cn('flex items-center gap-1', config.badgeClass)}>
                                                                  <config.icon className="h-3 w-3" />
                                                                  {config.label}
                                                                </Badge>
                                                                <Badge variant="secondary">{review.topic}</Badge>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 shadow-sm hover:shadow-md hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer">
                                                                            <PlatformIcon className="w-3.5 h-3.5" />
                                                                            <span className="text-xs font-semibold text-blue-700">{platformName}</span>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{platformName}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                             <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button onClick={() => handleReplyClick(review)} size="icon" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                                                                        <Send className="h-4 w-4" />
                                                                        <span className="sr-only">AI Reply</span>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                <p>Generate AI Reply</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                )
                                            }) : (
                                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                                    <p>No reviews to display for this category.</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-green-700 flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5" color='green' />
                                            Recommended Actions by Area
                                        </h3>
                                        {isKpiSuggestionsLoading ? (
                                            <div className="text-center py-10">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                                <p className="text-sm text-muted-foreground mt-2">Generating recommendations...</p>
                                            </div>
                                        ) : kpiSuggestions.length > 0 ? (
                                            <Accordion type="single" collapsible defaultValue={kpiSuggestions[0]?.topic} className="space-y-3">
                                                {kpiSuggestions.map((areaItem, index) => {
                                                    const topicReviewCount = reviews.filter(r => r.topic === areaItem.topic && (r.sentiment === 'BAD' || r.sentiment === 'FARE')).length;
                                                    return (
                                                        <AccordionItem key={areaItem.topic} value={areaItem.topic} className="border-2 border-green-200 rounded-lg px-4 bg-green-50">
                                                            <AccordionTrigger className="hover:no-underline py-3">
                                                                <div className="flex items-center justify-between w-full pr-2">
                                                                    <span className="font-semibold text-green-800">{areaItem.topic}</span>
                                                                    <Badge variant="destructive" className="ml-2">{topicReviewCount} mentions</Badge>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent className="pt-2 pb-3">
                                                                {areaItem.suggestions && areaItem.suggestions.length > 0 ? (
                                                                    <ul className="space-y-2">
                                                                        {areaItem.suggestions.map((suggestion, idx) => (
                                                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                                                <span className="text-gray-700">{suggestion.suggestion}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <p className="text-sm text-muted-foreground italic">No recommendations available for this area.</p>
                                                                )}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    );
                                                })}
                                            </Accordion>
                                        ) : (
                                            <div className="border-2 border-green-200 rounded-lg p-6 text-center bg-green-50">
                                                <AlertTriangle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">No recommendations available.</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                // For praise: Recommendations on right, reviews on left (same as critical)
                                <>
                                    
                                    <ScrollArea className="h-full max-h-[480px] pr-4">
                                        <div className="space-y-4">
                                            {kpiDetails.reviews.length > 0 ? kpiDetails.reviews.map((review: Review) => {
                                                const config = categoryConfig[review.sentiment as keyof typeof categoryConfig];
                                                const PlatformIcon = getPlatformIcon(review.id);
                                                const platformName = getPlatformName(review.id);
                                                return (
                                                    <div key={review.id} className={cn("border p-4 rounded-lg", `border-${config.color.split('-')[1]}-500`)}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <p className="font-semibold text-sm">{review.guestName || `Guest ${review.id}`}</p>
                                                                {review.date && <p className="text-xs text-muted-foreground">{format(typeof review.date === 'string' ? new Date(review.date) : review.date, 'MMM d, yyyy')}</p>}
                                                            </div>
                                                            <StarRating rating={review.rating} size={16} />
                                                        </div>
                                                        <p className="text-sm text-muted-foreground italic mb-3">"{review.text}"</p>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex gap-2 flex-wrap items-center">
                                                                 <Badge variant="outline" className={cn('flex items-center gap-1', config.badgeClass)}>
                                                                  <config.icon className="h-3 w-3" />
                                                                  {config.label}
                                                                </Badge>
                                                                <Badge variant="secondary">{review.topic}</Badge>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 shadow-sm hover:shadow-md hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer">
                                                                            <PlatformIcon className="w-3.5 h-3.5" />
                                                                            <span className="text-xs font-semibold text-blue-700">{platformName}</span>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{platformName}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                             <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button onClick={() => handleReplyClick(review)} size="icon" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                                                                        <Send className="h-4 w-4" />
                                                                        <span className="sr-only">AI Reply</span>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                <p>Generate AI Reply</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                )
                                            }) : (
                                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                                    <p>No reviews to display for this category.</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-green-700 flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5" />
                                            Enhancement Recommendations by Area
                                        </h3>
                                        {isKpiSuggestionsLoading ? (
                                            <div className="text-center py-10">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                                <p className="text-sm text-muted-foreground mt-2">Generating recommendations...</p>
                                            </div>
                                        ) : kpiSuggestions.length > 0 ? (
                                            <Accordion type="single" collapsible defaultValue={kpiSuggestions[0]?.topic} className="space-y-3">
                                                {kpiSuggestions.map((areaItem, index) => {
                                                    const topicReviewCount = reviews.filter(r => r.topic === areaItem.topic && (r.sentiment === 'BEST' || r.sentiment === 'GOOD')).length;
                                                    return (
                                                        <AccordionItem key={index} value={areaItem.topic} className="border-2 border-green-200 rounded-lg bg-green-50 px-4">
                                                            <AccordionTrigger className="hover:no-underline py-4">
                                                                <div className="flex items-center justify-between w-full pr-4">
                                                                    <span className="font-semibold text-green-800">{areaItem.topic}</span>
                                                                    <Badge variant="default" className="bg-green-600 text-white ml-2">
                                                                        {topicReviewCount} praise{topicReviewCount !== 1 ? 's' : ''}
                                                                    </Badge>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent className="pt-2 pb-4">
                                                                {areaItem.suggestions && areaItem.suggestions.length > 0 ? (
                                                                    <ul className="space-y-2">
                                                                        {areaItem.suggestions.map((suggestion, idx) => (
                                                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                                                <span className="text-gray-700">{suggestion.suggestion}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <p className="text-sm text-muted-foreground italic">No recommendations available for this area.</p>
                                                                )}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    );
                                                })}
                                            </Accordion>
                                        ) : (
                                            <div className="border-2 border-green-200 rounded-lg p-6 text-center bg-green-50">
                                                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">No recommendations available.</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>
      )}

      <section className="mb-8 animate-in fade-in-0 slide-in-from-bottom-5 duration-500 delay-100">
        <Card>
            <CardHeader>
                <CardTitle>Deep Dive Analysis</CardTitle>
                <CardDescription>A complete breakdown of guest feedback by category.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="positives">
                    <TabsList className="w-full flex justify-center gap-4">
                        <TabsTrigger value="positives" colorVariant="positive"><ThumbsUp className="mr-2 h-4 w-4" />Key Positives</TabsTrigger>
                        <TabsTrigger value="negatives" colorVariant="negative"><ThumbsDown className="mr-2 h-4 w-4" />Key Negatives</TabsTrigger>
                    </TabsList>
                    <TabsContent value="positives" className="pt-6">
                         <KeyPositivesCard positives={consolidatedReviewData?.keyPositives || ''} />
                    </TabsContent>
                    <TabsContent value="negatives" className="pt-6">
                        <KeyNegativesCard reviews={reviews} suggestions={consolidatedReviewData?.suggestions || []}/>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </section>

      <section className="mb-8 animate-in fade-in-0 slide-in-from-bottom-5 duration-500 delay-300">
          <SentimentTrendCard data={sentimentTrend} rating={consolidatedReviewData?.overallRating || 0} reviews={reviews} />
      </section>
      
      <section className="mb-8 animate-in fade-in-0 slide-in-from-bottom-5 duration-500 delay-400">
          <ReviewsListCard reviews={reviews} />
      </section>

      <section className="mt-8 mb-8 animate-in fade-in-0 slide-in-from-bottom-5 duration-500 delay-500">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    <div>
                        <CardTitle>Ask a Question</CardTitle>
                        <CardDescription>Get instant answers from AI about this specific set of reviews.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <QAndA reviews={reviews} />
            </CardContent>
        </Card>
      </section>

       {selectedReviewForReply && (
        <ReplyDialog
          isOpen={isReplyDialogOpen}
          onOpenChange={setIsReplyDialogOpen}
          review={selectedReviewForReply}
        />
      )}

      <footer className="text-center text-xs text-gray-500 mt-8 p-6 bg-white rounded-lg shadow-md animate-in fade-in-0 slide-in-from-bottom-5 duration-600">
          <p>© {new Date().getFullYear()} Hospitality Pulse AI | Guest Analytics Intelligence Platform | {reviews.length} reviews analyzed</p>
          
          <div className="mt-4 flex justify-center items-center gap-4">
              <Button onClick={() => resetState()} variant="outline" style={{ display: "none" }}>
                  <Upload className="mr-2 h-4 w-4" /> New Analysis
              </Button>
              <Button onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" /> Export JSON Report
              </Button>
              {!isExported && (
                <Button    onClick={handleExportHtml} variant="outline" style={{ display: "none" }}>
                    <FileCode className="mr-2 h-4 w-4" /> Export as HTML
                </Button>
              )}
          </div>
      </footer>
    </div>
  );
}
