# @sourceregistry/cel-lite

**CEL-lite** is a small, safe, dependency-free expression language inspired by
Google’s Common Expression Language (CEL), designed specifically for
**identity, policy, and mapping use-cases**.

It is not a full CEL implementation — by design.
CEL-lite focuses on **determinism, auditability, and sandbox safety**.

---

## ✨ Features

- ✅ Expression evaluation (no side effects)
- ✅ Safe property access (prototype-poisoning protected)
- ✅ Ternary operator (`condition ? a : b`)
- ✅ Logical operators (`&&`, `||`, `!`)
- ✅ Comparison operators (`==`, `!=`, `<`, `<=`, `>`, `>=`)
- ✅ `in` operator (arrays, strings, objects)
- ✅ Function allow-list (no arbitrary calls)
- ✅ Built-in explain / trace mode
- ✅ Hard limits (depth, size, complexity)
- ✅ Zero runtime dependencies
- ✅ Node & browser compatible

Designed for:
- Identity Provider attribute mapping (SAML / OIDC)
- Group assignment rules
- Policy preconditions
- Safe multi-tenant configuration

---

## ❌ Explicitly NOT included

CEL-lite intentionally does **not** support:

- Loops or comprehensions
- User-defined functions
- Mutation or side effects
- Access to globals, IO, network, or time
- Arbitrary JavaScript execution

This keeps it safe to evaluate on **authentication paths**.

---

## 📦 Installation

```bash
npm install @sourceregistry/cel-lite
````

---

## 🚀 Basic usage

```ts
import { compileCel } from "@sourceregistry/cel-lite";

const expr = compileCel("has(user.email) ? lower(user.email) : null");

const result = expr.eval({
  user: { email: "USER@EXAMPLE.COM" }
});

console.log(result);
// → "user@example.com"
```

---

## 🧠 Supported syntax

### Literals

```txt
true, false, null
123, -1, 3.14
"string", 'string'
[1, 2, "a"]
```

### Operators

```txt
==  !=  <  <=  >  >=
&&  ||  !
+   in
?: (ternary)
```

### Property access

```txt
user.email
saml.attributes["urn:mace:dir:attribute-def:mail"][0]
```

Missing properties resolve to `undefined` (safe).

---

## 🧩 Built-in functions

| Function                   | Description                   |
| -------------------------- | ----------------------------- |
| `has(x)` / `exists(x)`     | Checks defined / non-empty    |
| `size(x)`                  | Length of array/string/object |
| `first(x)`                 | First element or value        |
| `lower(s)` / `upper(s)`    | String casing                 |
| `trim(s)`                  | Trim whitespace               |
| `contains(a, b)`           | Array or string containment   |
| `containsAny(arr, values)` | Any value matches             |
| `startsWith(s, prefix)`    | String prefix                 |
| `endsWith(s, suffix)`      | String suffix                 |
| `matches(s, regex)`        | Regex test                    |
| `regexReplace(s, r, repl)` | Regex replace                 |
| `coalesce(a, b, ...)`      | First non-empty value         |
| `join(arr, sep)`           | Join array                    |
| `split(s, sep)`            | Split string                  |

Only allow-listed functions are callable.

---

## 🔍 Explain / trace mode

CEL-lite can explain *how* a result was produced.

```ts
const program = compileCel("size(groups) > 0 ? groups[0] : null");

const explained = program.explain({
  groups: ["Students", "Staff"]
});

console.log(explained.result);
// → "Students"

console.log(explained.trace);
// → evaluation steps (for UI / audit)
```

Useful for:

* admin UIs
* debugging mappers
* audit logging

---

## 🛡️ Safety guarantees

CEL-lite enforces:

* maximum expression length
* maximum AST nodes
* maximum call depth
* maximum trace entries
* blocked access to `__proto__`, `constructor`, `prototype`

It is safe to run on:

* login flows
* onboarding pipelines
* multi-tenant systems

---

## 📚 Related packages

* **@sourceregistry/monaco-cel-lite**
  Monaco Editor language + IntelliSense for CEL-lite

---

## 📄 License

Apache-2.0
