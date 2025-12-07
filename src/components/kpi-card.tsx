
'use client';
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ClipboardList, Smile, ShieldAlert, Award } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis } from 'recharts';

interface KpiCardProps {
    title: string;
    value: string | number;
    trend: string;
    insight: string;
    type: 'total' | 'satisfaction' | 'critical' | 'praise';
    onClick?: () => void;
    isSelected?: boolean;
    positiveCount?: number;
    negativeCount?: number;
    totalCount?: number;
    topicBreakdown?: Array<{ topic: string; count: number }>;
    trendData?: Array<{ name: string; 'Avg. Rating': number }>;
}

export const typeConfig: Record<KpiCardProps['type'], { icon: LucideIcon, bgColor: string, fgColor: string, lightBgColor: string, lightFgColor: string, borderColor: string, trendBorderColor: string }> = {
    total: { 
        icon: ClipboardList, 
        bgColor: 'bg-[hsl(var(--kpi-total-bg))]', 
        fgColor: 'text-[hsl(var(--kpi-total-fg))]',
        lightBgColor: 'bg-blue-50',
        lightFgColor: 'text-blue-700',
        borderColor: 'border-blue-500',
        trendBorderColor: 'border-blue-300'
    },
    satisfaction: { 
        icon: Smile,
        bgColor: 'bg-[hsl(var(--kpi-satisfaction-bg))]',
        fgColor: 'text-[hsl(var(--kpi-satisfaction-fg))]',
        lightBgColor: 'bg-green-50',
        lightFgColor: 'text-green-700',
        borderColor: 'border-green-500',
        trendBorderColor: 'border-green-300'
    },
    praise: {
        icon: Award,
        bgColor: 'bg-[hsl(var(--kpi-praise-bg))]',
        fgColor: 'text-[hsl(var(--kpi-praise-fg))]',
        lightBgColor: 'bg-yellow-50',
        lightFgColor: 'text-yellow-700',
        borderColor: 'border-yellow-500',
        trendBorderColor: 'border-yellow-300'
    },
    critical: { 
        icon: ShieldAlert,
        bgColor: 'bg-[hsl(var(--kpi-critical-bg))]',
        fgColor: 'text-[hsl(var(--kpi-critical-fg))]',
        lightBgColor: 'bg-red-50',
        lightFgColor: 'text-red-700',
        borderColor: 'border-red-500',
        trendBorderColor: 'border-red-500'
    },
};

export function KpiCard({ title, value, trend, insight, type, onClick, isSelected = false, positiveCount = 0, negativeCount = 0, totalCount, topicBreakdown, trendData }: KpiCardProps) {
    const config = typeConfig[type];
    const Icon = config.icon;

    const chartData = [
        { name: 'Positive', value: positiveCount, color: 'hsl(var(--chart-positive))' },
        { name: 'Negative', value: negativeCount, color: 'hsl(var(--chart-negative))' },
    ];

    const isTotalCardWithData = type === 'total' && (positiveCount > 0 || negativeCount > 0);
    const hasTopicBreakdown = (type === 'critical' || type === 'praise') && topicBreakdown && topicBreakdown.length > 0;
    const hasTrendData = type === 'satisfaction' && trendData && trendData.length > 0;

    const trendIcon = trend.startsWith('+') ? <TrendingUp className="h-4 w-4 text-green-600" /> : trend.startsWith('-') ? <TrendingDown className="h-4 w-4 text-red-600" /> : null;

    return (
        <div
            onClick={onClick}
            className={cn(
                "rounded-lg p-5 shadow-sm border-2 border-transparent transition-all duration-300 cursor-pointer flex flex-col h-full",
                config.bgColor,
                isSelected ? cn("scale-105 shadow-xl", config.borderColor) : 'hover:shadow-md'
            )}
        >
            <div className="flex-grow flex flex-col">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="mt-2"></div>
                        {type === 'total' && totalCount !== undefined && (
                            <p className="text-3xl font-bold text-foreground -mt-1">{totalCount}</p>
                        )}
                    </div>
                    <div className={cn("p-3 rounded-full -mt-2 -mr-2", config.lightBgColor)}>
                        <Icon className={cn("h-6 w-6", config.fgColor)} />
                    </div>
                </div>
                
                {isTotalCardWithData ? (
                    <div className="mt-3 flex flex-col items-center flex-grow justify-center">
                        <div className="relative w-32 h-32">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={60}
                                        fill="#8884d8"
                                        paddingAngle={positiveCount > 0 && negativeCount > 0 ? 5 : 0}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col text-center">
                                <div className="text-3xl font-bold text-foreground">{value}</div>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-3 text-xs">
                             <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-positive))]"></div>
                                <span className="font-semibold">{positiveCount}</span>
                                <span className="text-muted-foreground">Positive</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-[hsl(var(--chart-negative))]"></div>
                                <span className="font-semibold">{negativeCount}</span>
                                <span className="text-muted-foreground">Negative</span>
                            </div>
                        </div>
                        <div className={cn("mt-3 p-3 rounded-lg border-2 w-full", config.borderColor, config.lightBgColor)}>
                            <p className={cn("text-xs font-medium text-center", config.lightFgColor)}>{insight}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col justify-between">
                        <div className="mt-2">
                            <p className="text-4xl font-bold text-foreground">{value}</p>
                        </div>
                         {hasTopicBreakdown ? (
                            <div className="mt-auto space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {topicBreakdown!.map((item, index) => (
                                        <div 
                                            key={item.topic} 
                                            className={cn(
                                                "px-4 py-2 rounded-full text-sm font-semibold shadow-md transition-all border-2",
                                                index === 0 
                                                    ? cn(config.lightBgColor, config.lightFgColor, config.borderColor)
                                                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                                            )}
                                        >
                                            {item.topic}
                                        </div>
                                    ))}
                                </div>
                                <div className={cn("p-3 rounded-lg border-2", config.borderColor, config.lightBgColor)}>
                                    <p className={cn("text-xs font-medium", config.lightFgColor)}>{insight}</p>
                                </div>
                            </div>
                            // Trend Section
                        ) : hasTrendData ? (
                            <div className="mt-auto space-y-2">
                                <div className="h-20 -mx-2">
                                    <div style={{ padding: "10px" }}></div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <XAxis dataKey="name" hide />
                                            <YAxis hide domain={[0, 5]} />
                                            <Line 
                                                type="monotone" 
                                                dataKey="Avg. Rating" 
                                                stroke="hsl(var(--kpi-satisfaction-fg))" 
                                                strokeWidth={2}
                                                dot={{ fill: 'hsl(var(--kpi-satisfaction-fg))', r: 3 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className={cn("text-sm font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-2 border-2", config.trendBorderColor, config.lightBgColor)}>
                                    {trendIcon}
                                    <span className={config.lightFgColor}>{trend}</span>
                                </div>
                                <div className={cn("p-3 rounded-lg border-2", config.borderColor, config.lightBgColor)}>
                                    <p className={cn("text-xs font-medium", config.lightFgColor)}>{insight}</p>
                                </div>
                            </div>
                            // Trend Section End
                        ) : (
                            <div className="mt-auto space-y-3">
                                <div className={cn("text-sm font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-2 border-2", config.trendBorderColor, config.lightBgColor)}>
                                    {trendIcon}
                                    <span className={config.lightFgColor}>{trend}</span>
                                </div>
                                <div className={cn("p-3 rounded-lg border-2", config.borderColor, config.lightBgColor)}>
                                    <p className={cn("text-xs font-medium", config.lightFgColor)}>{insight}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
