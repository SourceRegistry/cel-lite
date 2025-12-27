import {compileCel} from "../src";

const ctx = {
    saml: {
        attributes: {
            mail: ["USER@EXAMPLE.COM"],
            eduPersonAffiliation: ["employee", "member"],
            department: ["TI"]
        }
    }
};

const prog = compileCel("has(saml.attributes.mail) ? lower(trim(first(saml.attributes.mail))) : 'n/a'");
console.log(prog.eval(ctx)); // "user@example.com"

const explained = prog.explain(ctx);
console.log(explained.result);
console.table(explained.trace.slice(-10)); // last steps
