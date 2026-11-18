import { cn } from '../../lib/utils.ts';

export function CorivoLogo({
  variant = 'full',
  inverse = false,
  className,
}: {
  variant?: 'full' | 'mark';
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 shrink-0 whitespace-nowrap', className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="2"
          y="5"
          width="28"
          height="22"
          rx="6"
          fill={inverse ? '#2563EB' : '#14243A'}
        />
        <path
          d="M6.5 10.5L16 17.5L25.5 10.5"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="9" r="3" fill="#3B82F6" stroke={inverse ? '#14243A' : '#FFFFFF'} strokeWidth="1.5" />
      </svg>
      {variant === 'full' && (
        <span
          className={cn(
            'font-display font-bold tracking-tight text-lg leading-none',
            inverse ? 'text-white' : 'text-[#14243A] dark:text-white'
          )}
        >
          Corivo Mail
        </span>
      )}
    </span>
  );
}
