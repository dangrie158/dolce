---
title: Custom Templates
icon: material/email-edit
---

# Use Custom Notification Templates

As with every other aspect, Dolce comes with great default templates that are tailored specifically for each notifier.
If you however want to customize the look or contents of the default, Dolce provides you with an easy way to override
the templates that are used to generate the notifications.

## Overriding a Template

When rendering a message, Dolce first checks if the template file exists inside `DOLCE_CUSTOM_TEMPLATE_PATH`. Only if
this lookup fails the default template gets used, so to override the template for one or more notifier, create the
following file:

```
./templates/<notifier>/<eventtype>.eta
```

where

- `<notifier>` is one of the built-in notifiers (`smtp` | `discord` | `telegram` | `apprise`) and
- `<eventtype>` is either `event` | `reboot`

depending on which notification you want to customise. The mount this folder to where `DOLCE_CUSTOM_TEMPLATE_PATH`
points (by default this will be `/var/dolce-custom-templates/`):

```yaml title="docker-compose.yml"
services:
  dolce:
    image: dangrie158/dolce:v3.0.2
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./templates:/var/dolce-custom-templates # (1)!
    environment:
      ...
```

1. change the target path if you set `DOLCE_CUSTOM_TEMPLATE_PATH` to any other value.

## Designing the Templates

As you can probably guess from the file extension, Dolce uses [Eta](https://eta.js.org) as a templating engine to render
the notification bodies so you can leverage the full power of JavaScript to generate the massge of you so choose.

Additionally some notifiers use the templates [frontmatter](https://deno.land/std/front_matter/mod.ts) in JSON format to
specify additional attributes (e.g. EMail subject for SMTP notifier).

It is probably a good idea to to look at the
[default templates](https://github.com/dangrie158/dolce/tree/master/templates) to get a starting point and work from
there.

### Template Context

Each template has access to a context object `it` that is populated with information that can be used inside the
template.

Every template context contains the following global properties:

| Name               | Type                                                   | Description                               |
| ------------------ | ------------------------------------------------------ | ----------------------------------------- |
| `hostname`         | `string`                                               | Hostname of the machine running Dolce     |
| `newest_first`     | `(DockerContainerEvent, DockerContainerEvent): number` | See [`newest_first`](#newest_first)       |
| `get_event_class`  | `(DockerContainerEvent): string`                       | See [get_event_class](#get_event_class)   |
| `get_event_symbol` | `(DockerContainerEvent): string`                       | See [get_event_symbol](#get_event_symbol) |

For `event` templates the context additionally contains the following properties:

| Name                   | Type                         | Description                                 |
| ---------------------- | ---------------------------- | ------------------------------------------- |
| `events`               | `DockerContainerEvent[]`[^1] | Events since the last notification          |
| `earliest_next_update` | `Date`                       | Timestamp of the earliest next notification |

For `restart` templates the context additionally contains the following properties:

| Name                    | Type                         | Description                                          |
| ----------------------- | ---------------------------- | ---------------------------------------------------- |
| `events_since_shutdown` | `DockerContainerEvent[]`[^1] | Events that happened while Dolce was not running     |
| `downtime_start`        | `Date`                       | Latest known timestamp where Dolce was still running |
| `downtime_end`          | `Date`                       | Timestamp at which Dolce started again               |

[^1]: [`DockerContainerEvent`](https://github.com/dangrie158/dolce/blob/master/lib/event_registry.ts#L4) and
    [`DockerApiContainerEvent`](https://github.com/dangrie158/dolce/blob/master/lib/docker-api.ts#L86)

### Helper Functions

#### `newest_first`

This function takes two event arguments and returns the chronological order of the events so that newer events will be
sorted first. This function is compatible with JavaScripts `Array.sort` and `Array.toSorted` which makes it perfect to
iterate over a sorted array of events like this:

```js
<% it.events.toSorted(it.newest_first).forEach(event => { %>
    <%= new Date(event.time * 1000).toLocaleString() %>: <%= event.Action %> <%= event.actor_name %>
<% }); %>
```

#### `get_event_class`

This function takes an event and returns one of `success` | `warning` | `error` depending on the event action. This is
used to color the events in the default templates and can thus be used is custom templates to keep the same
categorization that is used in the default templates:

| `event.Action`  | Class     |
| --------------- | --------- |
| `start`         | `success` |
| `die`           | `error`   |
| `kill`          | `error`   |
| `oom`           | `error`   |
| `stop`          | `warning` |
| `pause`         | `warning` |
| `unpause`       | `success` |
| `health_status` | `warning` |

Example usage:

```html
<span class="<%= it.get_event_class(event) %>"><%= event.Action %></span>
```

#### `get_event_symbol`

This function takes an event an returns a single UTF-8 glyph that can be used to represent the event based on the event
action:

| `event.Action`  | Symbol |
| --------------- | ------ |
| `start`         | ✅     |
| `die`           | ❌     |
| `kill`          | ❌     |
| `oom`           | ❌     |
| `stop`          | ⏹️     |
| `pause`         | ⏸️     |
| `unpause`       | ⏯️     |
| `health_status` | ❓     |

Example usage:

```js
<%= event.actor_name %>: <%= it.get_event_symbol(event) %><%= event.Action %>
```
