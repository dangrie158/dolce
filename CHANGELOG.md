### Changelog

All notable changes to this project will be documented in this file. Dates are displayed in UTC.

#### [v3.4.0](https://github.com/dangrie158/dolce/compare/v3.3.0...v3.4.0)

> 20 March 2025

#### [v3.3.0](https://github.com/dangrie158/dolce/compare/v3.2.0...v3.3.0)

> 23 November 2024

- feat: Switch to alpine distro [`#28`](https://github.com/dangrie158/dolce/pull/28)
- Add support for STARTTLS [`#26`](https://github.com/dangrie158/dolce/pull/26)
- docs: explain usage of `SMTP_USETLS` to use `STARTTLS`
  [`11561b4`](https://github.com/dangrie158/dolce/commit/11561b4fed5d0dc310b1074546fbf391b0553a50)
- Switch to alpine distro
  [`7b5870a`](https://github.com/dangrie158/dolce/commit/7b5870a678a38f518b18ac5f5f499dcd69dd510c)
- Apply method naming convention
  [`68c7450`](https://github.com/dangrie158/dolce/commit/68c7450c178d5fbee1209bcd3d10ece08b95360b)

#### [v3.2.0](https://github.com/dangrie158/dolce/compare/v3.1.0...v3.2.0)

> 5 October 2024

- feat: notifiy about state changes during blackout windows
  [`5832cfe`](https://github.com/dangrie158/dolce/commit/5832cfe9ac492dec731366bd241258c66c547a04)
- docs: better documentation for blackout window feature
  [`5cdfbba`](https://github.com/dangrie158/dolce/commit/5cdfbba7330a20e49b61a13c5e5bc01f3bbde2ed)
- feat: add docs task to deno.jsonc
  [`2ccaac2`](https://github.com/dangrie158/dolce/commit/2ccaac2e125eb63ae59ec7d378f0ed4928575b44)

#### [v3.1.0](https://github.com/dangrie158/dolce/compare/v3.0.2...v3.1.0)

> 4 October 2024

#### [v3.0.2](https://github.com/dangrie158/dolce/compare/v3.0.1...v3.0.2)

> 4 October 2024

- fix: make SMTP_USER and SMTP_PASSWORD optional again
  [`b4b45f0`](https://github.com/dangrie158/dolce/commit/b4b45f088c6ab56d153dd31feb3829cc68a48edd)

#### [v3.0.1](https://github.com/dangrie158/dolce/compare/v3.0.0...v3.0.1)

> 20 September 2024

- fix: use correct event timestamp in ms instead of seconds
  [`08d80ce`](https://github.com/dangrie158/dolce/commit/08d80ced3b28b4b42ced1ee1963b01a0a66161dc)
- docs: fix link to Blackout Times configuration section
  [`6f14894`](https://github.com/dangrie158/dolce/commit/6f1489405ff43525b3896982f9af1569103319fa)

### [v3.0.0](https://github.com/dangrie158/dolce/compare/v2.10.9...v3.0.0)

> 20 September 2024

- feat: implement DOLCE_BLACKOUT_WINDOWS function
  [`763dd33`](https://github.com/dangrie158/dolce/commit/763dd334a1f446e4cb8d6e07374a1f40571aa45f)
- feat: add transformers option to ConfigOption interface
  [`fddbc4c`](https://github.com/dangrie158/dolce/commit/fddbc4c7d4bf778964a8c65dd95884f128d71cb5)
- feat: introduce new DOLCE_RUN_DIRECTORY to make deno event registry path configurable
  [`0f68ce5`](https://github.com/dangrie158/dolce/commit/0f68ce5cbb1f8e846496b2d3658b8a19d82c7e97)

#### [v2.10.9](https://github.com/dangrie158/dolce/compare/v2.10.8...v2.10.9)

> 19 July 2024

- docs: add section for using local datetimes for event dates
  [`8f3693b`](https://github.com/dangrie158/dolce/commit/8f3693b2aeb417a8678da72fb11460632c9a0b2c)
- docs: remove deprecated version attribute from example configs
  [`d87023a`](https://github.com/dangrie158/dolce/commit/d87023a954b1b21281cd70c5b5cb29a1d15b9c00)

#### [v2.10.8](https://github.com/dangrie158/dolce/compare/v2.10.7...v2.10.8)

> 19 July 2024

- fix: use inline styles for mail template to improve mail client compatability
  [`1257a61`](https://github.com/dangrie158/dolce/commit/1257a61b281938d37a4e8f4a988c81a3d6e409eb)
- fix: improve typing for HttpSocket.read_response()
  [`86485c0`](https://github.com/dangrie158/dolce/commit/86485c0afcf8351a32411f6fcb616a13a70e01a3)

#### [v2.10.7](https://github.com/dangrie158/dolce/compare/v2.10.6...v2.10.7)

> 19 April 2024

#### [v2.10.6](https://github.com/dangrie158/dolce/compare/v2.10.5...v2.10.6)

> 19 April 2024

#### [v2.10.5](https://github.com/dangrie158/dolce/compare/v2.10.4...v2.10.5)

> 19 April 2024

#### [v2.10.4](https://github.com/dangrie158/dolce/compare/v2.10.3...v2.10.4)

> 19 April 2024

#### [v2.10.3](https://github.com/dangrie158/dolce/compare/v2.10.2...v2.10.3)

> 19 April 2024

#### [v2.10.2](https://github.com/dangrie158/dolce/compare/v2.10.1...v2.10.2)

> 19 April 2024

- fix: error when automatically generating release notes
  [`a4debc3`](https://github.com/dangrie158/dolce/commit/a4debc318bb570260b96e9f2bad3b46fc64293a3)

#### [v2.10.1](https://github.com/dangrie158/dolce/compare/v2.10.0...v2.10.1)

> 19 April 2024

- fix: don't throw an error when explicitly setting a DOCKER_HOST with DOCKER_TRANSPORT=unix
  [`19a83be`](https://github.com/dangrie158/dolce/commit/19a83bead1bccdb37cb533ed11417536f0b21d5a)

#### [v2.10.0](https://github.com/dangrie158/dolce/compare/v2.9.0...v2.10.0)

> 2 April 2024

- feat: use official denoland images which now support aarch64
  [`bf53424`](https://github.com/dangrie158/dolce/commit/bf5342491533826dd7d9c21ef3d34e53264f4701)
- fix: deprecation warning for not using fine-grained unstable flags
  [`3bde9fa`](https://github.com/dangrie158/dolce/commit/3bde9fa862458c74c43ff4a862778565f1ffb329)

#### [v2.9.0](https://github.com/dangrie158/dolce/compare/v2.8.0...v2.9.0)

> 24 March 2024

- fix: try to reconnect if the eventstream got unexpectedly closed
  [`ee018a3`](https://github.com/dangrie158/dolce/commit/ee018a3d268e5a91841984f1f97e735441a26d08)
- fix: off by one error that causes events to get delivered multiple times
  [`3224e08`](https://github.com/dangrie158/dolce/commit/3224e08cceda26790a0159141f48ed8b94e3a53b)
- fix: print active configuratoin on startup instead of defaults
  [`56e0a01`](https://github.com/dangrie158/dolce/commit/56e0a01b9a84f640a3c5fe2191ec1414be4afb6e)

#### [v2.8.0](https://github.com/dangrie158/dolce/compare/v2.7.0...v2.8.0)

> 29 October 2023

#### [v2.7.0](https://github.com/dangrie158/dolce/compare/v2.6.2...v2.7.0)

> 17 October 2023

- feat: add DOLCE_SUPERVISION_MODE s PREFIXED, NOTPREFIXED and UNTAGGED
  [`ae4973c`](https://github.com/dangrie158/dolce/commit/ae4973c745f6acb93fa0da83ef9b8051cba48c5f)

#### [v2.6.2](https://github.com/dangrie158/dolce/compare/v2.6.1...v2.6.2)

> 12 October 2023

- fix:[templates}: use wrong property name for identifier
  [`2d69d74`](https://github.com/dangrie158/dolce/commit/2d69d74f38c9feee7e24972694f175edd433cb02)

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
