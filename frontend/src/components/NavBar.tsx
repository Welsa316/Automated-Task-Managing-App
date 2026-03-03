import { NavLink } from 'react-router-dom';
import { useAppStore } from '../store';

const navItems = [
  { to: '/today', label: 'Today', screen: 'today' as const },
  { to: '/week', label: 'Week', screen: 'week' as const },
  { to: '/semester', label: 'Semester', screen: 'semester' as const },
  { to: '/insights', label: 'Insights', screen: 'insights' as const },
  { to: '/settings', label: 'Settings', screen: 'settings' as const },
];

export default function NavBar() {
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  return (
    <nav className="sticky top-0 z-40 border-b border-surface-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold tracking-tight text-accent-500">Canvas Flow</span>
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setActiveScreen(item.screen)}
              className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-accent-50 text-accent-600' : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700'}`}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
