export * as io from "https://deno.land/std@0.202.0/io/mod.ts";
export * as log from "https://deno.land/std@0.202.0/log/mod.ts";
export * as path from "https://deno.land/std@0.202.0/path/mod.ts";

import * as front_matter from "https://deno.land/std@0.202.0/front_matter/mod.ts";
export const extract_frontmatter = front_matter.createExtractor({
    [front_matter.Format.JSON]: JSON.parse as front_matter.Parser,
});

export { DelimiterStream, TextLineStream } from "https://deno.land/std@0.202.0/streams/mod.ts";
export { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
export { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
export { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
