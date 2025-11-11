'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const seedMessage: Message = {
  id: 'intro',
  role: 'assistant',
  content:
    "Hey, I'm Ghost. Ask me about BTC, request a quick breakdown, or fire /watch add BTC to stash it on your list.",
};

const generateId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([seedMessage]);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const assistantReply: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.commandSummary
          ? `${data.commandSummary}\n\n${data.response}`
          : data.response,
      };
      setMessages((prev) => [...prev, assistantReply]);
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: error.message.includes('not configured')
            ? 'My AI brain is offline. Add OPENAI_API_KEY to spin me up.'
            : `I ran into an issue: ${error.message}`,
        },
      ]);
    },
  });

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const canSend = input.trim().length > 0 && !chatMutation.isLoading;

  const handleSend = () => {
    if (!canSend) return;
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');

    chatMutation.mutate({
      messages: nextMessages.map(({ role, content }) => ({ role, content })),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const panelClasses = useMemo(
    () =>
      cn(
        'fixed bottom-24 right-6 z-50 w-80 md:w-96',
        'rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden'
      ),
    []
  );

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {isOpen && (
        <div className={panelClasses}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-muted/30">
            <div>
              <p className="text-sm font-semibold">Ghost AI Copilot</p>
              <p className="text-xs text-muted-foreground">
                Ask for breakdowns or use /watch and /alert commands
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div ref={viewportRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm leading-6',
                  message.role === 'assistant'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary text-primary-foreground ml-auto'
                )}
              >
                {message.content}
              </div>
            ))}
            {chatMutation.isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-3">
                <Loader2 className="w-3 h-3 animate-spin" />
                Ghost is thinking...
              </div>
            )}
          </div>

          <div className="border-t border-border/70 bg-background px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ask Ghost anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatMutation.isLoading}
              />
              <Button size="icon" onClick={handleSend} disabled={!canSend}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        size="icon"
        className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <MessageCircle className="w-5 h-5" />
      </Button>
    </div>
  );
}
