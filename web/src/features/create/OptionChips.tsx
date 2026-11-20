import { Eye, KeyRound, Timer } from "lucide-react";
import { useState } from "react";
import type { PublicConfig } from "@/api/types";
import { t } from "@/content/strings";
import { Button } from "@/ui/components/Button";
import { ChoiceList, Popover } from "@/ui/components/Popover";
import { formatDuration } from "@/ui/format";
import { defaultOptions, type Options } from "./createSecret";

const VIEW_CHOICES = [1, 2, 3, 5, 10, 25, 50, 100];

interface Props {
  config: PublicConfig;
  value: Options;
  onChange: (next: Options) => void;
}

/** Expiry, reads and passphrase, each folded into a chip. */
export function OptionChips({ config, value, onChange }: Props) {
  const set = (patch: Partial<Options>) => onChange({ ...value, ...patch });
  const defaults = defaultOptions(config);

  return (
    <div className="chips">
      <Popover label={t.create.expires} icon={Timer} value={formatDuration(value.ttl)} active={value.ttl !== defaults.ttl}>
        {(close) => (
          <ChoiceList
            options={config.ttlOptions}
            value={value.ttl}
            format={formatDuration}
            onPick={(ttl) => {
              set({ ttl });
              close();
            }}
          />
        )}
      </Popover>
      <Popover label={t.create.reads} icon={Eye} value={t.create.readsValue(value.views)} active={value.views !== defaults.views}>
        {(close) => (
          <ChoiceList
            options={VIEW_CHOICES.filter((n) => n <= config.maxViews)}
            value={value.views}
            format={t.create.readsValue}
            onPick={(views) => {
              set({ views });
              close();
            }}
          />
        )}
      </Popover>
      <Popover
        label={t.create.passphrase}
        icon={KeyRound}
        value={value.passphrase ? t.create.passphraseOn : t.create.passphraseOff}
        active={Boolean(value.passphrase)}
      >
        {(close) => <PassphraseEditor initial={value.passphrase} onSave={(passphrase) => (set({ passphrase }), close())} />}
      </Popover>
    </div>
  );
}

function PassphraseEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(initial);
  return (
    <div className="passphrase-editor">
      <input
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(draft);
          }
        }}
        autoComplete="new-password"
        aria-label={t.create.passphrase}
        autoFocus
      />
      <p className="hint">{t.create.passphraseHelp}</p>
      <div className="row-end">
        {initial && (
          <Button variant="quiet" onClick={() => onSave("")}>
            {t.create.passphraseClear}
          </Button>
        )}
        <Button variant="secondary" onClick={() => onSave(draft)}>
          {t.create.passphraseDone}
        </Button>
      </div>
    </div>
  );
}
