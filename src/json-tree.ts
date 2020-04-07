/*
JsonTree is a set of classes which allow a complex object hierarchy (a tree) to be serialized to a string
and then deserialized to the original tree structure (with new objects ofcourse)

Although it supports a similar set of features to the very popular NPM library "flattened" JsonTree is more customizable with the 
following features :-

- Pluggable Custom types (ie none Object) can be easily configured such that the deserialized objects have proper type
- Allows for "externs" - objects which are not to be serialized but still part of the tree
- Compresses duplicate primitives aswell

In a similar fashion to "flattened" Serialized objects become a flat array, with the "root" object always being the 0th element

the string 

"Hello world" 

becomes 

["Hello world"]

an object 

{ name: 'Fred', age: 36 }

becomes

[[1,2],"Object",{name:3,age:4},"Fred",36]

an array

["ABC",123,"ABC"]				// note the duplicate string "ABC"

becomes

[[[1,2,1]],"ABC",123]			// ABC is not duplicated but referenced twice


the custom object

var p = new Person({ name: "Fred", age: 36})
p.self = p;

becomes

[[1,2],"Person",{name:3,age:4,self:0},"Fred",36]


*/
export type Convert = (o: any) => any;

export type CustomFlatten = (o: any, context?: any) => any;
export type CustomFatten = (o: any, fatten: Convert, store: Convert, context?: any) => any;

export interface TypeTranslator {
	ctr: Function;
	name?: string;
	flatten?: CustomFlatten;
	fatten?: CustomFatten
}

function fattenObjectFactory(ctr: Function): any {
	ctr = ctr || (() => Object.create(null));
	return function fatten(o: any, fatten: Convert, store: Convert) {
		let fatObj = store(ctr());
		let hasOwnProperty = Object.hasOwnProperty.bind(o);
		for (let p in o) {
			if (hasOwnProperty(p)) {
				fatObj[p] = fatten(o[p]);
			}
		}
		return fatObj;
	}
}

export class JsonTreeTranslatorRegistry {
	types: TypeTranslator[];

	// parent = null will create a blank registry
	// parent = undefined will create a descendant of the global registry JsonTreeTranslators
	constructor(public parent?: JsonTreeTranslatorRegistry) {
		if (this.parent === undefined) {
			this.parent = JsonTreeTranslators;
		}
		this.types = [];
	}

	register(...configs: TypeTranslator[]): void {
		configs.map(config => {
			this.types.push({
				ctr: config.ctr,
				name: config.name || config.ctr.name,
				flatten: config.flatten || identity,
				fatten: config.fatten || fattenObjectFactory(config.ctr)
			});
		});
	}

	findConstructor(ctr: Function): TypeTranslator | null {
		let result = this.types.find(t => t.ctr === ctr);
		if (result == null && this.parent != null) {
			result = this.parent.findConstructor(ctr);
		}
		return result;
	}

	findName(name: string): TypeTranslator | null {
		let result = this.types.find(t => t.name === name);
		if (result == null && this.parent != null) {
			result = this.parent.findName(name);
		}
		return result;
	}
}

export const JsonTreeTranslators = new JsonTreeTranslatorRegistry();

const identity = o => o;

export class JsonTreeOptions {
	context: any;
	translators: JsonTreeTranslatorRegistry;
	externs: any[];
	flattenPropertyNames: boolean;
}

function makeOptions(options?: Partial<JsonTreeOptions>) {
	return Object.assign({
		translators: JsonTreeTranslators,
		context: null,
		externs: null,
		flattenPropertyNames: false
	}, options || {});
}

export class JsonTree {
	public options: JsonTreeOptions;

	constructor(options?: Partial<JsonTreeOptions>) {
		this.options = makeOptions(options);
	}

	stringify(tree: any): string {
		let t2j = new Tree2Json(this.options);
		t2j.flatten(tree);
		return JSON.stringify(t2j.flatObjects);
	}
	parse(json: string): any {
		let j2t = new Json2Tree(JSON.parse(json), this.options);
		return j2t.fatten(0);
	}

	flatten(tree: any): any[] {
		let t2j = new Tree2Json(this.options);
		t2j.flatten(tree);
		return t2j.flatObjects;
	}

	fatten(flat: any[]): any {
		let j2t = new Json2Tree(flat, this.options);
		return j2t.fatten(0);
	}

