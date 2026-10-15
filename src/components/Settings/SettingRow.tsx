import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { handleChoiceGroupKeyDown } from './choice-group-keys';

interface SettingGroupProps {
  title: string;
  children: ReactNode;
}

/** A titled, rounded group of setting rows, like macOS System Settings. */
export function SettingGroup({ title, children }: SettingGroupProps) {
  return (
    <section className="setting-group">
      <h2>{title}</h2>
      <div className="setting-group-rows">{children}</div>
    </section>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
}

/** One setting: its label (and an optional explanation) on the left, the control on the right. */
export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-row-text">
        <span className="setting-row-label">{label}</span>
        {description && <span className="setting-row-description">{description}</span>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  description?: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}

/** A yes/no setting shown as a switch. */
export function SwitchRow({ label, description, isChecked, onChange }: SwitchRowProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.checked);
  }

  return (
    <label className="setting-row is-clickable">
      <div className="setting-row-text">
        <span className="setting-row-label">{label}</span>
        {description && <span className="setting-row-description">{description}</span>}
      </div>
      <input type="checkbox" role="switch" className="switch" checked={isChecked} onChange={handleChange} />
    </label>
  );
}

interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

interface SegmentedProps<Value extends string> {
  label: string;
  value: Value;
  options: SegmentedOption<Value>[];
  onChange: (value: Value) => void;
}

/** A small set of choices shown side by side, like Light / Dark / System. */
export function Segmented<Value extends string>({ label, value, options, onChange }: SegmentedProps<Value>) {
  return (
    <div className="segmented-control is-large" role="radiogroup" aria-label={label} onKeyDown={handleChoiceGroupKeyDown}>
      {options.map((option) => (
        <SegmentedButton key={option.value} option={option} isActive={option.value === value} onChange={onChange} />
      ))}
    </div>
  );
}

interface SegmentedButtonProps<Value extends string> {
  option: SegmentedOption<Value>;
  isActive: boolean;
  onChange: (value: Value) => void;
}

function SegmentedButton<Value extends string>({ option, isActive, onChange }: SegmentedButtonProps<Value>) {
  function handleClick() {
    onChange(option.value);
  }

  return (
    <button role="radio" aria-checked={isActive} tabIndex={isActive ? 0 : -1} className={isActive ? 'is-active' : undefined} onClick={handleClick}>
      {option.label}
    </button>
  );
}

interface NumberInputProps {
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  onChange: (value: number) => void;
}

/** A number field that saves only values in range. Leaving it shows the saved value again. */
export function NumberInput({ value, minimum, maximum, step, onChange }: NumberInputProps) {
  // What's typed, kept while it's out of range (like "1" on the way to "14").
  const [draft, setDraft] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
    const { valueAsNumber } = event.target;
    if (valueAsNumber >= minimum && valueAsNumber <= maximum) onChange(valueAsNumber);
  }

  function handleBlur() {
    setDraft(null);
  }

  return (
    <input
      className="number-input"
      type="number"
      min={minimum}
      max={maximum}
      step={step}
      value={draft ?? value}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
