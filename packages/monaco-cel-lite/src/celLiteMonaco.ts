import type * as Monaco from "monaco-editor";

export type CelLiteFunctionSig = {
    name: string;
    detail?: string;          // short signature string
    documentation?: string;   // longer docs
    params?: string[];        // param names (for signature help)
};

export type CelLiteSymbol = {
    label: string;
    kind?: Monaco.languages.CompletionItemKind;
    detail?: string;
    documentation?: string;
};

export type RegisterCelLiteOptions = {
    languageId?: string; // default "cel-lite"
    functions?: CelLiteFunctionSig[];
    symbols?: CelLiteSymbol[];
};

const DEFAULT_FUNCS: CelLiteFunctionSig[] = [
    {
        name: "has",
        detail: "has(x) -> bool",
        documentation: "True if x is not null/undefined (arrays: length > 0).",
        params: ["x"]
    },
    {name: "exists", detail: "exists(x) -> bool", documentation: "Alias for has(x).", params: ["x"]},
    {
        name: "size",
        detail: "size(x) -> number",
        documentation: "Length of array/string; key count of object; else 0.",
        params: ["x"]
    },
    {
        name: "first",
        detail: "first(x) -> any",
        documentation: "First element of array; otherwise returns x.",
        params: ["x"]
    },

    {name: "lower", detail: "lower(s) -> string", documentation: "Lowercase string.", params: ["s"]},
    {name: "upper", detail: "upper(s) -> string", documentation: "Uppercase string.", params: ["s"]},
    {name: "trim", detail: "trim(s) -> string", documentation: "Trim whitespace.", params: ["s"]},

    {
        name: "contains",
        detail: "contains(haystack, needle) -> bool",
        documentation: "Array membership or substring match.",
        params: ["haystack", "needle"]
    },
    {
        name: "containsAny",
        detail: "containsAny(arr, values) -> bool",
        documentation: "True if any value in values is in arr.",
        params: ["arr", "values"]
    },

    {
        name: "startsWith",
        detail: "startsWith(s, prefix) -> bool",
        documentation: "String prefix check.",
        params: ["s", "prefix"]
    },
    {
        name: "endsWith",
        detail: "endsWith(s, suffix) -> bool",
        documentation: "String suffix check.",
        params: ["s", "suffix"]
    },
    {
        name: "matches",
        detail: "matches(s, regex) -> bool",
        documentation: "Regex test (JS RegExp).",
        params: ["s", "regex"]
    },
    {
        name: "regexReplace",
        detail: "regexReplace(s, regex, repl) -> string",
        documentation: "Regex replace (global).",
        params: ["s", "regex", "repl"]
    },

    {
        name: "coalesce",
        detail: "coalesce(a, b, ...) -> any",
        documentation: "First non-null/defined/non-empty array value.",
        params: ["a", "b", "..."]
    },
    {
        name: "join",
        detail: "join(arr, sep) -> string",
        documentation: "Join array items into string.",
        params: ["arr", "sep"]
    },
    {
        name: "split",
        detail: "split(s, sep) -> string[]",
        documentation: "Split string into array.",
        params: ["s", "sep"]
    },
];

const KEYWORDS = ["true", "false", "null", "in"];

