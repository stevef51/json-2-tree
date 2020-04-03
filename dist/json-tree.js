"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function fattenObjectFactory(ctr) {
    ctr = ctr || (() => Object.create(null));
    return function fatten(o, fatten, store) {
        let fatObj = store(ctr());
        let hasOwnProperty = Object.hasOwnProperty.bind(o);
        for (let p in o) {
            if (hasOwnProperty(p)) {
                fatObj[p] = fatten(o[p]);
            }
        }
        return fatObj;
    };
}
class JsonTreeTranslatorRegistry {
    // parent = null will create a blank registry
    // parent = undefined will create a descendant of the global registry JsonTreeTranslators
    constructor(parent) {
        this.parent = parent;
        if (this.parent === undefined) {
            this.parent = exports.JsonTreeTranslators;
        }
        this.types = [];
    }
    register(...configs) {
        configs.map(config => {
            this.types.push({
                ctr: config.ctr,
                name: config.name || config.ctr.name,
                flatten: config.flatten || identity,
                fatten: config.fatten || fattenObjectFactory(config.ctr)
            });
        });
    }
    findConstructor(ctr) {
        let result = this.types.find(t => t.ctr === ctr);
        if (result == null && this.parent != null) {
            result = this.parent.findConstructor(ctr);
        }
        return result;
    }
    findName(name) {
        let result = this.types.find(t => t.name === name);
        if (result == null && this.parent != null) {
            result = this.parent.findName(name);
        }
        return result;
    }
}
exports.JsonTreeTranslatorRegistry = JsonTreeTranslatorRegistry;
exports.JsonTreeTranslators = new JsonTreeTranslatorRegistry();
const identity = o => o;
// JsonTree.parse(JsonTree.stringify(people)) will reproduce the original graph
class JsonTree {
    constructor(translators) {
        this.translators = translators;
        if (this.translators === undefined) {
            this.translators = exports.JsonTreeTranslators;
        }
    }
    stringify(tree, context) {
        let t2j = new Tree2Json(this.translators, context, this.externs);
        t2j.flatten(tree);
        return JSON.stringify(t2j.flatObjects);
    }
    parse(json, context) {
        let j2t = new Json2Tree(JSON.parse(json), this.translators, context, this.externs);
        return j2t.fatten(0);
    }
    static stringify(tree, context, externs) {
        let t2j = new Tree2Json(exports.JsonTreeTranslators, context, externs);
        t2j.flatten(tree);
        return JSON.stringify(t2j.flatObjects);
    }
    static parse(json, context, externs) {
        let j2t = new Json2Tree(JSON.parse(json), exports.JsonTreeTranslators, context, externs);
        return j2t.fatten(0);
    }
}
exports.JsonTree = JsonTree;
// Handle Objects - note, a fatten'ed Object will always have a "undefined" prototype
exports.JsonTreeTranslators.register({
    ctr: Object
});
exports.JsonTreeTranslators.register({
    ctr: undefined,
    name: `undefined`
});
// Handle Date's
exports.JsonTreeTranslators.register({
    ctr: Date,
    fatten: (o, fatten, store) => {
        return store(new Date(JSON.parse(fatten(o))));
    },
    flatten: (dt) => {
        return JSON.stringify(dt);
    }
});
class Json2Tree {
    constructor(flattened, translators, context, externs) {
        this.flattened = flattened;
        this.translators = translators;
        this.context = context;
        this.externs = externs;
        this.fatObjects = [];
        this.fattenedObjects = [];
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
                    let translator = this.translators.findName(constructorName);
                    if (translator == null) {
                        throw new Error(`Cannot fatten ${constructorName}, missing Translator`);
                    }
                    let obj = this.flattened[flatObj[1]];
                    return translator.fatten(obj, this.fatten.bind(this), fatObj => {
                        return this.storeRef(fatObj, flatObj);
                    }, this.context);
                }
            }
            throw new Error(`Unexpected fatten construct ${JSON.stringify(flatObj)}`);
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
    constructor(translators, context, externs) {
        this.translators = translators;
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
            let translator = this.translators.findConstructor(constructor);
            if (translator == null) {
                throw new Error(`Cannot flatten ${constructor === null || constructor === void 0 ? void 0 : constructor.name}, missing Translator`);
            }
            let translatedObj = translator.flatten(fatObj, this.context);
            if (translatedObj === fatObj) {
                translatedObj = Object.assign(Object.create(null), fatObj);
            }
            let custom = [];
            ref = this.storeRef(custom, fatObj); // Key'ing off of fatObj
            custom.push(this.flatten(translator.name));
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