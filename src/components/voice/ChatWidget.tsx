"use client";

import React, { memo } from "react";
import { Chat } from "@livekit/components-react";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./ChatWidget.module.css";

// Error Boundary Component
interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  recoveryKey: number;
}

class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ChatErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryKey: 0,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<ChatErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log full error details to console for debugging
    console.error("Chat component error:", error);
    console.error("Error info:", errorInfo);
    console.error("Component stack:", errorInfo.componentStack);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleSoftRetry = () => {
    // Increment recovery key to remount child component
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryKey: prevState.recoveryKey + 1,
    }));
  };

  handleHardReload = () => {
    // Full page reload for complete recovery
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "不明なエラー";
      const errorCode = this.state.error?.name || "Error";

      return (
        <div className="flex flex-col items-center justify-center p-6 h-full text-center">
          <div className="mb-4">
            <MessageSquare className="w-12 h-12 text-red-400 mx-auto mb-2" />
            <h4 className="text-white font-semibold mb-1">
              チャットの読み込みに失敗しました
            </h4>
            <p className="text-sm text-gray-400 mb-1">
              エラーコード: {errorCode}
            </p>
            <p className="text-xs text-gray-500 max-w-xs mx-auto break-words">
              {errorMessage.length > 100
                ? `${errorMessage.substring(0, 100)}...`
                : errorMessage}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              variant="default"
              size="sm"
              onClick={this.handleSoftRetry}
              className="bg-blue-600 hover:bg-blue-700"
            >
              再試行
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleHardReload}
              className="text-gray-400 hover:text-white"
            >
              ページを再読み込み
            </Button>
          </div>
          <p className="text-xs text-gray-600 mt-4">
            詳細はコンソールをご確認ください
          </p>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.recoveryKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

interface ChatWidgetProps {
  onClose: () => void;
  className?: string;
}

export const ChatWidget = memo(function ChatWidget({
  onClose,
  className,
}: ChatWidgetProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-gray-900 border-l border-gray-700 shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-950/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">チャット</h3>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">閉じる</span>
        </Button>
      </div>

      {/* LiveKit Chat Component */}
      <div className={styles.chatContainer}>
        <ChatErrorBoundary>
          <Chat />
        </ChatErrorBoundary>
      </div>
    </div>
  );
});
