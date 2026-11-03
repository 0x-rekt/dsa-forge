import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center border-2 border-black px-2 py-1 text-[13px] font-extrabold leading-none",
  {
    variants: {
      variant: {
        default: "bg-[#ffed00] text-black",
        field: "bg-[#d4bdff] text-black",
        signal: "bg-[#ff4332] text-black",
        neutral: "bg-white text-black",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
