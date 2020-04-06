# JsonTree - a circular reference aware and customizable Javscript  serializer/deserializer

Note, this package is similar to the popular 'flatted' (and CircularJSON) package but handles more scenarios, 'flatted' is very likely to be faster (untested)

## Installation

```bash
npm install @stevef51/json-tree
```

## Usage
```typescript
import { JsonTree } from '@stevef51/json-tree';

expect(JsonTree.parse(JsonTree.stringify('Hello world'))).toBe('Hello world');
```

## Similarities to flatted :-

- Serializes to and from a string in same fashion as JSON.stringify/parse
- Able to serialize/deserialize simple primitives, arrays, objects and importantly handles circular references
- Flattens a hierarchy into an easy to interpret array with references to other elements

## Key differences to flatted :-

- Objects create with {} and Objects created with _Object.create(null)_ are handled (ie correct prototype can be recreated)
- Able to register "custom type translators" which handle classes 
- Everything is keyed into the root array including primitives which allows for primitive compression - eg a Number is gauranteed to appear once in the root array no matter how many times it is used in the object hierarchy
- Optionally, Object property names can be keyed into the root array for better "compression" of large trees (single objects will likely be bigger due to keying overhead)
- Able to handle "externs", objects which are not to be serialized but can be "hooked" back up during deserialization

### Examples

```javascript
JsonTree.stringify('Hello world')
//['Hello world']
```
```javascript
JsonTree.stringify(123)
//[123]
```
```javascript
JsonTree.stringify(['Hello world', 123])
//[[[1,2]],'Hello world',123]
```
```javascript
JsonTree.stringify([123,123])
//[[[1,1]],123]
```
```javascript
var fred = { name: 'Fred', age: 36 }

JsonTree.stringify(fred);
//[[1,2],"Object",{"name":3,"age":4},"Fred",36]


var betty = { name: 'Betty', age: 36 }
betty.brother = fred;
fred.sister = betty;

JsonTree.stringify([fred, betty])
//[[[1,6]],[2,3],"Object",{"name":4,"age":5,"sister":6},"Fred",36,[2,7],{"name":8,"age":5,"brother":1},"Betty"]
```

To handle custom types (classes), you register your type with JsonTree :-

```javascript
class Person {
	constructor(name, age) {
		this.name = name;
		this.age = age;
	}
}
JsonTreeTranslators.register({
	ctr: Person
})
```
```javascript
JsonTree.stringify(new Person("Fred", 36))
//[[1,2],"Person",{"name":3,"age":4},"Fred",36]
```

To avoid possible name clashes, use a name override when registering

```javascript
JsonTreeTranslators.register({
	ctr: Person,
	name: 'My Person'
})
```

```javascript
JsonTree.stringify(new Person("Fred", 36))
//[[1,2],"My Person",{"name":3,"age":4},"Fred",36]
```

To handle more complex types that don't necessarily have public properties that you want to iterate and serialize you provide your own _flatten_ and _fatten_ methods, for example to handle a Javascript Moment along with possible timezone (eg moment-timezone), simply use the following registration

```javascript
JsonTreeTranslators.register({
	ctr: moment().constructor,		// Required since access to the actual constructor is hidden by anonymous functions
	name: 'Moment',
	flatten(o) {
		return {
			dt: o.format(),
			tz: o.tz()
		}
	},
	fatten(o, fatten, store) {
		// Note, o is an object with the same properties are returned from 'flatten', however its values need 'fattening' to be used
		var m = moment(fatten(o.dt));
		if (o.tz != null) {
			m = m.tz(fatten(o.tz));
		}
		return store(m);			// You must 'store' the result to allow JsonTree circular referencing to work
	}
})
```

## The _flatten_ method
This is quite simple, you return an object/primitive/array of whatever you need to properly serialize your object.  

In the Moment example above we return enough information to fully restore the Moment in the fatten method

## The _fatten_ method
A little more complex due to how deserialization must handle possible circular references, your _fatten_ method is passed an object to fatten, a funtion _fatten_ which will fatten other objects and a _store_ method which you must call as early as possible to register your fattened object to support circular reference.  
The default Object _fatten_ method is essentially as follows, note that it calls _store_ right away before fattening the objects properties :-

```typescript
	fatten(o: any, fatten: (o: any) => any, store: (o: any) => any) {
		let fatObj = store({});			// Create the Object and store it right away
		let hasOwnProperty = Object.hasOwnProperty.bind(o);
		// Populate the Objects properties
		for (let p in o) {
			if (hasOwnProperty(p)) {
				fatObj[p] = fatten(o[p]);	// Fatten properties
			}
		}
		return fatObj;			// Return the fully fattened object
	}
```

