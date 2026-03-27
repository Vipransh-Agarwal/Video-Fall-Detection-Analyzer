"use client";

import { X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorToastProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  return (
    <Alert
      variant="destructive"
      className="animate-in fade-in-0 slide-in-from-top-2 duration-300 pr-10 relative"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
  );
}
