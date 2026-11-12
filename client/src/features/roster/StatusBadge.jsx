import React from 'react';
import { Check, Coffee, CalendarX, Clock, Award } from 'lucide-react';

export const STATUS_CONFIG = {
  WORKING: {
    code: 'W',
    label: 'Working',
    bg: 'bg-status-working-bg',
    text: 'text-status-working',
    border: 'border-status-working-border',
    icon: Check,
  },
  WEEKLY_OFF: {
    code: 'WO',
    label: 'Weekly Off',
    bg: 'bg-status-off-bg',
    text: 'text-status-off',
    border: 'border-status-off-border',
    icon: Coffee,
  },
  LEAVE: {
    code: 'L',
    label: 'Leave',
    bg: 'bg-status-leave-bg',
    text: 'text-status-leave',
    border: 'border-status-leave-border',
    icon: CalendarX,
  },
  COMP_OFF: {
    code: 'CO',
    label: 'Comp-Off',
    bg: 'bg-status-compoff-bg',
    text: 'text-status-compoff',
    border: 'border-status-compoff-border',
    icon: Clock,
  },
  HOLIDAY: {
    code: 'H',
    label: 'Holiday',
    bg: 'bg-status-holiday-bg',
    text: 'text-status-holiday',
    border: 'border-status-holiday-border',
    icon: Award,
  },
};

export function StatusBadge({ status = 'WORKING', isCompact = false, showIcon = true }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.WORKING;
  const Icon = config.icon;

  if (isCompact) {
    return (
      <span
        aria-label={`${config.label} (${config.code})`}
        title={`${config.label} (${config.code})`}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-sm border text-[11px] font-mono font-semibold transition-transform active:scale-95 ${config.bg} ${config.text} ${config.border}`}
      >
        {config.code}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-xs font-medium ${config.bg} ${config.text} ${config.border}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span className="font-mono font-semibold">{config.code}</span>
      <span className="text-[11px] opacity-90">· {config.label}</span>
    </span>
  );
}

