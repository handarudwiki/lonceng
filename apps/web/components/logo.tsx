export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--brand)" />
      <path
        d="M20 9.5a2 2 0 0 1 2 2v.7a8 8 0 0 1 6 7.8c0 4 1 5.7 2.2 7a1 1 0 0 1-.7 1.7H10.5a1 1 0 0 1-.7-1.7c1.2-1.3 2.2-3 2.2-7a8 8 0 0 1 6-7.8v-.7a2 2 0 0 1 2-2Z"
        fill="#fff"
      />
      <circle cx="20" cy="31.5" r="2.5" fill="#fff" />
    </svg>
  );
}
