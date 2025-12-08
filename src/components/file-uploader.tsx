
'use client';

import { useCallback, useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, ClipboardList, FileJson, TestTube2 } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
  onSurveyUpload: (file: File) => void;
  onTest: () => void;
}

export function FileUploader({ onFileUpload, onSurveyUpload, onTest }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const surveyInputRef = useRef<HTMLInputElement>(null);
  const analysisInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File | null, type: 'review' | 'survey' | 'analysis') => {
    if (selectedFile) {
        const isReviewFile = type === 'review' && (
            selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            selectedFile.type === 'application/vnd.ms-excel' ||
            selectedFile.name.endsWith('.xlsx') ||
            selectedFile.name.endsWith('.xls') ||
            selectedFile.name.endsWith('.csv')
        );
        const isSurveyFile = type === 'survey' && (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json'));
        const isAnalysisFile = type === 'analysis' && (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json'));

        if (isReviewFile) {
            onFileUpload(selectedFile);
        } else if (isSurveyFile) {
            onSurveyUpload(selectedFile);
        } else if (isAnalysisFile) {
            onFileUpload(selectedFile);
        } else {
            toast({
                variant: 'destructive',
                title: 'Invalid File Type',
                description: 'Please upload a file of the correct type for the selected option.',
            });
        }
    }
  }, [onFileUpload, onSurveyUpload, toast]);


  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0], 'review');
      e.dataTransfer.clearData();
    }
  };
  
  return (
    <div 
        className={cn(
            "w-full max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md border-2 border-dashed transition-all duration-300",
            isDragging ? "border-primary scale-105" : "border-gray-300"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center w-full text-center">
        <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null, 'review')} />
        <input ref={surveyInputRef} type="file" className="hidden" accept=".json" onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null, 'survey')} />
        <input ref={analysisInputRef} type="file" className="hidden" accept=".json" onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null, 'analysis')} />

        <div className="mb-6">
            <UploadCloud className={cn("h-16 w-16 text-primary transition-all duration-300", isDragging && "scale-110")} />
        </div>
        <h3 className="text-2xl font-bold text-gray-800">Start Your Analysis</h3>
        {/* <p className="mt-2 text-gray-600 max-w-md">Drag and drop a file or choose an option below.</p> */}
        {/* IMPORTANT: I NEED TO UNDO HERE */}
        <div className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8">
            {/* <OptionCard icon={FileSpreadsheet} title="Review File" description="Analyze a new Excel or CSV review file." buttonText="Upload Reviews" onClick={() => fileInputRef.current?.click()} /> */}
            {/* <OptionCard icon={ClipboardList} title="Survey File" description="Upload a survey-formatted JSON file." buttonText="Upload Survey" onClick={() => surveyInputRef.current?.click()} /> */}
            <OptionCard icon={FileJson} title="Load Analysis" description="Load a previously exported analysis file." buttonText="Load JSON" onClick={() => analysisInputRef.current?.click()} />
        </div>

        {/* <div className="mt-8 text-center">
            <p className="text-gray-500 mb-4">Or, see how it works with sample data:</p>
            <Button size="lg" variant="ghost" onClick={onTest}>
                <TestTube2 className="mr-2" />
                Test with Mock Data
            </Button>
        </div> */}
      </div>
    </div>
  );
}

interface OptionCardProps {
    icon: React.ElementType;
    title: string;
    description: string;
    buttonText: string;
    onClick: () => void;
    isOutline?: boolean;
}

const OptionCard = ({ icon: Icon, title, description, buttonText, onClick, isOutline = false }: OptionCardProps) => (
    <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg border border-gray-200">
        <Icon className="h-10 w-10 text-primary mb-3"/>
        <h4 className="font-semibold text-lg">{title}</h4>
        <p className="text-sm text-gray-500 mt-1 mb-4 text-center h-12">{description}</p>
        <Button size="lg" variant={isOutline ? 'outline' : 'default'} onClick={onClick} className="w-full">
            {buttonText}
        </Button>
    </div>
);
