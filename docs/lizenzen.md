# Lizenzverzeichnis

Erzeugt mit `pnpm licenses` (`node scripts/check-licenses.mjs`). Bitte nicht von Hand ändern. Erlaubt sind Lizenzen, die kommerziellen SaaS-Betrieb erlauben; Copyleft nur nach Prüfung. Die CI bricht bei unzulässigen Lizenzen ab.

## Laufzeit-Abhängigkeiten nach Lizenz

| Lizenz | Pakete |
| --- | --- |
| MIT | 245 |
| ISC | 19 |
| Apache-2.0 | 10 |
| BSD-3-Clause | 5 |
| BlueOak-1.0.0 | 5 |
| Unlicense | 1 |
| Unknown | 1 |
| MIT/X11 | 1 |
| (MIT OR GPL-3.0-or-later) | 1 |
| (MIT AND Zlib) | 1 |
| 0BSD | 1 |

Bei Mehrfachlizenzen (`A OR B`) nutzen wir die erlaubte Variante, z. B. MIT bei `jszip`.

## Nur Entwicklung und Tests

| Lizenz | Pakete |
| --- | --- |
| MIT | 115 |
| Apache-2.0 | 18 |
| BSD-2-Clause | 6 |
| ISC | 6 |
| MPL-2.0 | 5 |
| BSD-3-Clause | 2 |
| Python-2.0 | 1 |
| (MIT OR CC0-1.0) | 1 |

MPL-2.0 betrifft nur Prüfwerkzeuge (axe-core für Barrierefreiheitstests); sie werden nicht ausgeliefert.

## Geprüfte Ausnahmen

| Paket | Begründung |
| --- | --- |
| buffers | MIT/X11 laut README; package.json ohne Lizenzfeld (Abhängigkeit von exceljs) |

## Alle Laufzeit-Abhängigkeiten

