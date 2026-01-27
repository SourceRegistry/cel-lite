/*
   Dependency-free CEL-like expression compiler + evaluator for IdP mapping.
   Includes:
   - has(x) alias (same as exists)
   - ternary: cond ? a : b
   - explain(): returns evaluation trace (AST node -> value)
*/

export type CelContext = Record<string, any>;

export type CelOptions = {
    maxExpressionLength?: number; // default 4096
    maxAstNodes?: number;         // default 2000
    maxCallDepth?: number;        // default 50
    maxTraceEntries?: number;     // default 5000 (avoid huge traces)
};

export type CelExplainEntry = {
    id: number;
    kind: string;
    expr: string;
    value: any;
};

export type CelExplainResult = {
    result: any;
    trace: CelExplainEntry[];
};

export class CelError extends Error {
    constructor(message: string, public readonly position?: number) {
        super(position != null ? `${message} (at ${position})` : message);
        this.name = "CelError";
    }
}

/* ---------------------------------- API ---------------------------------- */

export class CelProgram {
    constructor(
        public readonly source: string,
        private readonly ast: Expr,
        private readonly opts: Required<CelOptions>,
    ) {
    }

    eval(ctx: CelContext): any {
        const state: EvalState = {callDepth: 0, opts: this.opts};
        return evalExpr(this.ast, ctx, state);
    }

    explain(ctx: CelContext): CelExplainResult {
        const trace: CelExplainEntry[] = [];
        const state: EvalState = {callDepth: 0, opts: this.opts, trace};
        const result = evalExpr(this.ast, ctx, state);
        return {result, trace};
    }
}

export function compileCel(source: string, opts: CelOptions = {}): CelProgram {
    const options: Required<CelOptions> = {
        maxExpressionLength: opts.maxExpressionLength ?? 4096,
        maxAstNodes: opts.maxAstNodes ?? 2000,
        maxCallDepth: opts.maxCallDepth ?? 50,
        maxTraceEntries: opts.maxTraceEntries ?? 5000,
    };

    if (source.length > options.maxExpressionLength) {
        throw new CelError(`Expression too long (>${options.maxExpressionLength})`);
    }

    const parser = new Parser(source, options.maxAstNodes);
    const ast = parser.parse();
    return new CelProgram(source, ast, options);
}

/* ------------------------------ Tokenization ------------------------------ */

type TokenType =
    | "eof"
    | "ident"
    | "number"
    | "string"
    | "true"
    | "false"
    | "null"
    | "lparen"
    | "rparen"
    | "lbrack"
    | "rbrack"
    | "comma"
    | "dot"
    | "plus"
    | "bang"
    | "andand"
    | "oror"
    | "eqeq"
    | "neq"
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "in"
    | "question"
    | "colon";

type Token = { type: TokenType; text: string; pos: number; value?: any };

class Lexer {
    private i = 0;

    constructor(private readonly src: string) {
    }

    next(): Token {
        this.skipWs();
        const pos = this.i;
        if (this.i >= this.src.length) return {type: "eof", text: "", pos};

        const ch = this.src[this.i];

        if (ch === "(") return this.take1("lparen");
        if (ch === ")") return this.take1("rparen");
        if (ch === "[") return this.take1("lbrack");
        if (ch === "]") return this.take1("rbrack");
        if (ch === ",") return this.take1("comma");
        if (ch === ".") return this.take1("dot");
        if (ch === "+") return this.take1("plus");
        if (ch === "?") return this.take1("question");
        if (ch === ":") return this.take1("colon");

        if (ch === "!") {
            if (this.peek("!=")) return this.take2("neq");
            return this.take1("bang");
        }
        if (ch === "&" && this.peek("&&")) return this.take2("andand");
        if (ch === "|" && this.peek("||")) return this.take2("oror");
        if (ch === "=" && this.peek("==")) return this.take2("eqeq");
        if (ch === "<") {
            if (this.peek("<=")) return this.take2("lte");
            return this.take1("lt");
        }
        if (ch === ">") {
            if (this.peek(">=")) return this.take2("gte");
            return this.take1("gt");
        }

        if (ch === "'" || ch === '"') return this.readString();

        if (isDigit(ch) || (ch === "-" && isDigit(this.src[this.i + 1] ?? ""))) {
            return this.readNumber();
        }

        if (isIdentStart(ch)) return this.readIdent();

        throw new CelError(`Unexpected character '${ch}'`, pos);
    }

