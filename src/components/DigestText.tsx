import ReactMarkdown from "react-markdown";

// All editorial and article prose uses one renderer. Do not auto-bold every
// number: dates and version strings are not necessarily the important evidence.
export function DigestText({ children, className = "" }: { children: string; className?: string }) {
  return <div className={`digest-body prose-digest ${className}`}><ReactMarkdown components={{
    a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  }}>{children}</ReactMarkdown></div>;
}
