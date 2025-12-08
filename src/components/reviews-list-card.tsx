
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Send, ChevronLeft, ChevronRight, List, ShieldAlert, AlertTriangle, ThumbsUp, MessageSquareReply } from 'lucide-react';
import type { Review } from './review-dashboard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RatingCategory } from '@/ai/schemas';
import { usePagination, DOTS } from '@/hooks/use-pagination';
import { ReplyDialog } from './reply-dialog';
import { format } from 'date-fns';
import { StarRating } from './ui/star-rating';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { getPlatformIcon, getPlatformName } from './platform-icons';


interface ReviewsListCardProps {
  reviews: Review[];
}

const REVIEWS_PER_PAGE = 5;

export const categoryConfig: Record<RatingCategory, { icon: React.ElementType, color: string, badgeClass: string, label: string }> = {
    'BEST': { icon: ThumbsUp, color: 'text-green-500', badgeClass: 'bg-green-100 text-green-700', label: 'Positive' },
    'GOOD': { icon: ThumbsUp, color: 'text-lime-500', badgeClass: 'bg-lime-100 text-lime-700', label: 'Positive' },
    'FARE': { icon: AlertTriangle, color: 'text-orange-500', badgeClass: 'bg-orange-100 text-orange-700', label: 'High Priority' },
    'BAD': { icon: ShieldAlert, color: 'text-red-500', badgeClass: 'bg-red-100 text-red-700', label: 'Critical' },
    'Other': { icon: List, color: 'text-gray-500', badgeClass: 'bg-gray-100 text-gray-700', label: 'Neutral' }
};

const nameToColor = (name: string) => {
    let hash = 0;
    if (name.length === 0) return { background: 'hsl(0, 0%, 80%)', text: 'hsl(0, 0%, 40%)' };
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const h = hash % 360;
    return {
        background: `hsl(${h}, 70%, 85%)`, // Lighter background
        text: `hsl(${h}, 60%, 40%)`        // Darker text
    };
};


