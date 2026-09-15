interface BrandMarkProps {
  /** `mark` is the circular XYAI logo only; `wordmark` adds the FreeOS name. */
  variant?: "mark" | "wordmark";
  height?: number;
  className?: string;
}

/** User-visible FreeOS brand: circular XYAI mark, optional wordmark text. */
export default function BrandMark({
  variant = "wordmark",
  height = 48,
  className,
}: BrandMarkProps) {
  const markSize = variant === "wordmark" ? Math.round(height * 0.92) : height;
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <img
        src="/xyai-mark.png"
        alt={variant === "mark" ? "FreeOS" : ""}
        width={markSize}
        height={markSize}
        style={{
          width: markSize,
          height: markSize,
          objectFit: "contain",
          display: "block",
          flexShrink: 0,
        }}
      />
      {variant === "wordmark" ? (
        <span
          style={{
            fontSize: Math.max(18, Math.round(height * 0.52)),
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--fn-text-primary)",
            lineHeight: 1,
          }}
        >
          FreeOS
        </span>
      ) : null}
    </div>
  );
}
