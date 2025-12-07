
'use client';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  className?: string;
}

export function StarRating({ rating, maxRating = 5, size = 20, className }: StarRatingProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const fillPercentage = Math.max(0, Math.min(1, rating - index)) * 100;

        return (
          <div key={index} className="relative">
            <Star
              className="text-muted-foreground/30"
              style={{ width: size, height: size }}
              fill="currentColor"
            />
            <div
              className="absolute top-0 left-0 h-full overflow-hidden"
              style={{ width: `${fillPercentage}%` }}
            >
              <Star
                className="text-amber-400"
                style={{ width: size, height: size }}
                fill="currentColor"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
