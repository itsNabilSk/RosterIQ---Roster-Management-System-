import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, Users, Building2, PlayCircle, Layers } from 'lucide-react';

export function MobileNav() {
  const items = [
    { to: '/', label: 'Roster', icon: Calendar, end: true },
    { to: '/employees', label: 'Staff', icon: Users },
    { to: '/brands', label: 'Brands', icon: Building2 },
    { to: '/processes', label: 'Processes', icon: Layers },
    { to: '/demo', label: 'Demo', icon: PlayCircle },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-elevated/95 backdrop-blur-md border-t border-hairline flex items-center justify-around px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `touch-target flex-1 py-1.5 flex flex-col items-center justify-center text-[10px] font-medium transition-colors ${
                isActive ? 'text-ink font-bold' : 'text-mute hover:text-ink'
              }`
            }
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

