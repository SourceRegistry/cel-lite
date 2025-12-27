import { describe, it, expect } from "vitest";
import {CelError, compileCel} from "../src";

describe("CEL-lite: literals", () => {
    it("evaluates booleans, null, numbers, strings", () => {
        expect(compileCel("true").eval({})).toBe(true);
        expect(compileCel("false").eval({})).toBe(false);
        expect(compileCel("null").eval({})).toBe(null);

        expect(compileCel("123").eval({})).toBe(123);
        expect(compileCel("-1").eval({})).toBe(-1);
        expect(compileCel("3.14").eval({})).toBe(3.14);

        expect(compileCel("'hi'").eval({})).toBe("hi");
        expect(compileCel('"hi"').eval({})).toBe("hi");
    });

    it("supports escapes in strings", () => {
        expect(compileCel("'a\\n b'").eval({})).toBe("a\n b");
        expect(compileCel("'\\''").eval({})).toBe("'");
        expect(compileCel('"\\\""').eval({})).toBe('"');
    });
});

describe("CEL-lite: arrays, access", () => {
    it("evaluates array literals", () => {
        expect(compileCel("['a', 'b', 1]").eval({})).toEqual(["a", "b", 1]);
    });

    it("supports property access and indexing", () => {
        const ctx = {
            saml: {
                attributes: {
                    mail: ["USER@EXAMPLE.COM", "ALT@EXAMPLE.COM"],
                },
            },
        };

        expect(compileCel("saml.attributes.mail[0]").eval(ctx)).toBe("USER@EXAMPLE.COM");
        expect(compileCel("saml.attributes.mail[1]").eval(ctx)).toBe("ALT@EXAMPLE.COM");
    });

    it("supports bracket indexing by string key", () => {
        const ctx = {
            saml: {
                attributes: {
                    "urn:mace:dir:attribute-def:mail": ["x@y.z"],
                },
            },
        };

        expect(
            compileCel("saml.attributes['urn:mace:dir:attribute-def:mail'][0]").eval(ctx),
        ).toBe("x@y.z");
    });

    it("returns undefined on missing paths (null-safe-ish)", () => {
        expect(compileCel("user.profile.email").eval({ user: {} })).toBe(undefined);
        expect(compileCel("user.profile.email").eval({ user: { profile: null } })).toBe(undefined);
    });

    it("blocks poison keys (__proto__/constructor/prototype)", () => {
        const ctx: any = {
            obj: {
                "__proto__": { hacked: true },
                constructor: { hacked: true },
                prototype: { hacked: true },
                safe: { ok: true },
            },
        };

        expect(compileCel("obj.safe.ok").eval(ctx)).toBe(true);
        expect(compileCel("obj.__proto__").eval(ctx)).toBe(undefined);
        expect(compileCel("obj['__proto__']").eval(ctx)).toBe(undefined);
        expect(compileCel("obj.constructor").eval(ctx)).toBe(undefined);
        expect(compileCel("obj.prototype").eval(ctx)).toBe(undefined);
    });
});

describe("CEL-lite: operators", () => {
    it("supports equality and relational ops", () => {
        expect(compileCel("1 == 1").eval({})).toBe(true);
        expect(compileCel("1 != 2").eval({})).toBe(true);
        expect(compileCel("1 < 2").eval({})).toBe(true);
        expect(compileCel("2 <= 2").eval({})).toBe(true);
        expect(compileCel("3 > 2").eval({})).toBe(true);
        expect(compileCel("3 >= 3").eval({})).toBe(true);
    });

    it("supports logical ops with short-circuit", () => {
        const ctx = { a: true, b: false };
        expect(compileCel("a && b").eval(ctx)).toBe(false);
        expect(compileCel("a || b").eval(ctx)).toBe(true);
        expect(compileCel("!b").eval(ctx)).toBe(true);

        // short-circuit: right side not evaluated (would throw if evaluated)
        expect(compileCel("true || unknownFunc(1)").eval(ctx)).toBe(true);
        expect(compileCel("false && unknownFunc(1)").eval(ctx)).toBe(false);
    });

    it("supports + for numeric add and string concat", () => {
        expect(compileCel("1 + 2").eval({})).toBe(3);
        expect(compileCel("'a' + 'b'").eval({})).toBe("ab");
        expect(compileCel("'a' + 1").eval({})).toBe("a1");
    });

    it("supports in operator for arrays, strings, objects", () => {
        expect(compileCel("'a' in ['a','b']").eval({})).toBe(true);
        expect(compileCel("'x' in 'text'").eval({})).toBe(true);
        expect(compileCel("'missing' in 'text'").eval({})).toBe(false);

        expect(compileCel("'k' in obj").eval({ obj: { k: 1 } })).toBe(true);
        expect(compileCel("'z' in obj").eval({ obj: { k: 1 } })).toBe(false);
    });
});

describe("CEL-lite: ternary", () => {
    it("supports conditional operator", () => {
        expect(compileCel("true ? 'a' : 'b'").eval({})).toBe("a");
        expect(compileCel("false ? 'a' : 'b'").eval({})).toBe("b");
    });

    it("is right-associative", () => {
        // true ? (false ? 'x' : 'y') : 'z' -> 'y'
        expect(compileCel("true ? false ? 'x' : 'y' : 'z'").eval({})).toBe("y");
    });
});

