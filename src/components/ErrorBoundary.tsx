
import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Optionally log error to an external service
    console.error("App ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center mt-32 text-center space-y-4">
          <div className="text-2xl font-bold text-red-600 mb-2">Something went wrong</div>
          <div className="text-base text-gray-700">{this.state.errorInfo || "Unknown error"}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 transition"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
