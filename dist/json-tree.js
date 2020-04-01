"use strict";
/*
JsonTree can take any object graph, a complex object/array with object references and produce a String representation that
can be "parsed" back the original object graph.
JSON.stringify and JSON.parse cannot do this as an object/array with multiple internal references to any given object/array will
JSON.stringify fine but when JSON.parse'd the output will be a different graph with missing references
eg

let bob = { name: 'Bob' };
let sarah = { name: 'Sarah', brother: bob };
let people = [ bob, sarah ];
JSON.parse(JSON.stringify(people)) will produce a subtley different graph with 'bob' appearing as 2 different objects


JsonTree (and its worker classes Tree2Json and Json2Tree) essentially walk the object graph and any Reference (Array, Object and any Object derivative (eg Date))
is serialized into an "flat" Array, Primitives are JSON.stringified in place where Objects/Arrays are annotated to reference these allowing for multiple
references to any given Object/Array
 
The encoding is as follows :-
 
[flatObj1, flatObj2, flatObjN]
 
flatObj is encoded as either
 
Object: { prop1: refA, prop2: refB }
Array: [[ ref1, ref2, ref3 ]]
CustomObject: [ ref-constructor-name, Object ]
 
eg, the above 'people' example would produce
[
    [
        [                   // This is the people array, the graph root will always be 1st item in the array
            2,              // Reference to Bob
            4               // Reference to Sarah
        ]
    ],
    'Bob',
    {                       // This is the simple Bob object
        name: 1
    },
    'Sarah',
    {
        name: 3,            // Sarah object
        brother: 2          // Reference to Bob
    },
    'Date',
    '2020-01-01T00:00:00.000Z',
    [
        5,					// Custom object type 'Date'
        6					// Custom object content
    ]
]
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalTypes = [];
function registerType(types, config) {
    let result = types.find(t => t.ctr === config.ctr);
    if (result == null) {
        result = {
            ctr: config.ctr,
            nameOverride: config.nameOverride || config.ctr.name,
            flatten: config.flatten || identity,
            fatten: config.fatten || identity
        };
        types.push(result);
    }
    else {
        result.fatten = config.fatten || identity;
        result.flatten = config.flatten || identity;
    }
    return result;
}
const identity = o => o;
// JsonTree.parse(JsonTree.stringify(people)) will reproduce the original graph
class JsonTree {
    constructor() {
        this.types = [];
    }
    stringify(tree, context) {
        let t2j = new Tree2Json(this.types, context, this.externs);
        t2j.flatten(tree);
        return JSON.stringify(t2j.flatObjects);
    }
    parse(json, context) {
        let j2t = new Json2Tree(JSON.parse(json), this.types, context, this.externs);
        return j2t.fatten(0);
    }
    registerType(config) {
        return registerType(this.types, config);
    }
    static registerType(config) {
        return registerType(exports.globalTypes, config);
    }
    static stringify(tree, context, externs) {
        let t2j = new Tree2Json(exports.globalTypes, context, externs);
        t2j.flatten(tree);
        return JSON.stringify(t2j.flatObjects);
    }
    static parse(json, context, externs) {
        let j2t = new Json2Tree(JSON.parse(json), exports.globalTypes, context, externs);
        return j2t.fatten(0);
    }
}
exports.JsonTree = JsonTree;
function FlattenDate(dt) {
    return JSON.stringify(dt);
}
function FattenDate(dtStr) {
    return new Date(JSON.parse(dtStr));
}
JsonTree.registerType({ ctr: Object, fatten: identity, flatten: identity });
JsonTree.registerType({ ctr: Date, fatten: FattenDate, flatten: FlattenDate });
class Json2Tree {
    constructor(flattened, types, context, externs) {
        this.flattened = flattened;
        this.types = types;
        this.context = context;
        this.externs = externs;
        this.fatObjects = [];
        this.fattenedObjects = [];
    }
    fattenObject(flatObj) {
        let fatObj = Object.create(null);
        this.storeRef(fatObj, flatObj);
        for (let p in flatObj) {
            fatObj[p] = this.fatten(flatObj[p]);
        }
        return fatObj;
    }
    fattenArray(flatArray) {
        let fatArray = [];
        this.storeRef(fatArray, flatArray);
        for (let p in flatArray) {
            fatArray[p] = this.fatten(flatArray[p]);
        }
        return fatArray;
    }
    fatten(flatRef) {
        if (flatRef === null) {
            return null;
        }
        else if (typeof flatRef === 'undefined') {
            return undefined;
        }
        else if (typeof flatRef === 'number') {
            // A -ve index means it should be an extern lookup 
            if (flatRef < 0) {
                return this.externs[-flatRef - 1];
            }
            let flatObj = this.flattened[flatRef];
            let i = this.fattenedObjects.indexOf(flatObj);
            if (i >= 0) {
                return this.fatObjects[i];
            }
            switch (typeof flatObj) {
                case 'number':
                case 'string':
                case 'bigint':
                case 'boolean':
                    return flatObj;
            }
            if (Array.isArray(flatObj)) {
                if (flatObj.length === 1) {
                    return this.fattenArray(flatObj[0]);
                }
                else {
                    let constructorName = this.fatten(flatObj[0]);
                    let translator = this.types.find(t => t.nameOverride === constructorName);
                    let fatObj = this.fatten(flatObj[1]);
                    if (translator == null || translator.fatten == null) {
                        return fatObj;
                    }
                    return translator.fatten(fatObj, this.context);
                }
            }
            else {
                return this.fattenObject(flatObj);
            }
        }
        return flatRef;
    }
    storeRef(fatObj, flatObj) {
        this.fattenedObjects.push(flatObj);
        this.fatObjects.push(fatObj);
        return fatObj;
    }
}
exports.Json2Tree = Json2Tree;
const NotFlattened = Object.create(null);
class Tree2Json {
    constructor(types, context, externs) {
        this.types = types;
        this.context = context;
        this.externs = externs;
        this.flatObjects = [];
        this.fatObjects = [];
    }
    flattenObject(fatObj) {
        let flatObj = Object.create(null);
        let ref = this.storeRef(flatObj, fatObj);
        let hasOwnProperty = Object.hasOwnProperty.bind(fatObj);
        for (let p in fatObj) {
            if (hasOwnProperty(p)) {
                let o = fatObj[p];
                flatObj[p] = this.flatten(o);
            }
        }
        return ref;
    }
    flattenArray(fatArray) {
        let flatArray = [];
        let ref = this.storeRef([flatArray], fatArray);
        for (let p in fatArray) {
            let o = fatArray[p];
            flatArray.push(this.flatten(o));
        }
        return ref;
    }
    flattenBasic(fatObj) {
        if (fatObj === null) {
            return null;
        }
        // Its an Object/Array, have we seen this object before ??
        let i = this.fatObjects.indexOf(fatObj);
        if (i >= 0) {
            return i;
        }
        if (this.externs != null) {
            i = this.externs.indexOf(fatObj);
            if (i >= 0) {
                return -1 - i; // -ve index means its an extern and will not be flattened
            }
        }
        switch (typeof fatObj) {
            case 'undefined':
            case 'function':
            case 'symbol':
                return undefined;
            case 'bigint':
            case 'boolean':
            case 'number':
            case 'string':
                return this.storeRef(fatObj, fatObj);
        }
        // We have not seen this object/array before, flatten it ..
        if (Array.isArray(fatObj)) {
            return this.flattenArray(fatObj);
        }
        return NotFlattened;
    }
    flatten(fatObj) {
        let ref = this.flattenBasic(fatObj);
        if (ref === NotFlattened) {
            let constructor = fatObj.constructor;
            let translator = this.types.find(t => t.ctr === constructor);
            if (translator == null) {
                throw new Error(`Cannot flatten ${constructor === null || constructor === void 0 ? void 0 : constructor.name}, missing Translator`);
            }
            let translatedObj = translator.flatten(fatObj, this.context);
            if (translatedObj === fatObj) {
                translatedObj = Object.assign(Object.create(null), fatObj);
            }
            let custom = [];
            ref = this.storeRef(custom, fatObj); // Key'ing off of fatObj
            custom.push(this.flatten(translator.nameOverride));
            let customRef = this.flattenBasic(translatedObj);
            if (customRef === NotFlattened) {
                customRef = this.flattenObject(translatedObj);
            }
            custom.push(customRef);
        }
        return ref;
    }
    storeRef(flatObj, fatObj) {
        this.flatObjects.push(flatObj);
        this.fatObjects.push(fatObj);
        return this.fatObjects.indexOf(fatObj);
    }
}
exports.Tree2Json = Tree2Json;
//# sourceMappingURL=json-tree.js.map