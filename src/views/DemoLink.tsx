import { youtubeSearchUrl } from "../apt/exercises";

// External "watch a real human do this" link. Deliberately a link to a
// YouTube search, not an embed: embedding would pull Google's scripts into
// a privacy-first app, break offline use, and rot when a hardcoded video
// disappears. A search stays fresh and the user leaves the app knowingly.

export function DemoLink({ query }: { query: string | null }) {
  if (!query) return null;
  return (
    <a
      className="demo-link"
      href={youtubeSearchUrl(query)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <polygon points="10,9 16,12 10,15" fill="currentColor" />
      </svg>
      Watch a real demo on YouTube
      <span className="demo-link-ext" aria-hidden="true">↗</span>
    </a>
  );
}
