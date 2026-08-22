# Newspaper DKIM public keys

Generated 2026-08-22 by `app/scripts/discover-dkim.mjs` from the
[ZK Email DKIM archive](https://archive.prove.email) (keys observed in real email) plus
live-DNS re-verification and ESP-selector brute-forcing. **564 RSA keys across
97/109 outlets have a key that is live in DNS right now** (562 live keys).

- **live** = the selector currently resolves in DNS with this exact key → the outlet can
  sign email with it today; these are registered in the Gnosis + Sepolia DKIMRegistry
  by `register-dkim-keys.mjs` (permissionless, write-once per modulus).
- **archived** = seen historically by the archive but no longer in DNS (rotated out). Not
  registered; listed so pre-rotation emails can be supported once the registry gains
  validity windows (backlog A2).
- Source `dns-brute` = found by selector brute-force only (never seen by the archive).

Registry-ready data (modulus/exponent hex): `docs/dkim-keys-public.json`.

| Outlet | Region | Domain | Selector | Bits | Status | First seen | Last seen | Source |
|---|---|---|---|---|---|---|---|---|
| ABC Australia | AU | `abc.net.au` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| ABC Australia | AU | `abc.net.au` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| Addis Standard | ET | `addisstandard.com` | `default` | 2048 | **live** | — | — | dns-brute |
| AFP | wire | `afp.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| Al Jazeera | QA | `mailer.aljazeera.net` | `k2` | 2048 | **live** | — | — | dns-brute |
| Al Jazeera | QA | `mailer.aljazeera.net` | `k3` | 2048 | **live** | — | — | dns-brute |
| Al Jazeera | QA | `mailer.aljazeera.net` | `mail` | 1024 | **live** | — | — | dns-brute |
| Arab News | SA | `arabnews.com` | `pic` | 1024 | **live** | — | — | dns-brute |
| Arab News | SA | `arabnews.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| Associated Press | wire | `ap.org` | `200608` | 1024 | **live** | — | — | dns-brute |
| Associated Press | wire | `ap.org` | `s1` | 2048 | **live** | — | — | dns-brute |
| Associated Press | wire | `ap.org` | `s2` | 2048 | **live** | — | — | dns-brute |
| Associated Press | wire | `ap.org` | `selector1` | 1024 | **live** | — | — | dns-brute |
| Associated Press | wire | `apnews.com` | `sailthru` | 1024 | **live** | 2024-04-09 | 2026-05-05 | archive |
| Associated Press | wire | `apnews.com` | `selector1` | 1024 | **live** | 2024-04-09 | 2026-05-06 | archive |
| Associated Press | wire | `apnews.com` | `selector2` | 1024 | **live** | 2024-04-09 | 2026-05-06 | archive |
| Axios | US | `axios.com` | `google` | 1024 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `mx` | 1024 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| Axios | US | `axios.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| Axios | US | `email.axios.com` | `sailthru` | 2048 | **live** | — | — | dns-brute |
| Axios | US | `email.axios.com` | `scph0222` | 1024 | **live** | — | — | dns-brute |
| BBC | UK | `bbc.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| BBC | UK | `email.bbc.co.uk` | `s1` | 2048 | **live** | — | — | dns-brute |
| BBC | UK | `email.bbc.co.uk` | `s2` | 2048 | **live** | — | — | dns-brute |
| BBC | UK | `email.bbc.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| CBC | CA | `cbc.ca` | `google` | 1024 | **live** | — | — | dns-brute |
| CBC | CA | `cbc.ca` | `k2` | 2048 | **live** | 2024-04-09 | 2026-04-28 | archive |
| CBC | CA | `cbc.ca` | `k3` | 2048 | **live** | 2024-04-09 | 2024-04-11 | archive+dns(rekeyed) |
| CBC | CA | `cbc.ca` | `s1` | 2048 | **live** | 2024-04-09 | 2026-05-09 | archive |
| CBC | CA | `cbc.ca` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-09 | archive |
| CBC | CA | `cbc.ca` | `s3` | 2048 | **live** | — | — | dns-brute |
| CBS News | US | `cbsnews.com` | `google` | 2048 | **live** | — | — | dns-brute |
| CBS News | US | `cbsnews.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| CBS News | US | `email.cbsnews.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| Chicago Tribune | US | `chicagotribune.com` | `google` | 1024 | **live** | — | — | dns-brute |
| Chicago Tribune | US | `chicagotribune.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Chicago Tribune | US | `chicagotribune.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Chicago Tribune | US | `chicagotribune.com` | `selector2` | 1024 | **live** | — | — | dns-brute |
| Chicago Tribune | US | `email.chicagotribune.com` | `key1` | 1024 | **live** | — | — | dns-brute |
| Clarín | AR | `clarin.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Clarín | AR | `clarin.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| Clarín | AR | `clarin.com` | `selector1` | 1024 | **live** | — | — | dns-brute |
| Clarín | AR | `clarin.com` | `selector2` | 1024 | **live** | — | — | dns-brute |
| CNBC | US | `cnbc.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| CNBC | US | `cnbc.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| CNBC | US | `cnbc.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| CNBC | US | `cnbc.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| CNN | US | `alert.cnn.com` | `scph0326` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `cm` | 1024 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `cnn.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| CNN | US | `email.cnn.com` | `scph0326` | 2048 | **live** | — | — | dns-brute |
| Corriere della Sera | IT | `corriere.it` | `selector1` | 1024 | **live** | — | — | dns-brute |
| Daily Maverick | ZA | `dailymaverick.co.za` | `cm` | 1024 | **live** | — | — | dns-brute |
| Daily Maverick | ZA | `dailymaverick.co.za` | `google` | 2048 | **live** | — | — | dns-brute |
| Daily Maverick | ZA | `dailymaverick.co.za` | `s1` | 2048 | **live** | — | — | dns-brute |
| Daily Maverick | ZA | `dailymaverick.co.za` | `s2` | 1024 | **live** | — | — | dns-brute |
| Daily Maverick | ZA | `dailymaverick.co.za` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nation.africa` | `k2` | 2048 | **live** | 2024-04-09 | 2026-05-28 | archive |
| Daily Nation | KE | `nation.africa` | `k3` | 2048 | **live** | 2024-04-09 | 2024-04-14 | archive+dns(rekeyed) |
| Daily Nation | KE | `nation.africa` | `mte1` | 2048 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nation.africa` | `mte2` | 2048 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nation.africa` | `s1` | 2048 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nation.africa` | `s2` | 2048 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nationmedia.com` | `mte1` | 2048 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nationmedia.com` | `mte2` | 2048 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nationmedia.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Daily Nation | KE | `nationmedia.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Dawn | PK | `dawn.com` | `s1` | 1024 | **live** | 2024-04-09 | 2026-05-27 | archive |
| Dawn | PK | `dawn.com` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-27 | archive |
| De Volkskrant | NL | `email.volkskrant.nl` | `fm1` | 2048 | **live** | — | — | dns-brute |
| De Volkskrant | NL | `email.volkskrant.nl` | `fm2` | 2048 | **live** | — | — | dns-brute |
| De Volkskrant | NL | `email.volkskrant.nl` | `pic` | 1024 | **live** | — | — | dns-brute |
| De Volkskrant | NL | `volkskrant.nl` | `fm1` | 2048 | **live** | — | — | dns-brute |
| De Volkskrant | NL | `volkskrant.nl` | `fm2` | 2048 | **live** | — | — | dns-brute |
| De Volkskrant | NL | `volkskrant.nl` | `google` | 1024 | **live** | — | — | dns-brute |
| De Volkskrant | NL | `volkskrant.nl` | `mailjet` | 1024 | **live** | — | — | dns-brute |
| Democracy Now | US | `democracynow.org` | `k2` | 2048 | **live** | 2024-04-09 | 2026-05-27 | archive |
| Democracy Now | US | `democracynow.org` | `k3` | 2048 | **live** | 2024-04-09 | 2024-04-13 | archive+dns(rekeyed) |
| Democracy Now | US | `democracynow.org` | `mail` | 1024 | **live** | 2024-04-09 | 2026-05-27 | archive |
| Der Spiegel | DE | `spiegel.de` | `selector1` | 1024 | **live** | 2024-04-09 | 2026-04-28 | archive |
| Der Spiegel | DE | `spiegel.de` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| Der Spiegel | DE | `spiegel.de` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| Deutsche Welle | DE | `dw.com` | `selector1` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| Deutsche Welle | DE | `newsletter.dw.com` | `default` | 1024 | **live** | — | — | dns-brute |
| Die Zeit | DE | `zeit.de` | `mailjet` | 1024 | **live** | — | — | dns-brute |
| Die Zeit | DE | `zeit.de` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| Die Zeit | DE | `zeit.de` | `s1` | 2048 | **live** | — | — | dns-brute |
| Die Zeit | DE | `zeit.de` | `s2` | 1024 | **live** | — | — | dns-brute |
| Die Zeit | DE | `zeit.de` | `selector1` | 1024 | **live** | — | — | dns-brute |
| Die Zeit | DE | `zeit.de` | `selector2` | 1024 | **live** | — | — | dns-brute |
| Die Zeit | DE | `zeit.de` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| El Mundo | ES | `elmundo.es` | `selector1` | 1024 | **live** | — | — | dns-brute |
| El Mundo | ES | `elmundo.es` | `selector2` | 1024 | **live** | — | — | dns-brute |
| El Mundo | ES | `info.elmundo.es` | `selector1` | 2048 | **live** | — | — | dns-brute |
| El Mundo | ES | `info.elmundo.es` | `selector2` | 2048 | **live** | — | — | dns-brute |
| El País | ES | `elpais.com` | `selector1` | 1024 | **live** | — | — | dns-brute |
| El Tiempo | CO | `eltiempo.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| El Tiempo | CO | `eltiempo.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| El Tiempo | CO | `eltiempo.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| El Tiempo | CO | `eltiempo.com` | `selector2` | 1024 | **live** | — | — | dns-brute |
| Estadão | BR | `email.estadao.com.br` | `mail` | 1024 | **live** | — | — | dns-brute |
| Estadão | BR | `estadao.com.br` | `acdkim1` | 2048 | **live** | 2024-04-09 | 2026-05-27 | archive |
| Estadão | BR | `estadao.com.br` | `default` | 1024 | **live** | 2024-04-09 | 2026-05-27 | archive |
| Estadão | BR | `estadao.com.br` | `m1` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| Estadão | BR | `estadao.com.br` | `mail` | 1024 | **live** | 2024-04-09 | 2026-05-27 | archive+dns(rekeyed) |
| Estadão | BR | `estadao.com.br` | `s1` | 2048 | **live** | 2024-04-09 | 2026-05-27 | archive |
| Estadão | BR | `estadao.com.br` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-27 | archive |
| Euronews | EU | `euronews.com` | `dk` | 1024 | **live** | — | — | dns-brute |
| Euronews | EU | `euronews.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| Euronews | EU | `euronews.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| Euronews | EU | `euronews.com` | `selector1` | 1024 | **live** | — | — | dns-brute |
| Euronews | EU | `euronews.com` | `selector2` | 2048 | **live** | — | — | dns-brute |
| FAZ | DE | `nl.faz.net` | `200608` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `google` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `mte1` | 2048 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `mte2` | 2048 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `mx` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `s1` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `ft.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `newsletters.ft.com` | `email` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `newsletters.ft.com` | `scph` | 1024 | **live** | — | — | dns-brute |
| Financial Times | UK | `send.ft.com` | `email` | 2048 | **live** | — | — | dns-brute |
| Financial Times | UK | `send.ft.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Folha de S.Paulo | BR | `folha.com.br` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| Folha de S.Paulo | BR | `uol.com.br` | `s1` | 2048 | **live** | — | — | dns-brute |
| Folha de S.Paulo | BR | `uol.com.br` | `s2` | 1024 | **live** | — | — | dns-brute |
| Fox News | US | `foxnews.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| Fox News | US | `foxnews.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| Fox News | US | `foxnews.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| Gulf News | AE | `em.gulfnews.com` | `scph0526` | 2048 | **live** | — | — | dns-brute |
| Gulf News | AE | `gulfnews.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| Gulf News | AE | `gulfnews.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Gulf News | AE | `gulfnews.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| Haaretz | IL | `haaretz.com` | `mte1` | 2048 | **live** | — | — | dns-brute |
| Haaretz | IL | `haaretz.com` | `mte2` | 2048 | **live** | — | — | dns-brute |
| Hindustan Times | IN | `hindustantimes.com` | `google` | 1024 | **live** | — | — | dns-brute |
| Hindustan Times | IN | `hindustantimes.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| Hindustan Times | IN | `hindustantimes.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Hindustan Times | IN | `hindustantimes.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| Hindustan Times | IN | `hindustantimes.com` | `selector1` | 1024 | **live** | — | — | dns-brute |
| Hindustan Times | IN | `hindustantimes.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| In These Times | US | `inthesetimes.com` | `google` | 2048 | **live** | — | — | dns-brute |
| In These Times | US | `inthesetimes.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| In These Times | US | `inthesetimes.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Kyiv Independent | UA | `kyivindependent.com` | `google` | 2048 | **live** | — | — | dns-brute |
| Kyiv Independent | UA | `kyivindependent.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| Kyiv Independent | UA | `kyivindependent.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| La Nación | AR | `lanacion.com.ar` | `mandrill` | 1024 | **live** | 2024-04-09 | 2026-05-26 | archive |
| La Nación | AR | `lanacion.com.ar` | `s1` | 2048 | **live** | 2024-04-09 | 2026-05-26 | archive |
| La Nación | AR | `lanacion.com.ar` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-26 | archive |
| La Nación | AR | `lanacion.com.ar` | `selector1` | 1024 | **live** | 2024-04-09 | 2026-05-26 | archive |
| La Repubblica | IT | `repubblica.it` | `selector1` | 2048 | **live** | — | — | dns-brute |
| La Tercera | CL | `latercera.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| La Tercera | CL | `latercera.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| La Tercera | CL | `latercera.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| La Tercera | CL | `latercera.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| La Tercera | CL | `latercera.com` | `selector2` | 2048 | **live** | — | — | dns-brute |
| Le Figaro | FR | `lefigaro.fr` | `m1` | 2048 | **live** | 2024-04-09 | 2026-05-25 | archive |
| Le Figaro | FR | `lefigaro.fr` | `m2` | 2048 | **live** | 2024-04-09 | 2026-05-13 | archive |
| Le Figaro | FR | `lefigaro.fr` | `mandrill` | 1024 | **live** | 2024-04-09 | 2026-05-21 | archive |
| Le Figaro | FR | `lefigaro.fr` | `s1` | 2048 | **live** | 2024-04-09 | 2026-05-23 | archive |
| Le Figaro | FR | `lefigaro.fr` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-23 | archive |
| Le Figaro | FR | `lefigaro.fr` | `selector1` | 2048 | **live** | 2024-04-09 | 2026-05-23 | archive |
| Le Monde | FR | `lemonde.fr` | `google` | 1024 | **live** | — | — | dns-brute |
| Le Monde | FR | `lemonde.fr` | `k1` | 1024 | **live** | — | — | dns-brute |
| Le Monde | FR | `lemonde.fr` | `mail` | 1024 | **live** | — | — | dns-brute |
| Le Monde | FR | `lemonde.fr` | `mailjet` | 1024 | **live** | — | — | dns-brute |
| Le Monde | FR | `lemonde.fr` | `mte1` | 2048 | **live** | — | — | dns-brute |
| Le Monde | FR | `lemonde.fr` | `mte2` | 2048 | **live** | — | — | dns-brute |
| Le Monde | FR | `lemonde.fr` | `s1` | 2048 | **live** | — | — | dns-brute |
| Le Monde | FR | `lemonde.fr` | `s2` | 1024 | **live** | — | — | dns-brute |
| Libération | FR | `liberation.fr` | `mailjet` | 1024 | **live** | — | — | dns-brute |
| Libération | FR | `liberation.fr` | `selector2` | 1024 | **live** | — | — | dns-brute |
| Libération | FR | `newsletter.liberation.fr` | `default` | 1024 | **live** | — | — | dns-brute |
| Los Angeles Times | US | `latimes.com` | `1522905413783` | 1024 | **live** | 2024-04-09 | 2026-06-19 | archive |
| Los Angeles Times | US | `latimes.com` | `google` | 2048 | **live** | 2024-04-09 | 2026-04-09 | archive |
| Los Angeles Times | US | `latimes.com` | `k1` | 1024 | **live** | 2024-04-09 | 2026-04-09 | archive |
| Los Angeles Times | US | `latimes.com` | `m1` | 1024 | **live** | 2024-04-09 | 2026-05-25 | archive |
| Los Angeles Times | US | `latimes.com` | `s1` | 2048 | **live** | 2024-04-09 | 2026-04-13 | archive |
| Los Angeles Times | US | `latimes.com` | `s2` | 1024 | **live** | 2024-04-09 | 2026-04-13 | archive |
| Los Angeles Times | US | `latimes.com` | `sailthru` | 1024 | **live** | 2024-04-09 | 2026-04-13 | archive |
| Los Angeles Times | US | `latimes.com` | `selector1` | 2048 | **live** | 2024-04-09 | 2026-04-14 | archive |
| Los Angeles Times | US | `mail.latimes.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| Los Angeles Times | US | `news.latimes.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| Los Angeles Times | US | `nl.latimes.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| Mail & Guardian | ZA | `mg.co.za` | `google` | 2048 | **live** | — | — | dns-brute |
| Mail & Guardian | ZA | `mg.co.za` | `k1` | 1024 | **live** | — | — | dns-brute |
| Mail & Guardian | ZA | `mg.co.za` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| Mail & Guardian | ZA | `mg.co.za` | `s1` | 2048 | **live** | — | — | dns-brute |
| Mail & Guardian | ZA | `mg.co.za` | `s2` | 1024 | **live** | — | — | dns-brute |
| Meduza | RU/LV | `meduza.io` | `google` | 2048 | **live** | — | — | dns-brute |
| Meduza | RU/LV | `meduza.io` | `k2` | 2048 | **live** | — | — | dns-brute |
| Meduza | RU/LV | `meduza.io` | `k3` | 2048 | **live** | — | — | dns-brute |
| Mother Jones | US | `motherjones.com` | `default` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| Mother Jones | US | `motherjones.com` | `google` | 2048 | **live** | — | — | dns-brute |
| Mother Jones | US | `motherjones.com` | `k2` | 2048 | **live** | 2024-04-09 | 2026-05-24 | archive |
| Mother Jones | US | `motherjones.com` | `k3` | 2048 | **live** | 2024-04-09 | 2024-04-12 | archive+dns(rekeyed) |
| Mother Jones | US | `motherjones.com` | `sailthru` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| Mother Jones | US | `motherjones.com` | `smtp` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| NBC News | US | `mail.nbcnews.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| NBC News | US | `mail.nbcnews.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| NBC News | US | `nbcnews.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| NBC News | US | `nbcnews.com` | `pic` | 1024 | **live** | — | — | dns-brute |
| NBC News | US | `nbcnews.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| NDTV | IN | `ndtv.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| NDTV | IN | `ndtv.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| NDTV | IN | `ndtv.com` | `selector2` | 2048 | **live** | — | — | dns-brute |
| News24 | ZA | `news24.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| News24 | ZA | `news24.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| News24 | ZA | `news24.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| News24 | ZA | `news24.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| Newsweek | US | `email.newsweek.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| Newsweek | US | `newsweek.com` | `google` | 2048 | **live** | — | — | dns-brute |
| Newsweek | US | `newsweek.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Newsweek | US | `newsweek.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| Newsweek | US | `newsweek.com` | `selector1` | 1024 | **live** | — | — | dns-brute |
| Newsweek | US | `newsweek.com` | `selector2` | 1024 | **live** | — | — | dns-brute |
| Nikkei Asia | JP | `nikkei.com` | `s1` | 2048 | **live** | 2024-04-09 | 2026-05-24 | archive |
| Nikkei Asia | JP | `nikkei.com` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| NPR | US | `e.npr.org` | `200608` | 1024 | **live** | — | — | dns-brute |
| NPR | US | `nl.npr.org` | `200608` | 1024 | **live** | — | — | dns-brute |
| NPR | US | `npr.org` | `200608` | 1024 | **live** | 2024-04-09 | 2026-06-17 | archive |
| NPR | US | `npr.org` | `k2` | 2048 | **live** | 2024-04-09 | 2026-06-18 | archive |
| NPR | US | `npr.org` | `k3` | 2048 | **live** | 2024-04-09 | 2024-05-01 | archive+dns(rekeyed) |
| NPR | US | `npr.org` | `mandrill` | 1024 | **live** | 2024-04-09 | 2026-06-20 | archive |
| NPR | US | `npr.org` | `s1` | 2048 | **live** | — | — | dns-brute |
| NPR | US | `npr.org` | `s2` | 2048 | **live** | — | — | dns-brute |
| NPR | US | `npr.org` | `s3` | 2048 | **live** | — | — | dns-brute |
| NPR | US | `npr.org` | `selector1` | 2048 | **live** | 2024-04-09 | 2026-06-22 | archive |
| NRC | NL | `nrc.nl` | `selector1` | 1024 | **live** | — | — | dns-brute |
| O Globo | BR | `globo.com` | `default` | 1024 | **live** | — | — | dns-brute |
| O Globo | BR | `globo.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| O Globo | BR | `globo.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| O Globo | BR | `globo.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| Philippine Daily Inquirer | PH | `inquirer.net` | `google` | 2048 | **live** | — | — | dns-brute |
| Philippine Daily Inquirer | PH | `inquirer.net` | `mail` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `email.politico.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `email.politico.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `email.politico.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `email.politico.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `email.politico.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `info.politico.com` | `cm` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `info.politico.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `mx` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `politico.com` | `selector2` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `politico.eu` | `cm` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `politico.eu` | `s1` | 2048 | **live** | — | — | dns-brute |
| Politico | US | `politico.eu` | `s2` | 1024 | **live** | — | — | dns-brute |
| Politico | US | `politico.eu` | `selector1` | 2048 | **live** | — | — | dns-brute |
| Premium Times | NG | `premiumtimesng.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| Premium Times | NG | `premiumtimesng.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| ProPublica | US | `propublica.org` | `200608` | 1024 | **live** | — | — | dns-brute |
| ProPublica | US | `propublica.org` | `google` | 2048 | **live** | — | — | dns-brute |
| ProPublica | US | `propublica.org` | `k2` | 2048 | **live** | — | — | dns-brute |
| ProPublica | US | `propublica.org` | `k3` | 2048 | **live** | — | — | dns-brute |
| ProPublica | US | `propublica.org` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| ProPublica | US | `propublica.org` | `selector1` | 2048 | **live** | — | — | dns-brute |
| ProPublica | US | `propublica.org` | `selector2` | 1024 | **live** | — | — | dns-brute |
| Punch | NG | `punchng.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| Punch | NG | `punchng.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| Punch | NG | `punchng.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Punch | NG | `punchng.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Rappler | PH | `rappler.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| Rappler | PH | `rappler.com` | `mte1` | 2048 | **live** | — | — | dns-brute |
| Rappler | PH | `rappler.com` | `mte2` | 2048 | **live** | — | — | dns-brute |
| Rappler | PH | `rappler.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Rappler | PH | `rappler.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Reforma | MX | `reforma.com` | `k2` | 2048 | **live** | 2024-04-09 | 2026-05-31 | archive |
| Reforma | MX | `reforma.com` | `k3` | 2048 | **live** | 2024-04-09 | 2024-04-17 | archive+dns(rekeyed) |
| Rest of World | global | `restofworld.org` | `google` | 2048 | **live** | — | — | dns-brute |
| Rest of World | global | `restofworld.org` | `k1` | 1024 | **live** | — | — | dns-brute |
| Rest of World | global | `restofworld.org` | `k2` | 2048 | **live** | — | — | dns-brute |
| Rest of World | global | `restofworld.org` | `k3` | 2048 | **live** | — | — | dns-brute |
| Reuters | wire | `email.reuters.com` | `sailthru` | 2048 | **live** | — | — | dns-brute |
| Reuters | wire | `reuters.com` | `k1` | 1024 | **live** | 2024-04-09 | 2026-04-17 | archive |
| Reuters | wire | `reuters.com` | `k2` | 2048 | **live** | 2024-04-09 | 2026-04-17 | archive |
| Reuters | wire | `reuters.com` | `k3` | 2048 | **live** | 2024-04-09 | 2024-05-11 | archive+dns(rekeyed) |
| Reuters | wire | `reuters.com` | `sailthru` | 2048 | **live** | 2025-02-25 | 2026-05-02 | archive |
| Reuters | wire | `reuters.com` | `scph1121` | 1024 | **live** | 2024-04-09 | 2026-05-03 | archive |
| Reuters | wire | `reuters.com` | `selector1` | 1024 | **live** | 2024-04-09 | 2026-05-04 | archive |
| Semafor | US | `notifications.semafor.com` | `mte1` | 2048 | **live** | — | — | dns-brute |
| Semafor | US | `notifications.semafor.com` | `mte2` | 2048 | **live** | — | — | dns-brute |
| Semafor | US | `semafor.com` | `20210112` | 1024 | **live** | — | — | dns-brute |
| Semafor | US | `semafor.com` | `google` | 1024 | **live** | — | — | dns-brute |
| Semafor | US | `semafor.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| Semafor | US | `semafor.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| Semafor | US | `semafor.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Semafor | US | `semafor.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| South China Morning Post | HK | `e.scmp.com` | `cm` | 1024 | **live** | 2025-12-16 | 2026-05-12 | archive |
| South China Morning Post | HK | `e.scmp.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| South China Morning Post | HK | `e.scmp.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| South China Morning Post | HK | `e.scmp.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| South China Morning Post | HK | `e.scmp.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| South China Morning Post | HK | `e.scmp.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| South China Morning Post | HK | `em.scmp.com` | `cm` | 1024 | **live** | — | — | dns-brute |
| South China Morning Post | HK | `scmp.com` | `google` | 1024 | **live** | 2024-04-09 | 2026-05-01 | archive |
| South China Morning Post | HK | `scmp.com` | `k1` | 1024 | **live** | 2024-04-09 | 2026-05-01 | archive |
| South China Morning Post | HK | `scmp.com` | `mailjet` | 1024 | **live** | 2024-04-09 | 2026-05-03 | archive |
| South China Morning Post | HK | `scmp.com` | `mailo` | 1024 | **live** | 2024-04-09 | 2026-05-03 | archive |
| South China Morning Post | HK | `scmp.com` | `mandrill` | 1024 | **live** | 2024-04-09 | 2026-05-03 | archive |
| South China Morning Post | HK | `scmp.com` | `s1` | 1024 | **live** | 2024-04-09 | 2026-05-03 | archive |
| South China Morning Post | HK | `scmp.com` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-03 | archive |
| South China Morning Post | HK | `scmp.com` | `smtp` | 1024 | **live** | 2024-04-09 | 2026-05-04 | archive |
| South China Morning Post | HK | `scmp.com` | `zendesk2` | 2048 | **live** | 2024-04-09 | 2025-07-20 | archive+dns(rekeyed) |
| Süddeutsche Zeitung | DE | `newsletter.sueddeutsche.de` | `key2` | 1024 | **live** | — | — | dns-brute |
| Süddeutsche Zeitung | DE | `sueddeutsche.de` | `selector1` | 1024 | **live** | — | — | dns-brute |
| The Atlantic | US | `e.theatlantic.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The Atlantic | US | `theatlantic.com` | `google` | 1024 | **live** | — | — | dns-brute |
| The Atlantic | US | `theatlantic.com` | `protonmail` | 2048 | **live** | — | — | dns-brute |
| The Atlantic | US | `theatlantic.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Atlantic | US | `theatlantic.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The Atlantic | US | `theatlantic.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The Atlantic | US | `theatlantic.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| The Atlantic | US | `theatlantic.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `key1` | 2048 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| The Boston Globe | US | `bostonglobe.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| The Boston Globe | US | `email.bostonglobe.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Boston Globe | US | `email.bostonglobe.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| The Boston Globe | US | `email.bostonglobe.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| The Boston Globe | US | `email.bostonglobe.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Conversation | global | `mail.theconversation.com` | `scph1225` | 2048 | **live** | — | — | dns-brute |
| The Conversation | global | `theconversation.com` | `cm` | 1024 | **live** | — | — | dns-brute |
| The Conversation | global | `theconversation.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Conversation | global | `theconversation.com` | `pic` | 1024 | **live** | — | — | dns-brute |
| The Conversation | global | `theconversation.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Conversation | global | `theconversation.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The Daily Star | BD | `thedailystar.net` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Daily Star | BD | `thedailystar.net` | `s2` | 2048 | **live** | — | — | dns-brute |
| The Economist | UK | `alerts.economist.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `alerts.economist.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `alerts.economist.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `e.economist.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `cm` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `dk1` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `mailjet` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `s1` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `economist.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `go.economist.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Economist | UK | `newsletters.economist.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `newsletters.economist.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| The Economist | UK | `newsletters.economist.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Guardian | UK | `mail.theguardian.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Guardian | UK | `mail.theguardian.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| The Guardian | UK | `mail.theguardian.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Guardian | UK | `theguardian.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Guardian | UK | `theguardian.com` | `cm` | 1024 | **live** | — | — | dns-brute |
| The Guardian | UK | `theguardian.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Guardian | UK | `theguardian.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| The Guardian | UK | `theguardian.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| The Guardian Nigeria | NG | `guardian.ng` | `default` | 2048 | **live** | — | — | dns-brute |
| The Hill | US | `email.thehill.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The Hill | US | `news.thehill.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The Hill | US | `thehill.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Hill | US | `thehill.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Hill | US | `thehill.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The Hill | US | `thehill.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| The Independent | UK | `e.independent.co.uk` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The Independent | UK | `e.independent.co.uk` | `selector1` | 2048 | **live** | — | — | dns-brute |
| The Independent | UK | `email.independent.co.uk` | `scph0723` | 1024 | **live** | — | — | dns-brute |
| The Independent | UK | `independent.co.uk` | `google` | 2048 | **live** | — | — | dns-brute |
| The Independent | UK | `independent.co.uk` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| The Independent | UK | `independent.co.uk` | `selector1` | 1024 | **live** | — | — | dns-brute |
| The Indian Express | IN | `indianexpress.com` | `google` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The Indian Express | IN | `indianexpress.com` | `mailmodo` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The Intercept | US | `theintercept.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Intercept | US | `theintercept.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| The Intercept | US | `theintercept.com` | `protonmail` | 2048 | **live** | — | — | dns-brute |
| The Intercept | US | `theintercept.com` | `scph1018` | 1024 | **live** | — | — | dns-brute |
| The Jakarta Post | ID | `thejakartapost.com` | `google` | 1024 | **live** | — | — | dns-brute |
| The Jakarta Post | ID | `thejakartapost.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| The Jakarta Post | ID | `thejakartapost.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| The Jakarta Post | ID | `thejakartapost.com` | `pic` | 1024 | **live** | — | — | dns-brute |
| The Japan Times | JP | `japantimes.co.jp` | `default` | 2048 | **live** | — | — | dns-brute |
| The Japan Times | JP | `japantimes.co.jp` | `google` | 2048 | **live** | — | — | dns-brute |
| The Japan Times | JP | `japantimes.co.jp` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| The Japan Times | JP | `japantimes.co.jp` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Japan Times | JP | `japantimes.co.jp` | `s2` | 2048 | **live** | — | — | dns-brute |
| The Japan Times | JP | `japantimes.co.jp` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| The Japan Times | JP | `japantimes.co.jp` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| The Nation | US | `thenation.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Nation | US | `thenation.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The National | AE | `thenationalnews.com` | `k2` | 2048 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The National | AE | `thenationalnews.com` | `k3` | 2048 | **live** | 2024-04-09 | 2024-04-12 | archive+dns(rekeyed) |
| The National | AE | `thenationalnews.com` | `mandrill` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The National | AE | `thenationalnews.com` | `mte1` | 2048 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The National | AE | `thenationalnews.com` | `mte2` | 2048 | **live** | — | — | dns-brute |
| The National | AE | `thenationalnews.com` | `selector1` | 2048 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The New York Times | US | `e.nytimes.com` | `scph0126` | 4096 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `cm` | 2048 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `kl` | 2048 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `kl2` | 2048 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| The New York Times | US | `nytimes.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| The New Yorker | US | `info.newyorker.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `info.newyorker.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `info.newyorker.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `newsletter.newyorker.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `newsletter.newyorker.com` | `scph0326` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `hs1` | 2048 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `hs2` | 2048 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `pic` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The New Yorker | US | `newyorker.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Standard | KE | `standardmedia.co.ke` | `k1` | 1024 | **live** | 2024-04-09 | 2026-05-28 | archive |
| The Standard | KE | `standardmedia.co.ke` | `mandrill` | 1024 | **live** | 2024-04-09 | 2026-05-28 | archive |
| The Standard | KE | `standardmedia.co.ke` | `s1024` | 1024 | **live** | 2024-04-09 | 2024-04-14 | archive+dns(rekeyed) |
| The Straits Times | SG | `sph.com.sg` | `google` | 1024 | **live** | 2024-04-11 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `k2` | 2048 | **live** | 2024-04-11 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `k3` | 2048 | **live** | 2024-10-03 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `key2` | 1024 | **live** | 2024-04-11 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `mandrill` | 1024 | **live** | 2024-04-11 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `qualtrics` | 2048 | **live** | 2024-04-11 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `s1` | 2048 | **live** | 2024-04-11 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `s2` | 2048 | **live** | 2024-04-11 | 2026-04-28 | archive |
| The Straits Times | SG | `sph.com.sg` | `selector1` | 1024 | **live** | — | — | dns-brute |
| The Straits Times | SG | `sph.com.sg` | `selector2` | 1024 | **live** | — | — | dns-brute |
| The Straits Times | SG | `straitstimes.com` | `google` | 1024 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `email.smh.com.au` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `email.smh.com.au` | `mail` | 1024 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `email.smh.com.au` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `info.smh.com.au` | `google` | 1024 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `newsletter.smh.com.au` | `google` | 1024 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `smh.com.au` | `google` | 1024 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `smh.com.au` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `smh.com.au` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| The Sydney Morning Herald | AU | `updates.smh.com.au` | `google` | 1024 | **live** | — | — | dns-brute |
| The Telegraph | UK | `telegraph.co.uk` | `google` | 2048 | **live** | — | — | dns-brute |
| The Telegraph | UK | `telegraph.co.uk` | `mailjet` | 1024 | **live** | — | — | dns-brute |
| The Telegraph | UK | `telegraph.co.uk` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Telegraph | UK | `telegraph.co.uk` | `s2` | 1024 | **live** | — | — | dns-brute |
| The Telegraph | UK | `telegraph.co.uk` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| The Telegraph | UK | `telegraph.co.uk` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| The Times | UK | `email.thetimes.co.uk` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Times | UK | `email.thetimes.co.uk` | `mail` | 1024 | **live** | — | — | dns-brute |
| The Times | UK | `email.thetimes.co.uk` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Times | UK | `newsletter.thetimes.co.uk` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| The Times | UK | `newsletter.thetimes.com` | `sailthru` | 2048 | **live** | — | — | dns-brute |
| The Times | UK | `thetimes.co.uk` | `google` | 1024 | **live** | — | — | dns-brute |
| The Times | UK | `thetimes.co.uk` | `k2` | 2048 | **live** | — | — | dns-brute |
| The Times | UK | `thetimes.co.uk` | `k3` | 2048 | **live** | — | — | dns-brute |
| The Times | UK | `thetimes.com` | `fm1` | 2048 | **live** | — | — | dns-brute |
| The Times | UK | `thetimes.com` | `fm2` | 2048 | **live** | — | — | dns-brute |
| The Times | UK | `thetimes.com` | `google` | 1024 | **live** | — | — | dns-brute |
| The Times of India | IN | `bounce.indiatimes.com` | `default` | 1024 | **live** | — | — | dns-brute |
| The Times of India | IN | `indiatimes.com` | `default` | 1024 | **live** | — | — | dns-brute |
| The Times of India | IN | `timesofindia.com` | `default` | 1024 | **live** | — | — | dns-brute |
| The Times of India | IN | `timesofindia.com` | `google` | 2048 | **live** | — | — | dns-brute |
| The Times of India | IN | `timesofindia.com` | `key1` | 2048 | **live** | — | — | dns-brute |
| The Times of India | IN | `timesofindia.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| The Times of India | IN | `timesofindia.com` | `selector2` | 2048 | **live** | — | — | dns-brute |
| The Times of Israel | IL | `timesofisrael.com` | `google` | 2048 | **live** | 2024-04-09 | 2024-04-12 | archive+dns(rekeyed) |
| The Times of Israel | IL | `timesofisrael.com` | `k1` | 1024 | **live** | 2024-04-09 | 2026-05-23 | archive |
| The Times of Israel | IL | `timesofisrael.com` | `mail` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The Times of Israel | IL | `timesofisrael.com` | `s1` | 2048 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The Times of Israel | IL | `timesofisrael.com` | `s2` | 1024 | **live** | 2024-04-09 | 2026-05-24 | archive |
| The Wall Street Journal | US | `dowjones.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `ctct1` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `ctct2` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `google` | 1024 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `mte1` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `mte2` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `s1024` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `sailthru` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `selector2` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `dowjones.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `em.wsj.com` | `scph0925` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `email.dowjones.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `mail.dowjones.com` | `scph0924` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `newsletter.dowjones.com` | `google` | 1024 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `newsletter.dowjones.com` | `k1` | 1024 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `wsj.com` | `200608` | 1024 | **live** | 2024-04-09 | 2026-06-16 | archive |
| The Wall Street Journal | US | `wsj.com` | `cv-usprod-1` | 1024 | **live** | 2024-04-09 | 2024-04-10 | archive+dns(rekeyed) |
| The Wall Street Journal | US | `wsj.com` | `dj` | 1024 | **live** | 2024-03-12 | 2026-05-27 | archive |
| The Wall Street Journal | US | `wsj.com` | `google` | 1024 | **live** | 2024-04-09 | 2026-06-18 | archive |
| The Wall Street Journal | US | `wsj.com` | `k2` | 2048 | **live** | 2024-04-09 | 2026-06-18 | archive |
| The Wall Street Journal | US | `wsj.com` | `k3` | 2048 | **live** | 2024-04-09 | 2024-04-30 | archive+dns(rekeyed) |
| The Wall Street Journal | US | `wsj.com` | `pp1` | 2048 | **live** | 2024-04-09 | 2026-06-19 | archive |
| The Wall Street Journal | US | `wsj.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `wsj.com` | `s2` | 2048 | **live** | — | — | dns-brute |
| The Wall Street Journal | US | `wsj.com` | `selector2` | 2048 | **live** | 2024-04-09 | 2026-06-20 | archive |
| The Washington Post | US | `e.washingtonpost.com` | `sailthru` | 1024 | **live** | 2024-04-29 | 2026-06-21 | archive |
| The Washington Post | US | `e.washingtonpost.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| The Washington Post | US | `e.washingtonpost.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |
| The Washington Post | US | `washingtonpost.com` | `4b5b2tydou7toanawjv236fiwenyyjnc` | 1024 | **live** | 2024-02-25 | 2024-03-07 | archive+dns(rekeyed) |
| The Washington Post | US | `washingtonpost.com` | `qc3bbt7h6f7nmllklhmnzlskzlws2uxk` | 1024 | **live** | 2025-10-21 | 2026-05-28 | archive |
| The Washington Post | US | `washingtonpost.com` | `zendesk1` | 2048 | **live** | 2024-04-09 | 2024-05-06 | archive+dns(rekeyed) |
| The Washington Post | US | `washingtonpost.com` | `zendesk2` | 2048 | **live** | 2024-04-09 | 2025-06-28 | archive+dns(rekeyed) |
| The Washington Post | US | `washingtonpost.com` | `dyhng56otxe77fe3tmp6ywjeirvqylay` | 1024 | archived | 2024-11-05 | 2025-08-16 | archive |
| The Washington Post | US | `washingtonpost.com` | `ns6qpilarilm4yezj6vcpr5etjh5hycn` | 1024 | archived | 2024-11-05 | 2025-01-15 | archive |
| Time | US | `email.time.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| Time | US | `time.com` | `google` | 2048 | **live** | 2024-04-09 | 2026-06-18 | archive |
| Time | US | `time.com` | `s1` | 2048 | **live** | 2024-04-09 | 2026-06-22 | archive |
| Time | US | `time.com` | `s2` | 2048 | **live** | 2024-04-09 | 2026-06-22 | archive |
| Toronto Star | CA | `email.thestar.com` | `key1` | 2048 | **live** | — | — | dns-brute |
| Toronto Star | CA | `thestar.com` | `sm` | 1024 | **live** | — | — | dns-brute |
| USA Today | US | `e.usatoday.com` | `200608` | 1024 | **live** | — | — | dns-brute |
| USA Today | US | `e.usatoday.com` | `mail` | 1024 | **live** | — | — | dns-brute |
| USA Today | US | `e.usatoday.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `hs1` | 2048 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `hs2` | 2048 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `m1` | 1024 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `mandrill` | 1024 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `selector1` | 2048 | **live** | — | — | dns-brute |
| USA Today | US | `usatoday.com` | `smtpapi` | 1024 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `google` | 1024 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `k2` | 2048 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `k3` | 2048 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `s1` | 2048 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `s2` | 1024 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `sailthru` | 1024 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `zendesk1` | 2048 | **live** | — | — | dns-brute |
| Vox | US | `vox.com` | `zendesk2` | 2048 | **live** | — | — | dns-brute |

## Outlets without a live key found

_none_

Outlets absent from the table entirely had no key in the archive and no brute-forced selector — their
newsletters use a sending subdomain or ESP selector this sweep didn't guess. A single received email
reveals both (the `d=`/`s=` tags), and the settlement bot registers such keys from DNS on first sight.
