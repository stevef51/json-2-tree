import { JsonTree, ITree2Json, IJson2Tree } from "../json-tree"

test("Json2Tree should be able to serialize then deserialize a circular referenced object hierarchy", function () {
	let Alice: any = {
		age: 30,
		favouriteFood: 'Apple'
	}
	let Fred: any = {
		age: 35,
		favouriteFood: 'Banana'
	}
	let Maggie: any = {
		age: 70,
		favouriteFood: 'Oatmeal'
	}
	let Hugh: any = {
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
	let [Alice2, Fred2, Maggie2, Hugh2] = JsonTree.parse(popsicle);

	function expectPerson(a: any, b: any) {
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
	expect((test2.dateOfBirth as Date).toString()).toBe(test.dateOfBirth.toString());
})

class Person {
	constructor(public name: string, public dateOfBirth: Date) {

	}

	sayHello(): string {
		return `Hello ${this.name}, your birthday is ${this.dateOfBirth}`;
	}
}

JsonTree.registerType({
	ctr: Person,
	nameOverride: 'A Person',
	fatten: (o: any, t2j: IJson2Tree) => {
		if (t2j.context != null) {
			return t2j.context.test;
		}
		let name = t2j.fatten(o.name);
		let dateOfBirth = t2j.fatten(o.dateOfBirth);
		return new Person(name, dateOfBirth);
	}
});

test('Json2Tree should be able to handle custom Types', () => {
	let test = new Person('Fred', new Date(2020, 0, 1));

	let popsicle = JsonTree.stringify(test);
	let test2 = JsonTree.parse(popsicle);

	expect(test2.constructor).toBe(Person);
	expect((test2 as Person).sayHello()).toBe(test.sayHello());
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
