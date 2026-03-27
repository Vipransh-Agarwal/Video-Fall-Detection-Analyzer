"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/lib/types";

interface AnalysisResultProps {
  result: AnalysisResult;
}

export function AnalysisResultCard({ result }: AnalysisResultProps) {
  const { fallDetected, confidence, explanation } = result;

  return (
    <Card className={cn(
      "w-full border-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
      fallDetected ? "border-destructive/40" : "border-green-500/40"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="text-muted-foreground font-medium">Analysis Result</span>
          <Badge
            variant={fallDetected ? "destructive" : "default"}
            className={cn(
              "text-sm px-3 py-1 flex items-center gap-1.5",
              !fallDetected && "bg-green-600 hover:bg-green-600 text-white"
            )}
          >
            {fallDetected ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                Fall Detected
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                No Fall
              </>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Confidence */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Confidence</span>
            <span className={cn(
              "font-semibold tabular-nums",
              confidence >= 75 ? "text-foreground" : "text-muted-foreground"
            )}>
              {confidence}%
            </span>
          </div>
          <Progress
            value={confidence}
            className={cn(
              "h-2",
              fallDetected
                ? "[&>div]:bg-destructive"
                : "[&>div]:bg-green-600"
            )}
          />
        </div>

        {/* Explanation */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Explanation</p>
          <p className="text-sm text-foreground leading-relaxed">{explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
