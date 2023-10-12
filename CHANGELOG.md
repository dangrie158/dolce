### Changelog

All notable changes to this project will be documented in this file. Dates are displayed in UTC.

#### [v2.6.1](https://github.com/dangrie158/dolce/compare/v2.6.0...v2.6.1)

> 12 October 2023

#### [v2.6.0](https://github.com/dangrie158/dolce/compare/v2.5.3...v2.6.0)

> 12 October 2023

- feat[notifier]: added DOLCE_ACTOR_IDENTIFIER and DOLCE_IDENTIFIER_LABEL options
  [`06a9fc0`](https://github.com/dangrie158/dolce/commit/06a9fc00f6ca20ed0e005d2b674aae6fb889ab8a)
- meta: fix automatic version deployment after version bump
  [`bdd922a`](https://github.com/dangrie158/dolce/commit/bdd922ac97da7829fd315466f77dd279bba58e60)

#### [v2.5.3](https://github.com/dangrie158/dolce/compare/v2.5.2...v2.5.3)

> 9 October 2023

- docs: add links to badges in readme and documentation landingpage
  [`713b8f4`](https://github.com/dangrie158/dolce/commit/713b8f4c3a11cdcd6b37763bc409dbd9313583a0)
- meta: automatically create releases on version bump
  [`c609bdf`](https://github.com/dangrie158/dolce/commit/c609bdf3814420c4c198b80a7d4c27a26ed69654)

#### [v2.5.2](https://github.com/dangrie158/dolce/compare/v2.5.1...v2.5.2)

> 8 October 2023

- meta: add auto-generated changelog to bump-version command
  [`e2f0e46`](https://github.com/dangrie158/dolce/commit/e2f0e4652d9aa213debb389859d6ad0d9fd05c77)
- meta: checkout whole git history to create complete changelog
  [`8e50e70`](https://github.com/dangrie158/dolce/commit/8e50e70bde798c3fc7b04dd4115d0fe85035a136)
- docker: remove ts files from template directory in docker allow list
  [`6d7f31b`](https://github.com/dangrie158/dolce/commit/6d7f31bf67ce655407481f39ec1b07dc088a4d58)

#### [v2.5.1](https://github.com/dangrie158/dolce/compare/v2.5.0...v2.5.1)

> 8 October 2023

- docs: fix issue #12 Wrong variable name references DOLCE_CUSTOM_TEPLATE_PATH
  [`1541b98`](https://github.com/dangrie158/dolce/commit/1541b9838ec68ebd592c24eb2769b686af3adbd3)
- docs: consistent formatting
  [`05ae48f`](https://github.com/dangrie158/dolce/commit/05ae48fab0a3ec039fb105b293f3cae09aca816d)

#### [v2.5.0](https://github.com/dangrie158/dolce/compare/v2.4.2...v2.5.0)

> 8 October 2023

- templates: move common functions inside module
  [`ac00de6`](https://github.com/dangrie158/dolce/commit/ac00de646ffe0a37888b96f15fb33fc2d295bbd0)
- docs: add documentation for custom templates
  [`b07461f`](https://github.com/dangrie158/dolce/commit/b07461fc090890eea3c2edf551b90be670c55ec1)
- tests: add tests for AppriseTemplate
  [`584de03`](https://github.com/dangrie158/dolce/commit/584de03b97f1c8ddeb0bbd0a4c9205f02d90d6b3)

#### [v2.4.2](https://github.com/dangrie158/dolce/compare/v2.4.1...v2.4.2)

> 7 October 2023

- docker: remove explicit override of tini entrypoint and use the parent instead
  [`011e5ae`](https://github.com/dangrie158/dolce/commit/011e5aef33c2a7138de8f9e049fa7941021696cd)

#### [v2.4.1](https://github.com/dangrie158/dolce/compare/v2.4.0...v2.4.1)

> 7 October 2023

- docker: remove explicit override of tini entrypoint and use the parent instead
  [`cb70b89`](https://github.com/dangrie158/dolce/commit/cb70b89c44bb928263072dd6b1e81e8350442b60)

#### [v2.4.0](https://github.com/dangrie158/dolce/compare/v2.3.0...v2.4.0)

> 6 October 2023

- docker: install dockerfile with install script from LukeChannings/deno-arm64 to support arm64 images
  [`b00d3af`](https://github.com/dangrie158/dolce/commit/b00d3affa799401869827fc46abdd6d08c96a8b7)
- meta: add automatic builds for arm64 platform
  [`5088473`](https://github.com/dangrie158/dolce/commit/5088473e442b8f6c800ed3739e74931c14f087aa)

#### [v2.3.0](https://github.com/dangrie158/dolce/compare/v2.2.0...v2.3.0)

> 4 October 2023

- docs: move information from readme to documentation
  [`9247902`](https://github.com/dangrie158/dolce/commit/9247902af3ab43625c478770fa89107a895121c3)
- lib/env: add global configuration via class based object
  [`1e78aae`](https://github.com/dangrie158/dolce/commit/1e78aaec265dc8d5216b5836423dc6a8af5a282d)
- notifiers: move to new configuration based creation
  [`1db78c8`](https://github.com/dangrie158/dolce/commit/1db78c817fcaee564efa9b30e7142621bba0d496)

#### [v2.2.0](https://github.com/dangrie158/dolce/compare/v2.1.1...v2.2.0)

> 30 September 2023

- main: add option to use tcp sockets to connect to docker service
  [`8ee602d`](https://github.com/dangrie158/dolce/commit/8ee602d62ee2a2d72cd18bc522006473f79ee1b1)
- templates: refactor template base class for easier use and less code duplication
  [`7e5d804`](https://github.com/dangrie158/dolce/commit/7e5d804b4a495f9f4eda68c658e3e537fa2189d7)
- tests: add tests for templates module
  [`5077151`](https://github.com/dangrie158/dolce/commit/5077151952d91f2e156e3ecf704f519e188ed4ff)

#### [v2.1.1](https://github.com/dangrie158/dolce/compare/v2.1.0...v2.1.1)

> 29 September 2023

- docker-api: update to v1.27 to add health status notifications
  [`f56d021`](https://github.com/dangrie158/dolce/commit/f56d021c6709146aa3073d3684cbf874052f7f15)

#### [v2.1.0](https://github.com/dangrie158/dolce/compare/v2.0.0...v2.1.0)

> 29 September 2023

- readme: add better documentation for smtp and telegram configuration parameters
  [`d7a53ce`](https://github.com/dangrie158/dolce/commit/d7a53ce5f157615584a475b47718c5a57b8dc6c4)
- notifiers: ensure emails are sent on new connections for each mail. this works around an error in the SMTP client lib
  [`40cdc48`](https://github.com/dangrie158/dolce/commit/40cdc48d3bde44b90d9e30c9bc328a5aae58059c)
- templates: use png version of logo in email template
  [`e570014`](https://github.com/dangrie158/dolce/commit/e570014928aa2dd95b7b4444522df491daf33f1a)

### [v2.0.0](https://github.com/dangrie158/dolce/compare/v1.0.0...v2.0.0)

> 29 September 2023

- meta: run deno fmt [`08b973c`](https://github.com/dangrie158/dolce/commit/08b973cc15bde04d8522614146f9db4302cb91b7)
- BREAKING main: use Deno.Kv and Deno Queue for delivery scheduling
  [`4ddde0b`](https://github.com/dangrie158/dolce/commit/4ddde0bb280005a2321c67e79261716aef39390a)
- assets: improve lines of logo
  [`9d8bb69`](https://github.com/dangrie158/dolce/commit/9d8bb69b991453b3f07acfc3f877ddc8d0859b12)

#### v1.0.0

> 26 September 2023

- meta: updated asset paths and added compact logo version
  [`5fce222`](https://github.com/dangrie158/dolce/commit/5fce2229c298e917dd6219651b5ca347defc1bff)
- meta: fix clipped shadows in logos
  [`3d90d79`](https://github.com/dangrie158/dolce/commit/3d90d79ff664bbb5ca44e7f57e07238dbf6fb76e)
- initial commit [`22e3532`](https://github.com/dangrie158/dolce/commit/22e35324e0556d36bf066b166285eabfc8a7f4bd)
