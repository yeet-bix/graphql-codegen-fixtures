import { PluginFunction } from '@graphql-codegen/plugin-helpers';
import { DEFAULT_SCALARS } from '@graphql-codegen/visitor-plugin-common';
import {
    printSchema,
    parse,
    visit,
    ObjectTypeDefinitionNode,
    FieldDefinitionNode,
    NamedTypeNode,
    ListTypeNode,
    InputObjectTypeDefinitionNode,
    InputValueDefinitionNode,
    UnionTypeDefinitionNode,
    NonNullTypeNode,
    EnumTypeDefinitionNode,
    EnumValueDefinitionNode,
} from 'graphql';

const transformScalar = (scalar: string) => {
    // TODO: Define custom scalars in config
    if (scalar === 'Time') {
        return `''`;
    }

    if (DEFAULT_SCALARS[scalar] === undefined) {
        return `${fixtureName(parseNodeType(scalar))}()`;
    }

    switch (DEFAULT_SCALARS[scalar]) {
        case 'number':
            return 0;
        case 'string':
            return "''";
        case 'boolean':
            return 'false';
    }
    throw Error(`Invalid scalar value: ${scalar}`);
};

const createFixtureFnTemplate = () =>
    `import deepmerge from 'deepmerge';\n\nexport function createFixture<T>(defaultValue: T): (overrideValue?: Partial<T>) => T {\n\treturn (overrideValue: Partial<T> = {}) => deepmerge(defaultValue, overrideValue);\n}`;

const typesImportTemplate = (types: string[]) => {
    return `import {\n\t${types.join(',\n\t')}\n} from 'pages/__generated__/types'`;
};

// This is a workaround as the `typescript` graphql codegen plugin camelcases ID => Id
// TODO: Create issue: https://github.com/dotansimha/graphql-code-generator/
const parseNodeType = (value: string) => value.replace('ID', 'Id');

const fixtureName = (value: string) => value[0].toLowerCase() + value.substring(1) + 'Fixture';

export const plugin: PluginFunction = (schema, documents, config, info) => {
    const printedSchema = printSchema(schema);
    const astNode = parse(printedSchema);
    const types: string[] = [];
    const visitor = {
        ObjectTypeDefinition: {
            leave: (node: ObjectTypeDefinitionNode) => {
                const nodeType = parseNodeType(node.name.value);
                types.push(nodeType);
                return `export function ${fixtureName(
                    nodeType,
                )}(override: Partial<${nodeType}> = {}): ${nodeType} {\n\treturn createFixture<${nodeType}>({\n\t\t__typename: '${
                    node.name.value
                }',\n${node.fields?.map((field) => `\t\t${field}`).join('\n')}\n\t})(override)\n}`;
            },
        },
        InputObjectTypeDefinition: {
            leave: (node: InputObjectTypeDefinitionNode) => {
                types.push(node.name.value);
                return `export function ${fixtureName(node.name.value)}(override: Partial<${
                    node.name.value
                }> = {}) {\n\treturn createFixture<${node.name.value}>({\n${node.fields
                    ?.map((field) => `\t\t${field}`)
                    .join('\n')}\n\t})(override)\n}`;
            },
        },
        UnionTypeDefinition: {
            leave(node: UnionTypeDefinitionNode) {
                types.push(node.name.value);
                const fixtureName = node.name.value[0].toLowerCase() + node.name.value.substring(1) + 'Fixture';
                return `export function ${fixtureName}() {\n\treturn ${node.types![0]};\n}`;
            },
        },
        ScalarTypeDefinition: {
            enter() {
                return null;
            },
        },
        EnumTypeDefinition: {
            leave(node: EnumTypeDefinitionNode) {
                types.push(node.name.value);
                const fixtureName = node.name.value[0].toLowerCase() + node.name.value.substring(1) + 'Fixture';
                return `function ${fixtureName}() {\n\treturn '${node.values![0]}' as ${node.name.value};\n}`;
            },
        },
        EnumValueDefinition: {
            leave(node: EnumValueDefinitionNode) {
                return node.name.value;
            },
        },
        FieldDefinition: {
            leave: (node: FieldDefinitionNode) => {
                return `${node.name.value}: ${node.type},`;
            },
        },
        InputValueDefinition: {
            leave(node: InputValueDefinitionNode) {
                return `${node.name.value}: ${node.type},`;
            },
        },
        NamedType: {
            leave: (node: NamedTypeNode) => {
                return transformScalar(node.name.value);
            },
        },
        NonNullType: {
            leave(node: NonNullTypeNode) {
                return node.type;
            },
        },
        ListType: {
            leave: (node: ListTypeNode) => {
                return '[]';
            },
        },
        OperationDefinition: {
            enter() {
                return null;
            },
        },
        FragmentDefinition: {
            enter() {
                return null;
            },
        },
    };

    const result = visit(astNode, visitor);

    return [typesImportTemplate(types), createFixtureFnTemplate(), ...result.definitions].join('\n\n');
};
