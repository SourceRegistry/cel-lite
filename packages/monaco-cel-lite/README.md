# @sourceregistry/monaco-cel-lite

Monaco Editor language support and IntelliSense for
**@sourceregistry/cel-lite**.

This package adds:
- syntax highlighting
- auto-completion
- hover documentation
- signature help

It does **not** bundle Monaco itself.

##  ✨ Features

- CEL-lite syntax highlighting (Monarch)
- Keyword, function, and symbol completion
- Hover documentation for functions
- Signature help while typing function calls
- Configurable context symbols (SAML, OIDC, claims, etc.)
- Zero runtime dependencies

##  📦 Installation

```bash
npm install @sourceregistry/monaco-cel-lite
````

You must also install Monaco:

```bash
npm install monaco-editor
```

##  🚀 Basic usage

```ts
import * as monaco from "monaco-editor";
import { registerCelLite } from "@sourceregistry/monaco-cel-lite";

registerCelLite(monaco);
```

Then use the language ID:

```ts
monaco.editor.create(container, {
  value: "has(user.email) ? lower(user.email) : null",
  language: "cel-lite",
});
```

##  ⚙️ Configuration

```ts
registerCelLite(monaco, {
  languageId: "cel-lite",
  functions: [
    { name: "has", detail: "has(x) -> bool" },
    { name: "lower", detail: "lower(s) -> string" },
  ],
  symbols: [
    { label: "user.email", detail: "User email address" },
    { label: "saml.attributes", detail: "SAML attribute map" },
  ],
});
```

### Options

| Option       | Description                               |
| ------------ | ----------------------------------------- |
| `languageId` | Custom language id (default: `cel-lite`)  |
| `functions`  | Function signatures for completion & docs |
| `symbols`    | Context variables for completion          |

##  🧠 Intended use-cases

* Identity Provider admin UIs
* Attribute mapper editors
* Policy rule builders
* Safe expression configuration interfaces

CEL-lite expressions are **configuration**, not code.

## 🔄 Relationship to CEL-lite

This package is **UI-only**.
It does not evaluate expressions.

For evaluation, use:

```ts
import { compileCel } from "@sourceregistry/cel-lite";
```

## 🛡️ Design philosophy

* No execution of user JavaScript
* No dynamic imports
* No access to browser globals
* No Monaco bundling

Safe by default.

## 📄 License

Apache-2.0
