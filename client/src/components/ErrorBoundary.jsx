import React from 'react';

/** A rendering bug on one screen must not white-screen the whole application. */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Real deployments would forward this to monitoring; the console keeps it visible to the QA console gate.
    console.error('UI render error:', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" data-testid="error-boundary" className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">This page hit an unexpected problem</h1>
        <p className="mt-2 text-sm text-slate-600">Your data is safe. Reload the page to try again. If it keeps happening, tell your administrator what you were doing.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          Reload page
        </button>
      </div>
    );
  }
}
