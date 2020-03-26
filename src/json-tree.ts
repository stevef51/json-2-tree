// JsonTree can take any object graph, a complex object/array with object references and produce a String representation that
// can be "parsed" back the original object graph.
// JSON.stringify and JSON.parse cannot do this as an object/array with multiple internal references to any given object/array will
// JSON.stringify fine but when JSON.parse'd the output will be a different graph with missing references
// eg
// let bob = { name: 'Bob' };
// let sarah = { name: 'Sarah', brother: bob };
// let people = [ bob, sarah ];
// JSON.parse(JSON.stringify(people)) will produce a subtley different graph with 'bob' appearing as 2 different objects
// whilst

export interface ITree2Json {
	flatten(o: any): any;
	storeRef(storedObj: any, indexObj: any): any;
}

export interface IJson2Tree {
	fatten(o: any): any;
	storeRef(storedObj: any, indexObj: any): any;
}

type Translator = (o: any) => any;
type StoreRef = (storedObj: any, indexObj: any) => any;
type Flatten = (o: any, tree2json: ITree2Json) => any;
type Fatten = (o: any, json2tree: IJson2Tree) => any;

interface TypeTranslator {
	ctr: Function;
	nameOverride: string;
	flatten: Flatten;
	fatten: Fatten
}

const _types: TypeTranslator[] = [];

// JsonTree.parse(JsonTree.stringify(people)) will reproduce the original graph
export class JsonTree {
	static stringify(tree: any): string {
		let t2j = new Tree2Json();
		t2j.flatten(tree);
		return JSON.stringify(t2j.flatObjects);
	}
	static parse(json: string): any {
		let j2t = new Json2Tree(JSON.parse(json));
		return j2t.fatten([0]);
	}

	static registerType(config: {
		ctr: Function;
		nameOverride?: string;
		flatten?: Flatten;
		fatten?: Fatten
	}): TypeTranslator {
		let result: TypeTranslator = {
			ctr: config.ctr,
			nameOverride: config.nameOverride || config.ctr.name,
			flatten: config.flatten || FlattenObject,
			fatten: config.fatten || FattenObjectFactory(config.ctr)
		};
		_types.push(result);
		return result;
	}
}

function FlattenObject(fatObj: any, tree2json: ITree2Json): any {
	let flatObj = Object.create(null);
	let ref = tree2json.storeRef(flatObj, fatObj);
	for (let p in fatObj) {
		if (fatObj.hasOwnProperty(p)) {
			let o = fatObj[p];
			flatObj[p] = tree2json.flatten(o);
		}
	}
	return ref;
}

function FattenObjectFactory(ctr: Function): Fatten {
	return function FattenObject(flatObj: any, json2tree: IJson2Tree): any {
		let obj = flatObj;
		if (Array.isArray(flatObj)) {
			obj = flatObj[1];
		}
		let fatObj = Object.create(ctr);
		fatObj = json2tree.storeRef(fatObj, flatObj);
		for (let p in obj) {
			let o = obj[p];
			fatObj[p] = json2tree.fatten(o);
		}
		return fatObj;
	}
}

const ObjectTranslator = JsonTree.registerType({ ctr: Object, fatten: FattenObjectFactory(Object), flatten: FlattenObject });

function FlattenArray(fatArray: [], tree2json: ITree2Json): any {
	let flatArray: any = [];
	let ref = tree2json.storeRef([flatArray], fatArray);
	for (let p in fatArray) {
		let o = fatArray[p];
		flatArray.push(tree2json.flatten(o));
	}
	return ref;
}

function FattenArray(flatArray: any, json2tree: IJson2Tree): any {
	let fatArray = json2tree.storeRef([], flatArray);
	for (let p in flatArray[0]) {
		let o = flatArray[0][p];
		fatArray.push(json2tree.fatten(o));
	}
	return fatArray;
}

const ArrayTranslator = JsonTree.registerType({ ctr: Array, fatten: FattenArray, flatten: FlattenArray });

function FlattenDate(dt: Date, tree2json: ITree2Json): any {
	return tree2json.storeRef(JSON.stringify(dt), dt);
}