export function registerCelLite(monaco: typeof import("monaco-editor"), opts: RegisterCelLiteOptions = {}) {

    const disposables: Monaco.IDisposable[] = [];

    const languageId = opts.languageId ?? "cel-lite";
    const functions = opts.functions ?? DEFAULT_FUNCS;
    const symbols = opts.symbols ?? defaultSymbols(monaco);

    // 1) Register language
    monaco.languages.register({id: languageId});

    // 2) Tokenizer (Monarch)
    disposables.push(monaco.languages.setMonarchTokensProvider(languageId, {
        keywords: KEYWORDS,
        functions: functions.map((f) => f.name),

        tokenizer: {
            root: [
                // whitespace
                {include: "@whitespace"},

                // identifiers + keywords + functions
                [/[a-zA-Z_][\w]*/, {
                    cases: {
                        "@keywords": "keyword",
                        "@functions": "function",
                        "@default": "identifier",
                    },
                }],

                // numbers
                [/-?\d+(\.\d+)?/, "number"],

                // strings
                [/'([^'\\]|\\.)*'/, "string"],
                [/"([^"\\]|\\.)*"/, "string"],

                // operators
                [/(\&\&)|(\|\|)|==|!=|<=|>=|<|>|\+|\!|\?|\:/, "operator"],

                // brackets / punctuation
                [/[()[\]{}]/, "@brackets"],
                [/[,\.]/, "delimiter"],

                // anything else
                [/./, "invalid"],
            ],

            whitespace: [
                [/[ \t\r\n]+/, "white"],
                [/\/\/.*$/, "comment"],
                [/\/\*/, "comment", "@comment"],
            ],

            comment: [
                [/[^\/*]+/, "comment"],
                [/\*\//, "comment", "@pop"],
                [/[\/*]/, "comment"],
            ],
        },
    }));

    // 3) Language configuration (brackets, comments, auto-close)
    disposables.push(monaco.languages.setLanguageConfiguration(languageId, {
        comments: {
            lineComment: "//",
            blockComment: ["/*", "*/"],
        },
        brackets: [
            ["(", ")"],
            ["[", "]"],
            ["{", "}"],
        ],
        autoClosingPairs: [
            {open: "(", close: ")"},
            {open: "[", close: "]"},
            {open: "{", close: "}"},
            {open: "'", close: "'"},
            {open: '"', close: '"'},
        ],
        surroundingPairs: [
            {open: "(", close: ")"},
            {open: "[", close: "]"},
            {open: "{", close: "}"},
            {open: "'", close: "'"},
            {open: '"', close: '"'},
        ],
    }));

    // 4) Completions
    disposables.push(monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: [".", "(", "[", "'", '"'],
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position);
            const range: Monaco.IRange = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const items: Monaco.languages.CompletionItem[] = [];

            // Keywords
            for (const kw of KEYWORDS) {
                items.push({
                    label: kw,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: kw,
                    range,
                });
            }

            // Functions: insert as snippet "fn($1)"
            for (const fn of functions) {
                items.push({
                    label: fn.name,
                    kind: monaco.languages.CompletionItemKind.Function,
                    detail: fn.detail,
                    documentation: fn.documentation,
                    insertText: fn.params?.length
                        ? `${fn.name}(${fn.params.map((_, i) => `\${${i + 1}}`).join(", ")})`
                        : `${fn.name}($1)`,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range,
                });
            }

            // Symbols (context variables)
            for (const s of symbols) {
                items.push({
                    label: s.label,
                    kind: s.kind ?? monaco.languages.CompletionItemKind.Variable,
                    detail: s.detail,
                    documentation: s.documentation,
                    insertText: s.label,
                    range,
                });
            }

            return {suggestions: items};
        },
    }));

    // 5) Hover (functions)
    disposables.push(monaco.languages.registerHoverProvider(languageId, {
        provideHover(model, position) {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const fn = functions.find((f) => f.name === word.word);
            if (!fn) return null;

            return {
                range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                contents: [
                    {value: `**${fn.name}**`},
                    fn.detail ? {value: `\`${fn.detail}\``} : {value: ""},
                    fn.documentation ? {value: fn.documentation} : {value: ""},
                ].filter((c) => c.value && c.value.trim().length > 0),
            };
        },
    }));

    // 6) Signature help (basic): shows params when inside fn(...)
    disposables.push(monaco.languages.registerSignatureHelpProvider(languageId, {
        signatureHelpTriggerCharacters: ["(", ","],
        provideSignatureHelp(model, position) {
            const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);

            // naive parse: find last "ident(" before cursor
            const m = /([a-zA-Z_]\w*)\s*\(([^()]*)$/.exec(line);
            if (!m) return {
                value: {signatures: [], activeSignature: 0, activeParameter: 0}, dispose: () => {
                }
            };

            const fnName = m[1];
            const argsSoFar = m[2] ?? "";
            const activeParam = argsSoFar.length === 0 ? 0 : argsSoFar.split(",").length - 1;

            const fn = functions.find((f) => f.name === fnName);
            if (!fn) return {
                value: {signatures: [], activeSignature: 0, activeParameter: 0}, dispose: () => {
                }
            };

            const params = (fn.params ?? ["x"]).map((p) => ({label: p}));

            return {
                value: {
                    signatures: [
                        {
                            label: fn.detail ?? `${fn.name}(...)`,
                            documentation: fn.documentation ? {value: fn.documentation} : undefined,
                            parameters: params,
                        },
                    ],
                    activeSignature: 0,
                    activeParameter: Math.max(0, Math.min(activeParam, params.length - 1)),
                },
                dispose: () => {
                },
            };
        },
    }));

    return {
        languageId,
        dispose: () => disposables.forEach(d => d.dispose())
    };
}

function defaultSymbols(monaco: typeof import("monaco-editor")): CelLiteSymbol[] {
    return [
        {label: "saml", kind: monaco.languages.CompletionItemKind.Module, detail: "SAML context root"},
        {
            label: "saml.attributes",
            kind: monaco.languages.CompletionItemKind.Property,
            detail: "Map of SAML attribute -> string[]"
        },

        {label: "oidc", kind: monaco.languages.CompletionItemKind.Module, detail: "OIDC context root"},
        {label: "oidc.claims", kind: monaco.languages.CompletionItemKind.Property, detail: "OIDC claims map"},

        {label: "claim", kind: monaco.languages.CompletionItemKind.Variable, detail: "Mapped claims (output bag)"},
        {
            label: "attr",
            kind: monaco.languages.CompletionItemKind.Variable,
            detail: "Mapped custom attributes (output bag)"
        },

        {label: "user", kind: monaco.languages.CompletionItemKind.Variable, detail: "Current user (read-only view)"},
        {label: "provider", kind: monaco.languages.CompletionItemKind.Variable, detail: "IdentityProvider info"},
        {label: "realm", kind: monaco.languages.CompletionItemKind.Variable, detail: "Realm info"},
        {label: "session", kind: monaco.languages.CompletionItemKind.Variable, detail: "Session metadata"},
    ];
}
