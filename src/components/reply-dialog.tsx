
'use client';
import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';
import type { Review } from './review-dashboard';
import { generateReply } from '@/ai/flows/generate-reply-flow';
import { useToast } from '@/hooks/use-toast';

interface ReplyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  review: Review;
}

export function ReplyDialog({ isOpen, onOpenChange, review }: ReplyDialogProps) {
  const [generatedReply, setGeneratedReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      handleGenerateReply();
    } else {
      // Reset state when dialog closes
      setGeneratedReply('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleGenerateReply = async () => {
    setIsLoading(true);
    try {
      const result = await generateReply({ review: review.text });
      setGeneratedReply(result.reply);
    } catch (error) {
      console.error('Failed to generate reply:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not generate an AI-powered reply. Please try again.',
      });
      onOpenChange(false); // Close dialog on error
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSendReply = () => {
    console.log("Replying with:", generatedReply);
    toast({
        title: "Reply Sent!",
        description: "Your reply has been logged."
    });
    onOpenChange(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Reply to Review</AlertDialogTitle>
          <AlertDialogDescription>
            AI has generated a draft response below. You can edit it before sending.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-4">
            <div className="border rounded-md p-4 bg-secondary/20">
                <p className="font-semibold text-sm mb-2">Original Review:</p>
                <p className="text-sm text-muted-foreground italic">"{review.text}"</p>
            </div>
        </div>

        <div className="relative">
          <Textarea
            placeholder="Your reply..."
            value={generatedReply}
            onChange={(e) => setGeneratedReply(e.target.value)}
            rows={5}
            className="pr-24"
            disabled={isLoading}
          />
           <div className="absolute top-2 right-2">
                <Button variant="ghost" size="sm" onClick={handleGenerateReply} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    <span className="sr-only">Regenerate</span>
                </Button>
            </div>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSendReply} disabled={!generatedReply || isLoading}>
            Send Reply
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
