export * as io from "https://deno.land/std@0.204.0/io/mod.ts";
export * as log from "https://deno.land/std@0.204.0/log/mod.ts";
export * as path from "https://deno.land/std@0.204.0/path/mod.ts";
export { ulid } from "https://deno.land/std@0.204.0/ulid/mod.ts";
export { DelimiterStream, TextLineStream } from "https://deno.land/std@0.204.0/streams/mod.ts";

import * as front_matter from "https://deno.land/std@0.204.0/front_matter/mod.ts";
export const extract_frontmatter = front_matter.createExtractor({
    [front_matter.Format.JSON]: JSON.parse as front_matter.Parser,
});

export { Reflect as ReflectMetadata } from "https://deno.land/x/reflect_metadata@v0.1.12/mod.ts";
export { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

export { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
export { type Options as EtaOptions } from "https://deno.land/x/eta@v3.1.0/src/config.ts";
export { resolvePath as resolve_template_path } from "https://deno.land/x/eta@v3.1.0/src/file-handling.ts";

export { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
