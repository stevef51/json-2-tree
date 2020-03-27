declare type Flatten = (o: any, context?: any) => any;
declare type Fatten = (o: any, context?: any) => any;
interface TypeTranslator {
    ctr: Function;
    nameOverride: string;
    flatten?: Flatten;
    fatten?: Fatten;
}
export declare class JsonTree {
    static stringify(tree: any, context?: any, externs?: any[]): string;
    static parse(json: string, context?: any, externs?: any[]): any;
    static registerType(config: {
        ctr: Function;
        nameOverride?: string;
        flatten?: Flatten;
        fatten?: Fatten;
    }): TypeTranslator;
}
export declare class Json2Tree {
    flattened: any[];
    context?: any;
    externs?: any[] | undefined;
    fatObjects: any[];
    fattenedObjects: any;
    constructor(flattened: any[], context?: any, externs?: any[] | undefined);
    fattenObject(flatObj: any): any;
    fattenArray(flatArray: []): any;
    fatten(flatRef: any): any;
    storeRef(fatObj: any, flatObj: any): any;
}
export declare class Tree2Json {
    context?: any;
    externs?: any[] | undefined;
    flatObjects: any[];
    fatObjects: any[];
    constructor(context?: any, externs?: any[] | undefined);
    flattenObject(fatObj: any): any;
    flattenArray(fatArray: []): any;
    flatten(fatObj: any): any;
    storeRef(flatObj: any, fatObj: any): number;
}
export {};