	static stringify(tree: any, options?: Partial<JsonTreeOptions>): string {
		return JSON.stringify(JsonTree.flatten(tree, options));
	}
	static parse(json: string, options?: Partial<JsonTreeOptions>): any {
		return JsonTree.fatten(JSON.parse(json), options);
	}
	static flatten(tree: any, options?: Partial<JsonTreeOptions>): any[] {
		let t2j = new Tree2Json(makeOptions(options));
		t2j.flatten(tree);
		return t2j.flatObjects;
	}
	static fatten(flat: any[], options?: Partial<JsonTreeOptions>): any {
		let j2t = new Json2Tree(flat, makeOptions(options));
		return j2t.fatten(0);
	}
}

// Handle Objects - note, a fatten'ed Object will always have a "undefined" prototype
JsonTreeTranslators.register({
	ctr: Object
});

JsonTreeTranslators.register({
	ctr: undefined,
	name: `undefined`
});

// Handle Date's
JsonTreeTranslators.register({
	ctr: Date,
	fatten: (o: any, fatten: Convert, store: Convert) => {
		return store(new Date(JSON.parse(fatten(o))));
	},
	flatten: (dt: Date) => {
		return JSON.stringify(dt);
	}
});

export class Json2Tree {
	public fatObjects: any[] = [];
	public fattenedObjects: any = [];

	constructor(public flattened: any[], public options: JsonTreeOptions) {
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
			// A -ve index means it should be an extern lookup 
			if (flatRef < 0) {
				return this.options.externs[-flatRef - 1];
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
				} else {
					let constructorName = this.fatten(flatObj[0]);
					let translator = this.options.translators.findName(constructorName);
					if (translator == null) {
						throw new Error(`Cannot fatten ${constructorName}, missing Translator`);
					}
					let obj = this.flattened[flatObj[1]];
					if (typeof obj === 'object' && this.options.flattenPropertyNames === true) {
						let fatPObj = Object.create(null);
						for (let p in obj) {
							fatPObj[this.fatten(Number(p))] = obj[p];
						}
						obj = fatPObj;
					}
					return translator.fatten(obj, this.fatten.bind(this), fatObj => {
						return this.storeRef(fatObj, flatObj);
					}, this.options.context)
				}
			}
			throw new Error(`Unexpected fatten construct ${JSON.stringify(flatObj)}`);
		}
		return flatRef;
	}

	storeRef(fatObj: any, flatObj: any): any {
		this.fattenedObjects.push(flatObj);
		this.fatObjects.push(fatObj);
		return fatObj;
	}
}

const NotFlattened = Object.create(null);

export class Tree2Json {
	public flatObjects: any[] = [];
	public fatObjects: any[] = [];

	constructor(public options: JsonTreeOptions) {
	}

	flattenObject(fatObj: any): any {
		let flatObj = Object.create(null);
		let ref = this.storeRef(flatObj, fatObj);
		let hasOwnProperty = Object.hasOwnProperty.bind(fatObj);
		for (let p in fatObj) {
			if (hasOwnProperty(p)) {
				let o = fatObj[p];
				flatObj[this.options.flattenPropertyNames === true ? this.flatten(p) : p] = this.flatten(o);
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

	flattenBasic(fatObj: any): any {
		if (fatObj === null) {
			return null;
		}

		// Its an Object/Array, have we seen this object before ??
		let i = this.fatObjects.indexOf(fatObj);
		if (i >= 0) {
			return i;
		}

		if (this.options.externs != null) {
			i = this.options.externs.indexOf(fatObj);
			if (i >= 0) {
				return -1 - i;			// -ve index means its an extern and will not be flattened
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
			return this.flattenArray(fatObj as []);
		}

		return NotFlattened;
	}

	flatten(fatObj: any): any {
		let ref = this.flattenBasic(fatObj);
		if (ref === NotFlattened) {
			let constructor = fatObj.constructor;
			let translator = this.options.translators.findConstructor(constructor);
			if (translator == null) {
				throw new Error(`Cannot flatten ${constructor?.name}, missing Translator`);
			}
			let translatedObj = translator.flatten(fatObj, this.options.context);
			if (translatedObj === fatObj) {
				translatedObj = Object.assign(Object.create(null), fatObj);
			}
			let custom = [];
			ref = this.storeRef(custom, fatObj);				// Key'ing off of fatObj
			custom.push(this.flatten(translator.name));
			let customRef = this.flattenBasic(translatedObj);
			if (customRef === NotFlattened) {
				customRef = this.flattenObject(translatedObj);
			}
			custom.push(customRef);
		}
		return ref;
	}

	storeRef(flatObj: any, fatObj: any) {
		this.flatObjects.push(flatObj);
		this.fatObjects.push(fatObj);
		return this.fatObjects.indexOf(fatObj);
	}
}




