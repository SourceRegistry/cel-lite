<div align="center">

# @sourceregistry/cel-lite

**A small, dependency-free CEL-inspired expression compiler and evaluator**

[![npm version](https://img.shields.io/npm/v/@sourceregistry/cel-lite?style=flat-square&color=f96743)](https://www.npmjs.com/package/@sourceregistry/cel-lite)
[![npm downloads](https://img.shields.io/npm/dm/@sourceregistry/cel-lite?style=flat-square)](https://www.npmjs.com/package/@sourceregistry/cel-lite)
[![license](https://img.shields.io/npm/l/@sourceregistry/cel-lite?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/node/v/@sourceregistry/cel-lite?style=flat-square)](https://www.npmjs.com/package/@sourceregistry/cel-lite)
[![issues](https://img.shields.io/github/issues/SourceRegistry/cel-lite?style=flat-square)](https://github.com/SourceRegistry/cel-lite/issues)

Evaluate safe, auditable expressions for identity mapping, policy checks, group assignment, and multi-tenant configuration. CEL-lite is inspired by Google's Common Expression Language, but intentionally implements a smaller deterministic subset.

[Docs](https://sourceregistry.github.io/cel-lite) | [npm](https://www.npmjs.com/package/@sourceregistry/cel-lite) | [Issues](https://github.com/SourceRegistry/cel-lite/issues)

</div>

---

## Installation

```sh
npm install @sourceregistry/cel-lite
```

CEL-lite has zero runtime dependencies and works in Node and browser runtimes.

---

## Overview

```ts
import { compileCel } from '@sourceregistry/cel-lite';

const program = compileCel("has(user.email) ? lower(trim(user.email)) : null");

const result = program.eval({
    user: { email: 'USER@EXAMPLE.COM' },
});

console.log(result); // user@example.com
```

Compile expressions once, then evaluate them against request-specific context objects.

```ts
const isStudent = compileCel("'student' in saml.attributes.eduPersonAffiliation");

isStudent.eval({
    saml: {
        attributes: {
            eduPersonAffiliation: ['member', 'student'],
        },
    },
}); // true
```

---

## Core API

### `compileCel(source, options?)`

Parses and validates an expression, then returns a reusable `CelProgram`.

```ts
import { compileCel } from '@sourceregistry/cel-lite';

const program = compileCel("coalesce(first(mail), 'n/a')", {
    maxExpressionLength: 4096,
    maxAstNodes: 2000,
});
```

Invalid expressions throw `CelError` with a message and source position when available.

### `program.eval(context)`

Evaluates the compiled expression against a plain context object.

```ts
const email = program.eval({
    mail: ['user@example.com'],
});
```

Evaluation has no side effects, does not mutate the context, and only supports allow-listed functions.

### `program.explain(context)`

Evaluates the expression and returns a trace of intermediate AST values.

```ts
const explained = compileCel("size(groups) > 0 ? groups[0] : null").explain({
    groups: ['Students', 'Staff'],
});

console.log(explained.result); // Students
console.table(explained.trace);
```

Use explain mode for admin previews, mapper debugging, and audit tooling. Keep trace limits configured for untrusted or high-volume inputs.

---

## Expression Syntax

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
?:  ternary
```

### Access

```txt
user.email
saml.attributes["urn:mace:dir:attribute-def:mail"][0]
```

Missing paths resolve to `undefined`. Object access only reads own properties. Inherited properties and the keys `__proto__`, `constructor`, and `prototype` are blocked everywhere, including root identifiers.

For objects, `in` checks own properties only:

```txt
"email" in user       // true when user has its own "email" property
"toString" in user    // false
```

---

## Built-In Functions

| Function                   | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `has(x)` / `exists(x)`     | Checks defined values; arrays must be non-empty  |
| `size(x)`                  | Length of an array/string or own-key object count |
| `first(x)`                 | First array element, otherwise the value itself  |
| `last(x)`                  | Last array element, otherwise the value itself   |
| `collect(a, b, ...)`       | Collects arguments into an array                 |
| `lower(s)` / `upper(s)`    | String casing                                    |
| `trim(s)`                  | Trim whitespace                                  |
| `contains(a, b)`           | Array membership or string containment           |
| `containsAny(arr, values)` | True when any value matches                      |
| `startsWith(s, prefix)`    | String prefix check                              |
| `endsWith(s, suffix)`      | String suffix check                              |
| `matches(s, regex)`        | Guarded JavaScript regex test                    |
| `regexReplace(s, r, repl)` | Guarded global JavaScript regex replace          |
| `coalesce(a, b, ...)`      | First non-null, defined, non-empty-array value   |
| `join(arr, sep)`           | Join array items into a string                   |
| `split(s, sep)`            | Split a string into an array                     |

Only these functions are callable. Arbitrary JavaScript functions, globals, imports, IO, network access, time access, mutation, loops, and user-defined functions are intentionally not supported.

---

## Regex Safety

`matches` and `regexReplace` use JavaScript `RegExp`, but CEL-lite applies conservative checks before compilation:

- regex pattern length is limited;
- regex input length is limited;
- backreferences are rejected;
- common nested and ambiguous repetition forms are rejected;
- invalid regex syntax is wrapped in `CelError`.

These guards reduce ReDoS risk without adding dependencies. JavaScript does not provide a synchronous regex timeout, so applications that accept arbitrary regex from untrusted users should run evaluation behind a host-level worker or process timeout.

---

## Limits

CEL-lite enforces compile-time and runtime limits.

```ts
const program = compileCel("matches(email, pattern)", {
    maxExpressionLength: 4096,
    maxAstNodes: 2000,
    maxCallDepth: 50,
    maxTraceEntries: 5000,
    maxCollectionLength: 10000,
    maxStringLength: 65536,
    maxCompareDepth: 50,
    maxRegexPatternLength: 256,
    maxRegexInputLength: 4096,
});
```

| Option                  | Default | Purpose                                      |
| ----------------------- | ------- | -------------------------------------------- |
| `maxExpressionLength`   | `4096`  | Maximum source string length                 |
| `maxAstNodes`           | `2000`  | Maximum parsed AST size                      |
| `maxCallDepth`          | `50`    | Maximum nested function calls                |
| `maxTraceEntries`       | `5000`  | Maximum explain-mode trace entries           |
| `maxCollectionLength`   | `10000` | Maximum array/object size for expensive scans |
| `maxStringLength`       | `65536` | Maximum string length for selected helpers   |
| `maxCompareDepth`       | `50`    | Maximum recursive object/array compare depth |
| `maxRegexPatternLength` | `256`   | Maximum regex pattern length                 |
| `maxRegexInputLength`   | `4096`  | Maximum input length for regex operations    |

---

## Production Guidance

- Compile expressions before hot paths when possible and reuse `CelProgram` instances.
- Treat context objects as data, not capability containers.
- Use plain data objects or null-prototype objects for untrusted context data.
- Keep regex support behind conservative limits, or isolate evaluation in a worker/process for hard timeouts.
- Keep `maxCollectionLength` and `maxCompareDepth` low for tenant-controlled input.
- Use `explain()` for admin tooling, not every production request.
- Add regression tests for tenant expressions, mapping rules, and authorization conditions.
- Keep dependency audit clean in CI, including workspace packages.

---

## Type Reference

```ts
compileCel(source, options?)

CelProgram
CelProgram.eval(context)
CelProgram.explain(context)

CelContext
CelOptions
CelExplainEntry
CelExplainResult
CelError
```

---

## Related Packages

- [`@sourceregistry/monaco-cel-lite`](https://www.npmjs.com/package/@sourceregistry/monaco-cel-lite) provides Monaco Editor syntax highlighting, completion, hover documentation, and signature help for CEL-lite expressions.

---

## Testing

```sh
npm test
npm run lint
```

---

## License

[Apache-2.0](./LICENSE) (c) [A.P.A. Slaa](https://github.com/SourceRegistry)
