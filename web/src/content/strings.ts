/** Every user-facing string, in one place. */

type Unit = "minute" | "hour" | "day";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const t = {
  nav: { new: "New secret", how: "How it works", legal: "Legal" },
  footer: "Encrypted in your browser. The key never reaches the server.",

  create: {
    title: "New secret",
    placeholder: "Paste a password, an API key, a token…",
    size: (used: string, max: string) => `${used} of ${max}`,
    tooLarge: "Too large for this server.",
    expires: "Expires",
    reads: "Reads",
    readsValue: (n: number) => plural(n, "read"),
    passphrase: "Passphrase",
    passphraseOff: "None",
    passphraseOn: "Set",
    passphraseHelp: "Mixed into the key. The recipient will need it too, so send it another way than the link.",
    passphraseClear: "Remove",
    passphraseDone: "Done",
    inspect: "Inspect payload",
    inspectTitle: "What the server would receive",
    inspectHelp: "Your text, encrypted locally with AES-256-GCM. This preview uses a throwaway key and nothing is sent until you create the link.",
    inspectEmpty: "Type something first.",
    submit: "Create link",
    submitting: "Encrypting…",
  },

  share: {
    title: "Link created",
    help: "Send it to the recipient. The ciphertext is deleted after the last read or at expiry.",
    host: "server",
    id: "secret id, sent to the server",
    key: "key, never leaves the browser",
    summary: (when: string, reads: string) => `Expires ${when}. ${reads} allowed.`,
    passphraseReminder: "The link alone cannot decrypt it. Share the passphrase separately.",
    done: "Done",
    destroy: "Delete secret",
    destroyConfirm: "Delete it? The link stops working immediately.",
    destroyYes: "Delete",
    destroyNo: "Keep",
    destroyed: "Secret deleted. The link no longer works.",
  },

  reveal: {
    title: "You received a secret",
    help: "It is encrypted. Decrypting happens in this browser and uses one read.",
    readsLeft: (n: number) => (n === 1 ? "Last read" : `${n} reads left`),
    expires: (when: string) => `expires ${when}`,
    decrypt: "Decrypt",
    confirmTitle: "Decrypt this secret?",
    confirmLast: "This is the last read: the secret is deleted from the server as soon as it is decrypted.",
    confirmMany: (n: number) => `This uses one of its ${n} remaining reads.`,
    passphrase: "Passphrase",
    passphraseHelp: "The sender should have shared it with you separately.",
    cancel: "Cancel",
    decrypting: "Decrypting…",
    hidden: "Hidden. Click to show.",
    hide: "Hide",
    show: "Show",
    burnt: "Deleted from the server. Copy it now if you need it.",
    remaining: (n: number) => `${plural(n, "read")} left before it is deleted.`,
  },

  errors: {
    notFound: "Nothing here. The secret never existed, expired, or was already read.",
    badLink: "This link is incomplete: the key after # is missing or cut. Copy the whole link again.",
    wrongKey: "Wrong passphrase. Too many wrong attempts delete the secret.",
    tooMany: "Too many requests. Try again in a minute.",
    network: "The server is unreachable. Check your connection and try again.",
    generic: "The request failed. Try again in a moment.",
    decrypt: "Decryption failed: the link is damaged.",
  },

  copy: { copy: "Copy", copied: "Copied" },
  notFound: { title: "404", help: "Nothing at this address." },

  time: {
    in: (n: number, unit: Unit) => `in ${plural(n, unit)}`,
    duration: (n: number, unit: Unit) => plural(n, unit),
  },
};