export function ReviewsListCard({ reviews }: ReviewsListCardProps) {
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);

  const filteredReviews = useMemo(() => {
    let filtered: Review[];
    if (filter === 'All') filtered = reviews;
    else if (filter === 'Critical') filtered = reviews.filter(r => r.sentiment === 'BAD');
    else if (filter === 'High Priority') filtered = reviews.filter(r => r.sentiment === 'FARE');
    else if (filter === 'Positive') filtered = reviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD');
    else if (filter === 'Pending Response') filtered = reviews.filter(r => !r.text.includes('Manager Response')); // Simple check
    else filtered = reviews;

    // Sort by date descending (newest first)
    return filtered.sort((a, b) => {
      const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
      const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });
  }, [reviews, filter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
  const paginationRange = usePagination({
    totalCount: filteredReviews.length,
    pageSize: REVIEWS_PER_PAGE,
    currentPage: currentPage,
  });

  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
    const endIndex = startIndex + REVIEWS_PER_PAGE;
    return filteredReviews.slice(startIndex, endIndex);
  }, [filteredReviews, currentPage]);

  const handlePageClick = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleReplyClick = (review: Review) => {
    setSelectedReview(review);
    setIsReplyDialogOpen(true);
  };
  
  const filterButtonConfig = {
    'All': { selected: 'bg-primary text-primary-foreground', unselected: 'bg-secondary text-secondary-foreground hover:bg-secondary/80', icon: List },
    'Critical': { selected: 'bg-[hsl(var(--kpi-critical-fg))] text-white', unselected: 'bg-[hsl(var(--kpi-critical-bg))] text-[hsl(var(--kpi-critical-fg))] hover:bg-opacity-80', icon: ShieldAlert },
    'High Priority': { selected: 'bg-amber-500 text-white', unselected: 'bg-amber-100 text-amber-700 hover:bg-opacity-80', icon: AlertTriangle },
    'Positive': { selected: 'bg-[hsl(var(--kpi-satisfaction-fg))] text-white', unselected: 'bg-[hsl(var(--kpi-satisfaction-bg))] text-[hsl(var(--kpi-satisfaction-fg))] hover:bg-opacity-80', icon: ThumbsUp }
  };

  const FilterButton = ({ label, count }: { label: 'All' | 'Critical' | 'High Priority' | 'Positive', count: number }) => {
    const isSelected = filter === label;
    const config = filterButtonConfig[label];
    const Icon = config.icon;

    return (
      <Button
        onClick={() => setFilter(label)}
        className={cn(
          "text-xs font-semibold border-none transition-all duration-200",
          isSelected ? config.selected : config.unselected,
          isSelected ? "shadow-md hover:brightness-110" : "hover:shadow-md"
        )}
      >
        <Icon className="mr-2 h-4 w-4" />
        {label} ({count})
      </Button>
    );
  };

  return (
    <>
      <section className="bg-white rounded-lg p-6 shadow-md mt-8">
        <div className="flex justify-between items-center mb-5 pb-4 border-primary">
          <h2 className="text-xl font-bold text-gray-800">📋 Detailed Guest Reviews</h2>
          <div className="flex gap-2 flex-wrap">
            <FilterButton label="All" count={reviews.length} />
            <FilterButton label="Critical" count={reviews.filter(r => r.sentiment === 'BAD').length} />
            <FilterButton label="High Priority" count={reviews.filter(r => r.sentiment === 'FARE').length} />
            <FilterButton label="Positive" count={reviews.filter(r => r.sentiment === 'BEST' || r.sentiment === 'GOOD').length} />
          </div>
        </div>

        <div className="space-y-4">
          {paginatedReviews.length > 0 ? (
            paginatedReviews.map(review => {
              const config = categoryConfig[review.sentiment];
              const Icon = config.icon;
              const name = review.guestName || `Guest ${review.id}`;
              const initials = review.guestName ? review.guestName.split(' ').map(n => n[0]).join('').substring(0, 2) : 'G';
              const isDateObject = review.date instanceof Date;
              const avatarColors = nameToColor(name);
              const PlatformIcon = getPlatformIcon(review.id);
              const platformName = getPlatformName(review.id);

              return (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-primary transition-all">
                    <div className="flex items-start gap-4">
                        <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                            style={{ backgroundColor: avatarColors.background, color: avatarColors.text }}
                        >
                            {initials}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold text-gray-800 text-sm">{name}</h3>
                                    {review.date && <p className="text-xs text-gray-500">{format(typeof review.date === 'string' ? new Date(review.date) : review.date, 'MMM d, yyyy')}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <StarRating rating={review.rating} size={20} />
                                    <span className="text-sm font-bold text-gray-800">{review.rating.toFixed(1)}/5.0</span>
                                </div>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed mt-2 mb-3">{review.text}</p>
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 flex-wrap items-center">
                                    <Badge variant="outline" className={cn('flex items-center gap-1', config.badgeClass)}>
                                      <Icon className="h-3 w-3" />
                                      {config.label}
                                    </Badge>
                                    <Badge variant="secondary">{review.topic}</Badge>
                                    {/* Platform Icon Badge */}
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
                    </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-10 text-gray-500">No reviews match the current filter.</div>
          )}
        </div>

        {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" onClick={() => handlePageClick(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                {paginationRange?.map((page, index) => {
                  if (page === DOTS) {
                    return <div key={index} className="px-3 py-1">...</div>;
                  }
                  return (
                    <Button key={index} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageClick(page as number)}>
                      {page}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => handlePageClick(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        )}

      </section>
      {selectedReview && (
        <ReplyDialog
          isOpen={isReplyDialogOpen}
          onOpenChange={setIsReplyDialogOpen}
          review={selectedReview}
        />
      )}
    </>
  );
}
