/**
 * Commit-on-blur inputs: typing stays local, the working copy changes once,
 * when the field is left (or Enter). Keeps edits cheap and the publish-bar
 * state honest.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { type Cents } from '../engine/money';

export function TextField(props: {
  label: ReactNode;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const [v, setV] = useState(props.value);
  useEffect(() => setV(props.value), [props.value]);
  return (
    <label className="f">
      <span className="lbl">{props.label}</span>
      <input
        value={v}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== props.value) props.onCommit(v);
          // if the handler ignored the commit, fall back to the stored value
          setV(props.value);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

export function NumField(props: {
  label: ReactNode;
  value: number | null;
  onCommit: (v: number | null) => void;
  step?: number;
  min?: number;
  suffix?: string;
  width?: number;
}) {
  const show = props.value == null ? '' : String(props.value);
  const [v, setV] = useState(show);
  useEffect(() => setV(show), [show]);
  const commit = () => {
    const n = v.trim() === '' ? null : Number(v);
    const next = n != null && Number.isFinite(n) ? n : null;
    if (next !== props.value) props.onCommit(next);
    // if the handler ignored or clamped the commit, the field falls back to
    // the stored value (the useEffect above resyncs when it DID change)
    setV(show);
  };
  return (
    <label className="f">
      <span className="lbl">{props.label}</span>
      <span className="numwrap">
        <input
          type="number"
          inputMode="decimal"
          value={v}
          step={props.step ?? 1}
          min={props.min}
          style={props.width ? { width: props.width } : undefined}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {props.suffix ? <span className="suffix">{props.suffix}</span> : null}
      </span>
    </label>
  );
}

/** Dollars in the box, integer cents in the data. */
export function MoneyField(props: {
  label: ReactNode;
  cents: Cents | null;
  onCommit: (cents: Cents | null) => void;
  step?: number;
  width?: number;
}) {
  return (
    <NumField
      label={props.label}
      value={props.cents == null ? null : props.cents / 100}
      step={props.step ?? 0.01}
      min={0}
      width={props.width}
      suffix="$"
      onCommit={(v) => props.onCommit(v == null ? null : Math.round(v * 100))}
    />
  );
}

export function Confirm(props: {
  message: string;
  action: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <span className="warnbox" role="alert">
      {props.message}
      <button className="btn sm" onClick={props.onNo}>
        Keep editing
      </button>
      <button className="btn sm danger" onClick={props.onYes}>
        {props.action}
      </button>
    </span>
  );
}