    private take1(type: TokenType): Token {
        const pos = this.i;
        const text = this.src[this.i++];
        return {type, text, pos};
    }

    private take2(type: TokenType): Token {
        const pos = this.i;
        const text = this.src.slice(this.i, this.i + 2);
        this.i += 2;
        return {type, text, pos};
    }

    private peek(s: string) {
        return this.src.slice(this.i, this.i + s.length) === s;
    }

    private skipWs() {
        while (this.i < this.src.length) {
            const c = this.src[this.i];
            if (c === " " || c === "\t" || c === "\n" || c === "\r") this.i++;
            else break;
        }
    }

    private readString(): Token {
        const quote = this.src[this.i];
        const pos = this.i;
        this.i++;
        let out = "";
        while (this.i < this.src.length) {
            const c = this.src[this.i++];
            if (c === quote) {
                return {type: "string", text: this.src.slice(pos, this.i), pos, value: out};
            }
            if (c === "\\") {
                const n = this.src[this.i++];
                if (n === "n") out += "\n";
                else if (n === "r") out += "\r";
                else if (n === "t") out += "\t";
                else if (n === "\\" || n === "'" || n === '"') out += n;
                else throw new CelError(`Invalid escape \\${n}`, this.i - 2);
            } else {
                out += c;
            }
        }
        throw new CelError("Unterminated string", pos);
    }

    private readNumber(): Token {
        const pos = this.i;
        let s = "";
        if (this.src[this.i] === "-") s += this.src[this.i++];

        while (this.i < this.src.length && isDigit(this.src[this.i])) s += this.src[this.i++];
        if (this.src[this.i] === ".") {
            s += this.src[this.i++];
            while (this.i < this.src.length && isDigit(this.src[this.i])) s += this.src[this.i++];
        }
        const n = Number(s);
        if (!Number.isFinite(n)) throw new CelError("Invalid number", pos);
        return {type: "number", text: s, pos, value: n};
    }

    private readIdent(): Token {
        const pos = this.i;
        let s = "";
        while (this.i < this.src.length && isIdentPart(this.src[this.i])) {
            s += this.src[this.i++];
        }

        if (s === "true") return {type: "true", text: s, pos, value: true};
        if (s === "false") return {type: "false", text: s, pos, value: false};
        if (s === "null") return {type: "null", text: s, pos, value: null};
        if (s === "in") return {type: "in", text: s, pos};

        return {type: "ident", text: s, pos, value: s};
    }
}

function isDigit(c: string) {
    return c >= "0" && c <= "9";
}

function isIdentStart(c: string) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
}

function isIdentPart(c: string) {
    return isIdentStart(c) || isDigit(c);
}

/* ---------------------------------- AST ---------------------------------- */

type ExprBase = { id: number; pos: number };

type Expr =
    | ({ kind: "lit"; value: any } & ExprBase)
    | ({ kind: "ident"; name: string } & ExprBase)
    | ({ kind: "get"; obj: Expr; prop: string } & ExprBase)
    | ({ kind: "idx"; obj: Expr; index: Expr } & ExprBase)
    | ({ kind: "call"; callee: Expr; args: Expr[] } & ExprBase)
    | ({ kind: "unary"; op: "!"; right: Expr } & ExprBase)
    | ({ kind: "bin"; op: string; left: Expr; right: Expr } & ExprBase)
    | ({ kind: "array"; items: Expr[] } & ExprBase)
    | ({ kind: "ternary"; cond: Expr; thenExpr: Expr; elseExpr: Expr } & ExprBase);

/* --------------------------------- Parser -------------------------------- */

class Parser {
    private lex: Lexer;
    private cur: Token;
    private nodeCount = 0;
    private nextId = 1;

    constructor(source: string, private readonly maxNodes: number) {
        this.lex = new Lexer(source);
        this.cur = this.lex.next();
    }

    parse(): Expr {
        const e = this.parseTernary();
        this.expect("eof");
        return e;
    }

    private parseTernary(): Expr {
        let cond = this.parseOr();

        if (this.match("question")) {
            const pos = this.prevPos();
            const thenExpr = this.parseTernary();
            this.expect("colon");
            const elseExpr = this.parseTernary();
            cond = this.node({kind: "ternary", cond, thenExpr, elseExpr, pos});
        }

        return cond;
    }

    private parseOr(): Expr {
        let left = this.parseAnd();
        while (this.match("oror")) {
            const pos = this.prevPos();
            const right = this.parseAnd();
            left = this.node({kind: "bin", op: "||", left, right, pos});
        }
        return left;
    }

