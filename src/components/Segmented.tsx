import { type CSSProperties, type ReactNode, useRef, useState } from 'react';
import { segmentedKeyTarget } from '../lib/segmented-nav';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  /** Drawn in place of the label, which then reaches the reader and the tooltip
   *  only. */
  icon?: ReactNode;
}

interface SegmentedProps<V extends string> {
  label: string;
  options: SegmentedOption<V>[];
  value: V;
  onSelect: (value: V) => void;
  /** From the caller's `useId()`; gives each option an id another element can
   *  be labelled by (`segmentedOptionId`). */
  idBase?: string;
}

export function segmentedOptionId(idBase: string, value: string): string {
  return `${idBase}-option-${value}`;
}

/** A segmented control: exclusive options on a track, the selected one on a
 *  floating face, chosen the moment it is pressed (snz-design doc-9 §6.12). It is
 *  read as a group of pressed buttons rather than as radios, because radios
 *  promise that an arrow selects, and here an arrow only moves the focus. */
export function Segmented<V extends string>({ label, options, value, onSelect, idBase }: SegmentedProps<V>) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /* The Tab stop follows the focus while it is inside the group, so Tab and
     Shift+Tab leave from the option the arrows reached rather than passing
     through the selected one; it goes back to the selected option once the focus
     leaves, so coming back in lands on what is chosen. */
  const [focusedValue, setFocusedValue] = useState<V | null>(null);
  const stopValue = focusedValue ?? value;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const target = segmentedKeyTarget(event.key, index, options.length);
    if (target === null) {
      return;
    }
    event.preventDefault();
    optionRefs.current[target]?.focus();
  }

  return (
    /* biome-ignore lint/a11y/useSemanticElements: role="group" is the ARIA pattern for a
       button cluster; <fieldset> is for form controls and requires a <legend>, while the
       label is already carried by aria-label. */
    <div
      className="segmented"
      role="group"
      aria-label={label}
      style={{ '--segmented-count': options.length, '--segmented-index': selectedIndex } as CSSProperties}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setFocusedValue(null);
        }
      }}
    >
      <span className="segmented__face" aria-hidden="true" />
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            optionRefs.current[index] = el;
          }}
          type="button"
          id={idBase === undefined ? undefined : segmentedOptionId(idBase, option.value)}
          className={`segmented__option${option.icon ? ' segmented__option--icon' : ''}`}
          title={option.icon ? option.label : undefined}
          aria-label={option.icon ? option.label : undefined}
          aria-pressed={option.value === value}
          tabIndex={option.value === stopValue ? 0 : -1}
          onFocus={() => setFocusedValue(option.value)}
          onClick={() => {
            if (option.value !== value) {
              onSelect(option.value);
            }
          }}
          onKeyDown={(e) => onKeyDown(e, index)}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  );
}
