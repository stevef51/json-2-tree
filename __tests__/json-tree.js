const { JsonTree, JsonTreeTranslators, JsonTreeTranslatorRegistry } = require('../dist/json-tree');

test("Json2Tree should be able to store simple objects", () => {
	let test = 'Hello world';
	let popsicle = JsonTree.stringify(test);
	let thawed = JsonTree.parse(popsicle);
	expect(thawed).toBe(test);

	test = { a: [] };
	test.a.push(test);
	popsicle = JsonTree.stringify(test);
	thawed = JsonTree.parse(popsicle);
	expect(thawed.a[0]).toBe(thawed);
})

test("Json2Tree should be able to serialize then deserialize a circular referenced object hierarchy", function () {
	let Alice = {
		age: 30,
		favouriteFood: 'Apple'
	}
	let Fred = {
		age: 35,
		favouriteFood: 'Banana'
	}
	let Maggie = {
		age: 70,
		favouriteFood: 'Oatmeal'
	}
	let Hugh = {
		age: 68,
		favouriteFood: 'Icecream'
	}
	Alice.self = Alice;

	Alice.relations = {
		siblings: [Fred],
		mother: Maggie,
		father: Hugh
	}
	Fred.relations = {
		siblings: [Alice],
		mother: Maggie,
		father: Hugh
	}
	Maggie.relations = {
		children: [Alice, Fred],
		spouse: Hugh
	}
	Hugh.relations = {
		children: [Alice, Fred],
		spouse: Maggie
	}

	let family = [Alice, Fred, Maggie, Hugh];

	let popsicle = JsonTree.stringify(family);
	let result = JsonTree.parse(popsicle);
	let Alice2 = result[0],
		Fred2 = result[1],
		Maggie2 = result[2],
		Hugh2 = result[3];

	function expectPerson(a, b) {
		expect(a.age).toBe(b.age);
		expect(a.favouriteFood).toBe(b.favouriteFood);
	}
	expectPerson(Alice2, Alice);
	expect(Alice2.self).toBe(Alice2);
	expectPerson(Fred2, Fred);
	expectPerson(Maggie2, Maggie);
	expectPerson(Hugh2, Hugh);

	expect(Alice2.relations).toMatchObject({
		siblings: [Fred2],
		mother: Maggie2,
		father: Hugh2
	})
	expect(Fred2.relations).toMatchObject({
		siblings: [Alice2],
		mother: Maggie2,
		father: Hugh2
	})
	expect(Maggie2.relations).toMatchObject({
		children: [Alice2, Fred2],
		spouse: Hugh2
	})
	expect(Hugh2.relations).toMatchObject({
		children: [Alice2, Fred2],
		spouse: Maggie2
	})
})

test('Json2Tree should be able to handle Dates', () => {
	let test = {
		dateOfBirth: new Date(1972, 3, 30)
	}

	let popsicle = JsonTree.stringify(test);
	let test2 = JsonTree.parse(popsicle);

	expect(test2.dateOfBirth.constructor).toBe(Date);
	expect(test2.dateOfBirth.toString()).toBe(test.dateOfBirth.toString());
})

class Person {
	constructor(name, dateOfBirth) {
		this.name = name;
		this.dateOfBirth = dateOfBirth;
	}

	sayHello() {
		return `Hello ${this.name}, your birthday is ${this.dateOfBirth}`;
	}
}

JsonTreeTranslators.register({
	ctr: Person,
	name: 'A Person',
	fatten: (o, context) => {
		if (context != null) {
			return context.test;
		}
		return new Person(o.name, o.dateOfBirth);
	}
});

test('Json2Tree should be able to handle custom Types', () => {
	let test = new Person('Fred', new Date(2020, 0, 1));

	let popsicle = JsonTree.stringify(test);
	let test2 = JsonTree.parse(popsicle);

	expect(test2.constructor).toBe(Person);
	expect(test2.sayHello()).toBe(test.sayHello());
})

test('Json2Tree should pass context to custom Types', () => {
	let test = new Person('Fred', new Date(2020, 0, 1));

	let context = { test }
	let popsicle = JsonTree.stringify(test, context);
	let testWithNoContext = JsonTree.parse(popsicle);
	let testWithContext = JsonTree.parse(popsicle, context);

	expect(testWithNoContext.constructor).toBe(Person);
	expect(testWithNoContext.constructor).toBe(Person);
	expect(testWithNoContext).not.toBe(test);
	expect(testWithContext).toBe(test);
})

class SimpleFlattenTest {

	constructor(doNotStoreThis) {
		this._underlyingData = null;
		this.doNotStoreThis = doNotStoreThis;
	}

	setUnderlyingData(data) {
		this._underlyingData = data;
	}

	getUnderlyingData() {
		return this._underlyingData;
	}

	static registerJsonTree() {
		JsonTreeTranslators.register({
			ctr: SimpleFlattenTest,
			flatten(o) {
				return o._underlyingData;
			},
			fatten(o) {
				let result = new SimpleFlattenTest(undefined);
				result.setUnderlyingData(o);
				return result;
			}
		})
	}
}

SimpleFlattenTest.registerJsonTree();

test('Json2Tree supports simple flattening', () => {
	let test = new SimpleFlattenTest('do not store this');
	test.setUnderlyingData('some important data');

	let popsicle = JsonTree.stringify(test);
	let test2 = JsonTree.parse(popsicle);

	expect(test2).not.toBe(test);
	expect(test2.doNotStoreThis).toBeUndefined();
	expect(test2.getUnderlyingData()).toBe(test.getUnderlyingData());
})

test('Json2Tree supports flattening with externals', () => {
	let extern1 = { a: 123 };
	let extern2 = { b: 456 };

	let test = {
		name: 'Hello',
		extern1: extern1,
		extern2: extern2
	}
	let popsicle = JsonTree.stringify(test);
	let test2 = JsonTree.parse(popsicle);

	expect(test2).not.toBe(test);
	expect(test2.name).toBe(test.name);
	expect(test2.extern1).not.toBe(extern1);
	expect(test2.extern2).not.toBe(extern2);

	// Now with externs
	popsicle = JsonTree.stringify(test, undefined, [extern1, extern2]);
	test2 = JsonTree.parse(popsicle, undefined, [extern1, extern2]);

	expect(test2).not.toBe(test);
	expect(test2.name).toBe(test.name);
	expect(test2.extern1).toBe(extern1);
	expect(test2.extern2).toBe(extern2);
})

test('Json2Tree instance supports custom Object flattening', () => {
	let jtr = new JsonTreeTranslatorRegistry();
	jtr.register({
		ctr: Object,
		flatten: o => {
			let result = Object.assign({}, o);
			delete result.$$hashKey;
			return result;
		}
	})
	let jt = new JsonTree(jtr);

	let test = {
		a: '1',
		$$hashKey: 'Delete this'
	}
	let popsicle = jt.stringify(test);
	let test2 = jt.parse(popsicle);

	expect(test2.a).toBe(test.a);
	expect(test2.$$hashKey).toBeUndefined();
});