    private parseAnd(): Expr {
        let left = this.parseEquality();
        while (this.match("andand")) {
            const pos = this.prevPos();
            const right = this.parseEquality();
            left = this.node({kind: "bin", op: "&&", left, right, pos});
        }
        return left;
    }

    private parseEquality(): Expr {
        let left = this.parseRel();
        while (true) {
            if (this.match("eqeq")) {
                const pos = this.prevPos();
                const right = this.parseRel();
                left = this.node({kind: "bin", op: "==", left, right, pos});
                continue;
            }
            if (this.match("neq")) {
                const pos = this.prevPos();
                const right = this.parseRel();
                left = this.node({kind: "bin", op: "!=", left, right, pos});
                continue;
            }
            if (this.match("in")) {
                const pos = this.prevPos();
                const right = this.parseRel();
                left = this.node({kind: "bin", op: "in", left, right, pos});
                continue;
            }
            break;
        }
        return left;
    }

    private parseRel(): Expr {
        let left = this.parseAdd();
        while (true) {
            if (this.match("lt")) {
                const pos = this.prevPos();
                const right = this.parseAdd();
                left = this.node({kind: "bin", op: "<", left, right, pos});
                continue;
            }
            if (this.match("lte")) {
                const pos = this.prevPos();
                const right = this.parseAdd();
                left = this.node({kind: "bin", op: "<=", left, right, pos});
                continue;
            }
            if (this.match("gt")) {
                const pos = this.prevPos();
                const right = this.parseAdd();
                left = this.node({kind: "bin", op: ">", left, right, pos});
                continue;
            }
            if (this.match("gte")) {
                const pos = this.prevPos();
                const right = this.parseAdd();
                left = this.node({kind: "bin", op: ">=", left, right, pos});
                continue;
            }
            break;
        }
        return left;
    }

    private parseAdd(): Expr {
        let left = this.parseUnary();
        while (this.match("plus")) {
            const pos = this.prevPos();
            const right = this.parseUnary();
            left = this.node({kind: "bin", op: "+", left, right, pos});
        }
        return left;
    }

    private parseUnary(): Expr {
        if (this.match("bang")) {
            const pos = this.prevPos();
            const right = this.parseUnary();
            return this.node({kind: "unary", op: "!", right, pos});
        }
        return this.parsePostfix();
    }

    private parsePostfix(): Expr {
        let expr = this.parsePrimary();

        while (true) {
            if (this.match("dot")) {
                const pos = this.prevPos();
                const name = this.expect("ident").value as string;
                expr = this.node({kind: "get", obj: expr, prop: name, pos});
                continue;
            }

            if (this.match("lbrack")) {
                const pos = this.prevPos();
                const idx = this.parseTernary();
                this.expect("rbrack");
                expr = this.node({kind: "idx", obj: expr, index: idx, pos});
                continue;
            }

            if (this.match("lparen")) {
                const pos = this.prevPos();
                const args: Expr[] = [];
                if (!this.check("rparen")) {
                    do {
                        args.push(this.parseTernary());
                    } while (this.match("comma"));
                }
                this.expect("rparen");
                expr = this.node({kind: "call", callee: expr, args, pos});
                continue;
            }

            break;
        }

        return expr;
    }

    private parsePrimary(): Expr {
        const t = this.cur;

        if (this.match("number") || this.match("string") || this.match("true") || this.match("false") || this.match("null")) {
            return this.node({kind: "lit", value: t.value, pos: t.pos});
        }

        if (this.match("ident")) {
            return this.node({kind: "ident", name: t.value as string, pos: t.pos});
        }

        if (this.match("lparen")) {
            const e = this.parseTernary();
            this.expect("rparen");
            return e;
        }

        if (this.match("lbrack")) {
            const pos = t.pos;
            const items: Expr[] = [];
            if (!this.check("rbrack")) {
                do {
                    items.push(this.parseTernary());
                } while (this.match("comma"));
            }
            this.expect("rbrack");
            return this.node({kind: "array", items, pos});
        }

        throw new CelError(`Unexpected token ${t.type}`, t.pos);
    }

    private node<T extends Omit<Expr, "id">>(n: T): Expr {
        this.nodeCount++;
        if (this.nodeCount > this.maxNodes) throw new CelError(`Expression too complex (>${this.maxNodes} nodes)`);
        return {...(n as any), id: this.nextId++};
    }

    private check(type: TokenType) {
        return this.cur.type === type;
    }

