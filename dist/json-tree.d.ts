export declare type Convert = (o: any) => any;
export declare type CustomFlatten = (o: any, context?: any) => any;
export declare type CustomFatten = (o: any, fatten: Convert, store: Convert, context?: any) => any;
export interface TypeTranslator {
    ctr: Function;
    name?: string;
    flatten?: CustomFlatten;
    fatten?: CustomFatten;
}
export declare class JsonTreeTranslatorRegistry {
    parent?: JsonTreeTranslatorRegistry;
    types: TypeTranslator[];
    constructor(parent?: JsonTreeTranslatorRegistry);
    register(...configs: TypeTranslator[]): void;
    findConstructor(ctr: Function): TypeTranslator | null;
    findName(name: string): TypeTranslator | null;
}
export declare const JsonTreeTranslators: JsonTreeTranslatorRegistry;
export declare class JsonTreeOptions {
    context?: any;
    translators?: JsonTreeTranslatorRegistry;
    externs?: any[];
}
export declare class JsonTree {
    translators?: JsonTreeTranslatorRegistry;
    externs: any[];
    constructor(translators?: JsonTreeTranslatorRegistry);
    stringify(tree: any, context?: any): string;
    parse(json: string, context?: any): any;
    flatten(tree: any, context?: any): any[];
    fatten(flat: any[], context?: any): any;
    static stringify(tree: any, options?: JsonTreeOptions): string;
    static parse(json: string, options?: JsonTreeOptions): any;
}
export declare class Json2Tree {
    flattened: any[];
    translators: JsonTreeTranslatorRegistry;
    context?: any;
    externs?: any[];
    fatObjects: any[];
    fattenedObjects: any;
    constructor(flattened: any[], translators: JsonTreeTranslatorRegistry, context?: any, externs?: any[]);
    fattenArray(flatArray: []): any;
    fatten(flatRef: any): any;
    storeRef(fatObj: any, flatObj: any): any;
}
export declare class Tree2Json {
    translators: JsonTreeTranslatorRegistry;
    context?: any;
    externs?: any[];
    flatObjects: any[];
    fatObjects: any[];
    constructor(translators: JsonTreeTranslatorRegistry, context?: any, externs?: any[]);
    flattenObject(fatObj: any): any;
    flattenArray(fatArray: []): any;
    flattenBasic(fatObj: any): any;
    flatten(fatObj: any): any;
    storeRef(flatObj: any, fatObj: any): number;
}