function FattenDate(flatObj: any, json2tree: IJson2Tree): any {
	return json2tree.storeRef(new Date(JSON.parse(flatObj)), flatObj);
}

JsonTree.registerType({ ctr: Date, fatten: FattenDate, flatten: FlattenDate });

/* 
JsonTree (and its worker classes Tree2Json and Json2Tree) essentially walk the object graph and any Reference (Array, Object and any Object derivative (eg Date))
is serialized into an "flat" Array, Primitives are JSON.stringified in place where Objects/Arrays are annotated to reference these allowing for multiple
references to any given Object/Array
 
The encoding is as follows :-
 
[flatObj1, flatObj2, flatObjN]
 
flatObj is encoded as either
 
Object: { prop1: primitive | [ refA ], prop2: primitive | [ refB ] }
Array: [ [ primitive | [ refA ], primitive | [ refB ] ] ]
CustomObject: [ 'Constructor.name', Custom Serialization ]
 
eg, the above 'people' example would produce
[
    [                       
        [                   // This is the people array, the graph root will always be 1st item in the array
            [ 1 ],          // Reference to Bob
            [ 2 ]           // Reference to Sarah
        ] 
    ],
    {                       // This is the simple Bob object
        name: 'Bob'         
    },
    {
        name: 'Sarah',      // Sarah object
        brother: [ 1 ]      // Reference to Bob
	},
	[
		'Date',				// Custom object type
		'2020-01-01T00:00:00.000Z'	// Custom object content
	]
]
*/
export class Tree2Json {
	public flatObjects: any[] = [];
	public fatObjects: any[] = [];

	flatten(obj: any): any {
		if (obj === null) {
			return null;
		}

		switch (typeof obj) {
			case 'undefined':
			case 'function':
			case 'symbol':
				return undefined;
			case 'bigint':
			case 'boolean':
			case 'number':
			case 'string':
				return obj;
		}

		// Its an Object/Array, have we seen this object before ??
		let i = this.fatObjects.indexOf(obj);
		if (i >= 0) {
			return [i];
		}

		// We have not seen this object before, flatten it ..
		let constructor = obj.constructor || Object;
		let plainObjectOrArray = ['Object', 'Array'].indexOf(constructor.name) >= 0;
		let translator = _types.find(t => t.ctr === constructor) || ObjectTranslator;
		return translator.flatten(obj, {
			flatten: this.flatten.bind(this),
			storeRef: (flatObj: any, fatObj: any) => {
				return this.storeRef(plainObjectOrArray ? flatObj : [translator.nameOverride, flatObj], fatObj);
			}
		});
	}

	storeRef(flatObj: any, fatObj: any) {
		this.flatObjects.push(flatObj);
		this.fatObjects.push(fatObj);
		return [this.fatObjects.indexOf(fatObj)];
	}
}

export class Json2Tree {
	public fatObjects: any[] = [];
	public fattenedObjects: any = [];

	constructor(public flattened: any[]) {
	}

	fatten(flatRef: any): any {
		const self: any = this;
		if (flatRef === null) {
			return null;
		} else if (typeof flatRef === 'undefined') {
			return undefined;
		} else if (Array.isArray(flatRef)) {
			let flatObj = this.flattened[flatRef[0]];
			let i = this.fattenedObjects.indexOf(flatObj);
			if (i >= 0) {
				return this.fatObjects[i];
			}
			if (Array.isArray(flatObj)) {
				if (flatObj.length == 1) {
					return ArrayTranslator.fatten(flatObj, this);
				} else {
					let translator = _types.find(t => t.nameOverride === flatObj[0]) || ObjectTranslator;
					return translator.fatten(flatObj[1], this);
				}
			} else {
				return ObjectTranslator.fatten(flatObj, this);
			}
		}
		return flatRef;
	}

	storeRef(fatObj: any, flatObj: any): any {
		this.fattenedObjects.push(flatObj);
		this.fatObjects.push(fatObj);
		return fatObj;
	}
}



