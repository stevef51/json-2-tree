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

type Flatten = (o: any, context?: any) => any;
type Fatten = (o: any, context?: any) => any;

interface TypeTranslator {
	ctr: Function;
	nameOverride: string;
	flatten?: Flatten;
	fatten?: Fatten
}

const _types: TypeTranslator[] = [];

// JsonTree.parse(JsonTree.stringify(people)) will reproduce the original graph
export class JsonTree {
	static stringify(tree: any, context?: any): string {
		let t2j = new Tree2Json(context);
		t2j.flatten(tree);
		return JSON.stringify(t2j.flatObjects);
	}
	static parse(json: string, context?: any): any {
		let j2t = new Json2Tree(JSON.parse(json), context);
		return j2t.fatten(0);
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
			flatten: config.flatten,
			fatten: config.fatten
		};
		_types.push(result);
		return result;
	}
}

function FlattenDate(dt: Date): any {
	return JSON.stringify(dt);
}

function FattenDate(dtStr: string): any {
	return new Date(JSON.parse(dtStr));
}

JsonTree.registerType({ ctr: Date, fatten: FattenDate, flatten: FlattenDate });

export class Json2Tree {
	public fatObjects: any[] = [];
	public fattenedObjects: any = [];

	constructor(public flattened: any[], public context?: any) {
	}

	fattenObject(flatObj: any): any {
		let fatObj = Object.create(null);
		this.storeRef(fatObj, flatObj);
		for (let p in flatObj) {
			fatObj[p] = this.fatten(flatObj[p]);
		}
		return fatObj;
	}

	fattenArray(flatArray: []): any {
		let fatArray: any[] = [];
		this.storeRef(fatArray, flatArray);
		for (let p in flatArray) {
			fatArray[p] = this.fatten(flatArray[p]);
		}
		return fatArray;
	}

	fatten(flatRef: any): any {
		if (flatRef === null) {
			return null;
		} else if (typeof flatRef === 'undefined') {
			return undefined;
		} else if (typeof flatRef === 'number') {
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
				} else {
					let constructorName = this.fatten(flatObj[0]);
					let translator = _types.find(t => t.nameOverride === constructorName);
					let fatObj = this.fatten(flatObj[1]);
					if (translator == null || translator.fatten == null) {
						return fatObj;
					}
					return translator.fatten(fatObj, this.context);
				}
			} else {
				return this.fattenObject(flatObj);
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

export class Tree2Json {
	public flatObjects: any[] = [];
	public fatObjects: any[] = [];

	constructor(public context?: any) {

	}

	flattenObject(fatObj: any): any {
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

	flattenArray(fatArray: []): any {
		let flatArray: any = [];
		let ref = this.storeRef([flatArray], fatArray);
		for (let p in fatArray) {
			let o = fatArray[p];
			flatArray.push(this.flatten(o));
		}
		return ref;
	}

	flatten(fatObj: any): any {
		if (fatObj === null) {
			return null;
		}

		// Its an Object/Array, have we seen this object before ??
		let i = this.fatObjects.indexOf(fatObj);
		if (i >= 0) {
			return i;
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
		let constructor = fatObj.constructor || Object;
		switch (constructor.name) {
			case 'Object':
				return this.flattenObject(fatObj);
			case 'Array':
				return this.flattenArray(fatObj);
		}

		let translator = _types.find(t => t.ctr === constructor);
		let translatedObj = fatObj;
		if (translator != null && translator.flatten != null) {
			// Custom translate the object first
			translatedObj = translator.flatten(fatObj, this.context);
		}
		if (translatedObj === fatObj) {
			translatedObj = Object.assign(Object.create(null), fatObj);
		}
		let custom = [];
		let ref = this.storeRef(custom, fatObj);				// Key'ing off of fatObj
		custom.push(this.flatten(translator.nameOverride));
		custom.push(this.flatten(translatedObj));
		return ref;
	}

	storeRef(flatObj: any, fatObj: any) {
		this.flatObjects.push(flatObj);
		this.fatObjects.push(fatObj);
		return this.fatObjects.indexOf(fatObj);
	}
}




