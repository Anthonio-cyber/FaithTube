import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, VideoSource } from '@faithtube/shared';
import { cx, formatDuration } from '@/lib/format';
import { PlaceholderArt } from './VideoCard';

export interface VideoPlayerProps {
  sources: VideoSource[];
  poster?: string | null;
  title: string;
  categorySlug: string;
  chapters?: Chapter[];
  captionsUrl?: string | null;
  startAt?: number;
  autoPlay?: boolean;
  vertical?: boolean;
  onProgress?: (progressSeconds: number, watchedDelta: number, completed: boolean) => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * The FaithTube player.
 *
 * Built on the native <video> element with custom controls so the interface,
 * keyboard model and quality picker are ours. Quality changes preserve the
 * current position, and progress is reported to the caller on a throttle so a
 * watch session survives a closed tab.
 */
export function VideoPlayer({
  sources,
  poster,
  title,
  categorySlug,
  chapters = [],
  captionsUrl,
  startAt = 0,
  autoPlay = false,
  vertical = false,
  onProgress,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const lastReport = useRef({ at: Date.now(), position: startAt });

  const ordered = useMemo(() => rankSources(sources), [sources]);
  const [qualityIndex, setQualityIndex] = useState(() => Math.max(0, ordered.findIndex((s) => s.height <= 720)));
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(startAt);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menu, setMenu] = useState<'none' | 'quality' | 'speed'>('none');
  const [captionsOn, setCaptionsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const active = ordered[qualityIndex] ?? ordered[0];

  const report = useCallback(
    (position: number, completed = false) => {
      if (!onProgress) return;
      const now = Date.now();
      const elapsed = (now - lastReport.current.at) / 1000;
      // Only count time that plausibly maps to real watching, so seeking around
      // does not inflate watch time.
      const watched = Math.max(0, Math.min(elapsed, Math.abs(position - lastReport.current.position) + 1));
      lastReport.current = { at: now, position };
      onProgress(Math.round(position), Math.round(watched), completed);
    },
    [onProgress],
  );

  // Periodic progress reporting while playing, plus a final report on unload.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const node = videoRef.current;
      if (node) report(node.currentTime);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [playing, report]);

  useEffect(() => {
    const onUnload = () => {
      const node = videoRef.current;
      if (node && node.currentTime > 0) report(node.currentTime);
    };
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      onUnload();
    };
  }, [report]);

