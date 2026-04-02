import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps {
  className?: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: any) => void;
  onKeyDown?: (e: any) => void;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  disabled?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref as any}
        {...props as any}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
