import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { GeneratedShootImage } from '../../types/studio';
import { getAccessToken, syncMediaCookie } from '../../lib/supabaseClient';

interface FashionImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  cropVariant?: GeneratedShootImage['cropVariant'];
  aspectClass?: string;
  fallbackLabel?: string;
}

function isStudioMedia(src: string): boolean {
  return src.startsWith('/api/media') || src.includes('/api/media?');
}

export const FashionImage: React.FC<FashionImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  cropVariant = 'full',
  aspectClass = 'aspect-[4/5]',
  fallbackLabel,
}) => {
  const [displaySrc, setDisplaySrc] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setDisplaySrc('');
      setHasError(true);
      return;
    }
    let cancelled = false;
    setHasError(false);
    setDisplaySrc('');
    const ready = isStudioMedia(src)
      ? getAccessToken().then((token) => {
          syncMediaCookie(token);
          if (!token) throw new Error('Sign in required.');
          const url = new URL(src, window.location.origin);
          url.searchParams.set('access_token', token);
          return `${url.pathname}${url.search}`;
        })
      : Promise.resolve(src);
    ready
      .then((nextSrc) => {
        if (!cancelled) setDisplaySrc(nextSrc);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const variantTransform: Record<NonNullable<GeneratedShootImage['cropVariant']>, string> = {
    full: 'scale-100 object-center',
    'three-quarter': 'scale-[1.14] object-[50%_18%]',
    detail: 'scale-[1.06] object-[50%_22%]',
    walking: 'scale-[1.04] object-[48%_30%]',
    seated: 'scale-100 object-[50%_40%]',
    angle: 'scale-[1.12] object-[55%_25%] contrast-[1.03] brightness-[0.99]',
  };

  if (hasError || !src) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#EFECE4] via-[#E5E0D4] to-[#D8D1C2] flex flex-col items-center justify-center p-6 text-center ${aspectClass} ${containerClassName}`}
      >
        <div className="w-10 h-10 rounded-full border border-ink/15 flex items-center justify-center mb-3 text-muted">
          <Sparkles className="w-4 h-4" />
        </div>
        <p className="font-editorial text-lg text-ink leading-snug max-w-[20ch]">
          {fallbackLabel || alt}
        </p>
        <span className="mt-1 text-[11px] font-mono text-faint">Image unavailable</span>
      </div>
    );
  }

  if (!displaySrc) {
    return <div className={`bg-wash ${aspectClass} ${containerClassName}`} />;
  }

  return (
    <div className={`relative overflow-hidden bg-[#EFECE4] ${aspectClass} ${containerClassName}`}>
      <img
        src={displaySrc}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-transform duration-300 ease-out ${variantTransform[cropVariant]} ${className}`}
      />
    </div>
  );
};
