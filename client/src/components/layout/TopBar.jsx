import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PlayCircle, ShieldCheck } from 'lucide-react';

export function TopBar() {
  return (
    <header className="border-b border-hairline bg-elevated/80 backdrop-blur-sm sticky top-0 z-40 px-4 lg:px-8 py-3 flex items-center justify-between">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-sm bg-ink text-on-primary flex items-center justify-center font-bold text-sm tracking-tight group-hover:bg-black transition-colors">
            IQ
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-ink flex items-center gap-2">
              RosterIQ
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-xs bg-hairline text-body">
                v1.0
              </span>
            </h1>
            <p className="text-[11px] text-mute">Smart Roster Management System</p>
          </div>
        </Link>
      </div>

      {/* Quick Navigation Pills */}
      <div className="flex items-center gap-2">
        <Link
          to="/demo"
          className="touch-target px-3 py-1.5 rounded-pill bg-link-soft text-link-deep border border-link/20 text-xs font-semibold hover:bg-link-soft/80 focus-ring transition-colors flex items-center gap-1.5"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>Interactive Demo</span>
        </Link>
      </div>
    </header>
  );
}

