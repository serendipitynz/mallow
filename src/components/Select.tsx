import type { SelectHTMLAttributes } from 'react';

export function Select(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>) {
  return (
    <span className="select">
      <select {...props} className="select__control" />
      {/* snz_studio's chevron rather than Lucide's chevron-down: wider and
          heavier, so it reads as the control's affordance (snz-design doc-8
          §6.3). An inline SVG and not a background image, because a data URL
          cannot follow the palette's custom properties. */}
      <svg
        className="select__chevron"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 9l7 7 7-7" />
      </svg>
    </span>
  );
}
