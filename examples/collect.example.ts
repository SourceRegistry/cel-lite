import {compileCel} from "../src";

async function main() {
    const prog = compileCel("collect(first(saml.attributes['urn:mace:dir:attribute-def:preferredLanguage']), 'test' ,first(saml.attributes['urn:mace:dir:attribute-def:referredLanguage']), first(saml.attributes['urn:mace:dir:attribute-def:preferredLanguage']))");

    const result = prog.eval({
        saml: {
            attributes: {
                'urn:mace:dir:attribute-def:preferredLanguage': 'en'
            }
        }
    });

    console.log(result); // Should output: ['en', 'en', 'en']
}

main().catch(console.error)