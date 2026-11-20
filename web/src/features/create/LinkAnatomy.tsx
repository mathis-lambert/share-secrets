import { Hash, KeyRound, Server } from "lucide-react";
import { t } from "@/content/strings";
import { CopyButton } from "@/ui/components/CopyButton";

/**
 * The link, split into what the server sees and what stays in the browser:
 *   https://host/s/  ID  #KEY
 */
export function LinkAnatomy({ link }: { link: string }) {
  const url = new URL(link);
  const id = url.pathname.split("/").pop() ?? "";
  const base = `${url.origin}${url.pathname.slice(0, -id.length)}`;
  const key = url.hash;

  return (
    <div className="anatomy">
      <div className="anatomy-bar">
        <code className="anatomy-link" tabIndex={0} aria-label={link}>
          <span className="part-host">{base}</span>
          <span className="part-id">{id}</span>
          <span className="part-key">{key}</span>
        </code>
        <CopyButton value={link} />
      </div>
      <dl className="anatomy-legend">
        <div className="legend-host">
          <dt>
            <Server size={12} aria-hidden="true" /> {url.host}
          </dt>
          <dd>{t.share.host}</dd>
        </div>
        <div className="legend-id">
          <dt>
            <Hash size={12} aria-hidden="true" /> {id}
          </dt>
          <dd>{t.share.id}</dd>
        </div>
        <div className="legend-key">
          <dt>
            <KeyRound size={12} aria-hidden="true" /> {key}
          </dt>
          <dd>{t.share.key}</dd>
        </div>
      </dl>
    </div>
  );
}
