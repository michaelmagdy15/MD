import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4 text-center">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong 😢</h1>
                    <p className="mb-4 text-gray-300">Please show this error to the developer:</p>
                    <div className="bg-black/50 p-4 rounded-lg border border-red-500/30 max-w-2xl overflow-auto text-left font-mono text-sm max-h-[50vh]">
                        <p className="text-red-400 font-bold mb-2">{this.state.error?.toString()}</p>
                    </div>
                    <button
                        className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-full font-bold transition-all"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