  // Resume position on mount and after a quality change.
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (startAt > 0 && node.currentTime < 1) node.currentTime = startAt;
  }, [startAt]);

  const togglePlay = useCallback(() => {
    const node = videoRef.current;
    if (!node) return;
    if (node.paused) void node.play().catch(() => setError('Playback could not start. Try a lower quality.'));
    else node.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const node = videoRef.current;
    if (!node) return;
    node.currentTime = Math.max(0, Math.min(node.duration || 0, node.currentTime + delta));
  }, []);

  const seekTo = useCallback((position: number) => {
    const node = videoRef.current;
    if (!node) return;
    node.currentTime = position;
    setCurrent(position);
  }, []);

  /** Keyboard model, announced in the accessibility help panel below the player. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;

      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          seekBy(-5);
          break;
        case 'ArrowRight':
          event.preventDefault();
          seekBy(5);
          break;
        case 'j':
          seekBy(-10);
          break;
        case 'l':
          seekBy(10);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          break;
        case 'm':
          setMuted((value) => !value);
          break;
        case 'f':
          void toggleFullscreen();
          break;
        case 'c':
          setCaptionsOn((value) => !value);
          break;
        default:
          if (/^[0-9]$/.test(event.key) && videoRef.current?.duration) {
            seekTo((Number(event.key) / 10) * videoRef.current.duration);
          }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, seekBy, seekTo]);

  useEffect(() => {
    const node = videoRef.current;
    if (node) {
      node.volume = volume;
      node.muted = muted;
      node.playbackRate = speed;
    }
  }, [volume, muted, speed]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    for (const track of Array.from(node.textTracks)) {
      track.mode = captionsOn ? 'showing' : 'hidden';
    }
  }, [captionsOn, captionsUrl]);

  async function toggleFullscreen() {
    const node = containerRef.current;
    if (!node) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await node.requestFullscreen().catch(() => undefined);
  }

  function changeQuality(index: number) {
    const node = videoRef.current;
    const position = node?.currentTime ?? 0;
    const wasPlaying = node ? !node.paused : false;
    setQualityIndex(index);
    setMenu('none');
    // The source swap resets the element, so the position is restored once the
    // new rendition reports it can play.
    window.setTimeout(() => {
      const next = videoRef.current;
      if (!next) return;
      next.currentTime = position;
      if (wasPlaying) void next.play().catch(() => undefined);
    }, 60);
  }

  function showControls() {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && menu === 'none') setControlsVisible(false);
    }, 2800);
  }

  const activeChapter = chapters.length
    ? [...chapters].reverse().find((chapter) => current >= chapter.startSeconds)
    : undefined;

  if (!ordered.length) {
    return (
      <div className={cx('relative w-full overflow-hidden rounded-2xl bg-navy', vertical ? 'aspect-[9/16]' : 'aspect-video')}>
        <PlaceholderArt title={title} categorySlug={categorySlug} />
        <div className="absolute inset-0 flex items-center justify-center bg-navy-deep/70 p-6 text-center">
          <p className="max-w-sm text-sm text-cream/85">
            This video has no playable file on this deployment. Uploaded media is stored by the configured storage driver;
            check that the API can reach it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cx(
        'group/player relative w-full select-none overflow-hidden rounded-2xl bg-black',
        vertical ? 'aspect-[9/16]' : 'aspect-video',
      )}
      onMouseMove={showControls}
      onMouseLeave={() => playing && menu === 'none' && setControlsVisible(false)}
      onTouchStart={showControls}
    >
      <video
        ref={videoRef}
        key={active.url}
        src={active.url}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
        aria-label={title}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          if (videoRef.current) report(videoRef.current.currentTime);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onProgress={(event) => {
          const node = event.currentTarget;
          if (node.buffered.length) setBuffered(node.buffered.end(node.buffered.length - 1));
        }}
        onEnded={() => {
          setPlaying(false);
          setControlsVisible(true);
          if (videoRef.current) report(videoRef.current.duration, true);
        }}
        onError={() => setError('This video could not be played. It may still be processing.')}
      >
        {captionsUrl ? <track kind="captions" srcLang="en" label="English" src={captionsUrl} default={captionsOn} /> : null}
      </video>

      {waiting ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-cream/30 border-t-gold" />
        </div>
      ) : null}

      {!playing && !error ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-navy-deep/25 transition hover:bg-navy-deep/35"
        >
          <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gilt shadow-glow transition group-hover/player:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 text-navy" fill="currentColor" aria-hidden>
              <path d="M7 4.5 19.5 12 7 19.5Z" />
            </svg>
          </span>
        </button>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-deep/85 p-6 text-center">
          <p className="max-w-sm text-sm text-cream/90">{error}</p>
        </div>
      ) : null}

      <div
        className={cx(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-300',
          controlsVisible || !playing ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {activeChapter ? (
          <p className="mb-1.5 truncate px-1 text-[0.72rem] font-medium text-gold-soft">{activeChapter.title}</p>
        ) : null}

        <Scrubber
          current={current}
          duration={duration}
          buffered={buffered}
          chapters={chapters}
          onSeek={seekTo}
        />

        <div className="mt-1.5 flex items-center gap-1 text-cream">
          <ControlButton onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M7 4.5 19.5 12 7 19.5Z" />
              </svg>
            )}
          </ControlButton>

          <ControlButton onClick={() => seekBy(-10)} label="Back 10 seconds">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M11 5 6.5 9.5 11 14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6.5 9.5H14a5.5 5.5 0 1 1 0 11h-3" strokeLinecap="round" />
            </svg>
          </ControlButton>

          <ControlButton onClick={() => seekBy(10)} label="Forward 10 seconds">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 -scale-x-100">
              <path d="M11 5 6.5 9.5 11 14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6.5 9.5H14a5.5 5.5 0 1 1 0 11h-3" strokeLinecap="round" />
            </svg>
          </ControlButton>

          <div className="group/vol flex items-center">
            <ControlButton onClick={() => setMuted((value) => !value)} label={muted ? 'Unmute' : 'Mute'}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z" />
                {!muted && volume > 0.05 ? (
                  <path
                    d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                ) : (
                  <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                )}
              </svg>
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => {
                setVolume(Number(event.target.value));
                setMuted(Number(event.target.value) === 0);
              }}
              aria-label="Volume"
              className="ml-1 h-1 w-0 cursor-pointer accent-gold transition-all group-hover/vol:w-16 focus:w-16"
            />
          </div>

          <span className="ml-1.5 text-xs tabular-nums text-cream/85">
            {formatDuration(current)} <span className="text-cream/45">/ {formatDuration(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            {captionsUrl ? (
              <ControlButton onClick={() => setCaptionsOn((value) => !value)} label="Captions" active={captionsOn}>
                <span className="text-[0.7rem] font-bold tracking-tight">CC</span>
              </ControlButton>
            ) : null}

            <div className="relative">
              <ControlButton onClick={() => setMenu(menu === 'speed' ? 'none' : 'speed')} label="Playback speed">
                <span className="text-[0.7rem] font-semibold tabular-nums">{speed}×</span>
              </ControlButton>
              {menu === 'speed' ? (
                <Menu>
                  {SPEEDS.map((value) => (
                    <MenuItem
                      key={value}
                      selected={value === speed}
                      onClick={() => {
                        setSpeed(value);
                        setMenu('none');
                      }}
                    >
                      {value === 1 ? 'Normal' : `${value}×`}
                    </MenuItem>
                  ))}
                </Menu>
              ) : null}
            </div>

            {ordered.length > 1 ? (
              <div className="relative">
                <ControlButton onClick={() => setMenu(menu === 'quality' ? 'none' : 'quality')} label="Video quality">
                  <span className="text-[0.7rem] font-semibold">{active.quality}</span>
                </ControlButton>
                {menu === 'quality' ? (
                  <Menu>
                    {ordered.map((source, index) => (
                      <MenuItem key={source.url} selected={index === qualityIndex} onClick={() => changeQuality(index)}>
                        {source.quality}
                        {source.original ? <span className="ml-1.5 text-[0.65rem] opacity-60">source</span> : null}
                      </MenuItem>
                    ))}
                  </Menu>
                ) : null}
              </div>
            ) : null}

            <ControlButton onClick={() => void toggleFullscreen()} label="Fullscreen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5" strokeLinecap="round">
                <path d="M4 9V4.5h5M20 9V4.5h-5M4 15v4.5h5M20 15v4.5h-5" />
              </svg>
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sorts renditions high-to-low so the picker reads the way viewers expect. */
function rankSources(sources: VideoSource[]): VideoSource[] {
  return [...sources].sort((a, b) => (b.height || 0) - (a.height || 0));
}

