import {
    AppriseTemplate,
    DiscordTemplate,
    EMailTemplate,
    RestartMessageContext,
    SimpleTemplate,
    TelegramTemplate,
} from "../lib/templates.ts";
import { assert, assertStrictEquals, assertThrows } from "https://deno.land/std@0.203.0/assert/mod.ts";
import { path } from "../deps.ts";

const dummy_render_context: RestartMessageContext = {
    downtime_start: new Date(),
    downtime_end: new Date(),
    events_since_shutdown: [],
    hostname: "",
};

const this_dir = path.dirname(path.fromFileUrl(import.meta.url));

Deno.test("SimpleTemplate", async (test) => {
    const template = new SimpleTemplate("restart.eta");

    await test.step("`SimpleTemplate` resolves path", () => {
        const relative_path = path.relative(this_dir, template.path);
        assertStrictEquals(relative_path, "../templates/simple/restart.eta");
    });

    await test.step("`SimpleTemplate` throws if accessing `text` before a render call", () => {
        assertThrows(() => template.text);
    });

    await test.step("`SimpleTemplate.text` returns a string after rendering", async () => {
        await template.render(dummy_render_context);
        assertStrictEquals(typeof template.text, "string");
    });
});

Deno.test("EMailTemplate", async (test) => {
    const template = new EMailTemplate("restart.eta");
    await template.render(dummy_render_context);

    await test.step("`EMailTemplate` resolves to correct path", () => {
        const relative_path = path.relative(this_dir, template.path);
        assertStrictEquals(relative_path, "../templates/email/restart.eta");
    });

    await test.step("`EMailTemplate.text` returns a string after rendering", () => {
        assertStrictEquals(typeof template.text, "string");
    });

    await test.step("`EMailTemplate.html` returns a string after rendering", () => {
        assertStrictEquals(typeof template.html, "string");
    });

    await test.step("`EMailTemplate.html` contains at least as many characters as `EMailTemplate.text`", () => {
        assert(template.text.length <= template.html.length);
    });

    await test.step("`EMailTemplate.subject` contains a string", () => {
        assertStrictEquals(typeof template.subject, "string");
    });
});

Deno.test("DiscordTemplate", async (test) => {
    const template = new DiscordTemplate("restart.eta");
    await template.render(dummy_render_context);

    await test.step("`DiscordTemplate` resolves to correct path", () => {
        const relative_path = path.relative(this_dir, template.path);
        assertStrictEquals(relative_path, "../templates/discord/restart.eta");
    });

    await test.step("`DiscordTemplate.text` returns a string after rendering", () => {
        assertStrictEquals(typeof template.text, "string");
    });
});

Deno.test("TelegramTemplate", async (test) => {
    const template = new TelegramTemplate("restart.eta");
    await template.render(dummy_render_context);

    await test.step("`TelegramTemplate` resolves to correct path", () => {
        const relative_path = path.relative(this_dir, template.path);
        assertStrictEquals(relative_path, "../templates/telegram/restart.eta");
    });

    await test.step("`TelegramTemplate.text` returns a string after rendering", () => {
        assertStrictEquals(typeof template.text, "string");
    });
});

Deno.test("AppriseTemplate", async (test) => {
    const template = new AppriseTemplate("restart.eta");
    await template.render(dummy_render_context);

    await test.step("`AppriseTemplate` resolves to correct path", () => {
        const relative_path = path.relative(this_dir, template.path);
        assertStrictEquals(relative_path, "../templates/apprise/restart.eta");
    });

    await test.step("`AppriseTemplate.text` returns a string after rendering", () => {
        assertStrictEquals(typeof template.text, "string");
    });

    await test.step("`AppriseTemplate.title` returns a string after rendering", () => {
        assertStrictEquals(typeof template.title, "string");
    });

    await test.step("`AppriseTemplate.format` returns a string after rendering", () => {
        assertStrictEquals(typeof template.format, "string");
    });
});
