declare type Flatten = (o: any, context?: any) => any;
declare type Fatten = (o: any, context?: any) => any;
interface TypeTranslator {
    ctr: Function;
    nameOverride?: string;
    flatten?: Flatten;
    fatten?: Fatten;
}
export declare const globalTypes: TypeTranslator[];
export declare class JsonTree {
    externs: any[];
    types: TypeTranslator[];
    constructor();
    stringify(tree: any, context?: any): string;
    parse(json: string, context?: any): any;
    registerType(config: TypeTranslator): TypeTranslator;
    static registerType(config: TypeTranslator): TypeTranslator;
    static stringify(tree: any, context?: any, externs?: any[]): string;
    static parse(json: string, context?: any, externs?: any[]): any;
}
export declare class Json2Tree {
    flattened: any[];
    types: TypeTranslator[];
    context?: any;
    externs?: any[];
    fatObjects: any[];
    fattenedObjects: any;
    constructor(flattened: any[], types: TypeTranslator[], context?: any, externs?: any[]);
    fattenObject(flatObj: any): any;
    fattenArray(flatArray: []): any;
    fatten(flatRef: any): any;
    storeRef(fatObj: any, flatObj: any): any;
}
export declare class Tree2Json {
    types: TypeTranslator[];
    context?: any;
    externs?: any[];
    flatObjects: any[];
    fatObjects: any[];
    constructor(types: TypeTranslator[], context?: any, externs?: any[]);
    flattenObject(fatObj: any): any;
    flattenArray(fatArray: []): any;
    flattenBasic(fatObj: any): any;
    flatten(fatObj: any): any;
    storeRef(flatObj: any, fatObj: any): number;
}
export {};
