import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  label?: string;
}

const StarRating = ({
  value,
  onChange,
  size = "md",
  readOnly = false,
  label,
}: StarRatingProps) => {
  const [hover, setHover] = useState(0);
  const dim = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5";

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => !readOnly && setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover || value) >= n;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => !readOnly && onChange?.(n)}
              onMouseEnter={() => !readOnly && setHover(n)}
              className={cn(
                "transition-smooth",
                !readOnly && "hover:scale-110 cursor-pointer",
                readOnly && "cursor-default"
              )}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            >
              <Star
                className={cn(
                  dim,
                  filled
                    ? "fill-accent text-accent"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StarRating;
