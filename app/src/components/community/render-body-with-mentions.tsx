import { Fragment, type ReactNode } from "react";
import { Link } from "wouter";

/** Render post/comment body with clickable @handles when present in mention_map. */
export function renderBodyWithMentions(body: string, mentionMap: Record<string, string>): ReactNode {
  const re = /@([a-z0-9_]{3,30})/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      out.push(<Fragment key={`t-${key++}`}>{body.slice(last, m.index)}</Fragment>);
    }
    const rawHandle = m[1]!;
    const uid = mentionMap[rawHandle.toLowerCase()];
    if (uid) {
      out.push(
        <Link
          key={`m-${key++}`}
          href={`/community/profile/${uid}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          @{rawHandle}
        </Link>,
      );
    } else {
      out.push(<Fragment key={`h-${key++}`}>@{rawHandle}</Fragment>);
    }
    last = re.lastIndex;
  }
  if (last < body.length) {
    out.push(<Fragment key={`t-${key++}`}>{body.slice(last)}</Fragment>);
  }
  return out;
}
