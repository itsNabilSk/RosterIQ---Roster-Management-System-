import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Calendar,
  Users,
  Building2,
  Layers,
  ArrowRightLeft,
  CalendarX,
  Award,
  PlayCircle,
  Shield,
  Users2,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Roster Matrix', icon: Calendar, end: true },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/pods', label: 'Pods', icon: Users2 },
  { to: '/brands', label: 'Brands', icon: Building2 },
  { to: '/processes', label: 'Processes', icon: Layers },
  { to: '/assignments', label: 'Assignments', icon: ArrowRightLeft },
  { to: '/leaves', label: 'Leaves & Comp-Offs', icon: CalendarX },
  { to: '/holidays', label: 'Public Holidays', icon: Award },
  { to: '/demo', label: 'One-Click Demo', icon: PlayCircle },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-hairline bg-canvas min-h-[calc(100vh-57px)] p-3 hidden md:flex flex-col justify-between">
      <nav className="space-y-1">
        <div className="text-[10px] font-mono uppercase text-mute px-3 py-1.5 tracking-wider">
          Management
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `touch-target px-3 py-2 rounded-sm text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  isActive
                    ? 'bg-elevated text-ink font-semibold border border-hairline shadow-xs'
                    : 'text-body hover:bg-hairline-soft/60 hover:text-ink'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0 text-mute" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-hairline text-[11px] text-mute space-y-1 text-left">
        <div className="font-medium text-ink flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-success" />
          <span>Strict Validation</span>
        </div>
        <p className="leading-tight">
          Never silently generates invalid schedules.
        </p>
      </div>
    </aside>
  );
}

