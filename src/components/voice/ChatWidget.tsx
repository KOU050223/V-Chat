"use client";

import React, { memo } from "react";
import { Chat } from "@livekit/components-react";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./ChatWidget.module.css";

// Error Boundary Component
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chat component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-4 h-full text-center text-gray-400">
          <p className="mb-2 text-sm">チャットの読み込みに失敗しました</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            再試行
          </Button>
        </div>
      );
    }

    return this.props.children;
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
