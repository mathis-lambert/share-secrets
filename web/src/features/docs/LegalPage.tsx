import { useConfig } from "@/app/config";
import { Link } from "@/app/router";
import { t } from "@/content/strings";

/** Legal notice and privacy. Operator details come from the server settings. */
export function LegalPage() {
  const config = useConfig();
  const legal = config?.legal;
  const site = config?.siteName ?? "This service";

  return (
    <article className="doc">
      <h1>Legal notice</h1>

      <h2>Operator</h2>
      <dl className="doc-facts">
        <div>
          <dt>Publisher</dt>
          <dd>{legal?.publisher ?? t.legal.notProvided}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            {legal?.contact ? (
              legal.contact.includes("@") ? (
                <a href={`mailto:${legal.contact}`}>{legal.contact}</a>
              ) : (
                legal.contact
              )
            ) : (
              t.legal.notProvided
            )}
          </dd>
        </div>
        <div>
          <dt>Hosting</dt>
          <dd>{legal?.hosting ?? t.legal.notProvided}</dd>
        </div>
      </dl>

      <h2>Privacy</h2>
      <p>
        {site} is built so that its operator cannot read what you share. Secrets are encrypted in your browser and the
        decryption key never reaches the server. See <Link to="/how-it-works">how it works</Link> for details.
      </p>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Kept</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Encrypted secret and its metadata (expiry, reads left)</td>
            <td>Until the last read or expiry, whichever comes first, then deleted</td>
          </tr>
          <tr>
            <td>Request logs: route, status code, duration</td>
            <td>A few days of rotating logs. No IP address, no secret id</td>
          </tr>
          <tr>
            <td>IP address, for rate limiting</td>
            <td>In memory only, about a minute</td>
          </tr>
        </tbody>
      </table>
      <p>
        No cookies, no analytics, no third-party requests. Fonts and scripts are served from this domain. Deleted secrets
        cannot be recovered, by you or by the operator.
      </p>

      <h2>Use</h2>
      <p>
        The service is provided as is, without warranty. You are responsible for what you share and with whom. Do not use
        it to share content you are not entitled to share.
      </p>

      <h2>Software</h2>
      <p>
        Open-source software under the MIT license. Read the code or run your own instance from{" "}
        <a href={t.source} target="_blank" rel="noopener noreferrer">
          the repository
        </a>
        .
      </p>
    </article>
  );
}