If your objects have no possibility of circular references then calling _store_ at the end will work fine (like the Moment example)

### Example of custom fatten
```typescript
import { JsonTree, JsonTreeTranslators, Convert } from 'json-tree';

class Person {
	public brother?: Person;
	public sister?: Person;
	constructor(public name: string, public age: number) {
	}
}

let fred = new Person('Fred', 36);
let betty = new Person('Betty', 32);
fred.sister = betty;
betty.brother = fred;

JsonTreeTranslators.register({
	ctr: Person,
	fatten: (o: any, fatten: Convert, store: Convert) {
		// name & age are constructor required and cannot circular reference
		// call _store_ with our new Person right away
		let p = store(new Person(fatten(o.name), fatten(o.age)));
		
		// set _brother_ and _sister_ which will eventually use the object
		// already _stored_ to fulfill the circular reference
		o.brother && p.brother = fatten(o.brother);
		o.sister && p.sister = fatten(o.sister);
		return p;
	}
})

JsonTree.stringify([fred,betty]);
//[[[1,6]],[2,3],"Person",{"name":4,"age":5,"sister":9},"Fred",36,[2,11],{"name":8,"age":5,"brother":1},"Betty"]
```

Note, there is no need for a custom _flatten_ since all public properties are automatically handled by the default _flatten_ method

## Externs
In some cases you may have certain objects which you do not want to be serialized, this is handled by a custom JsonTree instance and setting its _externs_ property to the list of objects you dont want serialized

Using the Person class defined earlier, if we did not want Fred to be serialized ..
```typescript
let fred = new Person("Fred",36);

let jt = new JsonTree();
jt.externs = [fred];

let externFredAndBetty = jt.stringify([fred,betty])
//[[[-1,1]],[2,3],"Person",{"name":4,"age":5,"brother":-1},"Betty",32]
```

and to deserialise the original structure with a prepared Fred object

```typescript
let fred = new Person("Fred",36);
let jt = new JsonTree();
jt.externs = [fred];

let [fred2,betty] = jt.parse(externFredAndBetty);
expect(fred2).toBe(fred);
expect(betty.brother).toBe(fred);
```

Provided the array of externs has the same order and length in both the _stringify_ and _parse_ calls then your tree will work perfectly

### Flattening Object property names
By default Object property names are not flattened, but you may get better "compression" by turning _flattenPropertyNames_ on. 
With the option turned off (default) Object property names are embedded into each keyed object, eg

```javascript
var fred = { name: 'Fred', age: 36 }

JsonTree.stringify(fred);
//[[1,2],"Object",{"name":3,"age":4},"Fred",36]					// 45 characters
```

with the option turned on, object property names are also flattened into the root ..

```javascript
var fred = { name: 'Fred', age: 36 }

JsonTree.stringify(fred, {
	flattenPropertyNames: true
});
//[[1,2],"Object",{"3":4,"5":6},"name","Fred","age",36]			// 53 characters
```

in the above simple example, the keying overhead actually makes the resulting string longer (53 compared to 45), but with another couple objects of same type being flattened ..

```javascript
var fred = { name: 'Fred', age: 36 }
var betty = { name: 'Betty', age: 32 }
var wilma = { name: 'Wilma', age: 39 }

JsonTree.stringify([fred, betty, wilma]);
//[[[1,6,10]],[2,3],"Object",{"name":4,"age":5},"Fred",36,[2,7],{"name":8,"age":9},"Betty",32,[2,11],{"name":12,"age":12},"Wilma",39]		// 131 characters
```

And the _flattenPropertyNames_ option turned on ..

```javascript
var fred = { name: 'Fred', age: 36 }
var betty = { name: 'Betty', age: 32 }
var wilma = { name: 'Wilma', age: 39 }

JsonTree.stringify([fred, betty, wilma], {
	flattenPropertyNames: true
});
//[[[1,8,10]],[2,3],"Object",{"4":5,"6":7},"name","Fred","age",36,[2,9],{"4":8,"6":9},"Betty",32,[2,11],{"4":12,"6":13},"Wilma",39]			// 129 characters
```

the resulting string is 2 characters shorter, the more similar objects flattened and the compression will get better - the obvious cost to this feature is the resulting string is far more difficult to decode for us mere humans

You should also note, that an object tree stringified with this option turned on should _always_ be parsed with the option turned on aswell ..

```javascript
var [ fred2, betty2, wilma2 ] = JsonTree.parse('[[[1,8,10]],[2,3],"Object",{"4":5,"6":7},"name","Fred","age",36,[2,9],{"4":8,"6":9},"Betty",32,[2,11],{"4":12,"6":13},"Wilma",39]', {
	flattenPropertyNames: true
})
```