| Paket | Version | Lizenz |
| --- | --- | --- |
| @fast-csv/format | 4.3.5 | MIT |
| @fast-csv/parse | 4.3.6 | MIT |
| @fastify/accept-negotiator | 2.1.1 | MIT |
| @fastify/ajv-compiler | 4.0.7 | MIT |
| @fastify/busboy | 3.2.3 | MIT |
| @fastify/deepmerge | 3.2.2 | MIT |
| @fastify/error | 4.2.1 | MIT |
| @fastify/fast-json-stringify-compiler | 5.1.1 | MIT |
| @fastify/forwarded | 3.1.1 | MIT |
| @fastify/merge-json-schemas | 0.2.2 | MIT |
| @fastify/multipart | 10.1.4 | MIT |
| @fastify/proxy-addr | 5.1.2 | MIT |
| @fastify/rate-limit | 11.2.1 | MIT |
| @fastify/send | 4.1.2 | MIT |
| @fastify/static | 10.1.6 | MIT |
| @fastify/swagger | 9.9.2 | MIT |
| @fastify/swagger-ui | 6.1.2 | MIT |
| @internationalized/date | 3.12.4 | Apache-2.0 |
| @internationalized/number | 3.6.9 | Apache-2.0 |
| @internationalized/string | 3.2.10 | Apache-2.0 |
| @lukeed/ms | 2.0.2 | MIT |
| @pinojs/redact | 0.4.0 | MIT |
| @react-types/shared | 3.37.0 | Apache-2.0 |
| @swc/helpers | 0.5.23 | Apache-2.0 |
| @tanstack/query-core | 5.104.4 | MIT |
| @tanstack/react-query | 5.104.4 | MIT |
| @types/node | 14.18.63 | MIT |
| @types/react | 19.3.0 | MIT |
| abstract-logging | 2.0.1 | MIT |
| ajv | 8.20.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| archiver | 5.3.2 | MIT |
| archiver-utils | 2.1.0, 3.0.4 | MIT |
| aria-hidden | 1.2.6 | MIT |
| array-buffer-byte-length | 1.0.2 | MIT |
| arraybuffer.prototype.slice | 1.0.4 | MIT |
| async | 3.2.6 | MIT |
| async-function | 1.0.0 | MIT |
| atomic-sleep | 1.0.0 | MIT |
| available-typed-arrays | 1.0.7 | MIT |
| avvio | 9.3.1 | MIT |
| balanced-match | 1.0.2, 4.0.4 | MIT |
| base64-js | 1.5.1 | MIT |
| big-integer | 1.6.52 | Unlicense |
| binary | 0.3.0 | MIT |
| bl | 4.1.0 | MIT |
| bluebird | 3.4.7 | MIT |
| brace-expansion | 1.1.21, 2.1.7, 5.0.12 | MIT |
| buffer | 5.7.1 | MIT |
| buffer-crc32 | 0.2.13 | MIT |
| buffer-indexof-polyfill | 1.0.2 | MIT |
| buffers | 0.1.1 | Unknown (Ausnahme) |
| call-bind | 1.0.9 | MIT |
| call-bind-apply-helpers | 1.0.2 | MIT |
| call-bound | 1.0.4 | MIT |
| chainsaw | 0.1.0 | MIT/X11 |
| client-only | 0.0.1 | MIT |
| clsx | 2.1.1 | MIT |
| compress-commons | 4.1.2 | MIT |
| concat-map | 0.0.1 | MIT |
| content-disposition | 3.0.0 | MIT |
| cookie | 1.1.1, 2.0.1 | MIT |
| core-util-is | 1.0.3 | MIT |
| crc-32 | 1.2.2 | Apache-2.0 |
| crc32-stream | 4.0.3 | MIT |
| csstype | 3.2.3 | MIT |
| csv-parse | 7.0.3 | MIT |
| data-view-buffer | 1.0.2 | MIT |
| data-view-byte-length | 1.0.2 | MIT |
| data-view-byte-offset | 1.0.1 | MIT |
| dayjs | 1.11.23 | MIT |
| debug | 4.4.3 | MIT |
| decimal.js | 10.6.0 | MIT |
| define-data-property | 1.1.4 | MIT |
| define-properties | 1.2.1 | MIT |
| depd | 2.0.0 | MIT |
| dequal | 2.0.3 | MIT |
| dunder-proto | 1.0.1 | MIT |
| duplexer2 | 0.1.4 | BSD-3-Clause |
| end-of-stream | 1.4.5 | MIT |
| es-abstract | 1.24.2 | MIT |
| es-abstract-get | 1.0.0 | MIT |
| es-define-property | 1.0.1 | MIT |
| es-errors | 1.3.0 | MIT |
| es-object-atoms | 1.1.2 | MIT |
| es-set-tostringtag | 2.1.0 | MIT |
| es-to-primitive | 1.3.4 | MIT |
| escape-html | 1.0.3 | MIT |
| exceljs | 4.4.0 | MIT |
| fast-csv | 4.3.6 | MIT |
| fast-decode-uri-component | 1.0.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-json-stringify | 7.1.0 | MIT |
| fast-querystring | 1.1.2 | MIT |
| fast-uri | 3.1.8, 4.2.2 | BSD-3-Clause |
| fastify | 5.12.7 | MIT |
| fastify-plugin | 6.0.1 | MIT |
| fastify-type-provider-zod | 7.0.0 | MIT |
| fastq | 1.20.3 | ISC |
| find-my-way | 9.10.0 | MIT |
| for-each | 0.3.5 | MIT |
| fs-constants | 1.0.0 | MIT |
| fs.realpath | 1.0.0 | ISC |
| fstream | 1.0.12 | ISC |
| function-bind | 1.1.2 | MIT |
| function.prototype.name | 1.2.0 | MIT |
| functions-have-names | 1.2.3 | MIT |
| generator-function | 2.0.1 | MIT |
| get-intrinsic | 1.3.0 | MIT |
| get-proto | 1.0.1 | MIT |
| get-symbol-description | 1.1.0 | MIT |
| glob | 7.2.3 | ISC |
| glob | 13.0.6 | BlueOak-1.0.0 |
| globalthis | 1.0.4 | MIT |
| gopd | 1.2.0 | MIT |
| graceful-fs | 4.2.11 | ISC |
| has-bigints | 1.1.0 | MIT |
| has-property-descriptors | 1.0.2 | MIT |
| has-proto | 1.2.0 | MIT |
| has-symbols | 1.1.0 | MIT |
| has-tostringtag | 1.0.2 | MIT |
| hasown | 2.0.4 | MIT |
| http-errors | 2.0.1 | MIT |
| ieee754 | 1.2.1 | BSD-3-Clause |
| immediate | 3.0.6 | MIT |
| inflight | 1.0.6 | ISC |
| inherits | 2.0.4 | ISC |
| internal-slot | 1.1.0 | MIT |
| ip-address | 10.7.4 | MIT |
| ipaddr.js | 2.5.0 | MIT |
| is-array-buffer | 3.0.5 | MIT |
| is-async-function | 2.1.1 | MIT |
| is-bigint | 1.1.0 | MIT |
| is-boolean-object | 1.2.2 | MIT |
| is-callable | 1.2.7 | MIT |
| is-data-view | 1.0.2 | MIT |
| is-date-object | 1.1.0 | MIT |
| is-document.all | 1.0.0 | MIT |
| is-finalizationregistry | 1.1.1 | MIT |
| is-generator-function | 1.1.2 | MIT |
| is-map | 2.0.3 | MIT |
| is-negative-zero | 2.0.3 | MIT |
| is-number-object | 1.1.1 | MIT |
| is-regex | 1.2.1 | MIT |
| is-set | 2.0.3 | MIT |
| is-shared-array-buffer | 1.0.4 | MIT |
| is-string | 1.1.1 | MIT |
| is-symbol | 1.1.1 | MIT |
| is-typed-array | 1.1.15 | MIT |
| is-weakmap | 2.0.2 | MIT |
| is-weakref | 1.1.1 | MIT |
| is-weakset | 2.0.4 | MIT |
| isarray | 1.0.0, 2.0.5 | MIT |
| jose | 6.2.12 | MIT |
| json-schema-ref-resolver | 3.0.1 | MIT |
| json-schema-resolver | 3.0.0 | MIT |
| json-schema-traverse | 1.0.0 | MIT |
| jszip | 3.10.2 | (MIT OR GPL-3.0-or-later) |
| kysely | 0.29.7 | MIT |
| lazystream | 1.0.1 | MIT |
| lie | 3.3.0 | MIT |
| light-my-request | 6.8.0 | BSD-3-Clause |
| listenercount | 1.0.1 | ISC |
| lodash.defaults | 4.2.0 | MIT |
| lodash.difference | 4.5.0 | MIT |
| lodash.escaperegexp | 4.1.2 | MIT |
| lodash.flatten | 4.4.0 | MIT |
| lodash.groupby | 4.6.0 | MIT |
| lodash.isboolean | 3.0.3 | MIT |
| lodash.isequal | 4.5.0 | MIT |
| lodash.isfunction | 3.0.9 | MIT |
| lodash.isnil | 4.0.0 | MIT |
| lodash.isplainobject | 4.0.6 | MIT |
| lodash.isundefined | 3.0.1 | MIT |
| lodash.union | 4.6.0 | MIT |
| lodash.uniq | 4.5.0 | MIT |
| lru-cache | 11.5.3 | BlueOak-1.0.0 |
| lucide-react | 1.59.0 | ISC |
| math-intrinsics | 1.1.0 | MIT |
| mime | 3.0.0 | MIT |
| minimatch | 3.1.5, 5.1.9 | ISC |
| minimatch | 10.2.6 | BlueOak-1.0.0 |
| minimist | 1.2.8 | MIT |
| minipass | 7.1.3 | BlueOak-1.0.0 |
| mkdirp | 0.5.6 | MIT |
| ms | 2.1.3 | MIT |
| normalize-path | 3.0.0 | MIT |
| object-inspect | 1.13.4 | MIT |
| object-keys | 1.1.1 | MIT |
| object.assign | 4.1.7 | MIT |
| on-exit-leak-free | 2.1.2 | MIT |
| once | 1.4.0 | ISC |
| openapi-fetch | 0.17.0 | MIT |
| openapi-types | 12.1.3 | MIT |
| openapi-typescript-helpers | 0.1.0 | MIT |
| own-keys | 1.0.2 | MIT |
| pako | 1.0.11 | (MIT AND Zlib) |
| path-is-absolute | 1.0.1 | MIT |
| path-scurry | 2.0.2 | BlueOak-1.0.0 |
| pg | 8.23.1 | MIT |
| pg-cloudflare | 1.4.1 | MIT |
| pg-connection-string | 2.14.1 | MIT |
| pg-int8 | 1.0.1 | ISC |
| pg-pool | 3.14.0 | MIT |
| pg-protocol | 1.16.1 | MIT |
| pg-types | 2.2.0 | MIT |
| pgpass | 1.0.5 | MIT |
| pino | 10.4.0 | MIT |
| pino-abstract-transport | 3.0.0 | MIT |
| pino-std-serializers | 7.1.0 | MIT |
| possible-typed-array-names | 1.1.0 | MIT |
| postgres-array | 2.0.0 | MIT |
| postgres-bytea | 1.0.1 | MIT |
| postgres-date | 1.0.7 | MIT |
| postgres-interval | 1.2.0 | MIT |
| process-nextick-args | 2.0.1 | MIT |
| process-warning | 5.1.1 | MIT |
| quick-format-unescaped | 4.0.4 | MIT |
| react | 19.3.1 | MIT |
| react-aria | 3.53.1 | Apache-2.0 |
| react-aria-components | 1.22.1 | Apache-2.0 |
| react-dom | 19.3.1 | MIT |
| react-router | 7.18.4 | MIT |
| react-stately | 3.51.0 | Apache-2.0 |
| readable-stream | 2.3.8, 3.6.2 | MIT |
| readdir-glob | 1.1.3 | Apache-2.0 |
| real-require | 1.0.0 | MIT |
| reflect.getprototypeof | 1.0.10 | MIT |
| regexp.prototype.flags | 1.5.4 | MIT |
| require-from-string | 2.0.2 | MIT |
| ret | 0.5.1 | MIT |
| reusify | 1.1.0 | MIT |
| rfdc | 1.4.1 | MIT |
| rimraf | 2.7.1 | ISC |
| safe-array-concat | 1.1.4 | MIT |
| safe-buffer | 5.1.2, 5.2.1 | MIT |
| safe-push-apply | 1.0.0 | MIT |
| safe-regex-test | 1.1.0 | MIT |
| safe-regex2 | 5.1.2 | MIT |
| safe-stable-stringify | 2.5.0 | MIT |
| saxes | 5.0.1 | ISC |
| scheduler | 0.28.0 | MIT |
| secure-json-parse | 4.1.1 | BSD-3-Clause |
| semver | 7.8.5 | ISC |
| set-cookie-parser | 2.7.2, 3.1.4 | MIT |
| set-function-length | 1.2.2 | MIT |
| set-function-name | 2.0.2 | MIT |
| set-proto | 1.0.0 | MIT |
| setimmediate | 1.0.5 | MIT |
| setprototypeof | 1.2.0 | ISC |
| side-channel | 1.1.1 | MIT |
| side-channel-list | 1.0.1 | MIT |
| side-channel-map | 1.0.1 | MIT |
| side-channel-weakmap | 1.0.2 | MIT |
| sonic-boom | 4.2.1 | MIT |
| split2 | 4.2.0 | ISC |
| statuses | 2.0.2 | MIT |
| stop-iteration-iterator | 1.1.0 | MIT |
| string_decoder | 1.1.1, 1.3.0 | MIT |
| string.prototype.trim | 1.2.11 | MIT |
| string.prototype.trimend | 1.0.10 | MIT |
| string.prototype.trimstart | 1.0.8 | MIT |
| supports-color | 10.2.2 | MIT |
| tar-stream | 2.2.0 | MIT |
| thread-stream | 4.2.0 | MIT |
| tmp | 0.2.7 | MIT |
| toad-cache | 3.7.4 | MIT |
| toidentifier | 1.0.1 | MIT |
| traverse | 0.3.10 | MIT |
| tslib | 2.8.1 | 0BSD |
| typed-array-buffer | 1.0.3 | MIT |
| typed-array-byte-length | 1.0.3 | MIT |
| typed-array-byte-offset | 1.0.5 | MIT |
| typed-array-length | 1.0.8 | MIT |
| typedarray.prototype.slice | 1.0.6 | MIT |
| unbox-primitive | 1.1.0 | MIT |
| unzipper | 0.10.14 | MIT |
| use-sync-external-store | 1.7.0 | MIT |
| util-deprecate | 1.0.2 | MIT |
| uuid | 8.3.2 | MIT |
| which-boxed-primitive | 1.1.1 | MIT |
| which-builtin-type | 1.2.1 | MIT |
| which-collection | 1.0.2 | MIT |
| which-typed-array | 1.1.24 | MIT |
| wrappy | 1.0.2 | ISC |
| xmlchars | 2.2.0 | MIT |
| xtend | 4.0.2 | MIT |
| yaml | 2.9.1 | ISC |
| zip-stream | 4.1.1 | MIT |
| zod | 4.6.7 | MIT |
