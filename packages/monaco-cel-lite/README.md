<div align="center">

# @sourceregistry/monaco-cel-lite

**Monaco Editor language support and IntelliSense for CEL-lite expressions**

[![npm version](https://img.shields.io/npm/v/@sourceregistry/monaco-cel-lite?style=flat-square&color=f96743)](https://www.npmjs.com/package/@sourceregistry/monaco-cel-lite)
[![npm downloads](https://img.shields.io/npm/dm/@sourceregistry/monaco-cel-lite?style=flat-square)](https://www.npmjs.com/package/@sourceregistry/monaco-cel-lite)
[![license](https://img.shields.io/npm/l/@sourceregistry/monaco-cel-lite?style=flat-square)](../../LICENSE)
[![Monaco](https://img.shields.io/badge/Monaco-%5E0.53-007ACC?style=flat-square)](https://www.npmjs.com/package/monaco-editor)
[![issues](https://img.shields.io/github/issues/SourceRegistry/cel-lite?style=flat-square)](https://github.com/SourceRegistry/cel-lite/issues)

Add CEL-lite syntax highlighting, completions, hover documentation, and signature help to Monaco-based expression editors. This package is UI-only and does not evaluate expressions.

[CEL-lite](https://www.npmjs.com/package/@sourceregistry/cel-lite) | [npm](https://www.npmjs.com/package/@sourceregistry/monaco-cel-lite) | [Issues](https://github.com/SourceRegistry/cel-lite/issues)

</div>

---

## Installation

```sh
npm install @sourceregistry/monaco-cel-lite monaco-editor
```

**Peer dependency:** `monaco-editor ^0.53.0`

This package does not bundle Monaco. Applications should already have Monaco configured through their bundler or editor integration.

---

## Overview

```ts
import * as monaco from 'monaco-editor';
import { registerCelLite } from '@sourceregistry/monaco-cel-lite';

const celLite = registerCelLite(monaco);

monaco.editor.create(container, {
    value: "has(user.email) ? lower(user.email) : null",
    language: celLite.languageId,
});
```

`registerCelLite` returns the language id and a `dispose()` function for cleaning up Monaco registrations when an editor integration is torn down.

```ts
const registration = registerCelLite(monaco);

// later
registration.dispose();
```

---

## Core API

### `registerCelLite(monaco, options?)`

Registers a Monaco language with Monarch tokenization, language configuration, completions, hover documentation, and signature help.

```ts
const registration = registerCelLite(monaco, {
    languageId: 'cel-lite',
    symbols: [
        { label: 'user.email', detail: 'User email address' },
        { label: 'saml.attributes', detail: 'SAML attribute map' },
    ],
});
```

The function can be called with a custom `languageId` when an application needs separate editor modes for different expression domains.

### Return value

```ts
{
    languageId: string;
    dispose(): void;
}
```

Call `dispose()` when the registration is no longer needed, especially in tests, demos, or hot-reloaded editor shells.

---

## Configuration

```ts
registerCelLite(monaco, {
    languageId: 'mapping-expression',
    functions: [
        {
            name: 'has',
            detail: 'has(x) -> bool',
            documentation: 'True if x is not null/undefined.',
            params: ['x'],
        },
        {
            name: 'lower',
            detail: 'lower(s) -> string',
            documentation: 'Lowercase string.',
            params: ['s'],
        },
    ],
    symbols: [
        {
            label: 'saml.attributes.mail',
            kind: monaco.languages.CompletionItemKind.Property,
            detail: 'SAML mail attribute',
        },
    ],
});
```

| Option       | Default      | Description                                |
| ------------ | ------------ | ------------------------------------------ |
| `languageId` | `cel-lite`   | Monaco language id to register             |
| `functions`  | built-ins    | Function signatures for completion/docs    |
| `symbols`    | `[]`         | Context variables or paths for completion  |

When `functions` is provided, it replaces the built-in list used for completion, hover, and signature help. Keep it aligned with the evaluator function allow-list used by your application.

---

## Built-In Function Metadata

The default metadata covers the built-in functions from `@sourceregistry/cel-lite`:

```txt
has, exists, size, first, collect,
lower, upper, trim,
contains, containsAny,
startsWith, endsWith,
matches, regexReplace,
coalesce, join, split
```

Regex helpers are documented as guarded JavaScript regex helpers to match the runtime safety behavior in CEL-lite.

---

## Editor Features

- Monarch syntax highlighting for CEL-lite literals, identifiers, strings, numbers, operators, brackets, comments, and invalid characters.
- Keyword completion for `true`, `false`, `null`, and `in`.
- Function completion with snippet placeholders.
- Symbol completion for application-provided context paths.
- Hover documentation for configured functions.
- Basic signature help while typing function calls.
- Language configuration for brackets, comments, and string/bracket auto-closing.

---

## Relationship To CEL-Lite

This package does not parse, compile, or evaluate expressions. It only improves the Monaco editing experience.

For evaluation, install and use the runtime package:

```ts
import { compileCel } from '@sourceregistry/cel-lite';

const program = compileCel("has(user.email) ? lower(user.email) : null");
const value = program.eval({ user: { email: 'USER@EXAMPLE.COM' } });
```

Keep editor metadata and runtime policy in sync. Hiding a function from completion does not disable it at runtime, and adding a function to completion does not make it callable unless the evaluator supports it.

---

## Production Guidance

- Register CEL-lite once per Monaco instance and reuse the returned `languageId`.
- Dispose registrations in tests, demos, or hot-reloaded shells.
- Provide domain-specific `symbols` for better mapper and policy authoring.
- Keep custom `functions` aligned with the runtime evaluator allow-list.
- Use `@sourceregistry/cel-lite` for validation and evaluation on save or preview.
- Treat editor hints as guidance only; enforce security and limits in the evaluator.

---

## Type Reference

```ts
registerCelLite(monaco, options?)

RegisterCelLiteOptions
CelLiteFunctionSig
CelLiteSymbol
```

---

## Testing

```sh
npm --workspace @sourceregistry/monaco-cel-lite run lint
npm --workspace @sourceregistry/monaco-cel-lite run build
```

---

## License

[Apache-2.0](../../LICENSE) (c) [A.P.A. Slaa](https://github.com/SourceRegistry)
