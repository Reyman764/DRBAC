import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-shell" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
          <div className="panel" style={{ maxWidth: 520, padding: 28 }}>
            <p className="eyebrow" style={{ color: 'var(--red)' }}>Something went wrong</p>
            <h2 className="panel-title" style={{ marginTop: 10 }}>{this.props.title || 'This view crashed'}</h2>
            <p className="subtitle" style={{ marginTop: 12 }}>
              {this.props.fallbackHint || 'A runtime error stopped this screen from rendering. You can try again without losing your session.'}
            </p>
            <pre
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 8,
                background: 'rgba(0,0,0,0.35)',
                color: 'var(--text-soft)',
                fontSize: 12,
                overflow: 'auto',
                maxHeight: 160,
              }}
            >
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset?.();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
