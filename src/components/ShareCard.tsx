'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildShareUrl, buildTelegramShareUrl, buildTwitterShareUrl } from '@/lib/share';
import { cn } from '@/lib/utils';
import { Link as LinkIcon, Twitter, Copy, Check, Send } from 'lucide-react';

type ShareCardProps = {
  title: string;
  description: string;
  path: string;
  hashtags?: string[];
  footer?: React.ReactNode;
  className?: string;
};

export function ShareCard({ title, description, path, hashtags, footer, className }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => buildShareUrl(path), [path]);

  const shareText = `${title} · GhostFX`;
  const twitterUrl = useMemo(
    () =>
      buildTwitterShareUrl({
        text: `${title}\n${description}`,
        url: shareUrl,
        hashtags: ['GhostFX', 'Crypto', ...(hashtags || [])],
      }),
    [title, description, shareUrl, hashtags]
  );
  const telegramUrl = useMemo(
    () =>
      buildTelegramShareUrl({
        text: `${title}\n${description}`,
        url: shareUrl,
      }),
    [title, description, shareUrl]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn('border-primary/30 bg-primary/5', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShareIcon />
          Share this insight
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <div className="font-semibold text-foreground">{title}</div>
          <p>{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter">
              <Twitter className="w-4 h-4 mr-2" />
              Post
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram">
              <Send className="w-4 h-4 mr-2" />
              Telegram
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy link
              </>
            )}
          </Button>
        </div>

        <div className="rounded-xl border border-dashed border-primary/50 bg-background px-3 py-2 text-xs font-mono text-muted-foreground truncate">
          {shareUrl}
        </div>

        {footer}
      </CardContent>
    </Card>
  );
}

function ShareIcon() {
  return <LinkIcon className="w-4 h-4 text-primary" />;
}
