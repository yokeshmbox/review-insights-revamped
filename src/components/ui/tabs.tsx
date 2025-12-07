
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      colorVariant: {
        default: "bg-secondary/30 border text-muted-foreground hover:bg-secondary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-transparent",
        positive: "bg-[hsl(var(--tab-positive-bg-light))] text-muted-foreground hover:bg-secondary/70 data-[state=active]:bg-[hsl(var(--tab-positive-bg))] data-[state=active]:text-[hsl(var(--tab-positive-fg))] data-[state=active]:shadow-lg",
        negative: "bg-[hsl(var(--tab-negative-bg-light))] text-muted-foreground hover:bg-secondary/70 data-[state=active]:bg-[hsl(var(--tab-negative-bg))] data-[state=active]:text-[hsl(var(--tab-negative-fg))] data-[state=active]:shadow-lg",
        action: "bg-[hsl(var(--tab-action-bg-light))] text-muted-foreground hover:bg-secondary/70 data-[state=active]:bg-[hsl(var(--tab-action-bg))] data-[state=active]:text-[hsl(var(--tab-action-fg))] data-[state=active]:shadow-lg",
      }
    },
    defaultVariants: {
      colorVariant: "default"
    }
  }
)

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>, VariantProps<typeof tabsTriggerVariants> {}

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto items-center justify-center rounded-lg bg-transparent p-1",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, colorVariant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ colorVariant }), className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
