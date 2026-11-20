/// <reference types="node" />
/**
 * share-secrets agent client: create and open end-to-end encrypted links from
 * a terminal or an AI agent. Zero dependencies; runs on Node 20+, Deno and Bun.
 * Served by every instance at /agent/share.mjs, built from the same envelope
 * code as the web page. Read /llms.txt on the instance before using it.
 */
import { ApiError, createApi } from "@/api/client";
import { create, info, remove, reveal } from "./commands";

const USAGE = `Usage:
  printf '%s' "$SECRET" | node share.mjs create --url <instance> [--ttl 1d] [--views 1] [--passphrase-env NAME]
  node share.mjs info   <link>
  node share.mjs reveal <link> [--passphrase-env NAME]
  node share.mjs delete <link> [--passphrase-env NAME]

The secret is read from stdin, never from arguments. A passphrase is read from
the environment variable named by --passphrase-env. Output is JSON on stdout;
errors are JSON on stderr with exit code 1.`;

interface Args {
  command?: string;
  link?: string;
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};
  let link: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg.startsWith("--")) {
      const [name, inline] = arg.slice(2).split("=", 2);
      const value = inline ?? rest[++i];
      if (value === undefined) throw new Error(`--${name} needs a value`);
      flags[name!] = value;
    } else if (link === undefined) {
      link = arg;
    } else {
      throw new Error(`unexpected argument ${JSON.stringify(arg)}`);
    }
  }
  return { command, link, flags };
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) throw new Error("pipe the secret on stdin, e.g. printf '%s' \"$SECRET\" | node share.mjs create ...");
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  // `echo` adds one newline; a secret almost never ends with one.
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

function passphrase(flags: Record<string, string>): string | undefined {
  const name = flags["passphrase-env"];
  if (name === undefined) return undefined;
  const value = process.env[name];
  if (!value) throw new Error(`environment variable ${name} is empty or unset`);
  return value;
}

/** The instance origin, refusing plain HTTP except on this machine. */
function instance(url: string): string {
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !local) throw new Error("the instance must be served over https");
  return parsed.origin;
}

async function run(argv: string[]): Promise<unknown> {
  if (argv.length === 0 || ["help", "--help", "-h"].includes(argv[0]!)) {
    process.stdout.write(`${USAGE}\n`);
    return undefined;
  }
  const { command, link, flags } = parseArgs(argv);
  // Commands on a link talk to the instance that issued it.
  const linkApi = () => {
    if (!link) throw new Error(`${command} needs a share link`);
    return createApi(instance(link));
  };
  switch (command) {
    case "create": {
      if (!flags.url) throw new Error("create needs --url <instance>, e.g. --url https://secrets.example.com");
      const origin = instance(flags.url);
      const views = flags.views === undefined ? undefined : Number(flags.views);
      return create(createApi(origin), origin, {
        text: await readStdin(),
        ttl: flags.ttl,
        views,
        passphrase: passphrase(flags),
      });
    }
    case "info":
      return info(linkApi(), link!);
    case "reveal":
      return reveal(linkApi(), link!, passphrase(flags));
    case "delete":
      return remove(linkApi(), link!, passphrase(flags));
    default:
      throw new Error(`unknown command ${JSON.stringify(command)}; run with --help`);
  }
}

run(process.argv.slice(2)).then(
  (result) => result !== undefined && process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
  (error: unknown) => {
    const body =
      error instanceof ApiError
        ? { error: error.code, message: error.message }
        : { error: "usage", message: error instanceof Error ? error.message : String(error) };
    process.stderr.write(`${JSON.stringify(body)}\n`);
    process.exitCode = 1;
  },
);
