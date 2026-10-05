import React from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div data-testid="page-not-found" className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <SearchX className="mb-4 h-12 w-12 text-slate-600" aria-hidden="true" />
      <h1 data-testid="page-title" className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-700">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2" data-testid="not-found-home">Go to the home page</Link>
    </div>
  );
}
