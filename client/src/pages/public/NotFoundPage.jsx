import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowLeft,
  Home,
  LayoutDashboard,
  Briefcase,
  ShieldCheck,
  Search,
  FileSearch,
  MessageSquare,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { landingPath } from '../../lib/access';

export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  const isAuth = Boolean(auth?.isAuthenticated);
  const homeTarget = isAuth ? landingPath(auth) : '/';
  const homeLabel = isAuth ? 'Go to My Workspace' : 'Go to Home Page';

  const quickLinks = isAuth
    ? [
        {
          label: 'Dashboard',
          description: 'Return to your main command center',
          to: landingPath(auth),
          icon: LayoutDashboard
        },
        {
          label: 'Team Chat',
          description: 'Connect with peers, mentors and managers',
          to: '/chat',
          icon: MessageSquare
        },
        {
          label: 'My Account',
          description: 'View profile, credentials, and settings',
          to: '/account',
          icon: UserCheck
        }
      ]
    : [
        {
          label: 'Explore Internships',
          description: 'Browse active openings and career tracks',
          to: '/internships',
          icon: Briefcase
        },
        {
          label: 'Verify Certificate',
          description: 'Authenticate internship credentials and awards',
          to: '/verify/certificate',
          icon: ShieldCheck
        },
        {
          label: 'Track Application',
          description: 'Check status of your submitted application',
          to: '/application/status',
          icon: FileSearch
        }
      ];

  return (
    <div
      data-testid="page-not-found"
      className="relative min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8"
    >
      {/* Ambient background decoration */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <div className="h-[420px] w-[620px] rounded-full bg-gradient-to-tr from-brand-100/60 via-slate-100/40 to-transparent blur-3xl opacity-75" />
      </div>

      <div className="mx-auto w-full max-w-2xl text-center">
        {/* Glowing badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur-sm">
          <Compass className="h-4 w-4 animate-spin [animation-duration:8s]" aria-hidden="true" />
          <span>Error 404 • Page Not Found</span>
        </div>

        {/* Large stylized 404 title */}
        <div className="mt-4 select-none">
          <span className="text-7xl font-extrabold tracking-tight text-slate-900 sm:text-8xl">
            4<span className="text-brand-600">0</span>4
          </span>
        </div>

        <h1
          data-testid="page-title"
          className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          Lost in route space?
        </h1>

        <p className="mx-auto mt-3 max-w-lg text-base text-slate-600">
          The page or resource you are looking for doesn't exist, has been relocated, or is temporarily unavailable.
        </p>

        {/* Display the attempted path */}
        {location.pathname && (
          <div className="mx-auto mt-4 max-w-md rounded-lg border border-slate-200 bg-white/80 px-3.5 py-2 text-xs text-slate-600 shadow-sm backdrop-blur-sm">
            Attempted route:{' '}
            <code className="font-mono font-medium text-brand-700 break-all">
              {location.pathname}
            </code>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(homeTarget))}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go Back
          </button>

          <Link
            to={homeTarget}
            data-testid="not-found-home"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {isAuth ? (
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Home className="h-4 w-4" aria-hidden="true" />
            )}
            {homeLabel}
          </Link>
        </div>

        {/* Quick jump navigation tiles */}
        <div className="mt-12 text-left">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            Suggested Destinations
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-700 transition group-hover:bg-brand-50 group-hover:text-brand-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                        {item.label}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    {item.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Support helper */}
        <p className="mt-10 text-xs text-slate-400">
          Need assistance or think this is a system error? Please contact your program coordinator or administrator.
        </p>
      </div>
    </div>
  );
}