    private match(type: TokenType): boolean {
        if (this.cur.type === type) {
            this.cur = this.lex.next();
            return true;
        }
        return false;
    }

    private expect(type: TokenType): Token {
        if (this.cur.type !== type) {
            throw new CelError(`Expected ${type} but got ${this.cur.type}`, this.cur.pos);
        }
        const t = this.cur;
        this.cur = this.lex.next();
        return t;
    }

    private prevPos(): number {
        return this.cur.pos;
    }
}

/* ------------------------------- Explain helper --------------------------- */

function exprToString(e: Expr): string {
    switch (e.kind) {
        case "lit":
            return typeof e.value === "string" ? JSON.stringify(e.value) : String(e.value);
        case "ident":
            return e.name;
        case "get":
            return `${exprToString(e.obj)}.${e.prop}`;
        case "idx":
            return `${exprToString(e.obj)}[${exprToString(e.index)}]`;
        case "array":
            return `[${e.items.map(exprToString).join(", ")}]`;
        case "call":
            return `${exprToString(e.callee)}(${e.args.map(exprToString).join(", ")})`;
        case "unary":
            return `!${exprToString(e.right)}`;
        case "bin":
            return `(${exprToString(e.left)} ${e.op} ${exprToString(e.right)})`;
        case "ternary":
            return `(${exprToString(e.cond)} ? ${exprToString(e.thenExpr)} : ${exprToString(e.elseExpr)})`;
    }
}

/* ------------------------------- Evaluation ------------------------------- */

type EvalState = {
    callDepth: number;
    opts: Required<CelOptions>;
    trace?: CelExplainEntry[];
};

function tracePush(st: EvalState, e: Expr, value: any) {
    if (!st.trace) return;
    if (st.trace.length >= st.opts.maxTraceEntries) return;

    st.trace.push({
        id: e.id,
        kind: e.kind,
        expr: exprToString(e),
        value,
    });
}

function evalExpr(expr: Expr, ctx: CelContext, st: EvalState): any {
    let out: any;

    switch (expr.kind) {
        case "lit":
            out = expr.value;
            break;

        case "array":
            out = expr.items.map((x) => evalExpr(x, ctx, st));
            break;

        case "ident":
            out = ctx[expr.name];
            break;

        case "get": {
            const obj = evalExpr(expr.obj, ctx, st);
            if (obj == null) out = undefined;
            else if (isPoisonKey(expr.prop)) out = undefined;
            else out = obj[expr.prop];
            break;
        }

        case "idx": {
            const obj = evalExpr(expr.obj, ctx, st);
            const idx = evalExpr(expr.index, ctx, st);
            if (obj == null) out = undefined;
            else if (typeof idx === "number") out = obj[idx];
            else if (typeof idx === "string") out = isPoisonKey(idx) ? undefined : obj[idx];
            else out = undefined;
            break;
        }

        case "unary": {
            const v = evalExpr(expr.right, ctx, st);
            out = !truthy(v);
            break;
        }

        case "bin": {
            const left = evalExpr(expr.left, ctx, st);

            if (expr.op === "&&") {
                out = truthy(left) ? truthy(evalExpr(expr.right, ctx, st)) : false;
                break;
            }
            if (expr.op === "||") {
                out = truthy(left) ? true : truthy(evalExpr(expr.right, ctx, st));
                break;
            }

            const right = evalExpr(expr.right, ctx, st);

            switch (expr.op) {
                case "==":
                    out = deepEqual(left, right);
                    break;
                case "!=":
                    out = !deepEqual(left, right);
                    break;
                case "<":
                    out = Number(left) < Number(right);
                    break;
                case "<=":
                    out = Number(left) <= Number(right);
                    break;
                case ">":
                    out = Number(left) > Number(right);
                    break;
                case ">=":
                    out = Number(left) >= Number(right);
                    break;
                case "+":
                    out = add(left, right);
                    break;
                case "in":
                    out = inOp(left, right);
                    break;
                default:
                    throw new CelError(`Unknown binary op ${expr.op}`, expr.pos);
            }
            break;
        }

        case "ternary": {
            const cond = evalExpr(expr.cond, ctx, st);
            out = truthy(cond) ? evalExpr(expr.thenExpr, ctx, st) : evalExpr(expr.elseExpr, ctx, st);
            break;
        }

        case "call": {
            st.callDepth++;
            if (st.callDepth > st.opts.maxCallDepth) {
                throw new CelError(`Max call depth exceeded (>${st.opts.maxCallDepth})`, expr.pos);
            }

            const callee = expr.callee;

            let fnName: string | undefined;
            let receiver: any = undefined;

            if (callee.kind === "ident") {
                fnName = callee.name;
            } else if (callee.kind === "get") {
                receiver = evalExpr(callee.obj, ctx, st);
                fnName = callee.prop;
            } else {
                throw new CelError("Invalid function call target", expr.pos);
            }

            const args = expr.args.map((a) => evalExpr(a, ctx, st));
            out = callFunction(fnName, receiver, args, expr.pos);

            st.callDepth--;
            break;
        }
    }

    tracePush(st, expr, out);
    return out;
}