function Scrubber({
  current,
  duration,
  buffered,
  chapters,
  onSeek,
}: {
  current: number;
  duration: number;
  buffered: number;
  chapters: Chapter[];
  onSeek: (position: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const positionFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !duration) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };

  return (
    <div className="relative px-1">
      {hover !== null ? (
        <span
          className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded bg-navy-deep px-1.5 py-0.5 text-[0.68rem] tabular-nums text-cream"
          style={{ left: `${duration ? (hover / duration) * 100 : 0}%` }}
        >
          {formatDuration(hover)}
        </span>
      ) : null}

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${formatDuration(current)} of ${formatDuration(duration)}`}
        className="group/track relative h-4 cursor-pointer"
        onClick={(event) => onSeek(positionFromEvent(event.clientX))}
        onMouseMove={(event) => setHover(positionFromEvent(event.clientX))}
        onMouseLeave={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') onSeek(Math.max(0, current - 5));
          if (event.key === 'ArrowRight') onSeek(Math.min(duration, current + 5));
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-cream/25 transition-all group-hover/track:h-[5px]">
          <div className="absolute inset-y-0 left-0 bg-cream/30" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
          <div className="absolute inset-y-0 left-0 bg-gold" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
        </div>

        {/* Chapter marks let long sermons be navigated at a glance. */}
        {duration
          ? chapters
              .filter((chapter) => chapter.startSeconds > 0)
              .map((chapter) => (
                <span
                  key={chapter.startSeconds}
                  title={chapter.title}
                  className="absolute top-1/2 h-2 w-[2px] -translate-y-1/2 rounded-full bg-navy-deep/70"
                  style={{ left: `${(chapter.startSeconds / duration) * 100}%` }}
                />
              ))
          : null}

        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-gold shadow transition-transform group-hover/track:scale-100"
          style={{ left: `${duration ? (current / duration) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        'flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-1.5 transition hover:bg-white/15',
        active && 'bg-white/20 text-gold-soft',
      )}
    >
      {children}
    </button>
  );
}

function Menu({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-10 right-0 z-20 min-w-[8rem] overflow-hidden rounded-xl bg-navy-deep/95 py-1 shadow-lift ring-1 ring-white/10 backdrop-blur">
      {children}
    </div>
  );
}

function MenuItem({ children, selected, onClick }: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition hover:bg-white/10',
        selected ? 'text-gold-soft' : 'text-cream/80',
      )}
    >
      {children}
      {selected ? <span aria-hidden>✓</span> : null}
    </button>
  );
}