describe("CEL-lite: functions", () => {
    it("has()/exists()", () => {
        expect(compileCel("has(x)").eval({ x: "y" })).toBe(true);
        expect(compileCel("exists(x)").eval({ x: 0 })).toBe(true);
        expect(compileCel("has(x)").eval({ x: null })).toBe(false);
        expect(compileCel("has(x)").eval({})).toBe(false);

        expect(compileCel("has(arr)").eval({ arr: [] })).toBe(false);
        expect(compileCel("has(arr)").eval({ arr: [1] })).toBe(true);
    });

    it("size(), first()", () => {
        expect(compileCel("size('abc')").eval({})).toBe(3);
        expect(compileCel("size([1,2,3])").eval({})).toBe(3);
        expect(compileCel("size(obj)").eval({ obj: { a: 1, b: 2 } })).toBe(2);

        expect(compileCel("first([9,8])").eval({})).toBe(9);
        expect(compileCel("first('x')").eval({})).toBe("x");
    });

    it("string helpers: lower/upper/trim", () => {
        expect(compileCel("lower('AbC')").eval({})).toBe("abc");
        expect(compileCel("upper('AbC')").eval({})).toBe("ABC");
        expect(compileCel("trim('  x  ')").eval({})).toBe("x");
    });

    it("contains(), containsAny()", () => {
        expect(compileCel("contains(['a','b'],'a')").eval({})).toBe(true);
        expect(compileCel("contains('hello','ell')").eval({})).toBe(true);
        expect(compileCel("contains('hello','xyz')").eval({})).toBe(false);

        expect(compileCel("containsAny(['a','b'], ['x','b'])").eval({})).toBe(true);
        expect(compileCel("containsAny(['a','b'], ['x','y'])").eval({})).toBe(false);
    });

    it("startsWith/endsWith/matches/regexReplace", () => {
        expect(compileCel("startsWith('hello','he')").eval({})).toBe(true);
        expect(compileCel("endsWith('hello','lo')").eval({})).toBe(true);
        expect(compileCel("matches('abc123','^abc')").eval({})).toBe(true);
        expect(compileCel("regexReplace('a-b-c','-','_')").eval({})).toBe("a_b_c");
    });

    it("coalesce/join/split", () => {
        expect(compileCel("coalesce(null, undefined, 'x')").eval({} as any)).toBe("x");
        expect(compileCel("coalesce([], 'x')").eval({})).toBe("x");
        expect(compileCel("join(['a','b'], ',')").eval({})).toBe("a,b");
        expect(compileCel("split('a,b', ',')").eval({})).toEqual(["a", "b"]);
    });

    it("rejects unknown functions", () => {
        expect(() => compileCel("nope(1)").eval({})).toThrowError(/Function not allowed/);
    });
});

describe("CEL-lite: explain()", () => {
    it("returns result and trace entries", () => {
        const ctx = {
            saml: { attributes: { mail: ["USER@EXAMPLE.COM"] } },
        };

        const prog = compileCel("has(saml.attributes.mail) ? lower(first(saml.attributes.mail)) : 'n/a'");
        const ex = prog.explain(ctx);

        expect(ex.result).toBe("user@example.com");
        expect(Array.isArray(ex.trace)).toBe(true);
        expect(ex.trace.length).toBeGreaterThan(0);

        // should include at least one entry mentioning lower(...)
        const hasLower = ex.trace.some((t: any) => typeof t.expr === "string" && t.expr.includes("lower("));
        expect(hasLower).toBe(true);
    });

    it("respects maxTraceEntries", () => {
        const prog = compileCel("1 + 2 + 3 + 4 + 5", { maxTraceEntries: 3 });
        const ex = prog.explain({});
        expect(ex.result).toBe(15);
        expect(ex.trace.length).toBe(3);
    });
});

describe("CEL-lite: limits & errors", () => {
    it("enforces maxExpressionLength", () => {
        const long = "a".repeat(50);
        expect(() => compileCel(long, { maxExpressionLength: 10 })).toThrowError(/Expression too long/);
    });

    it("enforces maxAstNodes (complex expression)", () => {
        // build a long chain: 1+1+1+...
        const expr = Array.from({ length: 200 }, () => "1").join(" + ");
        expect(() => compileCel(expr, { maxAstNodes: 50 })).toThrowError(/too complex/i);
    });

    it("enforces maxCallDepth", () => {
        // nested calls: lower(lower(lower(...)))
        const depth = 60;
        const expr = "lower(".repeat(depth) + "'x'" + ")".repeat(depth);
        const prog = compileCel(expr, { maxCallDepth: 20 });
        expect(() => prog.eval({})).toThrowError(/Max call depth exceeded/i);
    });

    it("throws helpful parse errors", () => {
        expect(() => compileCel("true ? 'a'").eval({})).toThrow(CelError); // missing ':'
        expect(() => compileCel("('a'").eval({})).toThrow(CelError);      // missing ')'
    });
});

describe("CEL-lite: IdP-ish scenarios", () => {
    it("maps SAML mail safely", () => {
        const ctx = {
            saml: { attributes: { "urn:mace:dir:attribute-def:mail": ["USER@EXAMPLE.COM"] } },
        };

        const expr =
            "has(saml.attributes['urn:mace:dir:attribute-def:mail']) ? lower(trim(first(saml.attributes['urn:mace:dir:attribute-def:mail']))) : null";

        expect(compileCel(expr).eval(ctx)).toBe("user@example.com");
    });

    it("group condition example", () => {
        const ctx = { saml: { attributes: { eduPersonAffiliation: ["member", "student"] } } };
        expect(compileCel("'student' in saml.attributes.eduPersonAffiliation").eval(ctx)).toBe(true);
    });
});
