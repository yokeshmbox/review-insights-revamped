import { ReviewDashboard } from '@/components/review-dashboard';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from '@/components/ui/tooltip';

export default function Home() {
  return (
    <TooltipProvider>
      <main className="bg-background min-h-screen">
        <ReviewDashboard />
      </main>
      <Toaster />
    </TooltipProvider>
  );
}