function truthy(v: any): boolean {
    return !!v;
}

function add(a: any, b: any) {
    if (typeof a === "string" || typeof b === "string") return String(a ?? "") + String(b ?? "");
    return Number(a) + Number(b);
}

function inOp(needle: any, haystack: any): boolean {
    if (Array.isArray(haystack)) return haystack.some((x) => deepEqual(x, needle));
    if (typeof haystack === "string") return typeof needle === "string" ? haystack.includes(needle) : false;
    if (haystack && typeof haystack === "object") return needle in haystack;
    return false;
}

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
        return true;
    }

    if (typeof a === "object" && typeof b === "object") {
        const ak = Object.keys(a);
        const bk = Object.keys(b);
        if (ak.length !== bk.length) return false;
        for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
        return true;
    }

    return false;
}

function isPoisonKey(k: string) {
    return k === "__proto__" || k === "constructor" || k === "prototype";
}

/* ------------------------------ Function allowlist ------------------------ */

function callFunction(name: string | undefined, _receiver: any, args: any[], pos: number): any {
    if (!name) throw new CelError("Missing function name", pos);

    switch (name) {
        case "exists":
        case "has": {
            const x = args[0];
            if (Array.isArray(x)) return x.length > 0;
            return x !== undefined && x !== null;
        }

        case "size": {
            const x = args[0];
            if (Array.isArray(x) || typeof x === "string") return x.length;
            if (x && typeof x === "object") return Object.keys(x).length;
            return 0;
        }

        case "first": {
            const x = args[0];
            return Array.isArray(x) ? x[0] : x;
        }
        case "last": {
            const x = args[0];
            return Array.isArray(x) ? x[x.length - 1] : x;
        }
        case "collect": {
            if (args.length <= 1) {
                const x = args[0];
                return Array.isArray(x) ? x : [x];
            }
            
            return args;
        }
        case "lower":
            return typeof args[0] === "string" ? args[0].toLowerCase() : args[0];
        case "upper":
            return typeof args[0] === "string" ? args[0].toUpperCase() : args[0];
        case "trim":
            return typeof args[0] === "string" ? args[0].trim() : args[0];

        case "contains": {
            const a = args[0], b = args[1];
            if (Array.isArray(a)) return a.some((x) => deepEqual(x, b));
            if (typeof a === "string") return typeof b === "string" ? a.includes(b) : false;
            return false;
        }

        case "containsAny": {
            const a = args[0], b = args[1];
            if (!Array.isArray(a) || !Array.isArray(b)) return false;
            return b.some((x) => a.some((y) => deepEqual(y, x)));
        }

        case "startsWith": {
            const s = args[0], p = args[1];
            return typeof s === "string" && typeof p === "string" ? s.startsWith(p) : false;
        }

        case "endsWith": {
            const s = args[0], p = args[1];
            return typeof s === "string" && typeof p === "string" ? s.endsWith(p) : false;
        }

        case "matches": {
            const s = args[0], re = args[1];
            if (typeof s !== "string" || typeof re !== "string") return false;
            const r = new RegExp(re);
            return r.test(s);
        }

        case "regexReplace": {
            const s = args[0], re = args[1], repl = args[2];
            if (typeof s !== "string" || typeof re !== "string" || typeof repl !== "string") return s;
            const r = new RegExp(re, "g");
            return s.replace(r, repl);
        }

        case "coalesce": {
            for (const v of args) {
                if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) return v;
            }
            return undefined;
        }

        case "join": {
            const arr = args[0], sep = args[1] ?? ",";
            if (!Array.isArray(arr)) return typeof arr === "string" ? arr : "";
            return arr.map((x) => String(x)).join(String(sep));
        }

        case "split": {
            const s = args[0], sep = args[1] ?? ",";
            if (typeof s !== "string") return [];
            return s.split(String(sep));
        }

        default:
            throw new CelError(`Function not allowed: ${name}`, pos);
    }
}
