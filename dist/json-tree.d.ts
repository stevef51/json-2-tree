export declare type Convert = (o: any) => any;
export declare type CustomFlatten = (o: any, context?: any) => any;
export declare type CustomFatten = (o: any, fatten: Convert, store: Convert, context?: any) => any;
export interface TypeTranslator {
    ctr: Function;
    create?: () => any;
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
    context: any;
    translators: JsonTreeTranslatorRegistry;
    externs: any[];
    flattenPropertyNames: boolean;
}
export declare class JsonTree {
    options: JsonTreeOptions;
    constructor(options?: Partial<JsonTreeOptions>);
    stringify(tree: any): string;
    parse(json: string): any;
    flatten(tree: any): any[];
    fatten(flat: any[]): any;
    static stringify(tree: any, options?: Partial<JsonTreeOptions>): string;
    static parse(json: string, options?: Partial<JsonTreeOptions>): any;
    static flatten(tree: any, options?: Partial<JsonTreeOptions>): any[];
    static fatten(flat: any[], options?: Partial<JsonTreeOptions>): any;
}
export declare class Json2Tree {
    flattened: any[];
    options: JsonTreeOptions;
    fatObjects: any[];
    fattenedObjects: any;
    constructor(flattened: any[], options: JsonTreeOptions);
    fattenArray(flatArray: []): any;
    fatten(flatRef: any): any;
    storeRef(fatObj: any, flatObj: any): any;
}
export declare class Tree2Json {
    options: JsonTreeOptions;
    flatObjects: any[];
    fatObjects: any[];
    constructor(options: JsonTreeOptions);
    flattenObject(fatObj: any): any;
    flattenArray(fatArray: []): any;
    flattenBasic(fatObj: any): any;
    flatten(fatObj: any): any;
    storeRef(flatObj: any, fatObj: any): number;
}
